// Electron main process file
const { app, BrowserWindow, ipcMain, net } = require('electron');
const path = require('path');
// -------------------  CONFIGURABLE DEFAULTS  -------------------
// Default port we want Next.js to start on in development.
// Change this single value if you want to bump the base port later.
const DEFAULT_NEXT_PORT = 3030;
// ----------------------------------------------------------------
const { spawn, exec, execSync } = require('child_process');
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

// Track if the initial page load has completed
// This prevents multiple 'show-login' events from being sent
let initialLoadComplete = false;

// Python API process reference
let pythonProcess = null;
let mainWindow = null;
let apiStarted = false;
let apiPort = 8000; // Default port, will be dynamically assigned
let nextProcess = null;
let nextJsPort = DEFAULT_NEXT_PORT; // Default port, will be updated if Next.js switches

// Start the Next.js development server
function startNextDevServer() {
  return new Promise((resolve, reject) => {
    if (process.env.NODE_ENV !== 'development') {
      // In production, just resolve immediately
      resolve();
      return;
    }

    console.log('Starting Next.js development server...');

    // Try to start with a specific base port
    const initialPort = DEFAULT_NEXT_PORT; // Start from a different port than the stock Next.js 3000
    nextJsPort = initialPort;  // ensure global port matches the first attempt

    // Build the command with the specified port
    let nextCommand = 'npm run dev';
    if (process.platform === 'win32') {
      // Add port specification - start higher to avoid common conflicts
      nextCommand = `set PORT=${initialPort} && npm run dev`;
    } else {
      nextCommand = `PORT=${initialPort} npm run dev`;
    }

    nextProcess = spawn(nextCommand, {
      shell: true,
      cwd: path.join(__dirname, '../front-end'),
      env: process.env
    });

    console.log('Next.js dev server process started');

    // Track whether we've resolved the promise already
    let hasResolved = false;

    // Function to resolve the promise once
    const resolveOnce = () => {
      if (!hasResolved) {
        hasResolved = true;
        clearTimeout(timeoutId); // Clear the timeout when resolved
        nextJsReady = true;
        console.log('Next.js server assumed ready on port:', nextJsPort);
        resolve();
      }
    };

    nextProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Next.js stdout: ${output}`);

      // Look for "ready" messages from Next.js
      if (output.includes('ready') || output.includes('Ready')) {
        nextJsReady = true;
        console.log('Next.js server detected as ready');
        resolveOnce();
      }

      // Check for the actual port Next.js is running on
      const portMatch = output.match(/http:\/\/localhost:(\d+)/);
      if (portMatch && portMatch[1]) {
        const detectedPort = parseInt(portMatch[1], 10);
        console.log(`Next.js port changed to: ${detectedPort}`);
        nextJsPort = detectedPort;
        store.set('nextJsPort', detectedPort);
      }
    });

    nextProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`Next.js stderr: ${output}`);

      // Also check stderr for port information as Next.js logs port conflicts here
      const portMatch = output.match(/Port (\d+) is in use/);
      if (portMatch && portMatch[1]) {
        console.log(`Port ${portMatch[1]} is in use, Next.js will try another port`);
      }

      // Check for fatal errors
      if (output.includes('Failed to start server') ||
          output.includes('Error: listen EADDRINUSE')) {
        console.error('Next.js server failed to start due to port conflicts');
      }
    });

    nextProcess.on('close', (code) => {
      console.log(`Next.js process exited with code ${code}`);
      nextJsReady = false;
      nextProcess = null;

      // Only reject if we haven't resolved yet
      if (code !== 0 && !hasResolved) {
        console.log('Next.js server fail');
        reject(new Error(`Next.js process exited with code ${code}`));
      }
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      // Use a polling approach to check server status
      console.log('Waiting for Next.js server to be ready...');

      // Try to poll the server to see if it's up
      let pollAttempts = 0;
      const maxPollAttempts = 30;

      function pollNextJsServer() {
        if (hasResolved) return; // Skip if already resolved

        pollAttempts++;
        console.log(`Polling Next.js server, attempt ${pollAttempts}/${maxPollAttempts}`);

        if (nextJsPort) {
          const url = `http://localhost:${nextJsPort}`;
          console.log(`Attempting to connect to: ${url}`);

          // Use http request to check if server is up
          const http = require('http');
          http.get(url, (res) => {
            console.log(`Next.js server responded with status: ${res.statusCode}`);
            if (res.statusCode === 200) {
              console.log('Next.js server is ready, loading URL');
              resolveOnce();
            } else if (pollAttempts < maxPollAttempts) {
              setTimeout(pollNextJsServer, 1000);
            } else {
              if (!hasResolved) {
                console.error('Next.js server polling timed out');
                reject(new Error('Failed to connect to Next.js server after multiple attempts'));
              }
            }
          }).on('error', (err) => {
            console.log(`Connection error: ${err.message}`);
            if (pollAttempts < maxPollAttempts) {
              setTimeout(pollNextJsServer, 1000);
            } else {
              if (!hasResolved) {
                console.error('Next.js server polling timed out after connection errors');
                reject(new Error('Failed to connect to Next.js server after multiple attempts'));
              }
            }
          });
        } else if (nextJsReady) {
          // If we've seen ready message but don't have a port yet
          resolveOnce();
        } else if (pollAttempts < maxPollAttempts) {
          setTimeout(pollNextJsServer, 1000);
        } else {
          if (!hasResolved) {
            console.error('Next.js server polling timed out, no port detected');
            reject(new Error('Failed to detect Next.js server port'));
          }
        }
      }

      // Start polling
      pollNextJsServer();

    }, 5000); // Wait 5 seconds before starting to poll
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
          
          // Event handler for when the web contents are fully loaded
          mainWindow.webContents.on('did-finish-load', async () => {
            console.log('Main window finished loading');
            
            // Check login state
            const isLoggedIn = store.get('isLoggedIn') || false;
            console.log('App loaded, isLoggedIn:', isLoggedIn);
            
            // Always enforce fresh login on app start for better reliability
            console.log('Enforcing fresh login for new session');
            
            // Use a short timeout to make sure the renderer is ready to receive IPC messages
            setTimeout(() => {
              console.log('Main page loaded, login screen will be shown via IPC');
              console.log('Sending show-login event to renderer');
              mainWindow.webContents.send('show-login');
              
              // Send a second show-login event after a slight delay if needed
              // This helps ensure the event is received properly
              setTimeout(() => {
                console.log('Sending backup show-login event to renderer');
                mainWindow.webContents.send('show-login');
              }, 1000);
            }, 500);
            
            initialLoadComplete = true;
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
}

function handlePageLoaded() {
  // We get isLoggedIn for logging purposes, but we'll always show login
  const isLoggedIn = store.get('isLoggedIn', false);
  
  console.log('App loaded, isLoggedIn:', isLoggedIn);
  
  // Always show login screen for fresh session approach
  console.log('Enforcing fresh login for new session');
  
  // Only send 'show-login' on the first load
  if (!initialLoadComplete) {
    // Force show login by sending event to renderer
    if (mainWindow && !mainWindow.isDestroyed()) { // Check if window exists
        mainWindow.webContents.send('show-login');
    }
    initialLoadComplete = true; // Set flag to prevent future 'show-login' events
  }
  
  return false; // Always return false to indicate a fresh session
}

// Add IPC handler to get values from the store
ipcMain.handle('get-store-value', (event, key) => {
  console.log(`IPC: Received get-store-value request for key: ${key}`); // Log request
  try {
    const value = store.get(key);
    console.log(`IPC: Returning value for ${key}: ${value}`); // Log value
    return value;
  } catch (error) {
    console.error(`IPC: Error getting store value for key ${key}:`, error);
    return undefined; // Or handle error appropriately
  }
});

// Function to find an available port
async function findAvailablePort(startPort, endPort = startPort + 100) {
  // Keep track of ports we've already tried and failed with
  const failedPorts = new Set();
  
  for (let port = startPort; port <= endPort; port++) {
    // Skip ports we already know have failed
    if (failedPorts.has(port)) {
      continue;
    }
    
    try {
      // More robust check for port availability
      const isAvailable = await new Promise((resolve) => {
        const testServer = require('net').createServer();
        
        testServer.once('error', (err) => {
          // Port is in use or there's some other error
          testServer.close();
          resolve(false);
        });
        
        testServer.once('listening', () => {
          // Port is available, close the server
          testServer.close(() => resolve(true));
        });
        
        // Use a short timeout to detect if binding fails
        setTimeout(() => {
          try {
            testServer.close();
          } catch (e) {}
          resolve(false);
        }, 500);
        
        // Try to listen on the port - important to use 127.0.0.1 instead of 0.0.0.0
        // as 0.0.0.0 might give false positives
        try {
          testServer.listen(port, '127.0.0.1');
        } catch (err) {
          resolve(false);
        }
      });
      
      if (isAvailable) {
        console.log(`Found available port: ${port}`);
        return port;
      } else {
        console.log(`Port ${port} is not available, trying next port`);
        // Add to failed ports so we don't retry it
        failedPorts.add(port);
      }
    } catch (error) {
      console.error(`Error checking port ${port}:`, error);
      // Add to failed ports
      failedPorts.add(port);
    }
  }
  
  // If we exhausted all ports, increment higher
  console.warn(`No available ports found in range ${startPort}-${endPort}, trying higher range`);
  return findAvailablePort(endPort + 1, endPort + 100);
}

/**
 * Starts the Python API with the credentials from the store
 * @param {number} port - Port to start the API on
 * @returns {ChildProcess} - The Python API process
 */
function startPythonApi(port) {
  try {
    // Kill any existing Python process before starting a new one
    if (pythonProcess) {
      console.log('Killing existing Python API process');
      pythonProcess.kill();
      pythonProcess = null;
    }
    
    // Find the API path
    const apiPath = findApiPath();
    const apiDir = path.dirname(apiPath);
    
    // Get credentials from store
    const credentials = store.get('graphCredentials');
    
    if (!credentials) {
      console.error('No credentials found in store');
      if (mainWindow) {
        mainWindow.webContents.send('api-error', 'No credentials found. Please log in again.');
      }
      return null;
    }
    
    // Set up environment variables for the API
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
    
    console.log(`Starting Python API with uvicorn from directory: ${apiDir}`);
    const command = `python -m uvicorn api:app --host 0.0.0.0 --port ${port}`;
    console.log(`Starting Python API with: ${command}`);
    
    // Start the Python API
    pythonProcess = spawn('python', ['-m', 'uvicorn', 'api:app', '--host', '0.0.0.0', '--port', port.toString()], {
      cwd: apiDir,
      env: env
    });
    
    let apiStarted = false;
    let apiErrors = [];
    
    // Listen for stdout data
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`API stdout: ${output}`);
      
      // Check for API startup message
      if (output.includes('Uvicorn running') || output.includes('Application startup complete')) {
        apiStarted = true;
        console.log('API server started successfully');
        
        // Signal to the UI that the API is ready
        if (mainWindow) {
          mainWindow.webContents.send('api-ready', port);
        }
      }
      
      // Check for authentication errors
      if (output.includes('Authentication failed') || output.includes('Invalid client')) {
        console.error('API authentication failed');
        apiErrors.push('Authentication failed: Invalid credentials');
        
        if (mainWindow) {
          mainWindow.webContents.send('api-error', 'Authentication failed: Invalid client ID, client secret, or tenant ID.');
        }
      }
    });
    
    // Listen for stderr data
    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`API stderr: ${output}`);
      
      // INFO log messages are not errors
      if (output.startsWith('INFO:')) {
        // Check for startup messages in stderr (uvicorn logs to stderr)
        if (output.includes('Application startup complete') || output.includes('Uvicorn running')) {
          apiStarted = true;
          console.log('API server started successfully (from stderr logs)');
          
          // Signal to the UI that the API is ready
          if (mainWindow) {
            mainWindow.webContents.send('api-ready', port);
          }
        }
      } else if (!output.includes('WARNING:')) {
        // Only add non-warning errors to the error list
        apiErrors.push(output);
        
        // Critical errors to notify about
        if (output.includes('Error') || output.includes('Exception') || output.includes('Failed')) {
          if (mainWindow) {
            mainWindow.webContents.send('api-error', `API Error: ${output}`);
          }
        }
      }
    });
    
    // Handle process exit
    pythonProcess.on('close', (code) => {
      console.log(`Python API process exited with code ${code}`);
      
      // If the API never started successfully
      if (!apiStarted && code !== 0) {
        console.error('API failed to start properly');
        
        if (mainWindow) {
          // Send a clear error message including the errors we collected
          if (apiErrors.length > 0) {
            mainWindow.webContents.send('api-error', `API failed to start: ${apiErrors.join(', ')}`);
          } else {
            mainWindow.webContents.send('api-error', `API process exited with code ${code}`);
          }
        }
      }
      
      // Reset the Python process reference
      pythonProcess = null;
    });
    
    // Add error handler
    pythonProcess.on('error', (err) => {
      console.error('Error starting Python API:', err);
      
      if (mainWindow) {
        mainWindow.webContents.send('api-error', `Failed to start API: ${err.message}`);
      }
      
      pythonProcess = null;
    });
    
    return pythonProcess;
  } catch (error) {
    console.error('Error in startPythonApi:', error);
    
    if (mainWindow) {
      mainWindow.webContents.send('api-error', `Failed to start API: ${error.message}`);
    }
    
    return null;
  }
}

