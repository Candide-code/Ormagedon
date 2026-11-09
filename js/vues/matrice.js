// Vue « Matrice » : colonne À classer + 4 cases, glisser-déposer des cartes
import { etat, $, hooks, CASES, LIMITE_CASE_1, TERMINES, memoriserFiltre } from '../noyau/etat.js';
import { echapper, dateFr, joursAvant, classeStatut, bloquantes, tacheParId, parEcheance, toast } from '../noyau/outils.js';
import { enregistrer } from '../noyau/api.js';
import { boutonsCategories, filtreActif, filtreCategorie } from '../composants/categories.js';
import { ouvrirFiche } from '../composants/fiche.js';
import { boutonSupprimer } from '../composants/suppression.js';

function tachesFiltrees() {
  const f = etat.filtre;
  const texte = f.texte.trim().toLowerCase();
  return etat.donnees.taches.filter((t) => {
    if (f.masquerTerminees && TERMINES.includes(t.statut)) return false;
    if (!filtreCategorie(t)) return false;
    if (texte && !`${t.id} ${t.titre} ${t.description}`.toLowerCase().includes(texte)) return false;
    return true;
  });
}

function carte(t) {
  const fait = (t.todo || []).filter((x) => x.fait).length;
  const nbTodo = (t.todo || []).length;
  const bloq = bloquantes(t);
  const retard = t.echeance && !TERMINES.includes(t.statut) && joursAvant(t.echeance) < 0;
  return `
    <article class="carte ${classeStatut(t.statut)}" draggable="true" data-id="${echapper(t.id)}" tabindex="0" title="Glisse la carte pour la classer · clique pour ouvrir la fiche">
      <div class="carte-haut">
        <span class="code">${echapper(t.id)}</span>
        <span class="carte-cat">${echapper(t.sousCategorie || t.categorie)}</span>
        ${t.statut !== 'À faire' ? `<span class="statut ${classeStatut(t.statut)}">${echapper(t.statut)}</span>` : ''}
        ${boutonSupprimer(echapper(t.id))}
      </div>
      <div class="carte-titre">${echapper(t.titre)}</div>
      <div class="carte-bas">
        ${t.echeance ? `<span class="${retard ? 'retard' : ''}">${retard ? 'En retard · ' : ''}${dateFr(t.echeance)}</span>` : ''}
        ${nbTodo ? `<span>☑ ${fait}/${nbTodo}</span>` : ''}
        ${bloq.length && !TERMINES.includes(t.statut) ? `<span class="bloquee" title="Attend : ${bloq.map((b) => b.id).join(', ')}">Attend ${bloq.map((b) => echapper(b.id)).join(', ')}</span>` : ''}
      </div>
    </article>`;
}

function zone(caseId, taches, entete) {
  return `
    <section class="zone" data-case="${caseId}">
      ${entete}
      <div class="cartes">
        ${taches.map(carte).join('') || '<p class="zone-vide">Glisse une tâche ici</p>'}
      </div>
    </section>`;
}

function enteteCase(c, nb, actives1) {
  const trop = c.id === 'q1' && actives1 > LIMITE_CASE_1;
  return `
    <header class="zone-tete">
      <h3><span class="num">${c.id.slice(1)}</span> ${c.nom}</h3>
      <span class="compteur ${trop ? 'alerte' : ''}" ${trop ? `title="Plus de ${LIMITE_CASE_1} tâches à faire tout de suite : choisis les vraies priorités"` : ''}>${nb}${trop ? ' · trop' : ''}</span>
      <p class="aide">${c.aide}</p>
    </header>`;
}

export function afficherMatrice() {
  const d = etat.donnees;
  const f = etat.filtre;
  const taches = tachesFiltrees().sort(parEcheance);
  const parCase = (c) => taches.filter((t) => (t.case || 'a_classer') === c);
  // Le compteur de la case 1 ne tient compte que des tâches encore à faire, tous filtres confondus
  const actives1 = d.taches.filter((t) => t.case === 'q1' && !TERMINES.includes(t.statut)).length;
  const caseHtml = (c) => zone(c.id, parCase(c.id), enteteCase(c, parCase(c.id).length, actives1));

  $('contenu').innerHTML = `
    <div class="barre">
      <input type="search" id="f-texte" placeholder="Rechercher une tâche…" value="${echapper(f.texte)}" aria-label="Rechercher">
      <label class="case-cocher"><input type="checkbox" id="f-terminees" ${f.masquerTerminees ? 'checked' : ''}> Masquer les tâches faites, reportées ou abandonnées</label>
      <button class="bouton violet" id="nouvelle">+ Nouvelle tâche</button>
    </div>
    ${boutonsCategories()}
    <div class="matrice">
      ${zone('a_classer', parCase('a_classer'), `<header class="zone-tete"><h3>À classer</h3><span class="compteur">${parCase('a_classer').length}</span></header>`)}
      <div class="quadrants">
        <div></div>
        <div class="axe axe-h">Urgent</div>
        <div class="axe axe-h">Pas urgent</div>
        <div class="axe axe-v"><span>Impact fort</span></div>
        ${CASES.slice(0, 2).map(caseHtml).join('')}
        <div class="axe axe-v"><span>Impact faible</span></div>
        ${CASES.slice(2).map(caseHtml).join('')}
      </div>
    </div>`;

  if (etat.focusRecherche) {
    const champ = $('f-texte');
    champ.focus();
    champ.setSelectionRange(champ.value.length, champ.value.length);
    etat.focusRecherche = false;
  }
}

