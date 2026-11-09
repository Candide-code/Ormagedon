// Vue « Nouveau projet » (#nouveau) : nom (obligatoire), deadline et catégories
// (facultatives). « Commencer » crée le projet et ouvre son tableau de bord.
// Au premier lancement (aucun projet), l'app s'ouvre ici, sans « Annuler ».
import { $, repartirDeZero } from '../noyau/etat.js';
import { echapper } from '../noyau/outils.js';
import { creerProjet, listerProjets } from '../noyau/stockage.js';

// Ce qui est déjà saisi : gardé si la page se redessine (ex. un autre onglet enregistre)
// ou si on part et revient. Vidé après « Commencer » ou « Annuler ».
let brouillon = null;
const brouillonVide = () => ({ nom: '', deadline: '', categories: [''], erreur: false });

function ligneCategorie(nom, i) {
  return `
    <div class="np-categorie">
      <input type="text" data-cat="${i}" value="${echapper(nom)}" maxlength="60"
        placeholder="${i === 0 ? 'ex. Marketing' : ''}" aria-label="Catégorie ${i + 1}">
      <button type="button" class="suppr" data-retirer="${i}" aria-label="Retirer cette catégorie">×</button>
    </div>`;
}

export function afficherNouveauProjet() {
  if (!brouillon) brouillon = brouillonVide();
  const b = brouillon;
  const premier = listerProjets().length === 0;
  $('contenu').innerHTML = `
    <form class="form-projet" novalidate>
      <h2 class="np-titre">${premier ? 'Ton premier projet' : 'Nouveau projet'}</h2>

      <label class="np-champ">
        <span>Nom du projet *</span>
        <input type="text" data-champ="nom" value="${echapper(b.nom)}" maxlength="80" required
          aria-describedby="np-erreur" ${b.erreur ? 'aria-invalid="true"' : ''}>
        <span class="np-erreur" id="np-erreur" ${b.erreur ? '' : 'hidden'}>Donne un nom au projet.</span>
      </label>

      <label class="np-champ">
        <span>Deadline <span class="discret">(facultatif)</span></span>
        <input type="date" data-champ="deadline" value="${echapper(b.deadline)}">
      </label>

      <fieldset class="np-champ np-categories">
        <legend>Catégories <span class="discret">(facultatif)</span></legend>
        <p class="discret np-aide">Tu pourras en ajouter ou en changer plus tard.</p>
        ${b.categories.map(ligneCategorie).join('')}
        <button type="button" class="bouton" data-ajouter-cat>+ Ajouter une catégorie</button>
      </fieldset>

      <div class="np-actions">
        ${premier ? '' : '<button type="button" class="bouton" data-annuler>Annuler</button>'}
        <button type="submit" class="bouton violet">Commencer</button>
      </div>
    </form>`;
  // À l'arrivée sur la page, le curseur est prêt dans le nom
  const actif = document.activeElement;
  if (!actif || actif === document.body || !actif.isConnected) $('contenu').querySelector('[data-champ="nom"]').focus();
}

// Redessine puis place le curseur dans le champ voulu
function redessiner(selecteur) {
  afficherNouveauProjet();
  const champ = selecteur && document.querySelector(selecteur);
  if (champ) champ.focus();
}

const surFormulaire = (e) => e.target instanceof Element && e.target.closest('.form-projet');

// Saisie : on garde tout dans le brouillon
$('contenu').addEventListener('input', (e) => {
  if (!surFormulaire(e) || !brouillon) return;
  const t = e.target;
  if (t.dataset.champ === 'nom') {
    brouillon.nom = t.value;
    if (brouillon.erreur && t.value.trim()) {
      brouillon.erreur = false;
      t.removeAttribute('aria-invalid');
      $('np-erreur').hidden = true;
    }
  }
  if (t.dataset.champ === 'deadline') brouillon.deadline = t.value;
  if (t.dataset.cat !== undefined) brouillon.categories[+t.dataset.cat] = t.value;
});

$('contenu').addEventListener('click', (e) => {
  if (!surFormulaire(e) || !brouillon) return;
  if (e.target.closest('[data-ajouter-cat]')) {
    brouillon.categories.push('');
    redessiner(`[data-cat="${brouillon.categories.length - 1}"]`);
    return;
  }
  const r = e.target.closest('[data-retirer]');
  if (r) {
    brouillon.categories.splice(+r.dataset.retirer, 1);
    if (!brouillon.categories.length) brouillon.categories.push(''); // toujours une ligne
    redessiner('[data-ajouter-cat]');
    return;
  }
  if (e.target.closest('[data-annuler]')) {
    brouillon = null;
    location.hash = 'projets';
  }
});

// Entrée dans une catégorie : nouvelle ligne juste en dessous (au lieu d'envoyer le formulaire)
$('contenu').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !surFormulaire(e) || !brouillon || e.target.dataset.cat === undefined) return;
  e.preventDefault();
  const i = +e.target.dataset.cat;
  brouillon.categories.splice(i + 1, 0, '');
  redessiner(`[data-cat="${i + 1}"]`);
});

// Commencer
$('contenu').addEventListener('submit', async (e) => {
  if (!surFormulaire(e) || !brouillon) return;
  e.preventDefault();
  const nom = brouillon.nom.trim();
  if (!nom) {
    brouillon.erreur = true;
    redessiner('[data-champ="nom"]');
    return;
  }
  // Catégories : sans les lignes vides, chaque nom une seule fois (majuscules ignorées)
  const vus = new Set();
  const categories = brouillon.categories.map((c) => c.trim()).filter((c) => {
    const cle = c.toLowerCase();
    if (!c || vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
  const bouton = e.target.querySelector('[type="submit"]');
  bouton.disabled = true; // pas de double clic
  if (!(await creerProjet({ nom, deadline: brouillon.deadline, categories }))) {
    bouton.disabled = false;
    return;
  }
  brouillon = null;
  repartirDeZero();
  location.hash = 'accueil'; // le changement d'adresse redessine la page
});
