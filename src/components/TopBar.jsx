import React, { useState } from "react";

export default function TopBar({ shopName, user, onLogoutRequest }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      style={{
        height: 64,
        borderBottom: "1px solid var(--color-border)",
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-navy)", fontWeight: 600 }}>
        <span>🏬</span>
        <span>{shopName || "Shop"}</span>
      </div>

      <div style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "none",
            background: "transparent",
            padding: "6px 8px",
            borderRadius: 8
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "var(--color-primary-light)",
              color: "var(--color-primary-dark)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 13
            }}
          >
            {(user?.username || "?").slice(0, 2).toUpperCase()}
          </span>
          <span style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--color-navy)" }}>{user?.username}</div>
            <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", textTransform: "capitalize" }}>{user?.role}</div>
          </span>
        </button>

        {menuOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 48,
              background: "#fff",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              boxShadow: "var(--shadow-card)",
              minWidth: 160,
              overflow: "hidden"
            }}
          >
            <button
              onClick={() => {
                setMenuOpen(false);
                onLogoutRequest();
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                border: "none",
                background: "#fff",
                color: "var(--color-danger)",
                fontWeight: 600,
                fontSize: 13.5
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
