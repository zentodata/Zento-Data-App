import { createRoot } from "react-dom/client";
import TecnicoApp from "./TecnicoApp";
import "../styles/index.css";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/tecnico/sw.js", { scope: "/tecnico/" }).catch(() => {});
}
createRoot(document.getElementById("root")!).render(<TecnicoApp />);
