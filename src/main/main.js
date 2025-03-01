const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const XLSX = require('xlsx');
const Papa = require('papaparse');

function setupIpcHandlers() {
  ipcMain.handle('read-file', async (event, filePath, options) => {
    try {
      const absolutePath = path.resolve(app.getAppPath(), filePath);
      const content = await fs.readFile(absolutePath, options);
      return content;
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  });

  ipcMain.handle('write-file', async (event, filePath, data) => {
    try {
      const absolutePath = path.resolve(app.getAppPath(), filePath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, data);
    } catch (error) {
      console.error('Error writing file:', error);
      throw error;
    }
  });

  ipcMain.handle('open-external-link', async (event, url) => {
    try {
      await shell.openExternal(url);
      return true;
    } catch (error) {
      console.error('Failed to open external link:', error);
      return false;
    }
  });

  // Nya handlers för export
  ipcMain.handle('show-save-dialog', async (event, options) => {
    return await dialog.showSaveDialog(options);
  });

  ipcMain.handle('export-to-excel', async (event, data, suggestedFilename) => {
    try {
      const result = await dialog.showSaveDialog({
        defaultPath: suggestedFilename || 'facebook-statistik.xlsx',
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      });

      if (result.canceled) return { success: false, message: 'Export avbruten' };

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Facebook Statistik');
      
      await XLSX.writeFile(workbook, result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (error) {
      console.error('Export to Excel failed:', error);
      throw error;
    }
  });

  ipcMain.handle('export-to-csv', async (event, data, suggestedFilename) => {
    try {
      const result = await dialog.showSaveDialog({
        defaultPath: suggestedFilename || 'facebook-statistik.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      });

      if (result.canceled) return { success: false, message: 'Export avbruten' };

      const csv = Papa.unparse(data);
      await fs.writeFile(result.filePath, csv, 'utf-8');
      return { success: true, filePath: result.filePath };
    } catch (error) {
      console.error('Export to CSV failed:', error);
      throw error;
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('Loading development server...');
    win.loadURL('http://localhost:5173')
      .then(() => {
        console.log('Development server loaded successfully');
        win.webContents.openDevTools();
      })
      .catch((err) => {
        console.error('Failed to load development server:', err);
      });
  } else {
    const indexPath = path.join(__dirname, '../../dist/index.html');
    console.log('Loading production build from:', indexPath);
    win.loadFile(indexPath)
      .catch((err) => {
        console.error('Failed to load production build:', err);
      });
  }
}

setupIpcHandlers();

app.whenReady()
  .then(() => {
    console.log('Electron app is ready');
    createWindow();
  })
  .catch((err) => {
    console.error('Failed to start app:', err);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});