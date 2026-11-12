// Mode sans internet (étape 1.8, option A « réseau d'abord », choisie par Marie le 12/11).
// Ce petit script est gardé par le navigateur à côté de l'app et se place entre l'app et internet :
//   - avec internet : il prend la dernière version de chaque fichier et en garde une copie ;
//   - sans internet, ou si le réseau met plus de 3 s : il donne la copie.
// Rien à changer à chaque mise en ligne (pas de numéro de version).
// Les données des projets ne passent pas par ici : elles restent dans le stockage de l'appareil.
const CACHE = 'ormagedon';
const DELAI = 3000; // au-delà, on prend la copie plutôt que d'attendre le réseau

// Gardés dès l'installation ; le reste des fichiers est envoyé par la page (js/noyau/hors-ligne.js)
const BASE = ['./', 'index.html', 'manifest.webmanifest', 'icones/icone.svg', 'icones/icone-192.png', 'icones/icone-512.png', 'icones/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

// Supprime les anciennes copies (autre nom), puis prend la main sur la page déjà ouverte
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Seulement les fichiers de l'app (même adresse), jamais les autres sites
const dansLApp = (adresse) => adresse.startsWith(self.registration.scope);

// La page envoie la liste des fichiers qu'elle a chargés : on garde une copie de ceux qui manquent
self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'garder' || !Array.isArray(e.data.adresses)) return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(e.data.adresses.filter(dansLApp).map(async (adresse) => {
    if (await c.match(adresse, { ignoreSearch: true })) return;
    try { const r = await fetch(adresse); if (r.ok && !r.redirected) await c.put(adresse, r); } catch { /* sans réseau : tant pis */ }
  }))));
});

self.addEventListener('fetch', (e) => {
  const q = e.request;
  if (q.method !== 'GET' || !dansLApp(q.url)) return;
  const reseau = fetch(q);
  // Nouvelle version reçue : on remplace la copie (la copie est faite tout de suite, avant que la page lise le fichier)
  e.waitUntil(reseau.then((r) => {
    if (!r.ok || r.redirected) return;
    const double = r.clone();
    return caches.open(CACHE).then((c) => c.put(q, double));
  }).catch(() => {}));
  e.respondWith(repondre(q, reseau));
});

async function copie(q) {
  const c = await caches.open(CACHE);
  const trouve = await c.match(q, { ignoreSearch: true });
  if (trouve || q.mode !== 'navigate') return trouve;
  return (await c.match('./')) || c.match('index.html'); // ouverture de l'app : la page d'accueil
}

// Réseau lent repéré : pendant 30 s, les fichiers suivants prennent directement leur copie
// (l'app charge ses fichiers en plusieurs vagues : sans ça, chaque vague attendrait 3 s).
// La copie est quand même remplacée en arrière-plan quand le réseau finit par répondre.
const PAUSE_LENT = 30000;
let lentJusqua = 0;

async function repondre(q, reseau) {
  if (Date.now() < lentJusqua) {
    const c = await copie(q);
    if (c) return c;
  }
  const lent = new Promise((r) => setTimeout(r, DELAI, 'lent'));
  try {
    const premier = await Promise.race([reseau, lent]);
    if (premier !== 'lent') return premier; // le réseau a répondu à temps
    lentJusqua = Date.now() + PAUSE_LENT;
    return (await copie(q)) || (await reseau); // réseau lent : la copie, sinon on attend quand même
  } catch {
    return (await copie(q)) || Response.error(); // pas de réseau : la copie
  }
}
