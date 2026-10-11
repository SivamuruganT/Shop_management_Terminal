import React, { useState } from "react";

export default function Setup({ onComplete }) {
  const [form, setForm] = useState({
    shopName: "",
    address: "",
    phone: "",
    email: "",
    ownerName: "",
    existingShopId: "",
    adminUsername: "",
    adminPassword: "",
    confirmPassword: ""
  });
  const [isAdditionalTerminal, setIsAdditionalTerminal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    setError("");
    if (!form.shopName.trim() || !form.address.trim() || !form.ownerName.trim()) {
      setError("Shop name, address and owner name are required.");
      return;
    }
    if (isAdditionalTerminal && !form.existingShopId.trim()) {
      setError("Enter the existing Shop ID this terminal belongs to.");
      return;
    }
    if (!form.adminUsername.trim() || form.adminPassword.length < 6) {
      setError("Admin username is required and password must be at least 6 characters.");
      return;
    }
    if (form.adminPassword !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const res = await window.api.setup.complete({
      shopName: form.shopName,
      address: form.address,
      phone: form.phone,
      email: form.email,
      ownerName: form.ownerName,
      existingShopId: isAdditionalTerminal ? form.existingShopId : "",
      adminUsername: form.adminUsername,
      adminPassword: form.adminPassword
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onComplete(res.data);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
        padding: 24
      }}
    >
      <div className="card" style={{ width: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>🛒</span>
          <span style={{ fontSize: 19, fontWeight: 800 }}>
            <span style={{ color: "var(--color-primary)" }}>EC</span>
            <span style={{ color: "var(--color-navy)" }}>Bill</span>
          </span>
        </div>
        <h2 style={{ margin: "12px 0 4px 0", color: "var(--color-navy)" }}>Set up this terminal</h2>
        <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
          This runs once. It permanently identifies this installation as one terminal of one shop —
          there's no switcher later, so double-check before saving.
        </p>

        <div style={{ display: "flex", gap: 16, margin: "16px 0" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
            <input type="radio" checked={!isAdditionalTerminal} onChange={() => setIsAdditionalTerminal(false)} />
            New shop
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
            <input type="radio" checked={isAdditionalTerminal} onChange={() => setIsAdditionalTerminal(true)} />
            Additional terminal for an existing shop
          </label>
        </div>

        {isAdditionalTerminal && (
          <div style={{ marginBottom: 14 }}>
            <label className="label">Existing Shop ID</label>
            <input className="input" placeholder="e.g. SHP-A1B2C3D4" value={form.existingShopId} onChange={update("existingShopId")} />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label className="label">Shop Name *</label>
            <input className="input" value={form.shopName} onChange={update("shopName")} />
          </div>
          <div>
            <label className="label">Owner / Primary User Name *</label>
            <input className="input" value={form.ownerName} onChange={update("ownerName")} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Address *</label>
          <input className="input" value={form.address} onChange={update("address")} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={update("phone")} />
          </div>
          <div>
            <label className="label">Email (optional)</label>
            <input className="input" value={form.email} onChange={update("email")} />
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: "16px 0" }} />
        <p style={{ fontWeight: 700, color: "var(--color-navy)", marginBottom: 10 }}>Create the first admin account</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label className="label">Admin Username *</label>
            <input className="input" value={form.adminUsername} onChange={update("adminUsername")} />
          </div>
          <div />
          <div>
            <label className="label">Password *</label>
            <input className="input" type="password" value={form.adminPassword} onChange={update("adminPassword")} />
          </div>
          <div>
            <label className="label">Confirm Password *</label>
            <input className="input" type="password" value={form.confirmPassword} onChange={update("confirmPassword")} />
          </div>
        </div>

        {error && (
          <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", padding: "10px 12px", borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
            {error}
          </div>
        )}

        <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading} onClick={submit}>
          {loading ? "Setting up..." : "Complete Setup"}
        </button>
      </div>
    </div>
  );
}
