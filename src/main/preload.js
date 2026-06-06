const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onGlobalKeystroke: (callback) => {
    const listener = (event, value) => callback(value);
    ipcRenderer.on('global-keystroke', listener);
    return () => ipcRenderer.removeListener('global-keystroke', listener);
  },
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },
  dragStart: () => {
    ipcRenderer.send('drag-start');
  },
  dragEnd: () => {
    ipcRenderer.send('drag-end');
  },
  showContextMenu: () => {
    ipcRenderer.send('show-context-menu');
  },
  onMenuCommand: (callback) => {
    const listener = (event, command) => callback(command);
    ipcRenderer.on('menu-command', listener);
    return () => ipcRenderer.removeListener('menu-command', listener);
  },
  getPosition: () => ipcRenderer.invoke('get-position'),
  setPosition: (x, y) => ipcRenderer.send('set-position', x, y),
  getScale: () => ipcRenderer.invoke('get-scale'),
  onGlobalCursor: (callback) => {
    const listener = (event, value) => callback(value);
    ipcRenderer.on('global-cursor', listener);
    return () => ipcRenderer.removeListener('global-cursor', listener);
  },
});
