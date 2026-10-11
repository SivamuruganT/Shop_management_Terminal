import React from "react";
import SyncStatus from "./SyncStatus.jsx";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "🏠", roles: ["admin", "worker"] },
  { key: "billing", label: "Billing (POS)", icon: "🧾", roles: ["admin", "worker"] },
  { key: "inventory", label: "Inventory", icon: "📦", roles: ["admin", "worker"] },
  { key: "sales", label: "Sales History", icon: "📈", roles: ["admin", "worker"] },
  { key: "expenses", label: "Expenses", icon: "💸", roles: ["admin"] },
  { key: "pnl", label: "Profit & Loss", icon: "📊", roles: ["admin"] },
  { key: "export", label: "Export", icon: "⬇️", roles: ["admin"] },
  { key: "users", label: "Users", icon: "👤", roles: ["admin"] },
  { key: "settings", label: "Settings", icon: "⚙️", roles: ["admin"] }
];

export default function Sidebar({ role, activePage, onNavigate }) {
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside
      style={{
        width: 232,
        background: "#fff",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        height: "100%"
      }}
    >
      <div style={{ padding: "20px 20px 16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22 }}>🛒</span>
          <span style={{ fontSize: 19, fontWeight: 800 }}>
            <span style={{ color: "var(--color-primary)" }}>EC</span>
            <span style={{ color: "var(--color-navy)" }}>Bill</span>
          </span>
        </div>
        <div style={{ fontSize: 10.5, letterSpacing: 1, color: "var(--color-text-muted)", marginTop: 2 }}>
          BILL · INVENTORY · GROW
        </div>
      </div>

      <nav style={{ flex: 1, padding: "4px 12px", overflowY: "auto" }}>
        {items.map((item) => {
          const active = item.key === activePage;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                marginBottom: 2,
                border: "none",
                borderRadius: 8,
                background: active ? "var(--color-primary-light)" : "transparent",
                color: active ? "var(--color-primary-dark)" : "var(--color-text)",
                fontWeight: active ? 700 : 500,
                fontSize: 13.5,
                textAlign: "left"
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <SyncStatus />

      <div style={{ padding: 16, borderTop: "1px solid var(--color-border)", fontSize: 11.5, color: "var(--color-text-muted)" }}>
        ECBill v0.1.0
        <br />
        Simple Billing, Smarter Business.
      </div>
    </aside>
  );
}
