const { contextBridge, ipcRenderer } = require("electron");

function invoke(channel) {
  return (...args) => ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld("api", {
  setup: {
    get: invoke("setup:get"),
    complete: invoke("setup:complete"),
    updateShopInfo: invoke("setup:updateShopInfo")
  },
  auth: {
    login: invoke("auth:login")
  },
  users: {
    list: invoke("users:list"),
    create: invoke("users:create"),
    update: invoke("users:update"),
    delete: invoke("users:delete")
  },
  products: {
    list: invoke("products:list"),
    findByCode: invoke("products:findByCode"),
    create: invoke("products:create"),
    update: invoke("products:update"),
    delete: invoke("products:delete"),
    adjustStock: invoke("products:adjustStock"),
    pickExcelFile: invoke("products:pickExcelFile"),
    previewExcelImport: invoke("products:previewExcelImport"),
    commitExcelImport: invoke("products:commitExcelImport")
  },
  bills: {
    create: invoke("bills:create"),
    list: invoke("bills:list"),
    get: invoke("bills:get")
  },
  expenses: {
    list: invoke("expenses:list"),
    create: invoke("expenses:create")
  },
  dashboard: {
    stats: invoke("dashboard:stats")
  },
  pnl: {
    summary: invoke("pnl:summary")
  },
  export: {
    generate: invoke("export:generate")
  },
  app: {
    getVersion: invoke("app:getVersion"),
    showInFolder: invoke("shell:showInFolder")
  },
  sync: {
    getConfig: invoke("sync:getConfig"),
    saveConfig: invoke("sync:saveConfig"),
    status: invoke("sync:status"),
    summary: invoke("sync:summary"),
    now: invoke("sync:now")
  }
});
