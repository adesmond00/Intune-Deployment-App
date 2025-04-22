// Electron main process file
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
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
let nextProcess = null;
let nextJsPort = 3000; // Default port, will be updated if it changes

// Start the Next.js development server
function startNextDevServer() {
  console.log('Starting Next.js development server...');
  
  // Check if we're in development mode
  if (process.env.NODE_ENV !== 'development') {
    console.log('Not in development mode, skipping Next.js server start');
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    // Define the path to the Next.js directory
    const nextJsPath = path.join(__dirname, '..', 'front-end');
    
    // Start Next.js dev server
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    nextProcess = spawn(npmCmd, ['run', 'dev'], { 
      cwd: nextJsPath,
      shell: true,
      stdio: 'pipe'
    });
    
    console.log('Next.js dev server process started');
    
    // Listen for stdout to determine when server is ready
    let serverOutput = '';
    let serverStarted = false;
    
    nextProcess.stdout.on('data', (data) => {
      const output = data.toString();
      serverOutput += output;
      console.log(`Next.js stdout: ${output}`);
      
      // Check for port in the server output
      const portMatch = output.match(/http:\/\/localhost:(\d+)/);
      if (portMatch && portMatch[1]) {
        nextJsPort = parseInt(portMatch[1], 10);
        console.log(`Detected Next.js running on port: ${nextJsPort}`);
      }
      
      // Check if server is ready
      if (output.includes('ready started server') || 
          output.includes('Local:') ||
          output.includes('started server on') ||
          output.includes('localhost:')) {
        console.log('Next.js server detected as ready');
        serverStarted = true;
        resolve();
      }
    });
    
    nextProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`Next.js stderr: ${output}`);
      
      // Check for port change message in stderr
      const portChangeMatch = output.match(/Port (\d+) is in use, trying (\d+) instead/);
      if (portChangeMatch && portChangeMatch[2]) {
        nextJsPort = parseInt(portChangeMatch[2], 10);
        console.log(`Next.js port changed to: ${nextJsPort}`);
      }
    });
    
    // Handle errors
    nextProcess.on('error', (err) => {
      console.error('Failed to start Next.js server:', err);
      reject(err);
    });
    
    // Set timeout to resolve anyway if taking too long but seems to be running
    setTimeout(() => {
      if (!serverStarted && nextProcess && !nextProcess.killed) {
        console.log('Next.js server taking longer than expected, but proceeding anyway');
        resolve();
      } else if (!serverStarted) {
        reject(new Error('Failed to start Next.js server within timeout period'));
      }
    }, 10000);
  });
}

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
    // Wait for the server to be ready before loading the URL
    console.log('Waiting for Next.js server to be ready...');
    
    // Poll until the server is ready
    let attempts = 0;
    const maxAttempts = 30;
    const pollInterval = 1000; // 1 second
    
    function pollServer() {
      console.log(`Polling Next.js server, attempt ${attempts + 1}/${maxAttempts}`);
      
      // Use the detected port
      const nextUrl = `http://localhost:${nextJsPort}`;
      console.log(`Attempting to connect to: ${nextUrl}`);
      
      // Try a simple HTTP request to check if server is responding
      require('http').get(nextUrl, (response) => {
        console.log(`Next.js server responded with status: ${response.statusCode}`);
        if (response.statusCode === 200) {
          console.log('Next.js server is ready, loading URL');
          
          // Load the Next.js app
          mainWindow.loadURL(nextUrl);
          
          // Open DevTools in development mode
          mainWindow.webContents.openDevTools();
          
          // Set a timeout to check if login screen appears within a reasonable time
          let loginScreenDetected = false;
          
          // Check login status once page is loaded
          mainWindow.webContents.on('did-finish-load', () => {
            handlePageLoaded();
            
            // Set a timeout to check if the login screen is properly shown
            setTimeout(() => {
              if (!loginScreenDetected) {
                console.log('Login screen not detected within expected time, loading fallback');
                // If login hasn't been detected, fall back to the static HTML login
                mainWindow.loadFile(path.join(__dirname, 'fallback.html'));
              }
            }, 5000);
          });
          
          // Listen for console logs from the renderer
          mainWindow.webContents.on('console-message', (event, level, message) => {
            console.log(`Renderer Console: ${message}`);
            
            // Check if login screen is shown
            if (message.includes('Rendering login screen')) {
              loginScreenDetected = true;
            }
          });
        } else {
          retryOrFail();
        }
      }).on('error', (err) => {
        console.error(`Next.js server poll failed: ${err.message}`);
        retryOrFail();
      });
      
      function retryOrFail() {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(pollServer, pollInterval);
        } else {
          console.error('Failed to connect to Next.js server after maximum attempts');
          // Load the fallback HTML login page
          mainWindow.loadFile(path.join(__dirname, 'fallback.html'));
        }
      }
    }
    
    pollServer();
  } else {
    // In production, load from built Next.js export
    mainWindow.loadFile(path.join(__dirname, '../front-end/out/index.html'));
    mainWindow.webContents.on('did-finish-load', () => {
      handlePageLoaded();
    });
  }
  
  // If we're showing a fallback login, we don't need the handlePageLoaded function
  // to be called, as the fallback login will call login directly
  mainWindow.webContents.on('did-navigate', (event, url) => {
    if (url.includes('fallback.html')) {
      console.log('Showing fallback login screen');
    }
  });
}

function handlePageLoaded() {
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
app.whenReady().then(async () => {
  // In development mode, start Next.js server first
  if (process.env.NODE_ENV === 'development') {
    try {
      await startNextDevServer();
    } catch (error) {
      console.error('Failed to start Next.js server:', error);
      // Continue anyway, the window will display an error message
    }
  }
  
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Clean up processes on exit
app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  
  if (nextProcess) {
    nextProcess.kill();
  }
});
