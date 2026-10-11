import React, { useState } from "react";

export default function Login({ onLoggedIn }) {
  const [role, setRole] = useState("worker");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (!username.trim() || !password) {
      setError("Enter both username and password.");
      return;
    }
    setLoading(true);
    const res = await window.api.auth.login(username.trim(), password, role);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onLoggedIn(res.data);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--color-bg)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 34 }}>🛒</span>
          <span style={{ fontSize: 30, fontWeight: 800 }}>
            <span style={{ color: "var(--color-primary)" }}>EC</span>
            <span style={{ color: "var(--color-navy)" }}>Bill</span>
          </span>
        </div>
        <div style={{ fontSize: 12, letterSpacing: 2, color: "var(--color-text-muted)", marginTop: 4, marginBottom: 32 }}>
          BILL &nbsp;|&nbsp; INVENTORY &nbsp;|&nbsp; GROW
        </div>
        {[
          ["🧾", "Fast Billing", "Quick and easy sales"],
          ["📦", "Inventory Management", "Track stock with confidence"],
          ["📊", "Business Insights", "Understand. Plan. Grow."]
        ].map(([icon, title, sub]) => (
          <div key={title} style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "var(--color-primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18
              }}
            >
              {icon}
            </span>
            <div>
              <div style={{ fontWeight: 700, color: "var(--color-navy)" }}>{title}</div>
              <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="card" style={{ width: 420 }}>
          <h2 style={{ margin: "0 0 4px 0", color: "var(--color-navy)", fontSize: 26 }}>Welcome</h2>
          <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
            Login to access <span style={{ color: "var(--color-primary)", fontWeight: 700 }}>ECBill</span>
          </p>

          <div style={{ display: "flex", background: "#eef1f3", borderRadius: 999, padding: 4, marginBottom: 20 }}>
            {["worker", "admin"].map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className="btn"
                style={{
                  flex: 1,
                  background: role === r ? "var(--color-primary)" : "transparent",
                  color: role === r ? "#fff" : "var(--color-text)",
                  borderRadius: 999
                }}
              >
                {r === "worker" ? "👤 WORKER" : "🛡️ ADMIN"}
              </button>
            ))}
          </div>

          <label className="label">Username</label>
          <input
            className="input"
            style={{ marginBottom: 14 }}
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />

          <label className="label">Password</label>
          <div style={{ position: "relative", marginBottom: 6 }}>
            <input
              className="input"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button
              onClick={() => setShowPassword((s) => !s)}
              style={{ position: "absolute", right: 10, top: 9, border: "none", background: "transparent" }}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          {error && (
            <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", padding: "10px 12px", borderRadius: 8, marginTop: 12, fontSize: 13.5 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} disabled={loading} onClick={submit}>
            {loading ? "Logging in..." : "→ LOGIN"}
          </button>

          <div style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 12, marginTop: 18 }}>
            🔒 Secured Access
          </div>
        </div>
      </div>
    </div>
  );
}
