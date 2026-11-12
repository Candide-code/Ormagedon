// Vue « Calendrier » : graphique des échéances jour par jour
// (une barre par date, un morceau par tâche, couleur = statut).
//   - Vue d'ensemble : de cette semaine à la dernière date (échéance, jalon ou deadline du projet).
//   - Zoom : clic sur « Sem. du JJ/MM » → les 7 jours de cette semaine en grand.
// Clic sur une date → ses tâches dans la colonne de droite ; clic sur un code → fiche.
import { etat, $, hooks } from '../noyau/etat.js';
import { echapper, dateFr, classeStatut, parEcheance, htmlCategorie } from '../noyau/outils.js';
import { boutonsCategories, filtreCategorie, filtreActif } from '../composants/categories.js';
import { jalonsTries } from '../composants/jalons.js';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

// Dates en heure locale (évite les décalages de fuseau)
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const versDate = (s) => new Date(s + 'T00:00:00');
const plusJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const lundiDe = (d) => plusJours(d, -((d.getDay() + 6) % 7));
const semaineDe = (s) => iso(lundiDe(versDate(s)));          // une semaine = son lundi
const decaler = (s, n) => iso(plusJours(versDate(s), n));
const nomJour = (s) => JOURS[versDate(s).getDay()];
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// Du lundi de la première date (ou d'aujourd'hui) jusqu'à la dernière date.
// Aucune date du tout : les 4 semaines à partir de ce lundi.
function periode(dates) {
  const triees = [iso(new Date()), ...dates].sort();
  const debut = lundiDe(versDate(triees[0]));
  const fin = dates.length ? versDate(triees[triees.length - 1]) : plusJours(debut, 27);
  const jours = [];
  for (let d = debut; d <= fin; d = plusJours(d, 1)) jours.push(iso(d));
  return jours;
}

// Jour choisi : celui déjà choisi s'il est affiché, sinon le prochain qui a des tâches
function jourParDefaut(jours, groupes, auj) {
  if (etat.jourCalendrier && jours.includes(etat.jourCalendrier)) return etat.jourCalendrier;
  const aVenir = jours.filter((j) => j >= auj);
  return aVenir.find((j) => groupes[j]?.taches.length) || jours.find((j) => groupes[j]?.taches.length) || aVenir[0] || jours[0];
}

function barre(taches, max, zoom) {
  if (!taches.length) return '';
  return `
      <span class="cal-nb">${taches.length}</span>
      <span class="cal-barre" style="--n:${taches.length};--max:${max}">
        ${taches.map((t) => `<span class="seg ${classeStatut(t.statut)}" title="${echapper(t.id)} ${echapper(t.titre)} · ${echapper(t.statut)}">${zoom ? echapper(t.id) : ''}</span>`).join('')}
      </span>`;
}

const losanges = (jalons) => jalons.map((x) => `<span class="losange" title="${echapper(x.id)} ${echapper(x.titre)} · ${dateFr(x.date)}">◆</span>`).join('');

// Une colonne du graphique = un jour
function colonneJour(j, { taches = [], jalons = [] }, max, auj, choisi, { paire, zoom }) {
  const actif = taches.length || jalons.length;
  const cls = ['jour', paire ? 'paire' : '', j === auj ? 'aujourdhui' : '', j < auj ? 'passe' : '',
    j === choisi ? 'choisi' : '', actif ? 'actif' : ''].filter(Boolean).join(' ');
  const montrer = zoom || actif || j === auj || versDate(j).getDay() === 1;
  const etiquette = !montrer ? '' : zoom ? `${JOURS_COURTS[versDate(j).getDay()]} ${dateFr(j)}` : dateFr(j);
  const contenu = `
    <span class="cal-zone">${barre(taches, max, zoom)}</span>
    <span class="cal-date ${actif ? '' : 'discret'}">${etiquette}</span>
    <span class="cal-marque">${losanges(jalons)}</span>`;
  if (!actif) return `<div class="${cls}" aria-hidden="true">${contenu}</div>`;
  const resume = [taches.length ? pluriel(taches.length, 'tâche') : '', jalons.length ? pluriel(jalons.length, 'jalon') : ''].filter(Boolean).join(', ');
  return `<button type="button" class="${cls}" data-jour="${j}" aria-pressed="${j === choisi}" aria-label="${nomJour(j)} ${dateFr(j)} : ${resume}" title="${nomJour(j)} ${dateFr(j)} · ${resume}">${contenu}</button>`;
}

