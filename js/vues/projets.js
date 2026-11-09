// Vue « Mes projets » : une carte par projet, clic = ouvre son tableau de bord ;
// bouton « + Nouveau projet » vers le formulaire (vues/nouveau-projet.js).
// On y revient en cliquant sur le logo (lien #projets dans l'en-tête).
import { etat, $, hooks, repartirDeZero } from '../noyau/etat.js';
import { echapper, dateFr, joursAvant, texteModifieLe } from '../noyau/outils.js';
import { listerProjets, ouvrirProjet } from '../noyau/stockage.js';

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

function carteProjet(p) {
  const nom = p.nom.trim() || 'Projet sans nom';
  let deadline = 'Pas de deadline';
  if (p.deadline) {
    const j = joursAvant(p.deadline);
    deadline = `Deadline ${dateFr(p.deadline)} · ${j >= 0 ? 'J-' + j : 'J+' + -j}`;
  }
  const taches = p.nbTaches === 0 ? 'Aucune tâche'
    : `${pluriel(p.nbTaches, 'tâche')}${p.nbFaites ? ' · ' + pluriel(p.nbFaites, 'faite') : ''}`;
  return `
    <button type="button" class="carte-projet" data-projet="${echapper(p.id)}">
      <span class="carte-projet-nom">${echapper(nom)}</span>
      <span>${deadline}</span>
      <span>${taches}</span>
      <span class="discret">${texteModifieLe(p.modifieLe)}</span>
    </button>`;
}

export function afficherProjets() {
  const projets = listerProjets();
  $('contenu').innerHTML = `
    <div class="liste-tete projets-tete">
      <h2>Mes projets · ${projets.length}</h2>
      <a class="bouton violet" href="#nouveau">+ Nouveau projet</a>
    </div>
    <div class="grille-projets">${projets.map(carteProjet).join('')}</div>`;
}

// Clic sur une carte : ouvre le projet sur son tableau de bord
$('contenu').addEventListener('click', async (e) => {
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
