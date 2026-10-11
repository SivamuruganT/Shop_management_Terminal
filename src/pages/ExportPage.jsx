import React, { useState } from "react";

const SHEET_OPTIONS = [
  { key: "sales", label: "Sales Records", sub: "All completed bills" },
  { key: "inventory", label: "Inventory", sub: "Current stock levels & product master data" },
  { key: "expenses", label: "Expenses", sub: "All expense records" },
  { key: "profit_loss", label: "Profit & Loss", sub: "Summary data for the period" }
];

export default function ExportPage() {
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [sheets, setSheets] = useState(["sales"]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  function toggleSheet(key) {
    setSheets((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function runExport() {
    setStatus(null);
    if (sheets.length === 0) {
      setStatus({ ok: false, error: "Select at least one data set to export." });
      return;
    }
    setLoading(true);
    const res = await window.api.export.generate({ startDate, endDate, sheets });
    setLoading(false);
    if (!res.ok) {
      setStatus({ ok: false, error: res.error });
      return;
    }
    setStatus({ ok: true, ...res.data });
  }

  return (
    <div>
      <h1 className="page-title">Export Data</h1>
      <p className="page-subtitle">Export your business data for backup, reporting, or analysis — any date range, as an Excel workbook.</p>

      <div className="card" style={{ marginTop: 16, maxWidth: 640 }}>
        <p style={{ fontWeight: 700, color: "var(--color-navy)" }}>1. Select Date Range</p>
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label className="label">Start Date</label>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">End Date</label>
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <p style={{ fontWeight: 700, color: "var(--color-navy)" }}>2. Select Data to Include</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {SHEET_OPTIONS.map((s) => (
            <label
              key={s.key}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                padding: 12,
                cursor: "pointer",
                background: sheets.includes(s.key) ? "var(--color-primary-light)" : "#fff"
              }}
            >
              <input type="checkbox" checked={sheets.includes(s.key)} onChange={() => toggleSheet(s.key)} style={{ marginTop: 2 }} />
              <span>
                <div style={{ fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{s.sub}</div>
              </span>
            </label>
          ))}
        </div>

        <p style={{ fontWeight: 700, color: "var(--color-navy)" }}>3. Format</p>
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            padding: 12,
            marginBottom: 20,
            background: "var(--color-primary-light)",
            fontWeight: 600
          }}
        >
          📊 Excel (.xlsx) — the only export format in this version. One workbook, one sheet per data set selected above.
        </div>

        {status && !status.ok && (
          <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", padding: "10px 12px", borderRadius: 8, marginBottom: 14 }}>
            {status.error}
          </div>
        )}
        {status && status.ok && (
          <div style={{ background: "var(--color-success-bg)", color: "var(--color-success)", padding: "10px 12px", borderRadius: 8, marginBottom: 14 }}>
            Export completed — <strong>{status.fileName}</strong> saved to your Downloads folder.
            <div>
              <button
                onClick={() => window.api.app.showInFolder(status.filePath)}
                style={{ border: "none", background: "transparent", color: "var(--color-success)", fontWeight: 700, textDecoration: "underline", padding: 0, marginTop: 4 }}
              >
                Show in folder
              </button>
            </div>
          </div>
        )}

        <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading} onClick={runExport}>
          {loading ? "Preparing export..." : "⬇ Download"}
        </button>
      </div>
    </div>
  );
}