/**
 * Find the API script (api.py) in the api directory
 * @returns {string} - Path to the api.py file
 */
function findApiPath() {
  console.log('Current working directory:', process.cwd());
  console.log('App path:', app.getAppPath());
  console.log('__dirname:', __dirname);
  
  // Try these paths in order until we find the API file
  const possibleApiPaths = [
    path.join(__dirname, '..', 'api', 'api.py'),          // Development - relative to electron dir
    path.join(process.cwd(), 'api', 'api.py'),            // Development - from current working dir
    path.join(app.getAppPath(), '..', 'api', 'api.py'),   // Production - relative to app resources
    path.join(app.getAppPath(), 'api', 'api.py'),         // Alternative production path
    path.join(process.cwd(), '..', 'api', 'api.py'),      // One level up from cwd
    path.resolve('api', 'api.py')                         // Resolve from current module
  ];
  
  console.log('Possible API paths:');
  possibleApiPaths.forEach((p, i) => {
    try {
      const exists = fs.existsSync(p);
      console.log(`  ${i}: ${p} (exists: ${exists})`);
    } catch (err) {
      console.log(`  ${i}: ${p} (error checking: ${err.message})`);
    }
  });
  
  // Find the first path that exists
  for (const testPath of possibleApiPaths) {
    try {
      if (fs.existsSync(testPath)) {
        console.log('Found API path:', testPath);
        return testPath;
      }
    } catch (err) {
      // Continue to next path
    }
  }
  
  console.error('Could not locate API api.py file');
  if (mainWindow) {
    mainWindow.webContents.send('api-error', 'Could not locate the API module. Please check your installation.');
  }
  throw new Error('Could not locate API api.py file');
}

