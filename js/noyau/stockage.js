// Lire et enregistrer les données sur l'appareil (stockage du navigateur).
// Remplace l'ancien api.js (serveur de Trudy) avec les mêmes fonctions.
//
// Rangement dans le navigateur (localStorage) :
//   ormagedon-projets       liste des projets : [{ id, nom, deadline, modifieLe }]
//   ormagedon-projet-<id>   toutes les données d'un projet
//   ormagedon-dernier       id du projet ouvert en dernier (rouvert au démarrage)
// On ne charge que le projet ouvert.
import { etat, $, hooks } from './etat.js';
import { toast } from './outils.js';

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

// Projet vide créé au premier lancement.
// Provisoire : la page « Mes projets » (étape 1.4) le remplacera.
function projetVide() {
  const maintenant = new Date().toISOString();
  return {
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
    donnees = lire(cleProjet(id));
    if (donnees) break;
  }
  const nouveau = !donnees;
  if (nouveau) donnees = projetVide();
  etat.donnees = donnees;
  try {
    ecrire(CLE_DERNIER, donnees.id);
    if (nouveau) ecrire(cleProjet(donnees.id), donnees);
    mettreAJourListe(donnees);
  } catch { /* stockage indisponible : l'app s'ouvre quand même, enregistrer() préviendra */ }
  hooks.toutAfficher();
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
export function enregistrer() {
  const resultat = file.then(ecrireProjet);
  file = resultat.catch(() => {});
  return resultat;
}

async function ecrireProjet() {
  const d = etat.donnees;
  try {
    d.modifieLe = new Date().toISOString();
    ecrire(cleProjet(d.id), d);
    mettreAJourListe(d);
    marquerConnexion(true);
    return true;
  } catch {
    marquerConnexion(false);
    toast("Échec de l'enregistrement sur cet appareil (stockage plein ou bloqué)");
    return false;
  }
}

// Provisoire : remplacé au point 3 (plusieurs onglets ouverts).
export async function surveiller() {}

// Provisoire : le pied de page change au point 2.
export function marquerConnexion(ok) {
  etat.serveurOk = ok;
  $('etat').className = 'etat ' + (ok ? 'ok' : 'ko');
  $('etat-texte').textContent = ok
    ? 'Connectée · enregistrement automatique'
    : 'Serveur arrêté : relance Lancer_roadmap.bat';
}
