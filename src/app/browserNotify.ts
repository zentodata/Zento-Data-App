// ─── NOTIFICACIONES NATIVAS DEL NAVEGADOR (Chrome desktop y móvil) ───────────
// Usa la Web Notification API. En Chrome de escritorio se muestra como
// notificación del sistema operativo. En Chrome móvil (Android), al ser una
// PWA instalada o con Service Worker activo, también se muestra como
// notificación nativa mientras el navegador esté abierto (en segundo o
// primer plano). No requiere backend de push: solo funciona con la app abierta.

let permissionRequested = false;

/** Pide permiso de notificaciones una sola vez por sesión de navegador */
export function requestNotifPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (permissionRequested) return;
  permissionRequested = true;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

export function notifPermissionGranted(): boolean {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

/** Muestra una notificación nativa de Chrome (desktop o móvil) */
export function notifyBrowser(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const icon = "/icons/web-app-manifest-192x192.png";
  const opts: NotificationOptions = { body, icon, badge: icon, tag: "zento-" + Date.now() };

  // Preferir el Service Worker (necesario para que funcione bien en Android/PWA)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(title, opts))
      .catch(() => {
        try { new Notification(title, opts); } catch { /* noop */ }
      });
  } else {
    try { new Notification(title, opts); } catch { /* noop */ }
  }
}
