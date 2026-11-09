// Échanges avec le serveur local (lecture, enregistrement, surveillance)
import { etat, $, hooks } from './etat.js';
import { toast } from './outils.js';

export async function charger() {
  const r = await fetch('/api/donnees', { cache: 'no-store' });
  if (!r.ok) throw new Error('lecture impossible');
  const { version, donnees } = await r.json();
  etat.version = version;
  etat.donnees = donnees;
  hooks.toutAfficher();
}

// Enregistre tout de suite. En cas de conflit (fichier modifié ailleurs),
// on recharge la version la plus récente au lieu de l'écraser.
// Les enregistrements passent l'un après l'autre : deux modifications très
// rapprochées (deux cases cochées vite) ne se gênent plus.
let file = Promise.resolve();
let enCours = 0;
export function enregistrer() {
  enCours++;
  const resultat = file.then(envoyer).finally(() => { enCours--; });
  file = resultat.catch(() => {});
  return resultat;
}

async function envoyer() {
  try {
    const r = await fetch('/api/donnees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionDeBase: etat.version, donnees: etat.donnees }),
    });
    if (r.status === 409) {
      const { version, donnees } = await r.json();
      etat.version = version; etat.donnees = donnees; hooks.toutAfficher();
      toast('Le fichier a été modifié ailleurs : version la plus récente rechargée, refais ta dernière action.');
      return false;
    }
    if (!r.ok) { toast("Échec de l'enregistrement"); return false; }
    etat.version = (await r.json()).version;
    marquerConnexion(true);
    return true;
  } catch {
    marquerConnexion(false);
    toast("Échec de l'enregistrement : le serveur est arrêté");
    return false;
  }
}

// Vérifie toutes les 3 secondes si roadmap.json a changé (ex. modifié par Claude).
// Pas de rechargement pendant une saisie ou un déplacement de carte.
function saisieEnCours() {
  const el = document.activeElement;
  return el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export async function surveiller() {
  if (etat.glisse || saisieEnCours() || enCours) return;
  try {
    const r = await fetch('/api/version', { cache: 'no-store' });
    const { version } = await r.json();
    marquerConnexion(true);
    if (version !== etat.version) { await charger(); toast('Roadmap mise à jour'); }
  } catch { marquerConnexion(false); }
}

export function marquerConnexion(ok) {
  etat.serveurOk = ok;
  $('etat').className = 'etat ' + (ok ? 'ok' : 'ko');
  $('etat-texte').textContent = ok
    ? 'Connectée · enregistrement automatique'
    : 'Serveur arrêté : relance Lancer_roadmap.bat';
}
