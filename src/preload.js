const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('waitGame', {
  onClaudeStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('claude-status', listener);
    return () => ipcRenderer.removeListener('claude-status', listener);
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
  stopFlash: () => ipcRenderer.send('stop-flash')
});
