import React, { useEffect, useState } from "react";

function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SalesHistory() {
  const [bills, setBills] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentMode, setPaymentMode] = useState("All");
  const [billNo, setBillNo] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await window.api.bills.list({ startDate, endDate, paymentMode, billNo });
    if (res.ok) setBills(res.data);
  }

  async function viewBill(id) {
    const res = await window.api.bills.get(id);
    if (res.ok) setSelectedBill(res.data);
  }

  const totalSales = bills.reduce((s, b) => s + b.total_amount, 0);

  return (
    <div>
      <h1 className="page-title">Sales History</h1>
      <p className="page-subtitle">View and manage all sales records.</p>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <label className="label">Start Date</label>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">End Date</label>
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Payment Mode</label>
            <select className="input" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              <option>All</option>
              <option>Cash</option>
              <option>UPI</option>
              <option>Card</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="label">Bill No.</label>
            <input className="input" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Search bill number" />
          </div>
          <button className="btn btn-primary" onClick={load}>
            Apply Filters
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, color: "var(--color-navy)" }}>Sales Records</h3>
          <div style={{ color: "var(--color-text-muted)" }}>
            Total Bills: <strong>{bills.length}</strong> &nbsp;·&nbsp; Total Sales: <strong>{money(totalSales)}</strong>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Bill No</th>
              <th>Date & Time</th>
              <th>Payment Mode</th>
              <th>Cashier</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id}>
                <td>#{b.bill_no}</td>
                <td>{new Date(b.created_at).toLocaleString()}</td>
                <td>{b.payment_mode}</td>
                <td>{b.cashier_name}</td>
                <td>{money(b.total_amount)}</td>
                <td>
                  <button className="btn btn-secondary" style={{ padding: "4px 10px" }} onClick={() => viewBill(b.id)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
            {bills.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--color-text-muted)" }}>
                  No sales records match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedBill && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: 460 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: "var(--color-navy)" }}>Bill #{selectedBill.bill_no}</h3>
              <button onClick={() => setSelectedBill(null)} style={{ border: "none", background: "transparent", fontSize: 18 }}>
                ✕
              </button>
            </div>
            <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
              {new Date(selectedBill.created_at).toLocaleString()} · Cashier: {selectedBill.cashier_name}
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedBill.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.name}</td>
                    <td>{it.qty}</td>
                    <td>{money(it.unit_price)}</td>
                    <td>{money(it.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 14, textAlign: "right" }}>
              <div>Subtotal: {money(selectedBill.subtotal)}</div>
              <div>Discount: -{money(selectedBill.discount)}</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "var(--color-navy)" }}>
                Total: {money(selectedBill.total_amount)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
