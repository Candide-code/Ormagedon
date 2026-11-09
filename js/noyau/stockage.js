// Lire et enregistrer les données sur l'appareil (stockage du navigateur).
// Remplace l'ancien api.js (serveur de Trudy) avec les mêmes fonctions.
//
// Rangement dans le navigateur (localStorage) :
//   ormagedon-projets       liste des projets : [{ id, nom, deadline, modifieLe }]
//   ormagedon-projet-<id>   toutes les données d'un projet
//   ormagedon-dernier       id du projet ouvert en dernier (rouvert au démarrage)
// On ne charge que le projet ouvert.
import { etat, $, hooks } from './etat.js';
import { toast, texteModifieLe } from './outils.js';

const CLE_LISTE = 'ormagedon-projets';
const CLE_DERNIER = 'ormagedon-dernier';
const cleProjet = (id) => 'ormagedon-projet-' + id;

// Lecture / écriture protégées : le stockage peut être bloqué (navigation privée,
// données du site bloquées) ou plein.
function lire(cle) {
  try { return JSON.parse(localStorage.getItem(cle)); } catch { return null; }
}
function ecrire(cle, valeur) {
  localStorage.setItem(cle, JSON.stringify(valeur)); // peut lever une erreur : géré par l'appelant
}

// Numéro de version de la forme des données. À augmenter quand la forme change,
// en ajoutant l'étape de mise à jour correspondante dans MISES_A_JOUR.
export const SCHEMA = 1;

// MISES_A_JOUR[n] transforme un projet de la version n vers la version n + 1.
// Exemple pour plus tard : 1: (d) => { d.taches.forEach((t) => { t.fichiers ||= []; }); },
const MISES_A_JOUR = {};

// Met un projet à la version actuelle, sans rien perdre.
// Projet sans numéro (créé avant le point 4) = version 1.
// Renvoie false si le projet vient d'une version plus récente de l'app.
export function mettreAJourDonnees(d) {
  if (!d.schema) d.schema = 1;
  if (d.schema > SCHEMA) return false;
  while (d.schema < SCHEMA) {
    MISES_A_JOUR[d.schema](d);
    d.schema++;
  }
  return true;
}

// Données toujours complètes : ce qui manque est ajouté vide, rien n'est supprimé
// (sauf l'ancien « code » des catégories, qui ne sert plus). Protège l'app d'un projet
// ancien, importé ou modifié à la main.
const STATUTS = ['À faire', 'En cours', 'Fait', 'Reporté', 'Abandonné'];
const CASES_VALIDES = ['a_classer', 'q1', 'q2', 'q3', 'q4'];
const texte = (v, defaut = '') => (typeof v === 'string' ? v : defaut);
const liste = (v) => (Array.isArray(v) ? v : []);

export function completerDonnees(d) {
  const p = d.projet && typeof d.projet === 'object' ? d.projet : {};
  d.projet = { ...p, nom: texte(p.nom), deadline: texte(p.deadline) || null, creeLe: texte(p.creeLe, d.modifieLe || new Date().toISOString()) };
  if (!liste(d.statuts).length) d.statuts = [...STATUTS];
  d.categories = liste(d.categories).filter((c) => c && texte(c.nom)).map((c) => {
    const { code, ...reste } = c; // l'ancien code (lettre) ne sert plus
    return { ...reste, nom: c.nom, sous: liste(c.sous).filter((s) => typeof s === 'string') };
  });
  d.jalons = liste(d.jalons).filter((j) => j && j.id).map((j) => ({ ...j, date: texte(j.date), titre: texte(j.titre) }));
  d.taches = liste(d.taches).filter((t) => t && t.id).map((t) => ({
    ...t,
    titre: texte(t.titre).trim() ? t.titre : 'Sans titre',
    description: texte(t.description),
    categorie: texte(t.categorie),
    sousCategorie: texte(t.sousCategorie),
    statut: d.statuts.includes(t.statut) ? t.statut : 'À faire', // statut inconnu (ex. venu de Trudy)
    case: CASES_VALIDES.includes(t.case) ? t.case : 'a_classer',
    echeance: texte(t.echeance),
    jalons: liste(t.jalons),
    todo: liste(t.todo).filter((x) => x && typeof x.texte === 'string'),
    liens: liste(t.liens).filter((l) => l && typeof l.url === 'string').map((l) => ({ ...l, libelle: texte(l.libelle, l.url) })),
    dependances: liste(t.dependances),
    notes: texte(t.notes),
  }));
  return d;
}

