const crypto = require("crypto");
const dbLayer = require("./db");

/**
 * Converts a local bill (with its bill_items) into the shape the cloud
 * sync endpoint expects, including the recordKey that makes the whole
 * operation idempotent - re-sending this exact bill again after a crash
 * mid-sync just upserts the same document instead of duplicating it.
 */
function toCloudBill(bill, shopId, terminalId) {
  return {
    recordKey: `${shopId}:${terminalId}:bills:${bill.local_seq}`,
    localSeq: bill.local_seq,
    billNo: bill.bill_no,
    subtotal: bill.subtotal,
    discount: bill.discount,
    discountType: bill.discount_type,
    totalAmount: bill.total_amount,
    paymentMode: bill.payment_mode,
    cashierName: bill.cashier_name,
    createdAt: bill.created_at,
    items: bill.items.map((it) => ({
      sku: it.sku,
      name: it.name,
      qty: it.qty,
      unitPrice: it.unit_price,
      costPrice: it.cost_price,
      lineTotal: it.line_total
    }))
  };
}

function toCloudExpense(expense, shopId, terminalId) {
  return {
    recordKey: `${shopId}:${terminalId}:expenses:${expense.local_seq}`,
    localSeq: expense.local_seq,
    category: expense.category,
    amount: expense.amount,
    note: expense.note,
    createdAt: expense.created_at
  };
}

/**
 * One sync pass: gather up to one batch of unsynced bills and expenses,
 * push them, mark whatever the server actually accepted as synced. Never
 * throws out to the caller on a network failure - sync is best-effort and
 * must never interrupt billing, so failures are returned as a result object
 * instead.
 */
async function runSync() {
  const config = dbLayer.getSyncConfig();
  if (!config.configured) {
    return { ok: false, error: "Sync isn't configured yet. Add your Cloud API URL and Shop API Key in Settings." };
  }

  const shopInfo = dbLayer.getShopInfo();
  const bills = dbLayer.getUnsyncedBillsBatch();
  const expenses = dbLayer.getUnsyncedExpensesBatch();

  // Stock snapshot: only sent when the catalog or any stock count changed
  // since the last accepted snapshot.
  const products = dbLayer.getProductsForSync();
  const productsHash = crypto.createHash("sha1").update(JSON.stringify(products)).digest("hex");
  const productsChanged = productsHash !== dbLayer.getProductsSyncedHash();

  if (bills.length === 0 && expenses.length === 0 && !productsChanged) {
    dbLayer.setLastSyncAt(new Date().toISOString());
    return { ok: true, billsSynced: 0, expensesSynced: 0, message: "Already up to date." };
  }

  const payload = {
    shopId: shopInfo.shop_id,
    apiKey: config.shopApiKey,
    terminalId: shopInfo.terminal_id,
    bills: bills.map((b) => toCloudBill(b, shopInfo.shop_id, shopInfo.terminal_id)),
    expenses: expenses.map((e) => toCloudExpense(e, shopInfo.shop_id, shopInfo.terminal_id))
  };
  if (productsChanged) {
    payload.products = products.map((p) => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      unit: p.unit,
      price: p.price,
      costPrice: p.cost_price,
      stockQty: p.stock_qty,
      lowStockThreshold: p.low_stock_threshold
    }));
  }

  let response;
  try {
    response = await fetch(`${config.cloudApiUrl}/api/sync/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    return { ok: false, error: `Couldn't reach the cloud server: ${err.message}` };
  }

  if (!response.ok) {
    let errorMsg = `Server responded with ${response.status}`;
    try {
      const body = await response.json();
      if (body.error) errorMsg = body.error;
    } catch {
      /* response body wasn't JSON - keep the generic status message */
    }
    return { ok: false, error: errorMsg };
  }

  const result = await response.json();
  const acceptedBillKeys = new Set(result.acceptedBillKeys || []);
  const acceptedExpenseKeys = new Set(result.acceptedExpenseKeys || []);

  const syncedBillIds = bills.filter((b) => acceptedBillKeys.has(`${shopInfo.shop_id}:${shopInfo.terminal_id}:bills:${b.local_seq}`)).map((b) => b.id);
  const syncedExpenseIds = expenses
    .filter((e) => acceptedExpenseKeys.has(`${shopInfo.shop_id}:${shopInfo.terminal_id}:expenses:${e.local_seq}`))
    .map((e) => e.id);

  if (productsChanged && result.productsAccepted) dbLayer.setProductsSyncedHash(productsHash);
  dbLayer.markBillsSynced(syncedBillIds);
  dbLayer.markExpensesSynced(syncedExpenseIds);
  dbLayer.setLastSyncAt(new Date().toISOString());

  return {
    ok: true,
    billsSynced: syncedBillIds.length,
    expensesSynced: syncedExpenseIds.length,
    hasMore: bills.length === 200 || expenses.length === 200 // batch was full, more may be waiting
  };
}

// ---- single-flight + status tracking + "sync soon" scheduling ----
const state = { running: false, lastAttemptAt: null, lastError: null };
let inflight = null;
let soonTimer = null;

/**
 * Only one sync runs at a time: the 5-minute timer, a post-bill trigger and
 * the Sync Now button can all fire together, and two overlapping passes
 * would send the same batch twice. Callers that arrive mid-sync just wait
 * for (and share) the one already running.
 */
function syncNow() {
  if (inflight) return inflight;
  state.running = true;
  state.lastAttemptAt = new Date().toISOString();
  inflight = runSync()
    .then((result) => {
      state.lastError = result.ok ? null : result.error;
      if (result.ok && result.hasMore) scheduleSync(1000); // batch was full - keep going
      return result;
    })
    .catch((err) => {
      state.lastError = err.message;
      return { ok: false, error: err.message };
    })
    .finally(() => {
      state.running = false;
      inflight = null;
    });
  return inflight;
}

/**
 * Called after a bill, expense or stock change is saved. Waits a few seconds
 * so a burst of changes (scanning several items, an Excel import) becomes
 * one sync instead of many. Does nothing if sync isn't configured, and never
 * throws - billing must never wait on or fail because of the network.
 */
function scheduleSync(delayMs = 3000) {
  if (soonTimer) clearTimeout(soonTimer);
  soonTimer = setTimeout(() => {
    soonTimer = null;
    try {
      if (!dbLayer.getSyncConfig().configured) return;
      syncNow();
    } catch {
      /* best-effort */
    }
  }, delayMs);
}

// Safe for the UI: no API key in here, unlike getSyncConfig().
function getSyncSummary() {
  const config = dbLayer.getSyncConfig();
  return {
    configured: config.configured,
    lastSyncAt: config.lastSyncAt,
    lastAttemptAt: state.lastAttemptAt,
    lastError: state.lastError,
    running: state.running,
    pending: dbLayer.getUnsyncedCounts()
  };
}

module.exports = { syncNow, scheduleSync, getSyncSummary };
