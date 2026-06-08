const { ipcMain } = require('electron');

let winRef = null;

function setupMascotIPC(mainWindow) {
  winRef = mainWindow;

  ipcMain.on('mascot-state-set', (event, state) => {
    if (winRef && !winRef.isDestroyed()) {
      winRef.webContents.send('mascot-state', state);
    }
  });

  // Start HTTP Server on localhost:40900 to integrate with external AI agents
  const http = require('http');
  const server = http.createServer((req, res) => {
    // CORS headers for browser integration (e.g. ChatGPT web app)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    let targetState = null;
    if (pathname === '/thinking') targetState = 'thinking';
    else if (pathname === '/done') targetState = 'done';
    else if (pathname === '/error') targetState = 'error';
    else if (pathname === '/idle') targetState = 'idle';

    if (targetState) {
      if (winRef && !winRef.isDestroyed()) {
        winRef.webContents.send('mascot-state', targetState);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success', state: targetState }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.on('error', (err) => {
    console.error('Mascot external IPC server error:', err);
  });

  server.listen(40900, '127.0.0.1', () => {
    console.log('Mascot external IPC server listening on http://127.0.0.1:40900');
  });

  // Optional: Listen to simulated/mock AI call to test thinking/done/error states
  ipcMain.handle('mock-ai-call', async (event, { prompt, simulateError }) => {
    return await callAIWithMascot(winRef, prompt, async () => {
      // Simulate network delay of 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (simulateError) {
        throw new Error('Simulated AI Error');
      }
      return `AI Response to: ${prompt}`;
    });
  });
}

// Wrap any AI call with mascot state transitions
async function callAIWithMascot(win, prompt, yourExistingFn) {
  const targetWin = win || winRef;
  if (targetWin && !targetWin.isDestroyed()) {
    targetWin.webContents.send('mascot-state', 'thinking');
  }

  try {
    const result = await yourExistingFn(prompt);
    if (targetWin && !targetWin.isDestroyed()) {
      targetWin.webContents.send('mascot-state', 'done');
    }
    return result;
  } catch (error) {
    if (targetWin && !targetWin.isDestroyed()) {
      targetWin.webContents.send('mascot-state', 'error');
    }
    throw error;
  }
}

module.exports = {
  setupMascotIPC,
  callAIWithMascot
};
