import React, { useEffect, useState } from "react";

export default function Settings() {
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

  const [syncStatus, setSyncStatus] = useState(null);
  const [syncForm, setSyncForm] = useState({ cloudApiUrl: "", shopApiKey: "" });
  const [syncSaved, setSyncSaved] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    load();
    loadSyncStatus();
  }, []);

  async function load() {
    const res = await window.api.setup.get();
    if (res.ok) {
      setInfo(res.data);
      setForm(res.data);
    }
  }

  async function loadSyncStatus() {
    const res = await window.api.sync.status();
    if (res.ok) {
      setSyncStatus(res.data);
      setSyncForm({ cloudApiUrl: res.data.cloudApiUrl, shopApiKey: res.data.shopApiKey });
    }
  }

  async function saveSyncConfig() {
    setSyncError("");
    if (!syncForm.cloudApiUrl.trim() || !syncForm.shopApiKey.trim()) {
      setSyncError("Both the Cloud API URL and the Shop API Key are required.");
      return;
    }
    const res = await window.api.sync.saveConfig(syncForm);
    if (!res.ok) {
      setSyncError(res.error);
      return;
    }
    setSyncStatus((prev) => ({ ...prev, ...res.data }));
    setSyncSaved(true);
    setTimeout(() => setSyncSaved(false), 2000);
    loadSyncStatus();
  }

  async function runSyncNow() {
    setSyncRunning(true);
    setSyncError("");
    setSyncResult(null);
    const res = await window.api.sync.now();
    setSyncRunning(false);
    if (!res.ok) {
      setSyncError(res.error);
      return;
    }
    setSyncResult(res.data);
    loadSyncStatus();
  }

  if (!info || !form) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Configure your shop, hardware and system preferences.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>System Information</h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
            System ID, Shop ID and Terminal ID were generated once during setup and cannot be changed here — there is
            deliberately no way to re-run setup or point this install at a different shop.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label className="label">System ID</label>
              <input className="input" value={info.system_id} disabled />
            </div>
            <div>
              <label className="label">Shop ID</label>
              <input className="input" value={info.shop_id} disabled />
            </div>
            <div>
              <label className="label">Terminal ID</label>
              <input className="input" value={info.terminal_id} disabled />
            </div>
          </div>

          <label className="label">Shop Name *</label>
          <input className="input" style={{ marginBottom: 10 }} value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} />
          <label className="label">Address *</label>
          <input className="input" style={{ marginBottom: 10 }} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label className="label">Phone Number</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email (Optional)</label>
              <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <label className="label">Owner / Primary User Name *</label>
          <input className="input" style={{ marginBottom: 14 }} value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />

          {saved && (
            <div style={{ background: "var(--color-success-bg)", color: "var(--color-success)", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
              Saved.
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={async () => {
              const res = await window.api.setup.updateShopInfo({
                shopName: form.shop_name,
                address: form.address,
                phone: form.phone,
                email: form.email,
                ownerName: form.owner_name
              });
              if (res.ok) {
                setInfo(res.data);
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }
            }}
          >
            Save Changes
          </button>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Scanner Test & Diagnostics</h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
            Most barcode/QR scanners act as keyboard-wedge devices — scan into the Billing search box directly. This
            panel is a lightweight sanity check.
          </p>
          <label className="label">Scanner Input (Live)</label>
          <input className="input" style={{ marginBottom: 14 }} placeholder="Click here, then scan any barcode..." />
          <div style={{ background: "var(--color-primary-light)", borderRadius: 8, padding: 12, fontSize: 13 }}>
            <strong>Troubleshooting</strong>
            <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
              <li>Ensure the scanner is connected via USB.</li>
              <li>Most scanners need no special drivers (keyboard mode).</li>
              <li>If nothing appears, try scanning a known product code.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Sync (Cloud)</h3>
        <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
          Get the Cloud API URL and this shop's API Key from the admin web dashboard's Shops page — register this shop
          there using the exact Shop ID shown above ({info.shop_id}), then paste the key it gives you here. Syncs
          automatically every 5 minutes in the background once configured, or trigger one manually below.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label className="label">Cloud API URL</label>
            <input
              className="input"
              style={{ marginBottom: 10 }}
              placeholder="https://your-app.onrender.com"
              value={syncForm.cloudApiUrl}
              onChange={(e) => setSyncForm({ ...syncForm, cloudApiUrl: e.target.value })}
            />
            <label className="label">Shop API Key</label>
            <input
              className="input"
              style={{ marginBottom: 10 }}
              type="password"
              placeholder="Paste the key from the admin dashboard"
              value={syncForm.shopApiKey}
              onChange={(e) => setSyncForm({ ...syncForm, shopApiKey: e.target.value })}
            />

            {syncError && (
              <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 13 }}>
                {syncError}
              </div>
            )}
            {syncSaved && (
              <div style={{ background: "var(--color-success-bg)", color: "var(--color-success)", padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 13 }}>
                Saved.
              </div>
            )}

            <button className="btn btn-primary" style={{ width: "100%" }} onClick={saveSyncConfig}>
              Save Sync Settings
            </button>
          </div>

          <div>
            <p style={{ fontWeight: 700, color: "var(--color-navy)", marginBottom: 10 }}>Status</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <span style={{ color: "var(--color-text-muted)" }}>Configured</span>
                <span className={`badge ${syncStatus?.configured ? "badge-success" : "badge-warning"}`}>
                  {syncStatus?.configured ? "Yes" : "Not Configured"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <span style={{ color: "var(--color-text-muted)" }}>Last Sync</span>
                <span>{syncStatus?.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : "Never"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <span style={{ color: "var(--color-text-muted)" }}>Pending Bills</span>
                <span>{syncStatus?.pending?.bills ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <span style={{ color: "var(--color-text-muted)" }}>Pending Expenses</span>
                <span>{syncStatus?.pending?.expenses ?? "—"}</span>
              </div>
            </div>

            {syncResult && (
              <div style={{ background: "var(--color-success-bg)", color: "var(--color-success)", padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 13 }}>
                {syncResult.message || `Synced ${syncResult.billsSynced} bill(s) and ${syncResult.expensesSynced} expense(s).`}
                {syncResult.hasMore && " More remain — run Sync Now again to continue."}
              </div>
            )}

            <button className="btn btn-secondary" style={{ width: "100%" }} disabled={syncRunning || !syncStatus?.configured} onClick={runSyncNow}>
              {syncRunning ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
