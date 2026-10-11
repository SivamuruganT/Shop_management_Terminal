import React, { useEffect, useState } from "react";

function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function defaultRange() {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { start, end };
}

export default function ProfitLoss() {
  const initial = defaultRange();
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await window.api.pnl.summary({ startDate, endDate });
    if (res.ok) setSummary(res.data);
  }

  return (
    <div>
      <h1 className="page-title">Profit & Loss Summary</h1>
      <p className="page-subtitle">View your business performance and profitability.</p>

      <div className="card" style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "end" }}>
        <div>
          <label className="label">Start Date</label>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="label">End Date</label>
          <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={load}>
          Apply
        </button>
      </div>

      {summary && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, margin: "16px 0" }}>
            {[
              ["Total Revenue", summary.revenue, "var(--color-success)"],
              ["Cost of Goods Sold", summary.cogs, "#2563eb"],
              ["Total Expenses", summary.totalExpenses, "#d97706"],
              ["Net Profit", summary.netProfit, "var(--color-primary-dark)"]
            ].map(([label, value, color]) => (
              <div key={label} className="card">
                <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{money(value)}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="card">
              <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Expense Breakdown</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.expenseBreakdown.map((e) => (
                    <tr key={e.category}>
                      <td>{e.category}</td>
                      <td>{money(e.amount)}</td>
                    </tr>
                  ))}
                  {summary.expenseBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ color: "var(--color-text-muted)" }}>
                        No expenses recorded in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Summary</h3>
              <table className="data-table">
                <tbody>
                  <tr>
                    <td>Total Revenue</td>
                    <td>{money(summary.revenue)}</td>
                  </tr>
                  <tr>
                    <td>Cost of Goods Sold</td>
                    <td>{money(summary.cogs)}</td>
                  </tr>
                  <tr style={{ fontWeight: 700 }}>
                    <td>Gross Profit</td>
                    <td>{money(summary.grossProfit)}</td>
                  </tr>
                  <tr>
                    <td>Total Expenses</td>
                    <td>{money(summary.totalExpenses)}</td>
                  </tr>
                  <tr style={{ fontWeight: 800, color: "var(--color-primary-dark)" }}>
                    <td>Net Profit</td>
                    <td>{money(summary.netProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
