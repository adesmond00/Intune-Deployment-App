// Electron preload script
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    login: (credentials) => ipcRenderer.invoke('login', credentials),
    logout: () => ipcRenderer.invoke('logout'),
    onApiReady: (callback) => ipcRenderer.on('api-ready', callback),
    onApiError: (callback) => ipcRenderer.on('api-error', (_, message) => callback(message)),
    onShowLogin: (callback) => ipcRenderer.on('show-login', callback),
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
);
