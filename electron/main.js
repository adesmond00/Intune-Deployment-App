// Electron main process file
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const Store = require('electron-store');

// Initialize configuration store
const store = new Store({
  encryptionKey: 'intune-deployment-app-secure-storage',
  schema: {
    credentials: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        clientSecret: { type: 'string' },
        tenantId: { type: 'string' }
      }
    },
    isLoggedIn: { type: 'boolean' }
  }
});

// Python API process reference
let pythonProcess = null;
let mainWindow = null;
let apiStarted = false;
let apiPort = 8000;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'icon.ico')
  });

  // If in development, load from Next.js dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built Next.js export
    mainWindow.loadFile(path.join(__dirname, '../front-end/out/index.html'));
  }

  // Check if logged in and show login screen if not
  const isLoggedIn = store.get('isLoggedIn', false);
  if (!isLoggedIn) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('show-login');
    });
  } else {
    startPythonApi();
  }
}

async function startPythonApi() {
  if (apiStarted) return;

  const credentials = store.get('credentials');
  if (!credentials) {
    console.error('No credentials found. Cannot start API.');
    return;
  }

  // Set environment variables for the Python process
  const env = {
    ...process.env,
    GRAPH_CLIENT_ID: credentials.clientId,
    GRAPH_CLIENT_SECRET: credentials.clientSecret,
    GRAPH_TENANT_ID: credentials.tenantId
  };

  // Determine the Python executable path based on environment
  let pythonPath;
  const resourcesPath = process.resourcesPath;
  
  if (app.isPackaged) {
    // In packaged app, use bundled Python
    pythonPath = path.join(resourcesPath, 'python', 'python.exe');
  } else {
    // In development, use system Python
    pythonPath = 'python';
  }

  // Determine the API script path
  let apiScript;
  if (app.isPackaged) {
    apiScript = path.join(resourcesPath, 'app', 'api', 'api.py');
  } else {
    apiScript = path.join(__dirname, '../api/api.py');
  }

  // Start the Python API
  try {
    console.log(`Starting Python API with: ${pythonPath} ${apiScript}`);
    pythonProcess = spawn(pythonPath, [apiScript], { 
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Listen for API output
    pythonProcess.stdout.on('data', (data) => {
      console.log(`API stdout: ${data}`);
      if (data.toString().includes('Application startup complete')) {
        apiStarted = true;
        mainWindow.webContents.send('api-ready');
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`API stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`API process exited with code ${code}`);
      apiStarted = false;
      if (code !== 0 && mainWindow) {
        mainWindow.webContents.send('api-error', `API process exited with code ${code}`);
      }
    });

    // Set a timeout to check if API started
    setTimeout(() => {
      if (!apiStarted && mainWindow) {
        mainWindow.webContents.send('api-error', 'API failed to start within expected time');
      }
    }, 10000);
  } catch (error) {
    console.error('Failed to start Python API:', error);
    if (mainWindow) {
      mainWindow.webContents.send('api-error', `Failed to start API: ${error.message}`);
    }
  }
}

// Handle login from renderer
ipcMain.handle('login', async (event, credentials) => {
  try {
    // Validate credentials
    if (!credentials.clientId || !credentials.clientSecret || !credentials.tenantId) {
      return { success: false, message: 'All fields are required' };
    }

    // Store credentials securely
    store.set('credentials', credentials);
    store.set('isLoggedIn', true);

    // Start the Python API
    await startPythonApi();
    
    return { success: true };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: error.message };
  }
});

// Handle logout
ipcMain.handle('logout', async () => {
  store.delete('credentials');
  store.set('isLoggedIn', false);
  
  // Kill the Python API process if running
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
    apiStarted = false;
  }
  
  // Reload app to show login screen
  mainWindow.webContents.send('show-login');
  return { success: true };
});

// Standard Electron app lifecycle events
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Clean up Python process on exit
app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});
