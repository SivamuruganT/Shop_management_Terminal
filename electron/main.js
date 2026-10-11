const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const ExcelJS = require("exceljs");
const dbLayer = require("./db");
const { parseProductExcel } = require("./excelImport");
const { syncNow, scheduleSync, getSyncSummary } = require("./sync");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Best-effort background sync: only fires if sync is actually configured,
 * and any failure (offline, server down, bad key) is swallowed here - sync
 * never gets to interrupt or block billing. The Settings page's "Sync Now"
 * button surfaces real success/failure for when the person wants to check.
 */
function startAutoSyncTimer() {
  setInterval(() => {
    const config = dbLayer.getSyncConfig();
    if (!config.configured) return;
    syncNow().catch(() => {
      /* swallowed deliberately - see comment above */
    });
  }, AUTO_SYNC_INTERVAL_MS);
}

app.whenReady().then(() => {
  dbLayer.initDb(app.getPath("userData"));
  registerIpcHandlers();
  createWindow();
  startAutoSyncTimer();
  scheduleSync(10000); // catch up shortly after launch instead of waiting for the first 5-minute tick

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Pass a result through unchanged, but queue a cloud sync for a few seconds
// from now. Called only after the local save has already succeeded.
function afterChange(result) {
  scheduleSync();
  return result;
}

function wrap(fn) {
  return async (_event, ...args) => {
    try {
      const result = await fn(...args);
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  };
}

function registerIpcHandlers() {
  ipcMain.handle("setup:get", wrap(async () => dbLayer.getShopInfo()));
  ipcMain.handle("setup:complete", wrap(async (payload) => dbLayer.completeSetup(payload)));
  ipcMain.handle("setup:updateShopInfo", wrap(async (payload) => dbLayer.updateShopInfo(payload)));

  ipcMain.handle("auth:login", wrap(async (username, password, role) => {
    const result = dbLayer.login(username, password, role);
    if (!result.ok) throw new Error(result.error);
    return result.user;
  }));

  ipcMain.handle("users:list", wrap(async () => dbLayer.listUsers()));
  ipcMain.handle("users:create", wrap(async (payload) => dbLayer.createUser(payload)));
  ipcMain.handle("users:update", wrap(async (id, payload) => dbLayer.updateUser(id, payload)));
  ipcMain.handle("users:delete", wrap(async (id) => dbLayer.deleteUser(id)));

  ipcMain.handle("products:list", wrap(async (filters) => dbLayer.listProducts(filters)));
  ipcMain.handle("products:findByCode", wrap(async (code) => dbLayer.findProductBySkuOrCode(code)));
  ipcMain.handle("products:create", wrap(async (payload) => afterChange(dbLayer.createProduct(payload))));
  ipcMain.handle("products:update", wrap(async (id, payload) => afterChange(dbLayer.updateProduct(id, payload))));
  ipcMain.handle("products:delete", wrap(async (id) => afterChange(dbLayer.deleteProduct(id))));
  ipcMain.handle("products:adjustStock", wrap(async (payload) => afterChange(dbLayer.adjustStock(payload))));

  ipcMain.handle("products:pickExcelFile", wrap(async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select product Excel file",
      filters: [{ name: "Spreadsheets", extensions: ["xlsx", "xls", "csv"] }],
      properties: ["openFile"]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  }));

  ipcMain.handle("products:previewExcelImport", wrap(async (filePath) => {
    const { rows, detectedColumns } = await parseProductExcel(filePath);
    const existingSkus = new Set(dbLayer.listProducts({}).map((p) => p.sku));
    const annotatedRows = rows.map((r) => ({ ...r, existsInDb: r.valid && existingSkus.has(r.sku) }));
    const validCount = annotatedRows.filter((r) => r.valid).length;
    return {
      rows: annotatedRows,
      detectedColumns,
      totalRows: annotatedRows.length,
      validCount,
      invalidCount: annotatedRows.length - validCount,
      existingCount: annotatedRows.filter((r) => r.existsInDb).length
    };
  }));

  ipcMain.handle("products:commitExcelImport", wrap(async (rows, updateExisting) =>
    afterChange(dbLayer.bulkImportProducts(rows, { updateExisting }))
  ));

  ipcMain.handle("bills:create", wrap(async (payload) => afterChange(dbLayer.createBill(payload))));
  ipcMain.handle("bills:list", wrap(async (filters) => dbLayer.listBills(filters)));
  ipcMain.handle("bills:get", wrap(async (id) => dbLayer.getBillDetail(id)));

  ipcMain.handle("expenses:list", wrap(async () => dbLayer.listExpenses()));
  ipcMain.handle("expenses:create", wrap(async (payload) => afterChange(dbLayer.createExpense(payload))));

  ipcMain.handle("dashboard:stats", wrap(async () => dbLayer.dashboardStats()));
  ipcMain.handle("pnl:summary", wrap(async (range) => dbLayer.profitLossSummary(range)));

  ipcMain.handle("export:generate", wrap(async (params) => generateExport(params)));

  ipcMain.handle("app:getVersion", wrap(async () => app.getVersion()));

  ipcMain.handle("sync:getConfig", wrap(async () => dbLayer.getSyncConfig()));
  ipcMain.handle("sync:saveConfig", wrap(async (payload) => dbLayer.saveSyncConfig(payload)));
  ipcMain.handle("sync:status", wrap(async () => ({ ...dbLayer.getSyncConfig(), pending: dbLayer.getUnsyncedCounts() })));
  ipcMain.handle("sync:summary", wrap(async () => getSyncSummary()));
  ipcMain.handle("sync:now", wrap(async () => {
    const result = await syncNow();
    if (!result.ok) throw new Error(result.error);
    return result;
  }));

  ipcMain.handle("shell:showInFolder", wrap(async (filePath) => {
    shell.showItemInFolder(filePath);
  }));
}

async function generateExport({ startDate, endDate, sheets }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ECBill";
  workbook.created = new Date();

  if (sheets.includes("sales")) {
    const sheet = workbook.addWorksheet("Sales Records");
    sheet.columns = [
      { header: "Bill No", key: "bill_no", width: 14 },
      { header: "Date & Time", key: "created_at", width: 22 },
      { header: "Cashier", key: "cashier_name", width: 16 },
      { header: "Payment Mode", key: "payment_mode", width: 14 },
      { header: "Subtotal", key: "subtotal", width: 12 },
      { header: "Discount", key: "discount", width: 12 },
      { header: "Total Amount", key: "total_amount", width: 14 }
    ];
    const bills = dbLayer.listBills({ startDate, endDate });
    bills.forEach((b) => sheet.addRow(b));
    sheet.getRow(1).font = { bold: true };
  }

  if (sheets.includes("inventory")) {
    const sheet = workbook.addWorksheet("Inventory");
    sheet.columns = [
      { header: "SKU", key: "sku", width: 14 },
      { header: "Name", key: "name", width: 24 },
      { header: "Category", key: "category", width: 16 },
      { header: "Price", key: "price", width: 12 },
      { header: "Cost Price", key: "cost_price", width: 12 },
      { header: "Stock Qty", key: "stock_qty", width: 12 },
      { header: "Unit", key: "unit", width: 10 }
    ];
    dbLayer.listProducts({}).forEach((p) => sheet.addRow(p));
    sheet.getRow(1).font = { bold: true };
  }

  if (sheets.includes("expenses")) {
    const sheet = workbook.addWorksheet("Expenses");
    sheet.columns = [
      { header: "Date", key: "created_at", width: 22 },
      { header: "Category", key: "category", width: 18 },
      { header: "Amount", key: "amount", width: 12 },
      { header: "Note", key: "note", width: 30 }
    ];
    dbLayer.listExpenses().forEach((e) => sheet.addRow(e));
    sheet.getRow(1).font = { bold: true };
  }

  if (sheets.includes("profit_loss")) {
    const sheet = workbook.addWorksheet("Profit & Loss");
    const pnl = dbLayer.profitLossSummary({ startDate, endDate });
    sheet.addRow(["Particulars", "Amount"]);
    sheet.addRow(["Total Revenue", pnl.revenue]);
    sheet.addRow(["Cost of Goods Sold", pnl.cogs]);
    sheet.addRow(["Gross Profit", pnl.grossProfit]);
    sheet.addRow(["Total Expenses", pnl.totalExpenses]);
    sheet.addRow(["Net Profit", pnl.netProfit]);
    sheet.getRow(1).font = { bold: true };
  }

  const downloadsPath = app.getPath("downloads");
  const fileName = `ecbill_export_${startDate}_to_${endDate}.xlsx`;
  const filePath = path.join(downloadsPath, fileName);
  await workbook.xlsx.writeFile(filePath);
  return { filePath, fileName };
}
