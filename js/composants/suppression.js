// Suppression d'une tâche (bouton × sur la liste, sur les cartes et dans la fiche),
// toujours après confirmation, puis « Annuler » possible pendant 8 s.
import { etat, $, hooks } from '../noyau/etat.js';
import { tacheParId, toast } from '../noyau/outils.js';
import { enregistrer } from '../noyau/stockage.js';

export async function supprimerTache(id) {
  const t = tacheParId(id);
  if (!t) return;
  if (!confirm(`Êtes-vous sûr·e de vouloir supprimer la tâche ${t.id} « ${t.titre} » ?\n\nPour la garder visible sans la faire, choisis plutôt le statut « Abandonné ».\n\nTu pourras annuler pendant quelques secondes, ensuite la suppression est définitive.`)) return;
  // On garde de quoi tout remettre en place : la position de la tâche
  // et les tâches qui dépendaient d'elle.
  const position = etat.donnees.taches.indexOf(t);
  const dependantes = etat.donnees.taches
    .filter((x) => (x.dependances || []).includes(t.id))
    .map((x) => ({ id: x.id, avant: [...x.dependances] }));
  etat.donnees.taches = etat.donnees.taches.filter((x) => x.id !== t.id);
  etat.donnees.taches.forEach((x) => { x.dependances = (x.dependances || []).filter((d) => d !== t.id); });
  hooks.toutAfficher(); // ferme la fiche si elle montrait cette tâche
  if (await enregistrer()) toast(`${t.id} supprimée`, { libelle: 'Annuler', faire: () => restaurer(t, position, dependantes) });
}

async function restaurer(t, position, dependantes) {
  // Cas rare : une nouvelle tâche a repris le même code entre-temps
  if (tacheParId(t.id)) { toast(`Impossible d'annuler : le code ${t.id} est déjà pris`); return; }
  etat.donnees.taches.splice(Math.min(position, etat.donnees.taches.length), 0, t);
  // Remet chaque dépendance à sa place d'origine (sans perdre celles ajoutées entre-temps)
  dependantes.forEach(({ id, avant }) => {
    const x = tacheParId(id);
    if (!x) return;
    const actuelles = x.dependances || [];
    x.dependances = [...avant.filter((d) => d === t.id || actuelles.includes(d)), ...actuelles.filter((d) => !avant.includes(d))];
  });
  hooks.toutAfficher();
  if (await enregistrer()) toast(`${t.id} restaurée`);
}

export const boutonSupprimer = (id) =>
  `<button type="button" class="suppr" data-supprimer="${id}" aria-label="Supprimer la tâche ${id}" title="Supprimer la tâche">×</button>`;

$('contenu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-supprimer]');
  if (b) supprimerTache(b.dataset.supprimer);
});
