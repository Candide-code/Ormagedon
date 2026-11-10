// Réglages › Catégories (dans le rideau des Réglages, voir reglages.js).
// Page « Catégories » : renommer (les tâches suivent), supprimer (« Où les mettre ? »
// si des tâches l'utilisent, puis « Annuler » 8 s), ajouter.
// Sous-page d'une catégorie : ses sous-catégories (renommer, supprimer, ajouter).
// Les filtres du tableau de bord et de la Matrice suivent les renommages et suppressions.
import { etat, hooks, memoriserFiltre } from '../noyau/etat.js';
import { echapper, toast } from '../noyau/outils.js';
import { enregistrer } from '../noyau/stockage.js';

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const memeNom = (a, b) => a.toLowerCase() === b.toLowerCase();
const tachesDe = (nom) => etat.donnees.taches.filter((t) => t.categorie === nom);

let suppression = null; // index de la catégorie dont la question « Où les mettre ? » est ouverte

// Nom refusé ? Renvoie le message à afficher, ou '' si le nom est bon.
// « › » est réservé : il sépare catégorie et sous-catégorie dans les filtres.
function nomRefuse(nom, autres) {
  if (!nom) return 'Le nom ne peut pas être vide';
  if (nom.includes('›')) return 'Le signe › ne peut pas être utilisé dans un nom';
  if (autres.some((a) => memeNom(a, nom))) return `« ${nom} » existe déjà`;
  return '';
}

// Filtre de catégorie actif (« Marketing » ou « Marketing›Pub »)
function filtre() {
  const [cat, sous = ''] = (etat.filtre.categorie || '').split('›');
  return { cat, sous };
}
function changerFiltre(cat, sous = '') {
  etat.filtre.categorie = cat ? cat + (sous ? '›' + sous : '') : '';
  memoriserFiltre();
}

async function appliquer() {
  hooks.afficher(); // page derrière le rideau (boutons de filtre, cartes…)
  return enregistrer();
}

// ----- Affichage -----

function questionSuppression(i) {
  const c = etat.donnees.categories[i];
  const taches = tachesDe(c.nom);
  const codes = taches.slice(0, 5).map((t) => t.id).join(', ') + (taches.length > 5 ? '…' : '');
  const destinations = [{ valeur: '', libelle: 'Sans catégorie' },
    ...etat.donnees.categories.filter((x) => x !== c).map((x) => ({ valeur: x.nom, libelle: x.nom }))];
  return `
    <div class="rg-question" role="group" aria-label="Supprimer ${echapper(c.nom)}">
      <strong>Supprimer « ${echapper(c.nom)} »</strong>
      <p>${pluriel(taches.length, 'tâche')} ${taches.length > 1 ? 'sont' : 'est'} dans cette catégorie (${echapper(codes)}). Où les mettre ?</p>
      ${destinations.map((d, k) => `<label class="case-cocher"><input type="radio" name="rg-destination" value="${echapper(d.valeur)}" ${k === 0 ? 'checked' : ''}> ${echapper(d.libelle)}</label>`).join('')}
      <div class="rg-actions">
        <button type="button" class="bouton" data-cat-annuler>Annuler</button>
        <button type="button" class="bouton danger" data-cat-confirmer="${i}">Supprimer</button>
      </div>
    </div>`;
}

export function htmlCategories() {
  const cats = etat.donnees.categories;
  const lignes = cats.map((c, i) => {
    const n = tachesDe(c.nom).length;
    return `
      <li class="rg-cat">
        <div class="rg-ligne-nom">
          <input type="text" data-cat-nom="${i}" value="${echapper(c.nom)}" maxlength="60" aria-label="Nom de la catégorie ${echapper(c.nom)}">
          <button type="button" class="suppr" data-cat-suppr="${i}" aria-label="Supprimer la catégorie ${echapper(c.nom)}" title="Supprimer la catégorie">×</button>
        </div>
        <div class="rg-cat-info">
          <span class="discret">${n ? pluriel(n, 'tâche') : 'aucune tâche'}</span>
          <span class="discret" aria-hidden="true">·</span>
          <button type="button" class="rg-sous-lien" data-cat-sous="${i}">Sous-catégories (${c.sous.length}) <span aria-hidden="true">›</span></button>
        </div>
        ${suppression === i ? questionSuppression(i) : ''}
      </li>`;
  }).join('');
  return `
    ${cats.length ? `<ul class="rg-liste">${lignes}</ul>` : '<p class="discret">Aucune catégorie pour l\'instant.</p>'}
    <form class="rg-ajout" data-ajout="cat">
      <input type="text" maxlength="60" placeholder="Nouvelle catégorie" aria-label="Nouvelle catégorie">
      <button type="submit" class="bouton">+ Ajouter</button>
    </form>`;
}

