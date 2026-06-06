const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { uIOhook } = require('uiohook-napi');

let mainWindow = null;
let dragInterval = null;
let configPath;

// Custom robust synchronous JSON settings storage
function getSettings() {
  try {
    if (!configPath) {
      configPath = path.join(app.getPath('userData'), 'mascot-settings.json');
    }
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read settings:', err);
  }
  return { scale: 1.0, position: null };
}

function saveSettings(settings) {
  try {
    if (!configPath) {
      configPath = path.join(app.getPath('userData'), 'mascot-settings.json');
    }
    const current = getSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const settings = getSettings();
  const scale = settings.scale || 1.0;
  const size = Math.round(150 * scale);

  // Position at bottom right by default
  const defaultX = width - size - 50;
  const defaultY = height - size - 50;
  const x = settings.position ? settings.position.x : defaultX;
  const y = settings.position ? settings.position.y : defaultY;

  mainWindow = new BrowserWindow({
    width: size,
    height: size,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] ${message}`);
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools detached for easy debugging
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  // Set initially to click through transparent parts
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  const cursorInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const cursor = screen.getCursorScreenPoint();
      const bounds = mainWindow.getBounds();
      mainWindow.webContents.send('global-cursor', { cursor, bounds });
    }
  }, 32);

  mainWindow.on('closed', () => {
    clearInterval(cursorInterval);
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Start the global keystroke hooks
  try {
    uIOhook.start();
    uIOhook.on('keydown', (e) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('global-keystroke', e);
      }
    });
  } catch (err) {
    console.error('Failed to start uiohook listener:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Stop hooks on exit
  try {
    uIOhook.stop();
  } catch (e) {}

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});

ipcMain.on('drag-start', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;

  const startMouse = screen.getCursorScreenPoint();
  const startWin = win.getPosition();

  if (dragInterval) clearInterval(dragInterval);

  dragInterval = setInterval(() => {
    const currentMouse = screen.getCursorScreenPoint();
    const dx = currentMouse.x - startMouse.x;
    const dy = currentMouse.y - startMouse.y;
    const newX = startWin[0] + dx;
    const newY = startWin[1] + dy;
    win.setPosition(newX, newY);
  }, 16); // ~60 FPS update
});

ipcMain.on('drag-end', (event) => {
  if (dragInterval) {
    clearInterval(dragInterval);
    dragInterval = null;
  }
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    const pos = win.getPosition();
    saveSettings({ position: { x: pos[0], y: pos[1] } });
  }
});

ipcMain.on('show-context-menu', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;

  const settings = getSettings();
  const currentScale = settings.scale || 1.0;

  const template = [
    {
      label: 'Mascot Scale',
      submenu: [
        {
          label: 'Small (1x)',
          type: 'radio',
          checked: currentScale === 1.0,
          click: () => handleScaleChange(win, 1.0)
        },
        {
          label: 'Medium (1.5x)',
          type: 'radio',
          checked: currentScale === 1.5,
          click: () => handleScaleChange(win, 1.5)
        },
        {
          label: 'Large (2x)',
          type: 'radio',
          checked: currentScale === 2.0,
          click: () => handleScaleChange(win, 2.0)
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Reset Position',
      click: () => {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        const settings = getSettings();
        const scale = settings.scale || 1.0;
        const size = Math.round(150 * scale);
        
        const defaultX = width - size - 50;
        const defaultY = height - size - 50;
        
        win.setPosition(defaultX, defaultY);
        saveSettings({ position: { x: defaultX, y: defaultY } });
      }
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: win.isAlwaysOnTop(),
      click: (menuItem) => {
        win.setAlwaysOnTop(menuItem.checked);
      }
    },
    { type: 'separator' },
    {
      label: 'DevTools',
      click: () => win.webContents.openDevTools({ mode: 'detach' })
    },
    {
      label: 'Quit Mascot',
      click: () => app.quit()
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: win });
});

function handleScaleChange(win, scale) {
  saveSettings({ scale: scale });
  const size = Math.round(150 * scale);
  
  // Try to preserve center of the mascot
  const currentBounds = win.getBounds();
  const currentCenterX = currentBounds.x + currentBounds.width / 2;
  const currentCenterY = currentBounds.y + currentBounds.height / 2;
  
  const newX = Math.round(currentCenterX - size / 2);
  const newY = Math.round(currentCenterY - size / 2);
  
  win.setBounds({
    x: newX,
    y: newY,
    width: size,
    height: size
  });

  win.webContents.send('menu-command', { type: 'scale', value: scale });
}

ipcMain.handle('get-position', () => {
  const settings = getSettings();
  return settings.position;
});

ipcMain.handle('get-scale', () => {
  const settings = getSettings();
  return settings.scale || 1.0;
});
