const { app, BrowserWindow, Menu, Tray, nativeImage, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let tray = null;
let serverProcess = null;

// Start embedded Node.js Express server
function startEmbeddedServer() {
  require('./server.js');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    title: 'ZerRemote - Uzak Masaüstü Erişim Uygulaması',
    icon: path.join(__dirname, 'public/assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableBlinkFeatures: 'DesktopCapture'
    },
    autoHideMenuBar: true,
    backgroundColor: '#0b0f19'
  });

  // Load the local ZerRemote Web interface
  mainWindow.loadURL('http://localhost:3000');

  // Handle Desktop Screen Capture Source Selection for Windows
  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      // Automatically select the primary screen or first source
      if (sources.length > 0) {
        callback({ video: sources[0], audio: 'loopback' });
      }
    }).catch(err => console.error('DisplayMedia Error:', err));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Application Lifecycle
app.whenReady().then(() => {
  startEmbeddedServer();
  
  setTimeout(() => {
    createWindow();
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