// Nouvelle tâche : code = lettre de la catégorie + numéro suivant.
// Elle prend la catégorie (et sous-catégorie) du filtre actif.
async function nouvelleTache() {
  const d = etat.donnees;
  const { cat: catFiltre, sous } = filtreActif();
  const cat = catFiltre || d.categories[0];
  const nums = d.taches.filter((t) => t.id.startsWith(cat.code)).map((t) => parseInt(t.id.slice(cat.code.length), 10) || 0);
  const id = cat.code + (Math.max(0, ...nums) + 1);
  d.taches.push({
    id, titre: 'Nouvelle tâche', description: '', categorie: cat.nom, sousCategorie: sous || cat.sous[0],
    statut: 'À faire', case: 'a_classer', echeance: '', jalons: [], todo: [], liens: [], dependances: [], notes: '',
  });
  hooks.afficher();
  if (await enregistrer()) {
    ouvrirFiche(id);
    const titre = document.querySelector('.fiche-titre');
    titre.focus(); titre.select();
  }
}

const contenu = $('contenu');

// Recherche et case « masquer »
contenu.addEventListener('input', (e) => {
  if (e.target.id === 'f-texte') {
    etat.filtre.texte = e.target.value; memoriserFiltre();
    etat.focusRecherche = true; hooks.afficher();
  }
});
contenu.addEventListener('change', (e) => {
  if (e.target.id === 'f-terminees') { etat.filtre.masquerTerminees = e.target.checked; memoriserFiltre(); hooks.afficher(); }
});

// Glisser-déposer des cartes
contenu.addEventListener('dragstart', (e) => {
  const c = e.target.closest('.carte');
  if (!c) return;
  etat.glisse = true;
  e.dataTransfer.setData('text/plain', c.dataset.id);
  e.dataTransfer.effectAllowed = 'move';
  requestAnimationFrame(() => c.classList.add('en-deplacement'));
});
contenu.addEventListener('dragend', (e) => {
  etat.glisse = false;
  const c = e.target.closest('.carte'); if (c) c.classList.remove('en-deplacement');
  document.querySelectorAll('.zone.survol').forEach((z) => z.classList.remove('survol'));
});
contenu.addEventListener('dragover', (e) => {
  const z = e.target.closest('.zone');
  if (!z) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.zone.survol').forEach((x) => { if (x !== z) x.classList.remove('survol'); });
  z.classList.add('survol');
});
contenu.addEventListener('drop', async (e) => {
  const z = e.target.closest('.zone');
  if (!z) return;
  e.preventDefault();
  etat.glisse = false;
  const t = tacheParId(e.dataTransfer.getData('text/plain'));
  if (!t || t.case === z.dataset.case) { hooks.afficher(); return; }
  t.case = z.dataset.case;
  hooks.afficher();
  if (await enregistrer()) {
    const c = CASES.find((x) => x.id === t.case);
    toast(`${t.id} → ${c ? c.nom : 'À classer'}`);
  }
});

// Bouton « Nouvelle tâche » (Matrice, ou tableau de bord vide : on passe d'abord
// dans la Matrice), clic ou Entrée sur une carte : ouvre la fiche
contenu.addEventListener('click', (e) => {
  if (e.target.id === 'nouvelle') {
    if (location.hash !== '#matrice') location.hash = 'matrice';
    nouvelleTache();
    return;
  }
  if (e.target.closest('[data-supprimer]')) return; // géré par suppression.js
  const c = e.target.closest('.carte');
  if (c) ouvrirFiche(c.dataset.id);
});
contenu.addEventListener('keydown', (e) => {
  const c = e.target.closest('.carte');
  if (c && e.key === 'Enter' && !e.target.closest('[data-supprimer]')) ouvrirFiche(c.dataset.id);
});
