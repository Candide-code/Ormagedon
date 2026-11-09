// Bloc « Jalons » du tableau de bord : date + avancement des tâches liées
import { etat } from '../noyau/etat.js';
import { echapper, dateFr } from '../noyau/outils.js';

const HORS_COMPTE = ['Reporté', 'Abandonné'];

export const jalonsTries = () => [...etat.donnees.jalons].sort((a, b) => a.date.localeCompare(b.date));

export function blocJalons() {
  const taches = etat.donnees.taches;
  return `
    <section class="bloc">
      <h2>Jalons</h2>
      <ul class="liste">
        ${jalonsTries().map((j) => {
          // Tâches liées à ce jalon (hors reportées et abandonnées) : faites / total
          const liees = taches.filter((t) => (t.jalons || []).includes(j.id) && !HORS_COMPTE.includes(t.statut));
          const faites = liees.filter((t) => t.statut === 'Fait').length;
          const avancement = liees.length
            ? ` <span class="avancement ${faites === liees.length ? 'complet' : ''}" title="Tâches faites sur tâches nécessaires : ${liees.map((t) => t.id).join(', ')}">${faites}/${liees.length}</span>`
            : '';
          return `<li><span>${echapper(j.titre)}${j.aVerifier ? ' <span class="a-verifier">date à vérifier</span>' : ''}</span><span class="discret nowrap">${dateFr(j.date)}${avancement}</span></li>`;
        }).join('')}
      </ul>
    </section>`;
}