/**
 * Verifies if the provided Graph API credentials are valid
 * @param {Object} credentials - Graph API credentials (clientId, clientSecret, tenantId)
 * @returns {Promise<boolean>} - True if credentials are valid, false otherwise
 */
async function verifyCredentials(credentials) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Verifying credentials before starting the API...');
    
      // Find API path
      const apiPath = findApiPath();
      const apiDir = path.dirname(apiPath);
      
      // Set up environment variables for the auth verification
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
      
      console.log(`Starting Python API with uvicorn from directory: ${apiDir}`);
      
      // Run the API with a verify-only mode
      const verifyProcess = spawn('python', [apiPath, '--verify-only'], { 
        cwd: apiDir,
        env: env
      });
      
      let authOutput = '';
      let authError = '';
      let authSuccess = false;
      let authFailed = false;
      
      verifyProcess.stdout.on('data', (data) => {
        const output = data.toString();
        authOutput += output;
        console.log(`Verify auth stdout: ${output}`);
        
        // Check for successful authentication message
        if (output.includes('Authentication successful') || output.includes('Token acquired successfully')) {
          console.log('Credential verification successful');
          authSuccess = true;
          // Complete the verification since it was successful
          clearTimeout(verifyTimeout);
          // Kill the process since we just needed verification
          verifyProcess.kill();
          resolve(true);
        }
      });
      
      verifyProcess.stderr.on('data', (data) => {
        const output = data.toString();
        authError += output;
        console.error(`Verify auth stderr: ${output}`);
        
        // Check if this is actually a successful log message
        if (output.includes('INFO:') && output.includes('access token')) {
          console.log('Found token acquisition success message in logs');
          authSuccess = true;
          // Immediately resolve with success since this is a positive indicator
          clearTimeout(verifyTimeout);
          verifyProcess.kill();
          resolve(true);
          return;
        }
        
        // Check for authentication failure messages in stderr
        if (output.includes('Authentication failed') || 
            output.includes('Invalid client') || 
            output.includes('AADSTS')) {
          console.error('Authentication failed in verification');
          authFailed = true;
          authSuccess = false;
          clearTimeout(verifyTimeout);
          // Kill the process since we detected an error
          verifyProcess.kill();
          
          if (mainWindow) {
            mainWindow.webContents.send('api-error', 'Authentication failed: Invalid client ID, client secret, or tenant ID.');
          }
          
          resolve(false);
        }
      });
      
      verifyProcess.on('close', (code) => {
        console.log(`Verification process closed with code: ${code}`);
        
        // If we already determined success/failure, don't do anything more
        if (authSuccess) {
          console.log('Verification already succeeded, no action needed on close');
          resolve(true);
          return;
        }
        
        if (authFailed) {
          console.log('Verification already failed, no action needed on close');
          resolve(false);
          return;
        }
        
        if (code === 0) {
          console.log('Credential verification process completed successfully');
          resolve(true);
        } else if (code === null) {
          // Process was killed - check if it was due to success
          if (authSuccess || authOutput.includes('Authentication successful') || 
              authOutput.includes('Token acquired successfully')) {
            console.log('Process was killed after successful verification');
            resolve(true);
          } else {
            console.error('Verification process was killed without clear success indicator');
            
            // Check if we can determine success from the combined output
            if (authOutput.includes('Authentication successful') || 
                authError.includes('access token') ||
                (authOutput.includes('Token') && authOutput.includes('success'))) {
              console.log('Found success indicators in combined output');
              resolve(true);
            } else {
              console.error('No success indicators found in output');
              
              // Send specific error message to renderer
              if (mainWindow) {
                mainWindow.webContents.send('api-error', 
                  'Credential verification interrupted. Please try again.');
              }
              
              resolve(false);
            }
          }
        } else {
          console.error(`Credential verification failed with code ${code}`);
          console.error(`Error: ${authError}`);
          
          // Final check for success indicators in the output
          if (authOutput.includes('Authentication successful') || 
              authError.includes('access token') ||
              (authOutput.includes('Token') && authOutput.includes('success'))) {
            console.log('Found success indicators despite error code, treating as successful');
            resolve(true);
            return;
          }
          
          // Send specific error message to renderer
          if (mainWindow) {
            if (authOutput.includes('Authentication failed') || authError.includes('Authentication failed')) {
              mainWindow.webContents.send('api-error', 'Authentication failed: Invalid client ID, client secret, or tenant ID.');
            } else {
              mainWindow.webContents.send('api-error', 'Credential verification failed. Please check your credentials and try again.');
            }
          }
          
          resolve(false);
        }
      });
      
      // Set a timeout for the verification process
      const verifyTimeout = setTimeout(() => {
        if (verifyProcess) {
          console.error('Credential verification timed out');
          
          // Check if we saw success messages even though it timed out
          if (authSuccess || authOutput.includes('Authentication successful') || 
              authOutput.includes('Token acquired successfully') || 
              authError.includes('access token')) {
            console.log('Timeout occurred but success was detected in output');
            resolve(true);
            return;
          }
          
          verifyProcess.kill();
          
          if (mainWindow) {
            mainWindow.webContents.send('api-error', 'Credential verification timed out. Please check your network connection and try again.');
          }
          
          resolve(false);
        }
      }, 15000); // 15 second timeout
      
    } catch (error) {
      console.error('Error during credential verification:', error);
      reject(error);
    }
  });
};

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

    // Kill any existing Python process before starting a new one
    if (pythonProcess) {
      console.log('Terminating existing Python API process before starting new one');
      pythonProcess.kill();
      pythonProcess = null;
      
      // Wait a moment for the process to fully terminate and release ports
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Verify credentials before starting the API
    try {
      const credentialsValid = await verifyCredentials(credentials);
      if (!credentialsValid) {
        console.log('Credential verification failed, aborting login');
        return { success: false, message: 'Invalid credentials' };
      }
      
      console.log('Credentials verified successfully');
    } catch (verifyError) {
      console.error('Error during credential verification:', verifyError);
      return { 
        success: false, 
        message: 'An error occurred during credential verification. Please try again.' 
      };
    }

    // Store credentials securely using the correct key
    store.set('graphCredentials', credentials); // Use 'graphCredentials'
    store.set('isLoggedIn', true);

    console.log('Credentials stored, finding port and starting Python API');
    // Find port *before* starting API
    let portToUse;
    
    try {
      portToUse = await findAvailablePort(8000);
      console.log('Found available port:', portToUse);
    } catch (error) {
      console.error('Error finding available port:', error);
      return { success: false, message: 'Failed to find available port for API' };
    }

    try {
      // Start the API as a background process
      startPythonApi(portToUse);
      store.set('apiPort', portToUse);
      apiPort = portToUse;  // update global reference so get-api-port returns the correct value
      
      // Return success to the renderer
      return { success: true };
    } catch (apiError) {
      console.error('Login error:', apiError);
      store.set('isLoggedIn', false);
      // If API startup fails, send an appropriate error message
      return { 
        success: false, 
        message: apiError.message || 'Failed to start API. Please try again.'
      };
    }
  } catch (error) {
    console.error('Login error:', error);
    store.set('isLoggedIn', false);
    return { success: false, message: error.message || 'An unexpected error occurred' };
  }
});

