// Corps de la page : en-tête, onglets, choix de la vue, démarrage.
// Chaque fonction principale vit dans son propre fichier :
//   noyau/      état partagé, outils, enregistrement sur l'appareil
//   composants/ jalons, catégories, liste des tâches, fiche
//   vues/       mes projets, tableau de bord, matrice, calendrier
import { etat, $, hooks } from './noyau/etat.js';
import { dateFr, joursAvant, tacheParId, texteModifieLe } from './noyau/outils.js';
import { charger } from './noyau/stockage.js';
import { afficherFiche, fermerFiche } from './composants/fiche.js';
import { afficherProjets } from './vues/projets.js';
import { afficherAccueil } from './vues/accueil.js';
import { afficherMatrice } from './vues/matrice.js';
import { afficherCalendrier } from './vues/calendrier.js';

const VUES = { projets: afficherProjets, accueil: afficherAccueil, matrice: afficherMatrice, calendrier: afficherCalendrier };

function vueActive() {
  const v = location.hash.replace('#', '');
  return v in VUES ? v : 'accueil';
}

function afficherEntete() {
  const d = etat.donnees;
  // Nom du projet : sous « Ormagedon » dans l'en-tête, et dans l'onglet du navigateur
  const nom = ((d.projet && d.projet.nom) || '').trim();
  $('sous-titre').textContent = nom;
  document.title = nom ? `${nom} · Ormagedon` : 'Ormagedon';
  // Compte à rebours vers la deadline du projet : J-12 avant, J-0 le jour même, J+3 après.
  // Pas de deadline : rien ne s'affiche.
  const deadline = d.projet && d.projet.deadline;
  if (deadline) {
    const jours = joursAvant(deadline);
    const nombre = jours >= 0 ? 'J-' + jours : 'J+' + -jours;
    $('compte').innerHTML = `<div class="nombre">${nombre}</div><div class="libelle">Deadline · ${dateFr(deadline)}</div>`;
  } else {
    $('compte').innerHTML = '';
  }
  $('maj').textContent = texteModifieLe(d.modifieLe);
}

// En-tête de « Mes projets » : pas de projet ouvert, donc ni nom ni compte à rebours
function afficherEnteteProjets() {
  $('sous-titre').textContent = '';
  document.title = 'Mes projets · Ormagedon';
  $('compte').innerHTML = '';
  $('maj').textContent = '';
}

function afficher() {
  if (!etat.donnees) return;
  const vue = vueActive();
  const surProjets = vue === 'projets';
  document.body.classList.toggle('page-projets', surProjets); // cache les onglets
  if (surProjets) {
    if (etat.ficheId) fermerFiche();
    afficherEnteteProjets();
  } else {
    afficherEntete();
  }
  document.querySelectorAll('.onglet').forEach((b) => {
    const actif = b.dataset.vue === vue;
    b.classList.toggle('actif', actif);
    if (actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('contenu').className = 'vue-' + vue;
  VUES[vue]();
}

function toutAfficher() {
  afficher();
  if (etat.ficheId) {
    if (tacheParId(etat.ficheId)) afficherFiche(); else fermerFiche();
  }
}

hooks.afficher = afficher;
hooks.toutAfficher = toutAfficher;

document.querySelectorAll('.onglet').forEach((b) => b.addEventListener('click', () => {
  if (!b.disabled) location.hash = b.dataset.vue;
}));
window.addEventListener('hashchange', afficher);

charger();
