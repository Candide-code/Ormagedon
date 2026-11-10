// Réglages du projet ouvert : rideau à droite (comme la fiche d'une tâche), ouvert par
// l'icône ⚙ de l'en-tête. Plein écran sur téléphone.
// Un menu (Projet, Catégories, Données), puis une sous-page dans le rideau
// (« ‹ Réglages » pour revenir ; ×, Échap ou clic à côté pour fermer).
// Projet : nom et deadline, enregistrés en quittant le champ.
// Catégories et sous-catégories : dans reglages-categories.js.
// Données (exporter, puis importer) : dans reglages-donnees.js.
import { etat, $, hooks } from '../noyau/etat.js';
import { echapper, toast } from '../noyau/outils.js';
import { enregistrer } from '../noyau/stockage.js';
import { fermerFiche } from './fiche.js';
import { htmlCategories, htmlSousCategories, titreSousCategories, fermerQuestion,
  clicCategories, changeCategories, envoiCategories, toucheCategories } from './reglages-categories.js';
import { htmlDonnees, clicDonnees } from './reglages-donnees.js';

const PAGES = { projet: 'Projet', categories: 'Catégories', donnees: 'Données' };
let ouvert = false;
let page = 'menu';  // 'menu', une clé de PAGES, ou 'sous' (sous-catégories d'une catégorie)
let catIndex = 0;   // catégorie affichée dans la page 'sous'

// Pour reglages-categories.js : redessiner le rideau, changer de page
const nav = {
  afficher: (focus) => afficher(focus),
  aller: (p, i) => { page = p; catIndex = i; afficher(p === 'sous' ? '.rg-retour' : null); },
  index: () => catIndex,
  fermer: () => fermerReglages(),
};

const boutonFermer = '<button type="button" class="fermer" data-rg-fermer aria-label="Fermer les réglages">×</button>';

function htmlMenu() {
  return `
    <div class="rg-tete"><h2 class="rg-titre">Réglages</h2>${boutonFermer}</div>
    <nav class="rg-menu" aria-label="Réglages">
      ${Object.entries(PAGES).map(([cle, titre]) => `<button type="button" class="rg-entree" data-rg-page="${cle}">${titre}<span aria-hidden="true">›</span></button>`).join('')}
    </nav>`;
}

function htmlProjet() {
  const p = etat.donnees.projet;
  return `
    <label class="rg-champ">
      <span>Nom du projet</span>
      <input type="text" data-reglage="nom" value="${echapper(p.nom)}" maxlength="80">
    </label>
    <div class="rg-champ">
      <label for="rg-deadline">Deadline</label>
      <div class="rg-ligne">
        <input type="date" id="rg-deadline" data-reglage="deadline" value="${echapper(p.deadline || '')}">
        <button type="button" class="bouton" data-retirer-deadline ${p.deadline ? '' : 'hidden'}>Retirer la deadline</button>
      </div>
    </div>`;
}

function htmlSousPage() {
  const sous = page === 'sous';
  const corps = page === 'projet' ? htmlProjet()
    : page === 'categories' ? htmlCategories()
      : sous ? htmlSousCategories(catIndex)
        : htmlDonnees();
  const retour = sous
    ? '<button type="button" class="rg-retour" data-rg-page="categories">‹ Catégories</button>'
    : '<button type="button" class="rg-retour" data-rg-page="menu">‹ Réglages</button>';
  return `
    <div class="rg-tete">${retour}${boutonFermer}</div>
    <h2 class="rg-titre">${echapper(sous ? titreSousCategories(catIndex) : PAGES[page])}</h2>
    <div class="rg-corps">${corps}</div>`;
}

function afficher(focus) {
  if (!etat.donnees) return;
  // Catégorie disparue (supprimée dans un autre onglet) : retour à la liste
  if (page === 'sous' && !etat.donnees.categories[catIndex]) page = 'categories';
  $('reglages-contenu').innerHTML = page === 'menu' ? htmlMenu() : htmlSousPage();
  const cible = focus && $('reglages').querySelector(focus);
  if (cible) cible.focus();
}

