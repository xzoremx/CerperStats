const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

// Lista blanca de rutas (todas las vistas autorizadas)
const ROUTES = new Set([
  // Menú principal y selección
  'menu.html',
  'procedure_select.html',

  // Flujo input_data
  'input_data/step_1_type.html',
  'input_data/step_3_dato.html',
  'input_data/step_2_parametro.html',
  'input_data/step_4_k.html',
  'input_data/step_5_sheet.html',

  // Evaluación y reporte
  'evaluation_select.html',
  'report_info.html',

  // Otros
  'index.html'
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    icon: path.join(__dirname, 'assets', 'logos', 'cerper_logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('menu.html'); // Pantalla inicial
  // mainWindow.webContents.openDevTools(); // ← activar para depurar
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.cerper.cerperstats');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Navegación segura controlada desde preload.js
ipcMain.handle('open-page', async (_event, page) => {
  if (!ROUTES.has(page)) {
    console.warn(`[CerperStats] Ruta no permitida: ${page}`);
    return false;
  }

  try {
    await mainWindow.loadFile(page);
    console.log(`[CerperStats] Página cargada: ${page}`);
    return true;
  } catch (err) {
    console.error(`[CerperStats] Error al cargar ${page}:`, err);
    return false;
  }
});
