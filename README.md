# ECBill — Shop Terminal (local-first billing & inventory)

Electron + React + SQLite (better-sqlite3).

## Run it

```bash
npm install
npm run dev
```

## Build a Windows installer

```bash
npm run build
```

Installer lands in `release\ECBill Setup 0.1.0.exe` (not `dist` — that's reserved for the
renderer's own build output, kept separate on purpose).

## Fixes applied so far (chronological)

1. **Dev-mode window loading** — `electron/main.js` now detects dev mode via `!app.isPackaged`
   instead of an env var that wasn't being passed through on Windows.
2. **electron-builder output folder** — set to `release/` in `package.json` so it doesn't
   collide with Vite's `dist/` renderer build.
3. **Product delete** — `products:delete` IPC handler + Delete button in Inventory, with a
   confirmation dialog. Deleting a product never corrupts past sales/adjustment history because
   `bill_items` and `inventory_adjustments` store their own name/sku/price snapshot rather than
   joining live to `products`.
4. **"+ Add Custom Item" fixed** — previously used `window.prompt()`, which Electron's renderer
   does not implement (silent no-op). Replaced with a real modal (name, price, qty).
5. **Numeric input leading-zero bug fixed** — `<input type="number">` fields in Inventory's
   Add/Edit Product form and Stock Adjustment now start as empty strings with placeholders
   instead of the literal value `0`, and gained `onFocus={select-all}` so editing an existing
   value doesn't require manually clearing it first. Parsing to a real number happens only at
   save time.

## Project structure

```
electron/
  main.js       Window creation + all IPC handlers
  preload.js    contextBridge — the only surface the renderer can call into
  db.js         SQLite schema + all data access
src/
  App.jsx       Setup → Login → app routing, role gating
  components/   Sidebar, TopBar, Layout, Modal (shared everywhere)
  pages/        One file per screen
```
