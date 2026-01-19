const { app, BrowserWindow, dialog, ipcMain, clipboard } = require('electron');
const path = require('path');
const XLSX = require('xlsx');

const STATUS_PENDING = '未制作';
const STATUS_CHECKING = '確認中';
const TARGET_SHEET_NAME = '製作状況';

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
};

const normalizeCompany = (value) => {
  return String(value || '')
    .replace(/株式会社/g, '')
    .trim();
};

const formatLine = ({ date, artist, company }) => {
  const cleanDate = String(date || '').trim();
  const cleanArtist = String(artist || '').trim();
  const cleanCompany = normalizeCompany(company);

  if (!cleanDate && !cleanArtist) {
    return '';
  }

  if (cleanCompany) {
    return `${cleanDate}：${cleanArtist}（${cleanCompany}）`;
  }

  return `${cleanDate}：${cleanArtist}`;
};

const parseWorkbook = (filePath) => {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames.includes(TARGET_SHEET_NAME)
    ? TARGET_SHEET_NAME
    : workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('シートが見つかりませんでした。');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false
  });

  if (rows.length === 0) {
    throw new Error('シートにデータがありません。');
  }

  const headers = rows[0].map((header) => String(header || '').trim());
  const getIndex = (name) => headers.findIndex((header) => header === name);

  const statusIndex = getIndex('制作状況');
  const artistIndex = getIndex('アーティスト名');
  const companyIndex = getIndex('申込社');
  const dateIndex = getIndex('公演日');

  if ([statusIndex, artistIndex, companyIndex, dateIndex].some((index) => index < 0)) {
    throw new Error('必要な列（制作状況 / アーティスト名 / 申込社 / 公演日）が見つかりません。');
  }

  const pending = [];
  const checking = [];

  rows.slice(1).forEach((row) => {
    const status = String(row[statusIndex] || '').trim();
    if (![STATUS_PENDING, STATUS_CHECKING].includes(status)) {
      return;
    }

    const line = formatLine({
      date: row[dateIndex],
      artist: row[artistIndex],
      company: row[companyIndex]
    });

    if (!line) {
      return;
    }

    if (status === STATUS_PENDING) {
      pending.push(line);
    } else if (status === STATUS_CHECKING) {
      checking.push(line);
    }
  });

  const output = [
    `＜${STATUS_PENDING}＞`,
    ...pending,
    '',
    `＜${STATUS_CHECKING}＞`,
    ...checking
  ].join('\n');

  return output.trim();
};

app.whenReady().then(() => {
  ipcMain.handle('open-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Excel', extensions: ['xlsx', 'xls'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('parse-excel', async (_, filePath) => {
    if (!filePath) {
      throw new Error('ファイルパスが指定されていません。');
    }

    return parseWorkbook(filePath);
  });

  ipcMain.handle('copy-text', async (_, text) => {
    clipboard.writeText(String(text || ''));
    return true;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
