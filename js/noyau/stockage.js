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

// Lit un projet et le met à jour. Un projet trop récent est marqué pour ne pas être écrasé.
function lireProjet(id) {
  const d = lire(cleProjet(id));
  if (!d) return null;
  if (!mettreAJourDonnees(d)) {
    d.tropRecent = true;
    toast("Ce projet vient d'une version plus récente d'Ormagedon : recharge la page pour mettre l'app à jour. Tes modifications ne seront pas enregistrées d'ici là.");
  }
  return d;
}

// Projet vide créé au premier lancement.
// Provisoire : la page « Mes projets » (étape 1.4) le remplacera.
function projetVide() {
  const maintenant = new Date().toISOString();
  return {
    schema: SCHEMA,
    id: 'p-' + Date.now(),
    projet: { nom: 'Mon projet', deadline: null, creeLe: maintenant },
    categories: [],
    statuts: ['À faire', 'En cours', 'Fait', 'Reporté', 'Abandonné'],
    jalons: [],
    taches: [],
    modifieLe: maintenant,
  };
}

// Ouvre le projet ouvert en dernier, sinon le premier de la liste,
// sinon crée un projet vide.
export async function charger() {
  const liste = lire(CLE_LISTE) || [];
  const ids = [lire(CLE_DERNIER), ...liste.map((p) => p.id)].filter(Boolean);
  let donnees = null;
  for (const id of ids) {
    donnees = lireProjet(id);
    if (donnees) break;
  }
  const nouveau = !donnees;
  if (nouveau) donnees = projetVide();
  etat.donnees = donnees;
  let ok = true;
  try {
    ecrire(CLE_DERNIER, donnees.id);
    if (nouveau) ecrire(cleProjet(donnees.id), donnees);
    mettreAJourListe(donnees);
  } catch { ok = false; /* stockage indisponible : l'app s'ouvre quand même */ }
  hooks.toutAfficher();
  if (donnees.tropRecent) marquerEnregistrement(false, 'version');
  else marquerEnregistrement(ok);
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
  // Projet venu d'une version plus récente de l'app : on ne l'abîme pas
  if (d.tropRecent) {
    marquerEnregistrement(false, 'version');
    toast("Non enregistré : ce projet vient d'une version plus récente d'Ormagedon, recharge la page");
    return false;
  }
  // Un autre onglet a enregistré depuis notre dernière lecture : on n'écrase pas
  // sa version, on la recharge (comme Trudy en cas de conflit).
  const stocke = lire(cleProjet(d.id));
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
  if (!aRecharger) return;
  if (occupe()) { setTimeout(rechargerDepuisAutreOnglet, 500); return; }
  aRecharger = false;
  const donnees = lireProjet(etat.donnees.id);
  if (!donnees) return; // projet supprimé ailleurs : géré avec « Mes projets » (étape 1.4)
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
  $('maj').textContent = texteModifieLe(etat.donnees && etat.donnees.modifieLe);
}
