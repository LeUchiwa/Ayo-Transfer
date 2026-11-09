import { useEffect } from "react";

export function useServiceWorkerUpdate() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Vérifie les updates toutes les 60s
      setInterval(() => reg.update(), 60_000);

      // Quand une nouvelle version est trouvée → forcer l'activation
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // Une nouvelle version est prête → forcer
            newWorker.postMessage("SKIP_WAITING");
          }
        });
      });
    });

    // Recharge la page quand un nouveau SW prend le contrôle
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);
}