export function ouvrirReglages() {
  if (!etat.donnees) return;
  if (etat.ficheId) fermerFiche(); // un seul rideau à la fois
  ouvert = true;
  page = 'menu';
  fermerQuestion();
  document.body.classList.add('reglages-ouverts'); // d'abord visible, sinon le curseur ne peut pas s'y placer
  $('reglages').setAttribute('aria-hidden', 'false');
  afficher('.rg-entree');
  $('reglages-bouton').classList.add('actif');
  $('reglages-bouton').setAttribute('aria-expanded', 'true');
}

export function fermerReglages() {
  if (!ouvert) return;
  // Enregistre d'abord un champ en cours de saisie
  if (document.activeElement && $('reglages').contains(document.activeElement)) document.activeElement.blur();
  ouvert = false;
  document.body.classList.remove('reglages-ouverts');
  $('reglages').setAttribute('aria-hidden', 'true');
  $('reglages-bouton').classList.remove('actif');
  $('reglages-bouton').setAttribute('aria-expanded', 'false');
  if (etat.donnees) $('reglages-bouton').focus();
}

// Après un rechargement (ex. un autre onglet a modifié le projet) : rideau à jour.
// Plus de projet ouvert (supprimé ailleurs) : on ferme.
export function rafraichirReglages() {
  if (!ouvert) return;
  if (!etat.donnees) { fermerReglages(); return; }
  afficher();
}

// On ne redessine pas le rideau (le curseur serait perdu en pleine saisie d'une date) :
// seulement l'en-tête et le bouton « Retirer la deadline »
async function modifierProjet(changement, message) {
  Object.assign(etat.donnees.projet, changement);
  hooks.entete();
  const retirer = $('reglages').querySelector('[data-retirer-deadline]');
  if (retirer) retirer.hidden = !etat.donnees.projet.deadline;
  if (await enregistrer() && message) toast(message);
}

$('reglages-bouton').addEventListener('click', () => (ouvert ? fermerReglages() : ouvrirReglages()));
$('voile').addEventListener('click', fermerReglages);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ouvert) fermerReglages(); });

$('reglages').addEventListener('click', (e) => {
  if (!(e.target instanceof Element)) return;
  if (e.target.closest('[data-rg-fermer]')) { fermerReglages(); return; }
  const lien = e.target.closest('[data-rg-page]');
  if (lien) {
    const venaitDe = page;
    page = lien.dataset.rgPage;
    fermerQuestion();
    // Retour : curseur sur la ligne d'où l'on vient ; nouvelle page : sur « ‹ Réglages »
    afficher(page === 'menu' ? `[data-rg-page="${venaitDe}"]`
      : venaitDe === 'sous' ? `[data-cat-sous="${catIndex}"]` : '.rg-retour');
    return;
  }
  if (clicCategories(e, nav)) return;
  if (clicDonnees(e, nav)) return;
  if (e.target.closest('[data-retirer-deadline]')) {
    $('rg-deadline').value = '';
    modifierProjet({ deadline: null }, 'Deadline retirée');
  }
});

// Enregistré quand on quitte le champ ou qu'on appuie sur Entrée
$('reglages').addEventListener('change', (e) => {
  if (changeCategories(e, nav)) return;
  const champ = e.target.dataset.reglage;
  if (champ === 'nom') {
    const nom = e.target.value.trim();
    if (!nom) { // un projet garde toujours un nom
      e.target.value = etat.donnees.projet.nom;
      toast('Le projet doit avoir un nom');
      return;
    }
    if (nom !== etat.donnees.projet.nom) modifierProjet({ nom });
  }
  if (champ === 'deadline') modifierProjet({ deadline: e.target.value || null });
});

$('reglages').addEventListener('keydown', (e) => {
  if (toucheCategories(e)) return;
  if (e.key === 'Enter' && e.target.dataset.reglage === 'nom') e.target.blur();
});

// « + Ajouter » (ou Entrée) dans Catégories et Sous-catégories
$('reglages').addEventListener('submit', (e) => { envoiCategories(e, nav); });
