const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

let db;

function uuid() {
  return crypto.randomUUID();
}

function nowISO() {
  return new Date().toISOString();
}

function initDb(userDataPath) {
  const dbPath = path.join(userDataPath, "ecbill-local.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'worker')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TEXT NOT NULL,
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      price REAL NOT NULL DEFAULT 0,
      cost_price REAL NOT NULL DEFAULT 0,
      stock_qty REAL NOT NULL DEFAULT 0,
      unit TEXT,
      low_stock_threshold REAL NOT NULL DEFAULT 5,
      notes TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_seq INTEGER NOT NULL,
      bill_no TEXT UNIQUE NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      discount_type TEXT NOT NULL DEFAULT 'flat',
      total_amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      cashier_user_id INTEGER,
      cashier_name TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL REFERENCES bills(id),
      product_id INTEGER,
      sku TEXT,
      name TEXT NOT NULL,
      qty REAL NOT NULL,
      unit_price REAL NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_seq INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      sku TEXT,
      delta_qty REAL NOT NULL,
      adjustment_type TEXT NOT NULL,
      reason TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_seq INTEGER NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
  `);

  runMigrations();
  return db;
}

/**
 * CREATE TABLE IF NOT EXISTS only matters for a brand-new database file - an
 * install that already ran before this column existed needs it added
 * explicitly. Checked via PRAGMA table_info rather than just trying the
 * ALTER and catching the error, so re-running this on an already-migrated
 * database is a silent no-op instead of a logged (harmless but noisy) error.
 */
function runMigrations() {
  const billItemColumns = db.prepare("PRAGMA table_info(bill_items)").all().map((c) => c.name);
  if (!billItemColumns.includes("cost_price")) {
    db.exec("ALTER TABLE bill_items ADD COLUMN cost_price REAL NOT NULL DEFAULT 0");
  }
}

// ---------- settings / setup ----------

function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

function isSetupComplete() {
  return getSetting("setup_complete") === "1";
}

function getShopInfo() {
  return {
    shop_id: getSetting("shop_id"),
    terminal_id: getSetting("terminal_id"),
    system_id: getSetting("system_id"),
    shop_name: getSetting("shop_name"),
    address: getSetting("address"),
    phone: getSetting("phone"),
    email: getSetting("email"),
    owner_name: getSetting("owner_name"),
    setup_complete: isSetupComplete()
  };
}

function completeSetup({ shopName, address, phone, email, ownerName, existingShopId, adminUsername, adminPassword }) {
  if (isSetupComplete()) {
    throw new Error("Setup has already been completed on this terminal.");
  }
  const shopId = existingShopId && existingShopId.trim() ? existingShopId.trim() : `SHP-${uuid().slice(0, 8).toUpperCase()}`;
  const terminalId = `TRM-${uuid().slice(0, 8).toUpperCase()}`;
  const systemId = `SYS-${new Date().getFullYear()}-${uuid().slice(0, 6).toUpperCase()}`;

  setSetting("shop_id", shopId);
  setSetting("terminal_id", terminalId);
  setSetting("system_id", systemId);
  setSetting("shop_name", shopName);
  setSetting("address", address);
  setSetting("phone", phone || "");
  setSetting("email", email || "");
  setSetting("owner_name", ownerName);

  const passwordHash = bcrypt.hashSync(adminPassword, 10);
  db.prepare(
    "INSERT INTO users (username, password_hash, role, status, created_at) VALUES (?, ?, 'admin', 'active', ?)"
  ).run(adminUsername, passwordHash, nowISO());

  setSetting("setup_complete", "1");
  return getShopInfo();
}

function updateShopInfo({ shopName, address, phone, email, ownerName }) {
  setSetting("shop_name", shopName);
  setSetting("address", address);
  setSetting("phone", phone || "");
  setSetting("email", email || "");
  setSetting("owner_name", ownerName);
  return getShopInfo();
}

// ---------- auth ----------

function login(username, password, expectedRole) {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return { ok: false, error: "Incorrect username or password." };
  if (user.status !== "active") return { ok: false, error: "This account is inactive. Contact your admin." };
  if (user.role !== expectedRole) {
    return { ok: false, error: `This account is a ${user.role} account. Use the ${user.role === "admin" ? "Admin" : "Worker"} tab.` };
  }
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return { ok: false, error: "Incorrect username or password." };

  db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(nowISO(), user.id);
  return { ok: true, user: { id: user.id, username: user.username, role: user.role } };
}

// ---------- users ----------

function listUsers() {
  return db.prepare("SELECT id, username, role, status, created_at, last_login FROM users ORDER BY id").all();
}

function createUser({ username, password, role, status }) {
  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists) throw new Error("That username is already taken.");
  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare("INSERT INTO users (username, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(username, passwordHash, role, status || "active", nowISO());
  return listUsers().find((u) => u.id === info.lastInsertRowid);
}

function updateUser(id, { username, password, role, status }) {
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!existing) throw new Error("User not found.");
  const newUsername = username || existing.username;
  const newRole = role || existing.role;
  const newStatus = status || existing.status;
  const newHash = password ? bcrypt.hashSync(password, 10) : existing.password_hash;
  db.prepare("UPDATE users SET username = ?, password_hash = ?, role = ?, status = ? WHERE id = ?").run(
    newUsername,
    newHash,
    newRole,
    newStatus,
    id
  );
  return listUsers().find((u) => u.id === id);
}

function deleteUser(id) {
  const adminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND status = 'active'").get().c;
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (target && target.role === "admin" && adminCount <= 1) {
    throw new Error("Cannot delete the last active admin account.");
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return true;
}

// ---------- products / inventory ----------

function listProducts({ search, category, stockStatus } = {}) {
  let rows = db.prepare("SELECT * FROM products ORDER BY name").all();
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (p) => p.name.toLowerCase().includes(s) || (p.sku || "").toLowerCase().includes(s)
    );
  }
  if (category && category !== "All") {
    rows = rows.filter((p) => p.category === category);
  }
  if (stockStatus === "low") {
    rows = rows.filter((p) => p.stock_qty <= p.low_stock_threshold);
  } else if (stockStatus === "in") {
    rows = rows.filter((p) => p.stock_qty > p.low_stock_threshold);
  }
  return rows;
}

function findProductBySkuOrCode(code) {
  return db.prepare("SELECT * FROM products WHERE sku = ?").get(code);
}

function createProduct(p) {
  const exists = db.prepare("SELECT id FROM products WHERE sku = ?").get(p.sku);
  if (exists) throw new Error("A product with that SKU/barcode already exists.");
  const info = db
    .prepare(
      `INSERT INTO products (sku, name, category, price, cost_price, stock_qty, unit, low_stock_threshold, notes, updated_at)
       VALUES (@sku, @name, @category, @price, @cost_price, @stock_qty, @unit, @low_stock_threshold, @notes, @updated_at)`
    )
    .run({ ...p, updated_at: nowISO() });
  return db.prepare("SELECT * FROM products WHERE id = ?").get(info.lastInsertRowid);
}

function updateProduct(id, p) {
  db.prepare(
    `UPDATE products SET sku=@sku, name=@name, category=@category, price=@price, cost_price=@cost_price,
     unit=@unit, low_stock_threshold=@low_stock_threshold, notes=@notes, updated_at=@updated_at WHERE id=@id`
  ).run({ ...p, id, updated_at: nowISO() });
  return db.prepare("SELECT * FROM products WHERE id = ?").get(id);
}

function deleteProduct(id) {
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!product) throw new Error("Product not found.");
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
  return true;
}

/**
 * Rows already carry a `valid` flag and `existsInDb` flag computed during
 * preview (see excelImport.js + the previewExcelImport handler) — this just
 * acts on that decision. New SKUs are created outright; existing SKUs are
 * either skipped or, if updateExisting is on, have their master fields
 * updated via the normal updateProduct path (which never touches stock_qty),
 * with any stock difference applied as a tracked 'correction' adjustment so
 * it still shows up in the inventory_adjustments audit trail.
 */
function bulkImportProducts(rows, { updateExisting }) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  const tx = db.transaction(() => {
    for (const row of rows) {
      if (!row.valid) {
        skipped++;
        continue;
      }
      const existing = db.prepare("SELECT * FROM products WHERE sku = ?").get(row.sku);
      if (existing) {
        if (!updateExisting) {
          skipped++;
          continue;
        }
        try {
          updateProduct(existing.id, {
            sku: row.sku,
            name: row.name,
            category: row.category || existing.category,
            price: row.price,
            cost_price: row.cost_price,
            unit: row.unit || existing.unit,
            low_stock_threshold: row.low_stock_threshold,
            notes: existing.notes
          });
          const delta = row.stock_qty - existing.stock_qty;
          if (delta !== 0) {
            adjustStock({
              productId: existing.id,
              deltaQty: delta,
              adjustmentType: "correction",
              reason: "Excel import - stock sync"
            });
          }
          updated++;
        } catch (err) {
          errors.push({ sku: row.sku, reason: err.message });
        }
      } else {
        try {
          createProduct({
            sku: row.sku,
            name: row.name,
            category: row.category || "",
            price: row.price,
            cost_price: row.cost_price,
            stock_qty: row.stock_qty,
            unit: row.unit || "pcs",
            low_stock_threshold: row.low_stock_threshold,
            notes: ""
          });
          created++;
        } catch (err) {
          errors.push({ sku: row.sku, reason: err.message });
        }
      }
    }
  });

  tx();
  return { created, updated, skipped, errors };
}

function nextLocalSeq(table) {
  const row = db.prepare(`SELECT MAX(local_seq) AS m FROM ${table}`).get();
  return (row.m || 0) + 1;
}

function adjustStock({ productId, deltaQty, adjustmentType, reason, notes }) {
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
  if (!product) throw new Error("Product not found.");
  const tx = db.transaction(() => {
    db.prepare("UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?").run(
      deltaQty,
      nowISO(),
      productId
    );
    db.prepare(
      `INSERT INTO inventory_adjustments (local_seq, product_id, sku, delta_qty, adjustment_type, reason, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(nextLocalSeq("inventory_adjustments"), productId, product.sku, deltaQty, adjustmentType, reason, notes || "", nowISO());
  });
  tx();
  return db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
}

