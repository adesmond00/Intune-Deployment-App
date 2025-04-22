// Preload script that will be executed in the renderer process
const { contextBridge, ipcRenderer } = require('electron');

// Log when the preload script starts and finishes
console.log('Preload script executing...');

// Expose Electron APIs and additional data to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Flag to check if running in Electron
  isElectron: true,
  
  // Authentication functions
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  logout: () => ipcRenderer.invoke('logout'),
  
  // Event listeners
  onApiReady: (callback) => {
    ipcRenderer.on('api-ready', (event, port) => callback(port));
  },
  onApiError: (callback) => {
    ipcRenderer.on('api-error', (event, message) => callback(message));
  },
  onApiLog: (callback) => {
    ipcRenderer.on('api-log', (event, message) => callback(message));
  },
  onShowLogin: (callback) => {
    ipcRenderer.on('show-login', () => callback());
  },
  
  // Get current API port, if available
  getApiPort: () => ipcRenderer.invoke('get-api-port'),
  
  // Get value from the electron-store
  getStoreValue: (key) => ipcRenderer.invoke('get-store-value', key),
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

console.log('Preload script completed, exposed electronAPI with isElectron=true');
