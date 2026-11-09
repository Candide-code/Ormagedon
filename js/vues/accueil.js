// Vue « Tableau de bord » : jalons, tâches par statut, boutons de catégories, liste
import { etat, $ } from '../noyau/etat.js';
import { echapper, parEcheance } from '../noyau/outils.js';
import { blocJalons } from '../composants/jalons.js';
import { boutonsCategories, filtreActif, filtreCategorie } from '../composants/categories.js';
import { listeTaches } from '../composants/taches.js';

function blocStatuts() {
  const d = etat.donnees;
  return `
    <section class="bloc">
      <h2>Tâches</h2>
      <ul class="liste">
        ${d.statuts.map((s) => `<li><span>${echapper(s)}</span><span class="discret">${d.taches.filter((t) => t.statut === s).length}</span></li>`).join('')}
      </ul>
    </section>`;
}

export function afficherAccueil() {
  const d = etat.donnees;
  const taches = d.taches.filter(filtreCategorie).sort(parEcheance);
  const { cat, sous } = filtreActif();
  const titreListe = cat ? `${echapper(cat.nom)}${sous ? ' › ' + echapper(sous) : ''}` : 'Toutes les tâches';

  $('contenu').innerHTML = `
    ${d.taches.length === 0 ? `
      <div class="vide">
        <strong>Aucune tâche pour l'instant</strong>
        Crée ta première tâche.
        <div class="vide-action"><button class="bouton violet" id="nouvelle">+ Nouvelle tâche</button></div>
      </div>` : ''}
    <div class="grille">
      ${blocJalons()}
      ${blocStatuts()}
    </div>
    ${d.taches.length === 0 ? '' : `
    <section class="bloc bloc-large">
      <h2>${titreListe} · ${taches.length}</h2>
      ${boutonsCategories()}
      ${listeTaches(taches)}
    </section>`}`;
}