// ---------- billing ----------

function nextBillNo() {
  const row = db.prepare("SELECT COUNT(*) AS c FROM bills").get();
  return `INV${String(row.c + 1).padStart(4, "0")}`;
}

function createBill({ items, discount, discountType, paymentMode, cashierUserId, cashierName }) {
  if (!items || items.length === 0) throw new Error("Cannot create a bill with no items.");
  const subtotal = items.reduce((sum, it) => sum + it.qty * it.unit_price, 0);
  const discountAmount = discountType === "percent" ? (subtotal * (discount || 0)) / 100 : discount || 0;
  const total = Math.max(0, subtotal - discountAmount);

  const tx = db.transaction(() => {
    const billNo = nextBillNo();
    const info = db
      .prepare(
        `INSERT INTO bills (local_seq, bill_no, subtotal, discount, discount_type, total_amount, payment_mode, cashier_user_id, cashier_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(nextLocalSeq("bills"), billNo, subtotal, discountAmount, discountType, total, paymentMode, cashierUserId, cashierName, nowISO());
    const billId = info.lastInsertRowid;

    for (const it of items) {
      // cost_price is snapshotted here (not looked up live later) for the same
      // reason unit_price already is: it needs to survive the product being
      // edited or deleted, and it's what the cloud uses to compute COGS once
      // this bill syncs, without needing the full product catalog synced too.
      const productCostPrice = it.product_id
        ? (db.prepare("SELECT cost_price FROM products WHERE id = ?").get(it.product_id)?.cost_price ?? 0)
        : 0;
      db.prepare(
        `INSERT INTO bill_items (bill_id, product_id, sku, name, qty, unit_price, cost_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(billId, it.product_id || null, it.sku || null, it.name, it.qty, it.unit_price, productCostPrice, it.qty * it.unit_price);

      if (it.product_id) {
        db.prepare("UPDATE products SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ?").run(
          it.qty,
          nowISO(),
          it.product_id
        );
        db.prepare(
          `INSERT INTO inventory_adjustments (local_seq, product_id, sku, delta_qty, adjustment_type, reason, notes, created_at)
           VALUES (?, ?, ?, ?, 'sale', 'Billing', ?, ?)`
        ).run(nextLocalSeq("inventory_adjustments"), it.product_id, it.sku, -it.qty, `Sold via ${billNo}`, nowISO());
      }
    }
    return billId;
  });

  const billId = tx();
  return getBillDetail(billId);
}

function getBillDetail(billId) {
  const bill = db.prepare("SELECT * FROM bills WHERE id = ?").get(billId);
  if (!bill) return null;
  const items = db.prepare("SELECT * FROM bill_items WHERE bill_id = ?").all(billId);
  return { ...bill, items };
}

function listBills({ startDate, endDate, paymentMode, billNo, cashier } = {}) {
  let rows = db.prepare("SELECT * FROM bills ORDER BY created_at DESC").all();
  if (startDate) rows = rows.filter((b) => b.created_at >= startDate);
  if (endDate) rows = rows.filter((b) => b.created_at <= endDate + "T23:59:59.999Z");
  if (paymentMode && paymentMode !== "All") rows = rows.filter((b) => b.payment_mode === paymentMode);
  if (billNo) rows = rows.filter((b) => b.bill_no.toLowerCase().includes(billNo.toLowerCase()));
  if (cashier && cashier !== "All") rows = rows.filter((b) => b.cashier_name === cashier);
  return rows;
}

// ---------- dashboard / reports ----------

function dashboardStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  const todaysBills = db.prepare("SELECT * FROM bills WHERE created_at >= ?").all(todayISO);
  const todaysSales = todaysBills.reduce((s, b) => s + b.total_amount, 0);
  const totalProducts = db.prepare("SELECT COUNT(*) AS c FROM products").get().c;
  const lowStock = db
    .prepare("SELECT id, name, sku, stock_qty, low_stock_threshold FROM products WHERE stock_qty <= low_stock_threshold ORDER BY stock_qty ASC")
    .all();
  const recentSales = db.prepare("SELECT * FROM bills ORDER BY created_at DESC LIMIT 5").all();

  return {
    todaysSales,
    todaysBillCount: todaysBills.length,
    totalProducts,
    lowStock,
    recentSales
  };
}

