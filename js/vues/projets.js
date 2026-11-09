// Vue « Mes projets » : une carte par projet, clic = ouvre son tableau de bord ;
// bouton « + Nouveau projet » vers le formulaire (vues/nouveau-projet.js) ;
// sous chaque carte : « Dupliquer » (même formulaire, prérempli) et « Supprimer ».
// On y revient en cliquant sur le logo (lien #projets dans l'en-tête).
import { etat, $, hooks, repartirDeZero } from '../noyau/etat.js';
import { echapper, dateFr, joursAvant, texteModifieLe, toast } from '../noyau/outils.js';
import { listerProjets, ouvrirProjet, supprimerProjet, restaurerProjet } from '../noyau/stockage.js';
import { preparerNouveau, preparerCopie } from './nouveau-projet.js';

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const nomAffiche = (p) => p.nom.trim() || 'Projet sans nom';

function carteProjet(p) {
  const nom = nomAffiche(p);
  let deadline = 'Pas de deadline';
  if (p.deadline) {
    const j = joursAvant(p.deadline);
    deadline = `Deadline ${dateFr(p.deadline)} · ${j >= 0 ? 'J-' + j : 'J+' + -j}`;
  }
  const taches = p.nbTaches === 0 ? 'Aucune tâche'
    : `${pluriel(p.nbTaches, 'tâche')}${p.nbFaites ? ' · ' + pluriel(p.nbFaites, 'faite') : ''}`;
  const id = echapper(p.id);
  return `
    <div class="carte-projet">
      <button type="button" class="carte-projet-ouvrir" data-projet="${id}">
        <span class="carte-projet-nom">${echapper(nom)}</span>
        <span>${deadline}</span>
        <span>${taches}</span>
        <span class="discret">${texteModifieLe(p.modifieLe)}</span>
      </button>
      <div class="carte-projet-actions">
        <button type="button" class="action-projet" data-dupliquer="${id}" aria-label="Dupliquer ${echapper(nom)}">Dupliquer</button>
        <button type="button" class="action-projet danger" data-supprimer-projet="${id}" aria-label="Supprimer ${echapper(nom)}">Supprimer</button>
      </div>
    </div>`;
}

export function afficherProjets() {
  const projets = listerProjets();
  $('contenu').innerHTML = `
    <div class="liste-tete projets-tete">
      <h2>Mes projets · ${projets.length}</h2>
      <button type="button" class="bouton violet" data-nouveau-projet>+ Nouveau projet</button>
    </div>
    ${projets.length ? `<div class="grille-projets">${projets.map(carteProjet).join('')}</div>`
      : '<div class="vide"><strong>Aucun projet</strong>Crée ton premier projet.</div>'}`;
}

// Suppression : confirmation, puis « Annuler » possible pendant 8 s (comme pour une tâche)
async function supprimer(id) {
  const p = listerProjets().find((x) => x.id === id);
  if (!p) return;
  const nom = nomAffiche(p);
  const contenu = p.nbTaches ? `Ses ${pluriel(p.nbTaches, 'tâche')}, ses jalons et ses catégories seront supprimés.` : 'Ses jalons et ses catégories seront supprimés.';
  if (!confirm(`Êtes-vous sûr·e de vouloir supprimer le projet « ${nom} » ?\n\n${contenu}\n\nTu pourras annuler pendant quelques secondes, ensuite la suppression est définitive.`)) return;
  const donnees = await supprimerProjet(id);
  if (!donnees) return;
  hooks.toutAfficher();
  toast(`« ${nom} » supprimé`, {
    libelle: 'Annuler',
    faire: () => {
      if (!restaurerProjet(donnees)) return;
      hooks.toutAfficher();
      toast(`« ${nom} » restauré`);
    },
  });
}

$('contenu').addEventListener('click', async (e) => {
  if (!(e.target instanceof Element)) return;
  if (e.target.closest('[data-nouveau-projet]')) { preparerNouveau(); location.hash = 'nouveau'; return; }
  const dup = e.target.closest('[data-dupliquer]');
  if (dup) { if (preparerCopie(dup.dataset.dupliquer)) location.hash = 'nouveau'; return; }
  const sup = e.target.closest('[data-supprimer-projet]');
  if (sup) { supprimer(sup.dataset.supprimerProjet); return; }
  // Clic sur une carte : ouvre le projet sur son tableau de bord
  const c = e.target.closest('[data-projet]');
  if (!c) return;
  const id = c.dataset.projet;
  const autre = !etat.donnees || id !== etat.donnees.id;
  if (!(await ouvrirProjet(id))) return;
  if (autre) repartirDeZero();
  location.hash = 'accueil'; // le changement d'adresse redessine la page
});

// Un autre onglet modifie un projet : la liste se met à jour
window.addEventListener('storage', (e) => {
  if (location.hash === '#projets' && e.key && e.key.startsWith('ormagedon-projet')) hooks.afficher();
});
