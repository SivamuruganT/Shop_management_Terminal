import React, { useEffect, useRef, useState } from "react";
import { Modal } from "../components/Modal.jsx";

function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Billing({ user }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("percent");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [error, setError] = useState("");
  const [successBill, setSuccessBill] = useState(null);

  // "+ Add Custom Item" previously used window.prompt(), which Electron's
  // renderer does not implement (it silently no-ops) — that's why the button
  // looked broken. Replaced with a real modal + form state below.
  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [customError, setCustomError] = useState("");

  const searchInputRef = useRef(null);
  const scanBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    searchInputRef.current?.focus();
    function handleKeyDown(e) {
      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const code = scanBufferRef.current.trim();
        scanBufferRef.current = "";
        if (code && gap < 60) {
          lookupAndAddByCode(code);
        }
        return;
      }
      if (e.key.length === 1) {
        scanBufferRef.current = gap < 60 ? scanBufferRef.current + e.key : e.key;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchTerm.trim().length < 1) {
        setSuggestions([]);
        return;
      }
      const res = await window.api.products.list({ search: searchTerm });
      if (res.ok) setSuggestions(res.data.slice(0, 6));
    }, 150);
    return () => clearTimeout(t);
  }, [searchTerm]);

  async function lookupAndAddByCode(code) {
    setError("");
    const res = await window.api.products.findByCode(code);
    if (res.ok && res.data) {
      addToCart(res.data);
      setSearchTerm("");
    } else {
      setError(`No product found for code "${code}". Search by name, or use "+ Add Custom Item" below.`);
    }
  }

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((it) => it.product_id === product.id);
      if (existing) {
        return prev.map((it) => (it.product_id === product.id ? { ...it, qty: it.qty + 1 } : it));
      }
      return [
        ...prev,
        { product_id: product.id, sku: product.sku, name: product.name, qty: 1, unit_price: product.price }
      ];
    });
    setSearchTerm("");
    setSuggestions([]);
  }

  function openCustomItem() {
    setCustomName("");
    setCustomPrice("");
    setCustomQty("1");
    setCustomError("");
    setCustomItemOpen(true);
  }

  function submitCustomItem() {
    setCustomError("");
    if (!customName.trim()) {
      setCustomError("Enter an item name.");
      return;
    }
    const price = parseFloat(customPrice);
    if (!customPrice || isNaN(price) || price < 0) {
      setCustomError("Enter a valid price.");
      return;
    }
    const qty = parseFloat(customQty) || 1;
    setCart((prev) => [...prev, { product_id: null, sku: null, name: customName.trim(), qty, unit_price: price }]);
    setCustomItemOpen(false);
  }

  function changeQty(idx, delta) {
    setCart((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, qty: Math.max(1, it.qty + delta) } : it))
    );
  }

  function removeItem(idx) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = cart.reduce((s, it) => s + it.qty * it.unit_price, 0);
  const discountAmount = discountType === "percent" ? (subtotal * discount) / 100 : discount;
  const total = Math.max(0, subtotal - discountAmount);

  async function completeBill() {
    setError("");
    if (cart.length === 0) {
      setError("Add at least one item before completing the bill.");
      return;
    }
    const res = await window.api.bills.create({
      items: cart,
      discount,
      discountType,
      paymentMode,
      cashierUserId: user.id,
      cashierName: user.username
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccessBill(res.data);
    setCart([]);
    setDiscount(0);
  }

  function startNewBill() {
    setSuccessBill(null);
    searchInputRef.current?.focus();
  }

  return (
    <div>
      <h1 className="page-title">Billing (POS)</h1>
      <p className="page-subtitle">Scan items, or search and add products to create a bill.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginTop: 16 }}>
        <div>
          <div className="card" style={{ position: "relative" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                ref={searchInputRef}
                className="input"
                placeholder="Search products by name, barcode or SKU... (scanner input also lands here)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && suggestions[0]) addToCart(suggestions[0]);
                }}
              />
              <button className="btn btn-secondary" onClick={openCustomItem}>
                + Add Custom Item
              </button>
              <button className="btn btn-danger" onClick={() => setCart([])}>
                🗑 Clear Cart
              </button>
            </div>
            {suggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 62,
                  left: 20,
                  right: 20,
                  background: "#fff",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  boxShadow: "var(--shadow-card)",
                  zIndex: 10
                }}
              >
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      border: "none",
                      borderBottom: "1px solid var(--color-border)",
                      background: "#fff"
                    }}
                  >
                    <strong>{p.name}</strong> — {money(p.price)}{" "}
                    <span style={{ color: "var(--color-text-muted)" }}>SKU: {p.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Cart ({cart.length} items)</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((it, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>
                      {it.name}
                      {it.sku && <div style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>SKU: {it.sku}</div>}
                      {!it.product_id && <span className="badge badge-neutral" style={{ marginTop: 4 }}>Custom</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button className="btn btn-secondary" style={{ padding: "2px 8px" }} onClick={() => changeQty(idx, -1)}>
                          −
                        </button>
                        {it.qty}
                        <button className="btn btn-secondary" style={{ padding: "2px 8px" }} onClick={() => changeQty(idx, 1)}>
                          +
                        </button>
                      </div>
                    </td>
                    <td>{money(it.unit_price)}</td>
                    <td>{money(it.qty * it.unit_price)}</td>
                    <td>
                      <button className="btn btn-danger" style={{ padding: "4px 10px" }} onClick={() => removeItem(idx)}>
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ color: "var(--color-text-muted)" }}>
                      Cart is empty — scan or search a product to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Bill Summary</h3>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              className="input"
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              style={{ flex: 1 }}
            />
            <select className="input" style={{ width: 90 }} value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
              <option value="percent">%</option>
              <option value="flat">₹</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, color: "var(--color-text-muted)" }}>
            <span>Discount</span>
            <span>- {money(discountAmount)}</span>
          </div>
          <hr style={{ border: "none", borderTop: "1px solid var(--color-border)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18, margin: "10px 0", color: "var(--color-navy)" }}>
            <span>Total</span>
            <span>{money(total)}</span>
          </div>

          <p className="label" style={{ marginTop: 16 }}>
            Payment Mode
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {["Cash", "UPI", "Card", "Other"].map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMode(m)}
                className="btn"
                style={{
                  background: paymentMode === m ? "var(--color-primary)" : "#fff",
                  color: paymentMode === m ? "#fff" : "var(--color-text)",
                  border: "1px solid var(--color-border)"
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", padding: "10px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13.5 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" style={{ width: "100%" }} onClick={completeBill}>
            ✓ Complete Bill
          </button>
        </div>
      </div>

      {customItemOpen && (
        <Modal title="Add Custom Item" onClose={() => setCustomItemOpen(false)} width={380}>
          <label className="label">Item Name *</label>
          <input
            className="input"
            style={{ marginBottom: 12 }}
            placeholder="e.g. Gift wrapping"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            autoFocus
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label className="label">Unit Price (₹) *</label>
              <input
                className="input"
                type="number"
                placeholder="0.00"
                value={customPrice}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setCustomPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Qty</label>
              <input
                className="input"
                type="number"
                value={customQty}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setCustomQty(e.target.value)}
              />
            </div>
          </div>
          {customError && (
            <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
              {customError}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setCustomItemOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={submitCustomItem}>
              Add to Cart
            </button>
          </div>
        </Modal>
      )}

      {successBill && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ textAlign: "center", width: 360 }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <h2 style={{ color: "var(--color-navy)", margin: "8px 0 4px" }}>Bill Created Successfully!</h2>
            <p style={{ color: "var(--color-text-muted)" }}>#{successBill.bill_no}</p>
            <div style={{ fontSize: 26, fontWeight: 800, margin: "8px 0 20px", color: "var(--color-primary-dark)" }}>
              {money(successBill.total_amount)}
            </div>
            <button className="btn btn-primary" style={{ width: "100%", marginBottom: 8 }} onClick={startNewBill}>
              + New Bill
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
