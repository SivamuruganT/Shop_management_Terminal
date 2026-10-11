import React, { useState } from "react";
import { Modal } from "./Modal.jsx";

const FIELD_LABELS = {
  sku: "SKU / Barcode",
  name: "Product Name",
  price: "Price",
  cost_price: "Cost Price",
  stock_qty: "Stock Qty",
  category: "Category",
  unit: "Unit",
  low_stock_threshold: "Low Stock Threshold"
};

export default function ImportExcelModal({ onClose, onImported }) {
  const [step, setStep] = useState("select"); // select | preview | importing | done
  const [preview, setPreview] = useState(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function chooseFile() {
    setError("");
    const pickRes = await window.api.products.pickExcelFile();
    if (!pickRes.ok) {
      setError(pickRes.error);
      return;
    }
    if (!pickRes.data) return; // cancelled

    setStep("loading");
    const previewRes = await window.api.products.previewExcelImport(pickRes.data);
    if (!previewRes.ok) {
      setError(previewRes.error);
      setStep("select");
      return;
    }
    setPreview(previewRes.data);
    setStep("preview");
  }

  async function commitImport() {
    setStep("importing");
    const res = await window.api.products.commitExcelImport(preview.rows, updateExisting);
    if (!res.ok) {
      setError(res.error);
      setStep("preview");
      return;
    }
    setResult(res.data);
    setStep("done");
    onImported();
  }

  return (
    <Modal title="Import Products from Excel" onClose={onClose} width={720}>
      {step === "select" && (
        <div>
          <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
            Pick an .xlsx, .xls, or .csv file. Columns are matched by header name — SKU/Barcode, Product
            Name and Price are required; Cost Price, Stock Qty, Unit, Category and Low Stock Threshold
            are picked up if present. Any other columns in your sheet (supplier, notes, dates, whatever)
            are simply ignored.
          </p>
          {error && (
            <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", padding: "10px 12px", borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
              {error}
            </div>
          )}
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={chooseFile}>
            Choose Excel File
          </button>
        </div>
      )}

      {step === "loading" && <div style={{ padding: "20px 0", textAlign: "center", color: "var(--color-text-muted)" }}>Reading file...</div>}

      {step === "preview" && preview && (
        <div>
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontWeight: 700, color: "var(--color-navy)", marginBottom: 6 }}>Detected columns</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(preview.detectedColumns).map(([field, header]) => (
                <span key={field} className="badge badge-neutral">
                  {FIELD_LABELS[field]}: "{header}"
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div className="card" style={{ flex: 1, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-success)" }}>{preview.validCount}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Ready to import</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-danger)" }}>{preview.invalidCount}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Skipped (missing data)</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-warning-text)" }}>{preview.existingCount}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Already in inventory</div>
            </div>
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, marginBottom: 14 }}>
            <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
            Update price/cost/category/stock for SKUs that already exist, instead of skipping them
          </label>

          <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: 10, marginBottom: 14 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 50).map((r) => (
                  <tr key={r.rowNumber}>
                    <td>{r.rowNumber}</td>
                    <td>{r.sku || "—"}</td>
                    <td>{r.name || "—"}</td>
                    <td>{r.price ?? "—"}</td>
                    <td>{r.stock_qty}</td>
                    <td>
                      {!r.valid && <span className="badge badge-danger">{r.reason}</span>}
                      {r.valid && r.existsInDb && (
                        <span className="badge badge-warning">{updateExisting ? "Will update" : "Exists — skip"}</span>
                      )}
                      {r.valid && !r.existsInDb && <span className="badge badge-success">New</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 50 && (
              <div style={{ padding: 10, textAlign: "center", color: "var(--color-text-muted)", fontSize: 12.5 }}>
                + {preview.rows.length - 50} more rows not shown (all are still included in the import)
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", padding: "10px 12px", borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep("select")}>
              Choose a different file
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={preview.validCount === 0} onClick={commitImport}>
              Import {preview.validCount} Product{preview.validCount === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}

      {step === "importing" && <div style={{ padding: "20px 0", textAlign: "center", color: "var(--color-text-muted)" }}>Importing...</div>}

      {step === "done" && result && (
        <div>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 36 }}>✅</div>
            <h3 style={{ color: "var(--color-navy)", margin: "8px 0 4px" }}>Import complete</h3>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div className="card" style={{ flex: 1, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-success)" }}>{result.created}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Created</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-primary-dark)" }}>{result.updated}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Updated</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text-muted)" }}>{result.skipped}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Skipped</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", padding: "10px 12px", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
              {result.errors.length} row(s) failed: {result.errors.map((e) => `${e.sku} (${e.reason})`).join(", ")}
            </div>
          )}
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={onClose}>
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