// Lit un projet, le met à jour et le complète. Un projet trop récent est marqué pour ne pas être écrasé.
function lireProjet(id) {
  const d = lire(cleProjet(id));
  if (!d || typeof d !== 'object') return null;
  d.id = id;
  if (!mettreAJourDonnees(d)) {
    d.tropRecent = true;
    toast("Ce projet vient d'une version plus récente d'Ormagedon : recharge la page pour mettre l'app à jour. Tes modifications ne seront pas enregistrées d'ici là.");
  }
  // Complété aussi quand il est trop récent : seulement pour l'afficher sans planter,
  // il n'est jamais enregistré dans ce cas.
  return completerDonnees(d);
}

// Clé unique d'un nouveau projet : heure de création + 4 caractères au hasard,
// vérifiée contre les projets déjà enregistrés. Deux projets peuvent avoir le même nom.
function nouvelId() {
  const pris = new Set((lire(CLE_LISTE) || []).map((p) => p.id));
  let id;
  do {
    id = 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  } while (pris.has(id) || lire(cleProjet(id)) !== null);
  return id;
}

// Crée un projet (formulaire « Nouveau projet »), l'enregistre et l'ouvre.
// categories : liste de noms déjà nettoyée (sans vide ni doublon).
// source : id d'un projet à dupliquer. On copie alors ses catégories, jalons et tâches
// (categories est ignoré) ; avec remettre, les tâches repartent à « À faire »
// et leurs étapes sont décochées.
export async function creerProjet({ nom, deadline, categories, source = null, remettre = false }) {
  await file; // les enregistrements en cours finissent d'abord dans l'ancien projet
  const maintenant = new Date().toISOString();
  const d = {
    schema: SCHEMA,
    id: nouvelId(),
    projet: { nom, deadline: deadline || null, creeLe: maintenant },
    categories: categories.map((c) => ({ nom: c, sous: [] })),
    statuts: [...STATUTS],
    jalons: [],
    taches: [],
    modifieLe: maintenant,
  };
  if (source) {
    const s = lireProjet(source);
    if (!s) { toast('Projet à copier introuvable'); return false; }
    const copie = JSON.parse(JSON.stringify(s)); // copie complète, sans lien avec l'original
    d.categories = copie.categories;
    d.statuts = copie.statuts;
    d.jalons = copie.jalons;
    d.taches = copie.taches;
    if (remettre) {
      d.taches.forEach((t) => {
        t.statut = 'À faire';
        t.todo.forEach((x) => { x.fait = false; });
      });
    }
  }
  try {
    ecrire(cleProjet(d.id), d);
    mettreAJourListe(d);
    ecrire(CLE_DERNIER, d.id);
  } catch {
    marquerEnregistrement(false);
    toast("Projet non créé : le stockage de l'appareil est plein ou bloqué");
    return false;
  }
  etat.donnees = d;
  aRecharger = false;
  marquerEnregistrement(true);
  return true;
}

// Ouvre le projet ouvert en dernier, sinon le premier de la liste.
// Aucun projet (premier lancement) : etat.donnees reste vide et main.js
// affiche le formulaire « Nouveau projet ».
export async function charger() {
  const liste = lire(CLE_LISTE) || [];
  const ids = [lire(CLE_DERNIER), ...liste.map((p) => p.id)].filter(Boolean);
  let donnees = null;
  for (const id of ids) {
    donnees = lireProjet(id);
    if (donnees) break;
  }
  etat.donnees = donnees;
  let ok = true;
  try {
    if (donnees) {
      ecrire(CLE_DERNIER, donnees.id);
      mettreAJourListe(donnees);
    } else {
      localStorage.setItem('ormagedon-essai', '1'); // le stockage marche-t-il ?
      localStorage.removeItem('ormagedon-essai');
    }
  } catch { ok = false; /* stockage indisponible : l'app s'ouvre quand même */ }
  hooks.toutAfficher();
  if (donnees && donnees.tropRecent) marquerEnregistrement(false, 'version');
  else marquerEnregistrement(ok);
}

