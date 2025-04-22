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
    // Open DevTools in development mode
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built Next.js export
    mainWindow.loadFile(path.join(__dirname, '../front-end/out/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    // Check if logged in
    const isLoggedIn = store.get('isLoggedIn', false);
    
    console.log('App loaded, isLoggedIn:', isLoggedIn);
    
    if (!isLoggedIn) {
      console.log('Sending show-login event to renderer');
      // Force show login by sending event to renderer
      mainWindow.webContents.send('show-login');
    } else {
      // If logged in, start API with stored credentials
      console.log('Starting API with stored credentials');
      startPythonApi();
    }
  });
}

async function startPythonApi() {
  if (apiStarted) {
    console.log('API already started');
    return;
  }

  const credentials = store.get('credentials');
  if (!credentials) {
    console.error('No credentials found. Cannot start API.');
    if (mainWindow) {
      mainWindow.webContents.send('api-error', 'No credentials found. Please log in again.');
      mainWindow.webContents.send('show-login');
    }
    return;
  }

  // Set environment variables for the Python process
  const env = {
    ...process.env,
    GRAPH_CLIENT_ID: credentials.clientId,
    GRAPH_CLIENT_SECRET: credentials.clientSecret,
    GRAPH_TENANT_ID: credentials.tenantId
  };

  console.log('Starting API with environment:', {
    GRAPH_CLIENT_ID: credentials.clientId ? '[SET]' : '[NOT SET]',
    GRAPH_CLIENT_SECRET: credentials.clientSecret ? '[SET]' : '[NOT SET]',
    GRAPH_TENANT_ID: credentials.tenantId ? '[SET]' : '[NOT SET]'
  });

  // Determine the Python executable path based on environment
  let pythonPath;
  
  if (app.isPackaged) {
    // In packaged app, use bundled Python
    pythonPath = path.join(process.resourcesPath, 'python', 'python.exe');
  } else {
    // In development, use system Python
    pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  }

  // Determine the API script path
  let apiScript;
  if (app.isPackaged) {
    apiScript = path.join(process.resourcesPath, 'app', 'api', 'api.py');
  } else {
    apiScript = path.join(__dirname, '../api/api.py');
  }

  console.log(`Starting Python API with: ${pythonPath} ${apiScript}`);

  // Start the Python API
  try {
    pythonProcess = spawn(pythonPath, [apiScript], { 
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Listen for API output
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`API stdout: ${output}`);
      
      // Check for API startup message
      if (output.includes('Application startup complete') || output.includes('Uvicorn running on')) {
        apiStarted = true;
        console.log('API started successfully');
        if (mainWindow) {
          mainWindow.webContents.send('api-ready', apiPort);
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`API stderr: ${data}`);
      if (mainWindow) {
        mainWindow.webContents.send('api-log', `Error: ${data}`);
      }
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
    console.log('Login request received with credentials:', {
      clientId: credentials.clientId ? '[PROVIDED]' : '[MISSING]',
      clientSecret: credentials.clientSecret ? '[PROVIDED]' : '[MISSING]',
      tenantId: credentials.tenantId ? '[PROVIDED]' : '[MISSING]'
    });

    // Validate credentials
    if (!credentials.clientId || !credentials.clientSecret || !credentials.tenantId) {
      return { success: false, message: 'All fields are required' };
    }

    // Store credentials securely
    store.set('credentials', credentials);
    store.set('isLoggedIn', true);

    console.log('Credentials stored, starting Python API');
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
  if (mainWindow) {
    mainWindow.webContents.send('show-login');
  }
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
