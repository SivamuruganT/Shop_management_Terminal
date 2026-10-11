import React, { useEffect, useState } from "react";

const CATEGORIES = ["Rent", "Electricity", "Salaries", "Transport", "Maintenance", "Packaging", "Supplies", "Other"];

function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await window.api.expenses.list();
    if (res.ok) setExpenses(res.data);
  }

  async function save() {
    setError("");
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    const res = await window.api.expenses.create({ category, amount: value, note: note.trim() });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setExpenses(res.data);
    setAmount("");
    setNote("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const now = new Date();
  const todayTotal = expenses.filter((e) => sameLocalDay(new Date(e.created_at), now)).reduce((s, e) => s + e.amount, 0);
  const monthTotal = expenses
    .filter((e) => {
      const d = new Date(e.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <h1 className="page-title">Expenses</h1>
      <p className="page-subtitle">Record shop expenses. They count against profit in Profit &amp; Loss and sync to the cloud dashboard.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 16 }}>
        <div className="card">
          <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Today</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#d97706" }}>{money(todayTotal)}</div>
        </div>
        <div className="card">
          <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>This Month</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#d97706" }}>{money(monthTotal)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Recent Expenses</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Note</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Cloud</th>
              </tr>
            </thead>
            <tbody>
              {expenses.slice(0, 100).map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.created_at).toLocaleString()}</td>
                  <td>{e.category}</td>
                  <td>{e.note || "—"}</td>
                  <td style={{ textAlign: "right" }}>{money(e.amount)}</td>
                  <td>
                    <span className={`badge ${e.synced ? "badge-success" : "badge-neutral"}`}>{e.synced ? "Synced" : "Pending"}</span>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "var(--color-text-muted)" }}>
                    No expenses recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ alignSelf: "start" }}>
          <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Add Expense</h3>
          <label className="label">Category</label>
          <select className="input" style={{ marginBottom: 10 }} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="label">Amount (₹)</label>
          <input
            className="input"
            style={{ marginBottom: 10 }}
            type="number"
            min="0"
            placeholder="0.00"
            value={amount}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setAmount(e.target.value)}
          />
          <label className="label">Note (optional)</label>
          <input className="input" style={{ marginBottom: 14 }} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && (
            <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
              {error}
            </div>
          )}
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={save}>
            {saved ? "Saved ✓" : "Add Expense"}
          </button>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 0 }}>
            Expenses can't be edited or deleted once saved, so the cloud copy always matches. Double-check the amount before adding.
          </p>
        </div>
      </div>
    </div>
  );
}
