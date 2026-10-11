import React, { useEffect, useState } from "react";
import { ConfirmModal } from "../components/Modal.jsx";
import ImportExcelModal from "../components/ImportExcelModal.jsx";

// Numeric fields default to empty string, NOT 0. <input type="number"> never
// auto-strips what you type — if the field already contains the literal text
// "0" and you type "1" "0" without clearing it first, Chromium/Electron will
// happily display "010" as raw text. Starting empty (with a placeholder)
// means there's nothing to collide with. Parsed to a real number only at
// save time (see toPayload below).
const emptyProduct = {
  sku: "",
  name: "",
  category: "",
  price: "",
  cost_price: "",
  stock_qty: "",
  unit: "pcs",
  low_stock_threshold: "",
  notes: ""
};

function toPayload(form) {
  return {
    ...form,
    price: parseFloat(form.price) || 0,
    cost_price: parseFloat(form.cost_price) || 0,
    stock_qty: parseFloat(form.stock_qty) || 0,
    low_stock_threshold: form.low_stock_threshold === "" ? 5 : parseFloat(form.low_stock_threshold) || 0
  };
}

// When editing an existing product, numeric values come back from SQLite as
// real numbers — convert to string for the controlled inputs so React doesn't
// fight the DOM over number-vs-string, and so clicking in and selecting-all
// (see onFocus below) behaves normally.
function toFormStrings(p) {
  return {
    ...p,
    price: String(p.price),
    cost_price: String(p.cost_price),
    stock_qty: String(p.stock_qty),
    low_stock_threshold: String(p.low_stock_threshold)
  };
}

function selectAllOnFocus(e) {
  e.target.select();
}