// Handle logout
ipcMain.handle('logout', async () => {
  console.log('Logout requested, clearing credentials');
  store.delete('graphCredentials'); // Use correct key name
  store.set('isLoggedIn', false);
  
  // Kill the Python API process if running
  if (pythonProcess) {
    console.log('Terminating Python API process');
    pythonProcess.kill();
    pythonProcess = null;
    apiStarted = false;
    apiPort = null; // Reset port
  }
  
  // Also kill the Next.js process if in development mode
  if (process.env.NODE_ENV === 'development' && nextProcess) {
    console.log('Terminating Next.js dev server process');
    nextProcess.kill();
    nextProcess = null;
  }
  
  // Reload app to show login screen
  if (mainWindow) {
    console.log('Sending show-login event to renderer');
    mainWindow.webContents.send('show-login');
  }
  
  return { success: true };
});

// Handle getApiPort request from renderer
ipcMain.handle('get-api-port', () => {
  return apiPort;
});

// Function to display an error message page
function showErrorPage(errorMessage) {
  if (mainWindow) {
    const errorPagePath = path.join(__dirname, 'error.html');
    // Simple way: load an error HTML file
    // You might want to pass the errorMessage via query parameter or IPC
    mainWindow.loadFile(errorPagePath);
    // Optionally, send the error message to the page if it's set up to receive it
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('display-error', errorMessage);
    });
  } else {
    // If window not created yet, maybe create it showing the error
    // Or log and exit?
    console.error("Cannot show error page, main window not available.");
    app.quit();
  }
}