export const titreSousCategories = (i) => `Sous-catégories de ${etat.donnees.categories[i].nom}`;

export function htmlSousCategories(i) {
  const c = etat.donnees.categories[i];
  const lignes = c.sous.map((s, j) => `
    <li class="rg-ligne-nom">
      <input type="text" data-sous-nom="${j}" value="${echapper(s)}" maxlength="60" aria-label="Nom de la sous-catégorie ${echapper(s)}">
      <button type="button" class="suppr" data-sous-suppr="${j}" aria-label="Supprimer la sous-catégorie ${echapper(s)}" title="Supprimer la sous-catégorie">×</button>
    </li>`).join('');
  return `
    ${c.sous.length ? `<ul class="rg-liste rg-liste-sous">${lignes}</ul>` : '<p class="discret">Aucune sous-catégorie.</p>'}
    <form class="rg-ajout" data-ajout="sous">
      <input type="text" maxlength="60" placeholder="Nouvelle sous-catégorie" aria-label="Nouvelle sous-catégorie">
      <button type="submit" class="bouton">+ Ajouter</button>
    </form>`;
}

export function fermerQuestion() { suppression = null; }

// ----- Modifications -----

async function renommerCategorie(i, champ) {
  const c = etat.donnees.categories[i];
  const nouveau = champ.value.trim();
  if (nouveau === c.nom) { champ.value = c.nom; return; }
  const refus = nomRefuse(nouveau, etat.donnees.categories.filter((x) => x !== c).map((x) => x.nom));
  if (refus) { champ.value = c.nom; toast(refus); return; }
  const ancien = c.nom;
  c.nom = nouveau;
  tachesDe(ancien).forEach((t) => { t.categorie = nouveau; });
  const f = filtre();
  if (f.cat === ancien) changerFiltre(nouveau, f.sous);
  champ.value = nouveau;
  champ.setAttribute('aria-label', 'Nom de la catégorie ' + nouveau);
  await appliquer();
}

async function renommerSous(i, j, champ) {
  const c = etat.donnees.categories[i];
  const ancien = c.sous[j];
  const nouveau = champ.value.trim();
  if (nouveau === ancien) { champ.value = ancien; return; }
  const refus = nomRefuse(nouveau, c.sous.filter((s, k) => k !== j));
  if (refus) { champ.value = ancien; toast(refus); return; }
  c.sous[j] = nouveau;
  tachesDe(c.nom).filter((t) => t.sousCategorie === ancien).forEach((t) => { t.sousCategorie = nouveau; });
  const f = filtre();
  if (f.cat === c.nom && f.sous === ancien) changerFiltre(c.nom, nouveau);
  champ.value = nouveau;
  await appliquer();
}

async function ajouter(type, champ, i, nav) {
  const nom = champ.value.trim();
  const liste = type === 'cat' ? etat.donnees.categories.map((c) => c.nom) : etat.donnees.categories[i].sous;
  const refus = nomRefuse(nom, liste);
  if (refus) { toast(refus); champ.focus(); return; }
  if (type === 'cat') etat.donnees.categories.push({ nom, sous: [] });
  else etat.donnees.categories[i].sous.push(nom);
  await appliquer();
  nav.afficher('.rg-ajout input'); // prêt pour en taper une autre
}

