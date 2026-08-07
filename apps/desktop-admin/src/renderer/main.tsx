import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Dev helpers: forward uncaught errors/rejections to main process console (makes stack visible in terminal)
window.addEventListener("error", (ev) => {
  try {
    console.error("[renderer uncaught error]", ev.error?.stack || ev.message || ev.error || ev);
  } catch (e) {
    console.error("[renderer uncaught error] (failed to stringify)", e);
  }
});
window.addEventListener("unhandledrejection", (ev) => {
  try {
    console.error("[renderer unhandledrejection]", ev.reason?.stack || ev.reason || ev);
  } catch (e) {
    console.error("[renderer unhandledrejection] (failed to stringify)", e);
  }
});

try {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err) {
  console.error("[renderer mount error]", err);
  throw err;
}