// Function to check for existing Next.js processes on Windows
const killExistingNextProcesses = (targetPort) => {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      console.log('Not on Windows, skipping process kill check.');
      resolve();
      return;
    }

    console.log(`Checking for existing processes on port ${targetPort} on Windows...`);

    // Use netstat to find the PID of the process using the target port
    const netstatCmd = `netstat -ano | findstr "LISTENING" | findstr ":${targetPort}"`;
    exec(netstatCmd, (error, stdout, stderr) => {
      if (error && !stdout.trim()) {
        // Error occurred, but likely because findstr found nothing, which is good.
        console.log(`No existing process found listening on port ${targetPort}.`);
        resolve();
        return;
      }
      if (stderr) {
        console.error(`Error checking port ${targetPort} with netstat: ${stderr}`);
        // Continue even if netstat check fails, might still work
      }

      if (stdout.trim()) {
        const lines = stdout.trim().split('\n');
        const pidsToKill = lines
          .map((line) => {
            const pidMatch = line.match(/\s+(\d+)$/m); // Match PID at the end of the line
            return pidMatch ? pidMatch[1] : null;
          })
          .filter((pid) => pid !== null);

        if (pidsToKill.length > 0) {
          console.log(`Found existing processes on port ${targetPort} with PIDs: ${pidsToKill.join(', ')}. Attempting to kill...`);
          // Kill the found processes
          const killCmd = `taskkill /F /PID ${pidsToKill.join(' /PID ')}`;
          exec(killCmd, (killError, killStdout, killStderr) => {
            if (killError) {
              console.error(
                `Failed to kill processes ${pidsToKill.join(', ')}: ${killError.message}`,
              );
              console.error(`Stderr from taskkill: ${killStderr}`);
              // Reject might be too strong? Maybe just warn and continue?
              // For now, let's resolve but log the error.
              resolve(); // Resolve even if kill fails, allowing startup attempt
              return;
            }
            console.log(
              `Successfully killed processes ${pidsToKill.join(', ')} using port ${targetPort}.`,
            );
            console.log(`Taskkill stdout: ${killStdout}`);
            resolve();
          });
        } else {
          console.log(
            `Netstat found listening ports but could not extract PIDs for port ${targetPort}. Output:\n${stdout}`,
          );
          resolve();
        }
      } else {
        // Should have been caught by the first error check, but just in case
        console.log(`No existing process found listening on port ${targetPort}.`);
        resolve();
      }
    });
  });
};