// Supprime la catégorie i ; ses tâches vont dans « destination » ('' = Sans catégorie)
async function supprimerCategorie(i, destination, nav) {
  const d = etat.donnees;
  const c = d.categories[i];
  const dest = d.categories.find((x) => x.nom === destination);
  const deplacees = tachesDe(c.nom).map((t) => ({ t, categorie: t.categorie, sous: t.sousCategorie }));
  const filtreAvant = etat.filtre.categorie;
  deplacees.forEach(({ t }) => {
    t.categorie = dest ? dest.nom : '';
    t.sousCategorie = dest ? (dest.sous[0] || '') : ''; // comme dans la fiche : la 1re sous-catégorie
  });
  d.categories.splice(i, 1);
  if (filtre().cat === c.nom) changerFiltre('');
  suppression = null;
  if (!(await appliquer())) return;
  nav.afficher();
  const ou = deplacees.length ? ` (${pluriel(deplacees.length, 'tâche')} → ${dest ? dest.nom : 'Sans catégorie'})` : '';
  toast(`« ${c.nom} » supprimée${ou}`, {
    libelle: 'Annuler',
    faire: async () => {
      if (d !== etat.donnees) return; // on a changé de projet entre-temps
      if (d.categories.some((x) => memeNom(x.nom, c.nom))) { toast(`Impossible d'annuler : « ${c.nom} » existe de nouveau`); return; }
      d.categories.splice(Math.min(i, d.categories.length), 0, c);
      // Les tâches reviennent, sauf celles qu'on a changées de catégorie entre-temps
      deplacees.forEach(({ t, categorie, sous }) => {
        if (t.categorie === (dest ? dest.nom : '')) { t.categorie = categorie; t.sousCategorie = sous; }
      });
      etat.filtre.categorie = filtreAvant; memoriserFiltre();
      if (await appliquer()) { nav.afficher(); toast(`« ${c.nom} » restaurée`); }
    },
  });
}

async function supprimerSous(i, j, nav) {
  const c = etat.donnees.categories[i];
  const s = c.sous[j];
  const taches = tachesDe(c.nom).filter((t) => t.sousCategorie === s);
  if (taches.length && !confirm(`Supprimer la sous-catégorie « ${s} » ?\n\n${pluriel(taches.length, 'tâche')} ${taches.length > 1 ? 'restent' : 'reste'} dans « ${c.nom} », sans sous-catégorie.`)) return;
  c.sous.splice(j, 1);
  taches.forEach((t) => { t.sousCategorie = ''; });
  const f = filtre();
  if (f.cat === c.nom && f.sous === s) changerFiltre(c.nom);
  if (await appliquer()) { nav.afficher('.rg-ajout input'); toast(`« ${s} » supprimée`); }
}

// ----- Événements (appelés par reglages.js ; renvoient true si traités) -----
// nav : { afficher(focus), aller(page, index), index() }

export function clicCategories(e, nav) {
  const el = (sel) => e.target.closest(sel);
  let b;
  if ((b = el('[data-cat-sous]'))) { suppression = null; nav.aller('sous', +b.dataset.catSous); return true; }
  if ((b = el('[data-cat-suppr]'))) {
    const i = +b.dataset.catSuppr;
    if (!tachesDe(etat.donnees.categories[i].nom).length) supprimerCategorie(i, '', nav);
    else { suppression = i; nav.afficher('[name="rg-destination"]'); }
    return true;
  }
  if (el('[data-cat-annuler]')) { const i = suppression; suppression = null; nav.afficher(`[data-cat-suppr="${i}"]`); return true; }
  if ((b = el('[data-cat-confirmer]'))) {
    const choix = document.querySelector('[name="rg-destination"]:checked');
    supprimerCategorie(+b.dataset.catConfirmer, choix ? choix.value : '', nav);
    return true;
  }
  if ((b = el('[data-sous-suppr]'))) { supprimerSous(nav.index(), +b.dataset.sousSuppr, nav); return true; }
  return false;
}

export function changeCategories(e, nav) {
  const t = e.target;
  if (t.dataset.catNom !== undefined) { renommerCategorie(+t.dataset.catNom, t); return true; }
  if (t.dataset.sousNom !== undefined) { renommerSous(nav.index(), +t.dataset.sousNom, t); return true; }
  return false;
}

export function envoiCategories(e, nav) {
  const f = e.target.closest('[data-ajout]');
  if (!f) return false;
  e.preventDefault();
  ajouter(f.dataset.ajout, f.querySelector('input'), nav.index(), nav);
  return true;
}

// Entrée dans un nom : valide le renommage (comme quitter le champ)
export function toucheCategories(e) {
  const t = e.target;
  if (e.key === 'Enter' && (t.dataset.catNom !== undefined || t.dataset.sousNom !== undefined)) { t.blur(); return true; }
  return false;
}
