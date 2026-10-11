import React, { useEffect, useState } from "react";
import { ConfirmModal } from "../components/Modal.jsx";

const emptyForm = { username: "", password: "", confirmPassword: "", role: "worker", status: "active" };

export default function Users({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await window.api.users.list();
    if (res.ok) setUsers(res.data);
  }

  function startEdit(u) {
    setEditingId(u.id);
    setForm({ username: u.username, password: "", confirmPassword: "", role: u.role, status: u.status });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function save() {
    setError("");
    if (!form.username.trim()) {
      setError("Username is required.");
      return;
    }
    if (!editingId && form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const payload = { username: form.username, role: form.role, status: form.status };
    if (form.password) payload.password = form.password;

    const res = editingId ? await window.api.users.update(editingId, payload) : await window.api.users.create(payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    resetForm();
    load();
  }

  async function confirmDelete() {
    const res = await window.api.users.delete(deleteTarget.id);
    setDeleteTarget(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    load();
  }

  return (
    <div>
      <h1 className="page-title">User Management</h1>
      <p className="page-subtitle">Manage staff accounts and access to the system — Worker or Admin only.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>Staff Users</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id}>
                  <td>{i + 1}</td>
                  <td>{u.username}</td>
                  <td>
                    <span className={`badge ${u.role === "admin" ? "badge-warning" : "badge-neutral"}`} style={{ textTransform: "capitalize" }}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.status === "active" ? "badge-success" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>
                      {u.status}
                    </span>
                  </td>
                  <td>{u.last_login ? new Date(u.last_login).toLocaleString() : "—"}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-secondary" style={{ padding: "4px 10px" }} onClick={() => startEdit(u)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: "4px 10px" }}
                      disabled={u.id === currentUser.id}
                      onClick={() => setDeleteTarget(u)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, color: "var(--color-navy)" }}>{editingId ? "Edit User" : "Add User"}</h3>
          <label className="label">Username *</label>
          <input className="input" style={{ marginBottom: 10 }} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <label className="label">{editingId ? "New Password (leave blank to keep current)" : "Password *"}</label>
          <input className="input" style={{ marginBottom: 10 }} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <label className="label">Confirm Password</label>
          <input
            className="input"
            style={{ marginBottom: 10 }}
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          />
          <label className="label">Role *</label>
          <select className="input" style={{ marginBottom: 10 }} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="worker">Worker</option>
            <option value="admin">Admin</option>
          </select>
          <label className="label">Status *</label>
          <select className="input" style={{ marginBottom: 14 }} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {error && (
            <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={resetForm}>
              Clear
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>
              Save User
            </button>
          </div>

          <div style={{ marginTop: 20, fontSize: 13, color: "var(--color-text-muted)" }}>
            <strong style={{ color: "var(--color-navy)" }}>Roles</strong>
            <div style={{ marginTop: 6 }}>
              <strong>Admin</strong> — logs in on the Admin tab; billing, inventory, reports, exports and user management.
            </div>
            <div style={{ marginTop: 6 }}>
              <strong>Worker</strong> — logs in on the Worker tab; billing, inventory and sales history only.
            </div>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete this user?"
          message={`"${deleteTarget.username}" will lose access immediately. This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
