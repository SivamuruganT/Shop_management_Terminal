import React, { useEffect, useState } from "react";

function ago(iso) {
  if (!iso) return "never";
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.round(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Small always-visible sync indicator. Billing keeps working whatever this
 * says - it exists so a failing sync is noticed the same day instead of
 * weeks later when the dashboard turns out to be stale.
 */
export default function SyncStatus() {
  const [s, setS] = useState(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      const res = await window.api.sync.summary();
      if (alive && res.ok) setS(res.data);
    }
    poll();
    const t = setInterval(poll, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!s) return null;

  const pending = (s.pending?.bills || 0) + (s.pending?.expenses || 0);
  let color = "var(--color-success)";
  let line1;
  let line2 = null;

  if (!s.configured) {
    color = "var(--color-text-muted)";
    line1 = "Cloud sync not set up";
    line2 = "Settings → Sync";
  } else if (s.running) {
    color = "var(--color-primary)";
    line1 = "Syncing...";
  } else if (s.lastError) {
    color = "var(--color-danger)";
    line1 = pending > 0 ? `Sync failing · ${pending} pending` : "Sync failing";
    line2 = s.lastError.length > 70 ? s.lastError.slice(0, 70) + "…" : s.lastError;
  } else if (pending > 0) {
    color = "#d97706";
    line1 = `${pending} waiting to sync`;
    line2 = `Last synced ${ago(s.lastSyncAt)}`;
  } else {
    line1 = "Cloud synced";
    line2 = `Last synced ${ago(s.lastSyncAt)}`;
  }

  return (
    <div style={{ padding: "10px 16px", borderTop: "1px solid var(--color-border)", fontSize: 12 }} title={s.lastError || ""}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, color: "var(--color-text)" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        {line1}
      </div>
      {line2 && <div style={{ color: "var(--color-text-muted)", marginTop: 2, marginLeft: 15 }}>{line2}</div>}
    </div>
  );
}
