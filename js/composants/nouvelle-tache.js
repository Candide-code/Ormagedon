// Bouton « + Nouvelle tâche » : même effet partout (Matrice, tableau de bord, tableau vide).
// On reste sur l'onglet ouvert ; la fiche de la nouvelle tâche s'ouvre à droite.
import { etat, $, hooks } from '../noyau/etat.js';
import { enregistrer } from '../noyau/stockage.js';
import { filtreActif } from './categories.js';
import { ouvrirFiche } from './fiche.js';

// Le bouton, à placer dans une vue
export const boutonNouvelleTache = () => '<button class="bouton violet" data-nouvelle>+ Nouvelle tâche</button>';

// Code = T + numéro suivant (T1, T2…), quelle que soit la catégorie.
// Avec un filtre de catégorie actif, elle prend cette catégorie (et sous-catégorie) ;
// sans filtre (« Toutes ») ou avec « Sans catégorie », elle est sans catégorie.
async function nouvelleTache() {
  const d = etat.donnees;
  const { cat, sous } = filtreActif();
  const nums = d.taches.map((t) => /^T(\d+)$/.exec(t.id)).filter(Boolean).map((m) => +m[1]);
  const id = 'T' + (Math.max(0, ...nums) + 1);
  d.taches.push({
    id, titre: 'Nouvelle tâche', description: '',
    categorie: cat ? cat.nom : '', sousCategorie: cat ? (sous || cat.sous[0] || '') : '',
    statut: 'À faire', case: 'a_classer', echeance: '', jalons: [], todo: [], liens: [], dependances: [], notes: '',
  });
  hooks.afficher();
  if (await enregistrer()) {
    ouvrirFiche(id);
    const titre = document.querySelector('.fiche-titre');
    titre.focus(); titre.select();
  }
}

$('contenu').addEventListener('click', (e) => {
  if (e.target.closest('[data-nouvelle]')) nouvelleTache();
});
