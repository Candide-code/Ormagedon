// Petite fenêtre aux couleurs de l'app, à la place des confirmations du navigateur.
// dialogue({ titre, alerte, html, boutons: [{ valeur, libelle, classe, principal }], focus, valider })
// renvoie une promesse : la valeur du bouton cliqué, ou null (Annuler, Échap, clic à côté).
// alerte = true : titre précédé de ⚠, en orange (cas rares : suppression…).
// Fenêtre avec des champs (ex. jalon) :
//   focus   : sélecteur du champ où placer le curseur (sinon le premier bouton) ;
//   valider(valeur, fenetre) : appelé au clic sur un bouton autre qu'Annuler ;
//     renvoie false pour garder la fenêtre ouverte (champ manquant…),
//     sinon ce qu'il renvoie devient le résultat (ex. les valeurs des champs).
//   Entrée dans un champ = clic sur le bouton « principal ».
import { echapper } from '../noyau/outils.js';

export function dialogue({ titre, alerte = false, html = '', boutons, focus = '', valider = null }) {
  return new Promise((resoudre) => {
    const avant = document.activeElement; // le curseur y revient à la fermeture
    const d = document.createElement('dialog');
    d.className = 'dialogue';
    d.setAttribute('aria-labelledby', 'dialogue-titre');
    d.innerHTML = `
      <h2 class="dialogue-titre${alerte ? ' alerte' : ''}" id="dialogue-titre">${alerte ? '<span aria-hidden="true">⚠ </span>' : ''}${echapper(titre)}</h2>
      <div class="dialogue-corps">${html}</div>
      <div class="dialogue-boutons">
        ${boutons.map((b, i) => `<button type="button" class="bouton ${b.classe || ''}" data-i="${i}"${b.principal ? ' data-principal' : ''}>${echapper(b.libelle)}</button>`).join('')}
      </div>`;
    let valeur = null;
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) {
        const v = boutons[+b.dataset.i].valeur;
        if (v !== null && valider) {
          const r = valider(v, d);
          if (r === false) return; // la fenêtre reste ouverte
          valeur = r === undefined ? v : r;
        } else valeur = v;
        d.close();
        return;
      }
      // Clic sur le fond, à côté de la fenêtre (un clic dans sa marge intérieure ne ferme pas)
      const r = d.getBoundingClientRect();
      const dehors = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (e.target === d && dehors) d.close();
    });
    d.addEventListener('keydown', (e) => {
      const champ = e.target.closest('input:not([type="checkbox"])');
      const principal = d.querySelector('[data-principal]');
      if (e.key === 'Enter' && champ && principal) { e.preventDefault(); principal.click(); }
    });
    d.addEventListener('close', () => {
      d.remove();
      if (avant && avant.isConnected) avant.focus();
      resoudre(valeur);
    });
    document.body.append(d);
    d.showModal(); // Échap ferme la fenêtre (valeur null)
    const premier = (focus && d.querySelector(focus)) || d.querySelector('[data-i="0"]');
    if (premier) premier.focus(); // sans champ : le choix sans risque (Annuler) en premier
  });
}