// Pour la page « Mes projets » : tous les projets, le plus récemment modifié en premier.
// On lit chaque projet pour compter ses tâches (un projet disparu est ignoré).
export function listerProjets() {
  return (lire(CLE_LISTE) || [])
    .map((p) => {
      const d = lire(cleProjet(p.id));
      if (!d || typeof d !== 'object') return null;
      const taches = Array.isArray(d.taches) ? d.taches : [];
      return {
        id: p.id,
        nom: (d.projet && d.projet.nom) || '',
        deadline: (d.projet && d.projet.deadline) || null,
        modifieLe: d.modifieLe || '',
        nbTaches: taches.length,
        nbFaites: taches.filter((t) => t && t.statut === 'Fait').length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
}

// Ouvre un autre projet (depuis « Mes projets »). Attend la fin des enregistrements
// en cours pour ne jamais écrire un projet dans un autre.
export async function ouvrirProjet(id) {
  await file;
  const d = lireProjet(id);
  if (!d) { toast('Projet introuvable'); return false; }
  etat.donnees = d;
  aRecharger = false;
  let ok = true;
  try { ecrire(CLE_DERNIER, id); } catch { ok = false; }
  if (d.tropRecent) marquerEnregistrement(false, 'version');
  else marquerEnregistrement(ok);
  return true;
}

// Supprime un projet de l'appareil. Renvoie ses données (pour « Annuler »), ou null.
// Si c'était le projet ouvert, plus aucun projet n'est ouvert.
export async function supprimerProjet(id) {
  await file;
  const d = lire(cleProjet(id));
  if (!d) return null;
  try {
    localStorage.removeItem(cleProjet(id));
    ecrire(CLE_LISTE, (lire(CLE_LISTE) || []).filter((p) => p.id !== id));
    if (lire(CLE_DERNIER) === id) localStorage.removeItem(CLE_DERNIER);
  } catch {
    toast("Projet non supprimé : le stockage de l'appareil est bloqué");
    return null;
  }
  if (etat.donnees && etat.donnees.id === id) { etat.donnees = null; aRecharger = false; }
  return d;
}

// « Annuler » après une suppression : remet le projet tel qu'il était
export function restaurerProjet(d) {
  if (lire(cleProjet(d.id))) return false; // déjà là
  try {
    ecrire(cleProjet(d.id), d);
    mettreAJourListe(d);
    return true;
  } catch {
    toast("Impossible d'annuler : le stockage de l'appareil est plein ou bloqué");
    return false;
  }
}

// Le stockage répond-il ? (bloqué : on ne peut pas savoir si un projet existe)
function stockageLisible() {
  try { localStorage.getItem(CLE_LISTE); return true; } catch { return false; }
}

// Le projet ouvert a été supprimé dans un autre onglet : on le ferme, sans le recréer
function projetSupprimeAilleurs() {
  aRecharger = false;
  etat.donnees = null;
  hooks.toutAfficher(); // main.js renvoie vers « Mes projets »
  toast('Ce projet a été supprimé dans un autre onglet');
}

// Met à jour la fiche du projet dans la liste des projets
function mettreAJourListe(d) {
  const liste = (lire(CLE_LISTE) || []).filter((p) => p.id !== d.id);
  liste.push({ id: d.id, nom: d.projet.nom, deadline: d.projet.deadline, modifieLe: d.modifieLe });
  ecrire(CLE_LISTE, liste);
}

// Enregistre tout de suite. Les enregistrements passent l'un après l'autre :
// deux modifications très rapprochées (deux cases cochées vite) ne se gênent pas.
let file = Promise.resolve();
let enCours = 0;
export function enregistrer() {
  enCours++;
  const resultat = file.then(ecrireProjet).finally(() => { enCours--; });
  file = resultat.catch(() => {});
  return resultat;
}

async function ecrireProjet() {
  const d = etat.donnees;
  if (!d) return false;
  // Projet venu d'une version plus récente de l'app : on ne l'abîme pas
  if (d.tropRecent) {
    marquerEnregistrement(false, 'version');
    toast("Non enregistré : ce projet vient d'une version plus récente d'Ormagedon, recharge la page");
    return false;
  }
  // Un autre onglet a enregistré depuis notre dernière lecture : on n'écrase pas
  // sa version, on la recharge (comme Trudy en cas de conflit).
  const stocke = lire(cleProjet(d.id));
  // Supprimé dans un autre onglet : on ne le recrée pas
  if (!stocke && stockageLisible()) { projetSupprimeAilleurs(); return false; }
  if (stocke && stocke.modifieLe && stocke.modifieLe !== d.modifieLe) {
    aRecharger = false;
    etat.donnees = lireProjet(d.id);
    hooks.toutAfficher();
    marquerEnregistrement(true);
    toast('Modifié dans un autre onglet : version la plus récente rechargée, refais ta dernière action');
    return false;
  }
  try {
    d.modifieLe = new Date().toISOString();
    ecrire(cleProjet(d.id), d);
    mettreAJourListe(d);
    marquerEnregistrement(true);
    return true;
  } catch {
    marquerEnregistrement(false);
    toast("Échec de l'enregistrement sur cet appareil (stockage plein ou bloqué)");
    return false;
  }
}

// Plusieurs onglets ouverts : le navigateur prévient cet onglet quand un autre
// enregistre (événement « storage »). On recharge alors le projet et on redessine.
// Si on est en train d'écrire, de déplacer une carte ou d'enregistrer, on attend.
let aRecharger = false;

function occupe() {
  const el = document.activeElement;
  const saisie = el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
  return saisie || etat.glisse || enCours > 0;
}

function rechargerDepuisAutreOnglet() {
  if (!aRecharger || !etat.donnees) return;
  if (occupe()) { setTimeout(rechargerDepuisAutreOnglet, 500); return; }
  aRecharger = false;
  const donnees = lireProjet(etat.donnees.id);
  if (!donnees) { projetSupprimeAilleurs(); return; }
  etat.donnees = donnees;
  hooks.toutAfficher();
  if (donnees.tropRecent) { marquerEnregistrement(false, 'version'); return; }
  marquerEnregistrement(true);
  toast('Mis à jour depuis un autre onglet');
}

window.addEventListener('storage', (e) => {
  if (!etat.donnees || e.key !== cleProjet(etat.donnees.id)) return;
  if (aRecharger) return; // déjà prévu
  aRecharger = true;
  rechargerDepuisAutreOnglet();
});
// Fin d'une saisie ou d'un déplacement : on recharge sans attendre le prochain essai
document.addEventListener('focusout', () => setTimeout(rechargerDepuisAutreOnglet, 0));
document.addEventListener('dragend', () => setTimeout(rechargerDepuisAutreOnglet, 0));

// Pied de page : état de l'enregistrement (pastille verte / grise) + date de modification
// raison : 'stockage' (plein ou bloqué) ou 'version' (projet d'une version plus récente)
export function marquerEnregistrement(ok, raison = 'stockage') {
  etat.enregistrementOk = ok;
  $('etat').className = 'etat ' + (ok ? 'ok' : 'ko');
  $('etat-texte').textContent = ok
    ? 'Enregistré sur cet appareil'
    : raison === 'version'
      ? "Non enregistré : version plus récente de l'app"
      : 'Non enregistré : stockage plein ou bloqué';
  // Sur « Mes projets » et « Nouveau projet », aucun projet n'est affiché : pas de date
  const horsProjet = ['#projets', '#nouveau'].includes(location.hash);
  $('maj').textContent = horsProjet ? '' : texteModifieLe(etat.donnees && etat.donnees.modifieLe);
}