function profitLossSummary({ startDate, endDate }) {
  const bills = listBills({ startDate, endDate });
  const revenue = bills.reduce((s, b) => s + b.total_amount, 0);

  const billIds = bills.map((b) => b.id);
  let cogs = 0;
  if (billIds.length) {
    const placeholders = billIds.map(() => "?").join(",");
    const items = db
      .prepare(`SELECT bi.qty, bi.product_id FROM bill_items bi WHERE bi.bill_id IN (${placeholders})`)
      .all(...billIds);
    for (const it of items) {
      if (!it.product_id) continue;
      const product = db.prepare("SELECT cost_price FROM products WHERE id = ?").get(it.product_id);
      if (product) cogs += product.cost_price * it.qty;
    }
  }

  const expenses = db
    .prepare("SELECT * FROM expenses WHERE created_at >= ? AND created_at <= ?")
    .all(startDate || "0000", (endDate || "9999") + "T23:59:59.999Z");
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - totalExpenses;

  const byCategory = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  }

  return {
    revenue,
    cogs,
    totalExpenses,
    grossProfit,
    netProfit,
    expenseBreakdown: Object.entries(byCategory).map(([category, amount]) => ({ category, amount }))
  };
}

function listExpenses() {
  return db.prepare("SELECT * FROM expenses ORDER BY created_at DESC").all();
}

