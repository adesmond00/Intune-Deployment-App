// Electron preload script
const { contextBridge, ipcRenderer } = require('electron');

// Log that preload script is running
console.log('Preload script executing...');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    isElectron: true, // Add flag to explicitly detect Electron environment
    login: (credentials) => ipcRenderer.invoke('login', credentials),
    logout: () => ipcRenderer.invoke('logout'),
    onApiReady: (callback) => ipcRenderer.on('api-ready', (_, port) => callback(port)),
    onApiError: (callback) => ipcRenderer.on('api-error', (_, message) => callback(message)),
    onApiLog: (callback) => ipcRenderer.on('api-log', (_, message) => callback(message)),
    onShowLogin: (callback) => ipcRenderer.on('show-login', () => {
      console.log('Show login event received in preload');
      callback();
    }),
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
);

// Log that preload script has completed
console.log('Preload script completed, exposed electronAPI with isElectron=true');
