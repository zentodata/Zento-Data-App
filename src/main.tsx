  import { lazy, Suspense } from "react";
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { iniciarLogger } from "./app/logger";

  iniciarLogger("crm");

  // Enlace público de firma: https://<dominio>/?firmar=<token> (no requiere iniciar sesión)
  const FirmaPublica = lazy(() => import("./app/FirmaPublica.tsx"));
  const tokenFirma = new URLSearchParams(window.location.search).get("firmar");

  createRoot(document.getElementById("root")!).render(
    tokenFirma ? (
      <Suspense fallback={null}><FirmaPublica token={tokenFirma} /></Suspense>
    ) : (
      <App />
    )
  );
