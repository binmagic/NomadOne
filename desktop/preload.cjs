const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("nomadOneDesktop", {
  runtime: "desktop",
});
