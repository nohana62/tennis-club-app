import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";

// 新しいバージョンを検知したら自動でリロードして最新化する
registerSW({ immediate: true, onNeedRefresh() {}, onOfflineReady() {} });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