// Kill any existing Next.js process that might still be hanging on our preferred port
killExistingNextProcesses(DEFAULT_NEXT_PORT);

// Standard Electron app lifecycle events
app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  console.log('App quitting, cleaning up processes...');
  if (pythonProcess) {
    console.log('Terminating Python API process...');
    pythonProcess.kill();
    pythonProcess = null; // Clear the reference
  }
  
  if (nextProcess) {
    console.log('Terminating Next.js dev server process...');
    nextProcess.kill();
    nextProcess = null; // Clear the reference
  }
  console.log('Cleanup complete.');
});

app.whenReady().then(async () => {
  // FORCE RESET: Always start with a clean slate
  console.log('App starting, forcibly clearing any previous login state');
  store.set('isLoggedIn', false);
  store.delete('graphCredentials');
  
  // Kill any lingering processes
  if (pythonProcess) {
    console.log('Terminating lingering Python API process on startup');
    pythonProcess.kill();
    pythonProcess = null;
  }

  // Load stored state (which should now be reset)
  const isLoggedIn = store.get('isLoggedIn');
  const graphCredentials = store.get('graphCredentials');

  // Set up IPC handlers
  // setupIpcHandlers(); // Removed this line as setupIpcHandlers is not defined

  // Start Next.js dev server if in development
  if (process.env.NODE_ENV === 'development') {
    try {
      await startNextDevServer();
      console.log(`Next.js server assumed ready on port: ${nextJsPort}`);
    } catch (error) {
      console.error('Failed to start Next.js server:', error);
      // Handle error: maybe show error in main window or load fallback
      // For now, just log and potentially quit or show error window
      // This prevents trying to load a non-existent URL
      showErrorPage(`Failed to start frontend server: ${error.message}`);
      return; // Prevent further execution like createWindow if server failed
    }
  }
  
  createWindow();

  console.log('App ready. Waiting for user login to start API.');
});