export default function Inventory({ user }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [stockStatus, setStockStatus] = useState("All");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustType, setAdjustType] = useState("restock");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    load();
  }, [search, stockStatus]);

  async function load() {
    const res = await window.api.products.list({ search, stockStatus: stockStatus === "All" ? undefined : stockStatus });
    if (res.ok) setProducts(res.data);
  }

  function startEdit(p) {
    setEditing(p);
    setForm(toFormStrings(p));
  }

  function startNew() {
    setEditing({});
    setForm(emptyProduct);
  }

  async function saveProduct() {
    setError("");
    if (!form.sku.trim() || !form.name.trim()) {
      setError("SKU/Barcode and Product Name are required.");
      return;
    }
    const payload = toPayload(form);
    const res = editing?.id ? await window.api.products.update(editing.id, payload) : await window.api.products.create(payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing(null);
    setForm(emptyProduct);
    load();
  }

  async function submitAdjustment() {
    setError("");
    if (!adjustProductId) {
      setError("Select a product to adjust.");
      return;
    }
    const qty = parseFloat(adjustQty) || 0;
    if (qty <= 0) {
      setError("Enter a quantity greater than 0.");
      return;
    }
    const delta = adjustType === "wastage" || adjustType === "correction-remove" ? -qty : qty;
    const res = await window.api.products.adjustStock({
      productId: Number(adjustProductId),
      deltaQty: delta,
      adjustmentType: adjustType,
      reason: adjustReason || adjustType
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAdjustProductId("");
    setAdjustQty("");
    setAdjustReason("");
    load();
  }

  async function confirmDeleteProduct() {
    const res = await window.api.products.delete(deleteTarget.id);
    setDeleteTarget(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (editing?.id === deleteTarget.id) {
      setEditing(null);
      setForm(emptyProduct);
    }
    load();
  }

  const lowStock = products.filter((p) => p.stock_qty <= p.low_stock_threshold);

  return (
    <div>
      <h1 className="page-title">Inventory</h1>
      <p className="page-subtitle">Manage your products, stock levels and adjustments — one screen for all of it.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginTop: 16 }}>
        <div>
          <div className="card">
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <input className="input" placeholder="Search by name, SKU or barcode..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="input" style={{ width: 160 }} value={stockStatus} onChange={(e) => setStockStatus(e.target.value)}>
                <option value="All">All Stock Status</option>
                <option value="low">Low Stock</option>
                <option value="in">In Stock</option>
              </select>
              <button className="btn btn-secondary" onClick={() => setImportOpen(true)}>
                ⬆ Import Excel
              </button>
              <button className="btn btn-primary" onClick={startNew}>
                + Add Product
              </button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.sku}</td>
                    <td>₹{p.price}</td>
                    <td>{p.stock_qty}</td>
                    <td>
                      <span className={`badge ${p.stock_qty <= p.low_stock_threshold ? "badge-danger" : "badge-success"}`}>
                        {p.stock_qty <= p.low_stock_threshold ? "Low Stock" : "In Stock"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-secondary" style={{ padding: "4px 10px" }} onClick={() => startEdit(p)}>
                          Edit
                        </button>
                        <button className="btn btn-danger" style={{ padding: "4px 10px" }} onClick={() => setDeleteTarget(p)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ color: "var(--color-text-muted)" }}>
                      No products yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {lowStock.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Low Stock Items ({lowStock.length})</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td style={{ color: "var(--color-danger)", fontWeight: 700 }}>{p.stock_qty}</td>
                      <td>{p.low_stock_threshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          {editing !== null && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>{editing?.id ? "Edit Product" : "Add Product"}</h3>
              <label className="label">SKU / Barcode *</label>
              <input className="input" style={{ marginBottom: 10 }} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              <label className="label">Product Name *</label>
              <input className="input" style={{ marginBottom: 10 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label className="label">Price (₹) *</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="0.00"
                    value={form.price}
                    onFocus={selectAllOnFocus}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Cost Price (₹) *</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="0.00"
                    value={form.cost_price}
                    onFocus={selectAllOnFocus}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label className="label">Stock Qty</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="0"
                    value={form.stock_qty}
                    disabled={!!editing?.id}
                    onFocus={selectAllOnFocus}
                    onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                  />
                  {editing?.id && (
                    <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 4 }}>
                      Use Stock Adjustment (right) to change quantity — keeps an audit trail.
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="ream">ream</option>
                    <option value="box">box</option>
                  </select>
                </div>
              </div>
              <label className="label">Low Stock Threshold</label>
              <input
                className="input"
                style={{ marginBottom: 10 }}
                type="number"
                placeholder="5"
                value={form.low_stock_threshold}
                onFocus={selectAllOnFocus}
                onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
              />
              <label className="label">Category</label>
              <input className="input" style={{ marginBottom: 14 }} value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />

              {error && (
                <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveProduct}>
                  Save Product
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Stock Adjustment</h3>
            <label className="label">Product *</label>
            <select className="input" style={{ marginBottom: 10 }} value={adjustProductId} onChange={(e) => setAdjustProductId(e.target.value)}>
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
            <label className="label">Adjustment Type *</label>
            <select className="input" style={{ marginBottom: 10 }} value={adjustType} onChange={(e) => setAdjustType(e.target.value)}>
              <option value="restock">Restock (+)</option>
              <option value="wastage">Wastage (−)</option>
              <option value="correction-remove">Correction (−)</option>
              <option value="correction-add">Correction (+)</option>
            </select>
            <label className="label">Quantity Change *</label>
            <input
              className="input"
              style={{ marginBottom: 10 }}
              type="number"
              placeholder="0"
              value={adjustQty}
              onFocus={selectAllOnFocus}
              onChange={(e) => setAdjustQty(e.target.value)}
            />
            <label className="label">Notes</label>
            <textarea className="input" style={{ marginBottom: 14 }} rows={2} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={submitAdjustment}>
              Update Stock
            </button>
          </div>
        </div>
      </div>

      {importOpen && (
        <ImportExcelModal
          onClose={() => setImportOpen(false)}
          onImported={load}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete this product?"
          message={`"${deleteTarget.name}" (SKU: ${deleteTarget.sku}) will be removed from the catalog, billing search, and stock adjustment. Past sales and adjustment records already reference a saved snapshot, so this won't affect historical reports. This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDeleteProduct}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