function createExpense({ category, amount, note }) {
  db.prepare("INSERT INTO expenses (local_seq, category, amount, note, created_at) VALUES (?, ?, ?, ?, ?)").run(
    nextLocalSeq("expenses"),
    category,
    amount,
    note || "",
    nowISO()
  );
  return listExpenses();
}

// ---------- cloud sync ----------

function getSyncConfig() {
  return {
    cloudApiUrl: getSetting("cloud_api_url") || "",
    shopApiKey: getSetting("shop_api_key") || "",
    lastSyncAt: getSetting("last_sync_at") || null,
    configured: !!(getSetting("cloud_api_url") && getSetting("shop_api_key"))
  };
}

function saveSyncConfig({ cloudApiUrl, shopApiKey }) {
  setSetting("cloud_api_url", cloudApiUrl.trim().replace(/\/$/, ""));
  setSetting("shop_api_key", shopApiKey.trim());
  return getSyncConfig();
}

function getUnsyncedCounts() {
  return {
    bills: db.prepare("SELECT COUNT(*) AS c FROM bills WHERE synced = 0").get().c,
    expenses: db.prepare("SELECT COUNT(*) AS c FROM expenses WHERE synced = 0").get().c
  };
}

const SYNC_BATCH_SIZE = 200;

function getUnsyncedBillsBatch() {
  const bills = db.prepare("SELECT * FROM bills WHERE synced = 0 ORDER BY local_seq LIMIT ?").all(SYNC_BATCH_SIZE);
  return bills.map((b) => ({
    ...b,
    items: db.prepare("SELECT * FROM bill_items WHERE bill_id = ?").all(b.id)
  }));
}

