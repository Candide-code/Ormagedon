// État partagé de la page et constantes communes
export const etat = {
  donnees: null,
  enregistrementOk: false, // dernier enregistrement sur l'appareil réussi ?
  ficheId: null,      // tâche ouverte dans la fiche (panneau de droite)
  glisse: false,      // une carte est en train d'être déplacée
  focusRecherche: false,
  jourCalendrier: null, // date choisie dans la vue Calendrier
  semaineZoom: null,    // lundi de la semaine zoomée (null = vue d'ensemble)
  filtre: { texte: '', categorie: '', masquerTerminees: false },
};

export const $ = (id) => document.getElementById(id);

export const CASES = [
  { id: 'q1', nom: 'À faire tout de suite', aide: 'Important et urgent' },
  { id: 'q2', nom: 'À planifier', aide: 'Important, pas urgent' },
  { id: 'q3', nom: 'À faire vite', aide: 'Urgent, peu important' },
  { id: 'q4', nom: 'Plus tard', aide: 'Ni urgent, ni important' },
];
export const LIMITE_CASE_1 = 5;
export const TERMINES = ['Fait', 'Reporté', 'Abandonné'];

// Fonctions de rendu fournies par main.js (évite les imports circulaires)
export const hooks = {
  afficher: () => {},      // redessine la vue active
  toutAfficher: () => {},  // redessine la vue active + la fiche ouverte
};

// Préférences de filtre gardées dans le navigateur (facultatif)
try { Object.assign(etat.filtre, JSON.parse(localStorage.getItem('ormagedon-filtre') || '{}')); } catch { /* sans importance */ }
export function memoriserFiltre() {
  try { localStorage.setItem('ormagedon-filtre', JSON.stringify(etat.filtre)); } catch { /* sans importance */ }
}
