// ─── CONFIGURACIÓN DE FIREBASE VÍA VARIABLES DE ENTORNO ──────────────────────
// Permite que TODOS los dispositivos que abran la app en Vercel usen la misma
// configuración de Firebase automáticamente, sin tener que pegarla a mano en
// cada navegador. Las variables se definen en Vercel → Project → Settings →
// Environment Variables, y Vite las incorpora en el build (por eso deben
// empezar con "VITE_").

import type { FirebaseWebConfig } from "./cloudSync";

export function getEnvFirebaseConfig(): FirebaseWebConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;

  if (!apiKey || !authDomain || !databaseURL || !projectId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    databaseURL,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  };
}