function getUnsyncedExpensesBatch() {
  return db.prepare("SELECT * FROM expenses WHERE synced = 0 ORDER BY local_seq LIMIT ?").all(SYNC_BATCH_SIZE);
}

function markBillsSynced(ids) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`UPDATE bills SET synced = 1 WHERE id IN (${placeholders})`).run(...ids);
}

function markExpensesSynced(ids) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`UPDATE expenses SET synced = 1 WHERE id IN (${placeholders})`).run(...ids);
}

// Read-only stock snapshot for the cloud dashboard. The hash lets sync.js skip
// re-sending the catalog when nothing about it has changed.
function getProductsForSync() {
  return db
    .prepare("SELECT sku, name, category, unit, price, cost_price, stock_qty, low_stock_threshold FROM products ORDER BY sku")
    .all();
}

function getProductsSyncedHash() {
  return getSetting("products_synced_hash") || "";
}

function setProductsSyncedHash(hash) {
  setSetting("products_synced_hash", hash);
}

function setLastSyncAt(iso) {
  setSetting("last_sync_at", iso);
}

module.exports = {
  initDb,
  getShopInfo,
  isSetupComplete,
  completeSetup,
  updateShopInfo,
  login,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listProducts,
  findProductBySkuOrCode,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkImportProducts,
  adjustStock,
  createBill,
  getBillDetail,
  listBills,
  dashboardStats,
  profitLossSummary,
  listExpenses,
  createExpense,
  getSyncConfig,
  saveSyncConfig,
  getUnsyncedCounts,
  getUnsyncedBillsBatch,
  getUnsyncedExpensesBatch,
  markBillsSynced,
  markExpensesSynced,
  getProductsForSync,
  getProductsSyncedHash,
  setProductsSyncedHash,
  setLastSyncAt
};
