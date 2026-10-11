import React from "react";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

export default function Layout({ shopName, user, activePage, onNavigate, onLogoutRequest, children }) {
  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
      <Sidebar role={user.role} activePage={activePage} onNavigate={onNavigate} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar shopName={shopName} user={user} onLogoutRequest={onLogoutRequest} />
        <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>{children}</main>
      </div>
    </div>
  );
}
