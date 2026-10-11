import React, { useEffect, useState } from "react";
import Setup from "./pages/Setup.jsx";
import Login from "./pages/Login.jsx";
import Layout from "./components/Layout.jsx";
import { ConfirmModal } from "./components/Modal.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Billing from "./pages/Billing.jsx";
import Inventory from "./pages/Inventory.jsx";
import SalesHistory from "./pages/SalesHistory.jsx";
import Expenses from "./pages/Expenses.jsx";
import ProfitLoss from "./pages/ProfitLoss.jsx";
import ExportPage from "./pages/ExportPage.jsx";
import Users from "./pages/Users.jsx";
import Settings from "./pages/Settings.jsx";

const ADMIN_ONLY_PAGES = new Set(["expenses", "pnl", "export", "users", "settings"]);

export default function App() {
  const [phase, setPhase] = useState("loading");
  const [shopInfo, setShopInfo] = useState(null);
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await window.api.setup.get();
      if (res.ok && res.data.setup_complete) {
        setShopInfo(res.data);
        setPhase("login");
      } else {
        setPhase("setup");
      }
    })();
  }, []);

  function handleSetupComplete(info) {
    setShopInfo(info);
    setPhase("login");
  }

  function handleLoggedIn(loggedInUser) {
    setUser(loggedInUser);
    setActivePage("dashboard");
    setPhase("app");
  }

  function handleNavigate(page) {
    if (ADMIN_ONLY_PAGES.has(page) && user?.role !== "admin") return;
    setActivePage(page);
  }

  function handleLogout() {
    setUser(null);
    setLogoutConfirm(false);
    setPhase("login");
  }

  if (phase === "loading") {
    return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading ECBill...</div>;
  }
  if (phase === "setup") {
    return <Setup onComplete={handleSetupComplete} />;
  }
  if (phase === "login") {
    return <Login onLoggedIn={handleLoggedIn} />;
  }

  const pageMap = {
    dashboard: <Dashboard user={user} onNavigate={handleNavigate} />,
    billing: <Billing user={user} />,
    inventory: <Inventory user={user} />,
    sales: <SalesHistory />,
    expenses: <Expenses />,
    pnl: <ProfitLoss />,
    export: <ExportPage />,
    users: <Users currentUser={user} />,
    settings: <Settings />
  };

  return (
    <>
      <Layout
        shopName={shopInfo?.shop_name}
        user={user}
        activePage={activePage}
        onNavigate={handleNavigate}
        onLogoutRequest={() => setLogoutConfirm(true)}
      >
        {pageMap[activePage]}
      </Layout>

      {logoutConfirm && (
        <ConfirmModal
          title="Logout from ECBill?"
          message="Are you sure you want to logout? Your current session will be ended."
          confirmLabel="Logout"
          danger
          onConfirm={handleLogout}
          onCancel={() => setLogoutConfirm(false)}
        />
      )}
    </>
  );
}
