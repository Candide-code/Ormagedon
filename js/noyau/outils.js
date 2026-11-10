// Petits outils sans affichage propre
import { etat, $ } from './etat.js';

export function joursAvant(dateIso) {
  const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
  const cible = new Date(dateIso + 'T00:00:00');
  return Math.round((cible - aujourdhui) / 86400000);
}

export const dateFr = (iso) => { const [, m, j] = iso.split('-'); return `${j}/${m}`; };

// Catégorie affichée à côté du code d'une tâche : « T1 · Marketing › Pub ».
// Renvoie le morceau « · Marketing › Pub » en HTML (rien si la tâche est sans catégorie).
// avecSous = false là où la place manque (cartes, dépendances, calendrier).
export function htmlCategorie(t, avecSous = true, classe = 'code-cat') {
  if (!t.categorie) return '';
  const texte = ' · ' + t.categorie + (avecSous && t.sousCategorie ? ' › ' + t.sousCategorie : '');
  return `<span class="${classe}">${echapper(texte)}</span>`;
}

// « 09/11 à 13:35 » (heure locale), '' si pas de date
export function dateHeure(isoComplet) {
  const d = isoComplet ? new Date(isoComplet) : null;
  if (!d || isNaN(d)) return '';
  const deux = (n) => String(n).padStart(2, '0');
  return `${deux(d.getDate())}/${deux(d.getMonth() + 1)} à ${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

// Pied de page : « Modifié le 09/11 à 13:35 », rien si pas de date
export function texteModifieLe(isoComplet) {
  const t = dateHeure(isoComplet);
  return t ? 'Modifié le ' + t : '';
}

export function echapper(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const tacheParId = (id) => etat.donnees.taches.find((t) => t.id === id);
export const categorieDe = (t) => etat.donnees.categories.find((c) => c.nom === t.categorie);
export const classeStatut = (s) => ({ 'Fait': 'fait', 'En cours': 'en-cours', 'Reporté': 'reporte', 'Abandonné': 'abandonne' }[s] || '');

// Dépendances pas encore terminées
export const bloquantes = (t) => (t.dependances || []).map(tacheParId).filter((d) => d && d.statut !== 'Fait');

// Tri : échéance la plus proche d'abord (sans date à la fin), puis code
export const parEcheance = (a, b) => (a.echeance || '9').localeCompare(b.echeance || '9') || a.id.localeCompare(b.id);

// Petit message en bas de l'écran. Avec `action` ({ libelle, faire }), il porte un bouton
// (ex. « Annuler ») et reste affiché 8 s au lieu de 3,5 s. Un nouveau message remplace le précédent.
let minuteurToast;
export function toast(texte, action = null) {
  const t = $('toast');
  t.textContent = texte;
  t.classList.toggle('avec-action', !!action);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-action';
    b.textContent = action.libelle;
    b.addEventListener('click', () => {
      clearTimeout(minuteurToast);
      t.classList.remove('visible', 'avec-action');
      action.faire();
    }, { once: true });
    t.append(' ', b);
  }
  t.classList.add('visible');
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => t.classList.remove('visible', 'avec-action'), action ? 8000 : 3500);
}
