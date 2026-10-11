import React from "react";

export function ConfirmModal({ title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 380 }}>
        <h3 style={{ margin: "0 0 8px 0", color: "var(--color-navy)" }}>{title}</h3>
        <p style={{ color: "var(--color-text-muted)", margin: "0 0 20px 0" }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: "var(--color-navy)" }}>{title}</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 18 }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
