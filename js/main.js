// Corps de la page : en-tête, onglets, choix de la vue, démarrage.
// Chaque fonction principale vit dans son propre fichier :
//   noyau/      état partagé, outils, enregistrement sur l'appareil
//   composants/ jalons, catégories, liste des tâches, fiche
//   vues/       mes projets, nouveau projet, tableau de bord, matrice, calendrier
import { etat, $, hooks } from './noyau/etat.js';
import { dateFr, joursAvant, tacheParId, texteModifieLe } from './noyau/outils.js';
import { charger, listerProjets } from './noyau/stockage.js';
import { afficherFiche, fermerFiche } from './composants/fiche.js';
import { afficherProjets } from './vues/projets.js';
import { afficherNouveauProjet } from './vues/nouveau-projet.js';
import { afficherAccueil } from './vues/accueil.js';
import { afficherMatrice } from './vues/matrice.js';
import { afficherCalendrier } from './vues/calendrier.js';

const VUES = {
  projets: afficherProjets, nouveau: afficherNouveauProjet,
  accueil: afficherAccueil, matrice: afficherMatrice, calendrier: afficherCalendrier,
};
// Pages sans projet affiché (pas d'onglets, pas de compte à rebours)
const HORS_PROJET = ['projets', 'nouveau'];

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

// En-tête de « Mes projets » et « Nouveau projet » : pas de projet affiché,
// donc ni nom ni compte à rebours
function afficherEnteteHorsProjet(vue) {
  $('sous-titre').textContent = '';
  document.title = (vue === 'nouveau' ? 'Nouveau projet' : 'Mes projets') + ' · Ormagedon';
  $('compte').innerHTML = '';
  $('maj').textContent = '';
}

function afficher() {
  let vue = vueActive();
  // Aucun projet ouvert : « Mes projets » s'il en existe (ex. le projet ouvert vient
  // d'être supprimé), sinon le formulaire « Nouveau projet » (premier lancement)
  if (!etat.donnees && !HORS_PROJET.includes(vue)) {
    vue = listerProjets().length ? 'projets' : 'nouveau';
    history.replaceState(null, '', '#' + vue);
  }
  const horsProjet = HORS_PROJET.includes(vue);
  document.body.classList.toggle('page-projets', horsProjet); // cache les onglets
  if (horsProjet) {
    if (etat.ficheId) fermerFiche();
    afficherEnteteHorsProjet(vue);
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
    if (etat.donnees && tacheParId(etat.ficheId)) afficherFiche(); else fermerFiche();
  }
}

hooks.afficher = afficher;
hooks.toutAfficher = toutAfficher;

document.querySelectorAll('.onglet').forEach((b) => b.addEventListener('click', () => {
  if (!b.disabled) location.hash = b.dataset.vue;
}));
window.addEventListener('hashchange', afficher);

charger();