function colonneDroite(j, { taches = [], jalons = [] }, vide) {
  return `
    <section class="bloc cal-jour" aria-live="polite">
      <h2>Échéances du ${dateFr(j)}</h2>
      <p class="discret cal-sous-titre">${nomJour(j)} · ${taches.length ? pluriel(taches.length, 'tâche') : 'aucune tâche'}</p>
      ${jalons.length ? `<ul class="cal-jalons">${jalons.map((x) => `<li><span class="losange">◆</span> <span class="code">${echapper(x.id)}</span> ${echapper(x.titre)}</li>`).join('')}</ul>` : ''}
      ${taches.length ? `
      <ul class="cal-taches">
        ${taches.map((t) => `
          <li>
            <div><button class="code lien" data-ouvrir="${echapper(t.id)}" title="Ouvrir la fiche">${echapper(t.id)}</button>${htmlCategorie(t, false)} ${echapper(t.titre)}</div>
            <div class="cal-meta">
              <span class="statut ${classeStatut(t.statut)}">${echapper(t.statut)}</span>
            </div>
          </li>`).join('')}
      </ul>` : vide ? '' : '<p class="discret">Clique sur une barre du graphique pour voir ses tâches.</p>'}
    </section>`;
}

export function afficherCalendrier() {
  const d = etat.donnees;
  const taches = d.taches.filter((t) => t.echeance && filtreCategorie(t)).sort(parEcheance);
  const sansDate = d.taches.filter((t) => !t.echeance && filtreCategorie(t)).length;
  const jalons = jalonsTries();
  const auj = iso(new Date());
  const deadline = d.projet && d.projet.deadline;
  const tousLesJours = periode([
    ...d.taches.filter((t) => t.echeance).map((t) => t.echeance),
    ...jalons.map((x) => x.date),
    ...(deadline ? [deadline] : []),
  ]);
  const lundis = [...new Set(tousLesJours.map(semaineDe))];

  const groupes = {};
  const ajouter = (j, champ, x) => { (groupes[j] ||= { taches: [], jalons: [] })[champ].push(x); };
  taches.forEach((t) => ajouter(t.echeance, 'taches', t));
  jalons.forEach((x) => ajouter(x.date, 'jalons', x));
  // Même échelle dans les deux vues, pour comparer
  const max = Math.max(1, ...Object.values(groupes).map((g) => g.taches.length));
  // Rien à montrer (ni échéance dans le filtre, ni jalon) : message par-dessus le graphique gris
  const vide = !taches.length && !jalons.length;
  const { cat, sans } = filtreActif();
  const filtre = !!(cat || sans);

  // Zoom sur une semaine (ignoré si la semaine n'est plus dans la période)
  const zoom = lundis.includes(etat.semaineZoom) ? etat.semaineZoom : null;
  etat.semaineZoom = zoom;
  const jours = zoom ? Array.from({ length: 7 }, (_, i) => decaler(zoom, i)) : tousLesJours;
  const choisi = jourParDefaut(jours, groupes, auj);
  etat.jourCalendrier = choisi;

  let tete, grille;
  if (zoom) {
    const i = lundis.indexOf(zoom);
    const nav = (cible, texte, titre) => cible
      ? `<button type="button" class="bouton petit" data-zoom="${cible}" title="${titre}">${texte}</button>`
      : `<button type="button" class="bouton petit" disabled>${texte}</button>`;
    tete = `
      <div class="cal-titre">
        <button type="button" class="bouton petit" data-zoom="" title="Revenir à toute la période">← Vue d'ensemble</button>
        <h2>Semaine du ${dateFr(zoom)} au ${dateFr(decaler(zoom, 6))}</h2>
        <span class="cal-nav">${nav(lundis[i - 1], '‹', 'Semaine précédente')}${nav(lundis[i + 1], '›', 'Semaine suivante')}</span>
      </div>`;
    grille = `
      <div class="cal-grille zoom" style="--jours:7">
        ${jours.map((j) => colonneJour(j, groupes[j] || {}, max, auj, choisi, { paire: false, zoom: true })).join('')}
      </div>`;
  } else {
    tete = `
      <div class="cal-titre">
        <h2>Échéances jour par jour</h2>
        <span class="discret cal-aide">Clique sur une semaine pour la voir en détail</span>
      </div>`;
    grille = `
      <div class="cal-grille" style="--jours:${jours.length}">
        ${lundis.map((l, i) => {
          const nb = Math.min(7, jours.length - i * 7);
          return `<button type="button" class="semaine ${i % 2 ? '' : 'paire'}" style="grid-column: span ${nb}" data-zoom="${l}" title="Voir la semaine du ${dateFr(l)} jour par jour">${nb < 5 ? '' : 'Sem. du '}${dateFr(l)}</button>`;
        }).join('')}
        ${jours.map((j, i) => colonneJour(j, groupes[j] || {}, max, auj, choisi, { paire: Math.floor(i / 7) % 2 === 0, zoom: false })).join('')}
      </div>`;
  }

  // Défilement du graphique (téléphone, tablette) : gardé si on reste dans la même vue
  // (clic sur un jour, filtre…), sinon le graphique s'ouvre sur la semaine d'aujourd'hui
  const mode = zoom || 'ensemble';
  const avant = document.querySelector('.cal-defile');
  const garder = avant && avant.dataset.mode === mode ? avant.scrollLeft : null;

  $('contenu').innerHTML = `
    <section class="bloc bloc-large cal-filtres">
      ${boutonsCategories()}
    </section>
    <div class="cal">
      <section class="bloc cal-graphe">
        <div class="cal-tete">
          ${tete}
          <div class="cal-legende discret">
            <span><i class="seg"></i>À faire</span>
            <span><i class="seg en-cours"></i>En cours</span>
            <span><i class="seg fait"></i>Fait</span>
            <span><span class="losange">◆</span> Jalon</span>
          </div>
        </div>
        <div class="cal-cadre">
          <div class="cal-defile" data-mode="${mode}">${grille}</div>
          ${vide ? `<div class="cal-vide"><strong>${filtre ? 'Aucune échéance dans cette catégorie' : "Aucune échéance pour l'instant"}</strong>
            <span class="discret">Donne une échéance à une tâche (dans sa fiche) ou ajoute un jalon.</span></div>` : ''}
        </div>
        ${sansDate ? `<p class="discret cal-note">${pluriel(sansDate, 'tâche')} sans échéance, non affichée${sansDate > 1 ? 's' : ''} ici.</p>` : ''}
      </section>
      ${colonneDroite(choisi, groupes[choisi] || {}, vide)}
    </div>`;

  const defile = document.querySelector('.cal-defile');
  if (defile.scrollWidth <= defile.clientWidth) return; // tout tient : rien à faire
  if (garder !== null) { defile.scrollLeft = garder; return; }
  // Colonnes de même largeur. Vue d'ensemble : le lundi de cette semaine au bord gauche ;
  // zoom sur la semaine en cours : aujourd'hui, avec la veille visible à gauche
  const i = zoom ? jours.indexOf(auj) - 1 : jours.indexOf(semaineDe(auj));
  defile.scrollLeft = i > 0 ? Math.round((i / jours.length) * defile.querySelector('.cal-grille').scrollWidth) : 0;
}

// Zoom sur une semaine : le jour choisi devient le premier jour de la semaine
// qui a des tâches (sauf s'il est déjà dans cette semaine)
function zoomer(lundi) {
  etat.semaineZoom = lundi || null;
  if (lundi && !(etat.jourCalendrier && semaineDe(etat.jourCalendrier) === lundi)) {
    const dates = etat.donnees.taches
      .filter((t) => t.echeance && filtreCategorie(t) && semaineDe(t.echeance) === lundi)
      .map((t) => t.echeance).sort();
    etat.jourCalendrier = dates[0] || lundi;
  }
  hooks.afficher();
}

$('contenu').addEventListener('click', (e) => {
  const z = e.target.closest('[data-zoom]');
  if (z) { zoomer(z.dataset.zoom); return; }
  const b = e.target.closest('[data-jour]');
  if (!b) return;
  etat.jourCalendrier = b.dataset.jour;
  hooks.afficher();
});
