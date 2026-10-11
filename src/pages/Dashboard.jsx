import React, { useEffect, useState } from "react";

function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Dashboard({ user, onNavigate }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await window.api.dashboard.stats();
    if (res.ok) setStats(res.data);
  }

  if (!stats) return <div>Loading...</div>;

  const cards = [
    { label: "Today's Sales", value: money(stats.todaysSales), icon: "💰" },
    { label: "Today's Bills", value: stats.todaysBillCount, icon: "🧾" },
    { label: "Products Tracked", value: stats.totalProducts, icon: "📦" }
  ];

  return (
    <div>
      <h1 className="page-title">Good day, {user.username}!</h1>
      <p className="page-subtitle">Here's what's happening at your shop today.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, margin: "20px 0" }}>
        {cards.map((c) => (
          <div key={c.label} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 26 }}>{c.icon}</span>
            <div>
              <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-navy)" }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Recent Sales</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill No</th>
                <th>Time</th>
                <th>Payment</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentSales.map((b) => (
                <tr key={b.id}>
                  <td>#{b.bill_no}</td>
                  <td>{new Date(b.created_at).toLocaleTimeString()}</td>
                  <td>{b.payment_mode}</td>
                  <td>{money(b.total_amount)}</td>
                </tr>
              ))}
              {stats.recentSales.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: "var(--color-text-muted)" }}>
                    No sales yet today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Low Stock Alerts</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Stock</th>
                <th>Threshold</th>
              </tr>
            </thead>
            <tbody>
              {stats.lowStock.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td style={{ color: "var(--color-danger)", fontWeight: 700 }}>{p.stock_qty}</td>
                  <td>{p.low_stock_threshold}</td>
                </tr>
              ))}
              {stats.lowStock.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ color: "var(--color-text-muted)" }}>
                    Nothing running low right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 16 }} className="card">
        <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Quick Actions</h3>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-primary" onClick={() => onNavigate("billing")}>
            🛒 New Bill
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate("inventory")}>
            📦 Add Product
          </button>
        </div>
      </div>
    </div>
  );
}
