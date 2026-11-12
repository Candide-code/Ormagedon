// Mode sans internet : enregistre le service worker (service-worker.js, à la racine de l'app)
// puis lui envoie la liste des fichiers chargés par la page, pour qu'il en garde une copie.
// Ne fait rien si le navigateur ne le permet pas (page ouverte en file://, vieux navigateur).
export function activerHorsLigne() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('service-worker.js');
      const pret = await navigator.serviceWorker.ready;
      const adresses = performance.getEntriesByType('resource').map((r) => r.name);
      adresses.push(location.href.split('#')[0]);
      if (pret.active) pret.active.postMessage({ type: 'garder', adresses });
    } catch (err) {
      console.warn('Mode sans internet indisponible :', err);
    }
  });
}
