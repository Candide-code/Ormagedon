// Boutons de catégories : filtre commun au tableau de bord et à la matrice.
// Un clic sur une catégorie n'affiche que ses tâches et fait apparaître ses
// sous-catégories ; un second clic sur le bouton actif retire le filtre.
import { etat, $, hooks, memoriserFiltre } from '../noyau/etat.js';
import { echapper } from '../noyau/outils.js';

// Valeur du filtre « Sans catégorie » (tâches dont la catégorie est vide)
export const SANS_CATEGORIE = '∅';

// Filtre actif, ignoré si la catégorie n'existe plus.
// sans = true quand le filtre « Sans catégorie » est choisi.
export function filtreActif() {
  if (etat.filtre.categorie === SANS_CATEGORIE) return { cat: null, sous: '', sans: true };
  const [nom, sous] = (etat.filtre.categorie || '').split('›');
  const cat = etat.donnees.categories.find((c) => c.nom === nom) || null;
  return { cat, sous: cat && cat.sous.includes(sous) ? sous : '', sans: false };
}

export function filtreCategorie(t) {
  const { cat, sous, sans } = filtreActif();
  if (sans) return !t.categorie;
  if (!cat) return true;
  return t.categorie === cat.nom && (!sous || t.sousCategorie === sous);
}

function puce(valeur, contenu, nb, active) {
  // contenu est déjà échappé ; il sert aussi de bulle (nom complet si raccourci avec « … »)
  return `<button type="button" class="puce ${active ? 'active' : ''}" data-filtre="${echapper(valeur)}" aria-pressed="${active}" title="${contenu}"><span class="puce-nom">${contenu}</span><span class="nb">${nb}</span></button>`;
}

export function boutonsCategories() {
  const { categories, taches } = etat.donnees;
  const { cat, sous, sans } = filtreActif();
  const nbSans = taches.filter((t) => !t.categorie).length;
  const lignePrincipale = [
    puce('', 'Toutes', taches.length, !cat && !sans),
    ...categories.map((c) => {
      const active = cat === c;
      // Re-cliquer sur la catégorie active retire le filtre
      return puce(active && !sous ? '' : c.nom, echapper(c.nom),
        taches.filter((t) => t.categorie === c.nom).length, active);
    }),
    // « Sans catégorie » : seulement si le projet a des catégories et des tâches sans catégorie
    // (ou si ce filtre est déjà choisi, pour pouvoir le retirer)
    (categories.length && nbSans) || sans ? puce(sans ? '' : SANS_CATEGORIE, 'Sans catégorie', nbSans, sans) : '',
  ].join('');
  const sousLigne = cat ? `
    <div class="puces sous-puces" aria-label="Sous-catégories">
      ${cat.sous.map((s) => {
        const active = sous === s;
        return puce(active ? cat.nom : cat.nom + '›' + s, echapper(s),
          taches.filter((t) => t.categorie === cat.nom && t.sousCategorie === s).length, active);
      }).join('')}
    </div>` : '';
  return `<div class="puces" aria-label="Catégories">${lignePrincipale}</div>${sousLigne}`;
}

$('contenu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filtre]');
  if (!b) return;
  etat.filtre.categorie = b.dataset.filtre;
  memoriserFiltre();
  hooks.afficher();
});
