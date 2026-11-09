// Fiche de tâche : section « Liens » (liens web).
//   - Clic sur le nom → la page s'ouvre dans un nouvel onglet.
//   - Sous le nom : le nom du site seulement (ex. onedrive.live.com).
//   - ✎ renomme, × retire le lien.
// Les fichiers et photos (via OneDrive) viendront en phase 3 : voir ROADMAP.md, section 5 bis.
import { etat, $ } from '../noyau/etat.js';
import { echapper, tacheParId, toast } from '../noyau/outils.js';

const ICONE_LIEN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 8h13 M8 1.5c-2.2 2.2-2.2 10.8 0 13 M8 1.5c2.2 2.2 2.2 10.8 0 13" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';

// État local de la section (formulaire ouvert, renommage en cours)
const ui = { formLien: false, renomme: null };
let modifier = null;     // fonction d'enregistrement fournie par fiche.js
let redessiner = null;   // redessine la fiche

export function brancherLiens(fnModifier, fnRedessiner) {
  modifier = fnModifier;
  redessiner = fnRedessiner;
}

// Lien cliquable seulement si c'est bien une page web (données importées ou modifiées à la main)
const lienSur = (l) => /^https?:\/\//i.test(l.url || '');

// Nom du site affiché sous le lien (sans « www. »)
function nomDuSite(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function adresseValide(texte) {
  let a = texte.trim();
  if (!a || /\s/.test(a)) return null;   // une adresse ne contient pas d'espace
  if (!/^[a-z][a-z0-9+.-]*:/i.test(a)) a = 'https://' + a;
  try {
    const u = new URL(a);
    // Seulement des pages web, avec un vrai nom de site (ex. exemple.fr)
    return ['http:', 'https:'].includes(u.protocol) && /^[^.]+(\.[^.]+)+$/.test(u.hostname) ? u.href : null;
  } catch { return null; }
}

function element(l, i) {
  const nom = ui.renomme === i
    ? `<input type="text" class="fl-renommer" data-fl-nom="${i}" value="${echapper(l.libelle)}" aria-label="Nom affiché">`
    : lienSur(l)
      ? `<a class="fl-nom" href="${echapper(l.url)}" target="_blank" rel="noopener noreferrer" title="Ouvrir dans un nouvel onglet">${echapper(l.libelle)}</a>`
      : `<span class="fl-nom fl-invalide" title="Adresse invalide : retire ce lien et ajoute-le à nouveau">${echapper(l.libelle)}</span>`;
  return `
    <li class="fl" data-fl="${i}">
      <div class="fl-ligne">
        <span class="fl-icone">${ICONE_LIEN}</span>
        ${nom}
        <span class="fl-actions">
          <button type="button" class="fl-btn" data-fl-renommer="${i}" title="Renommer" aria-label="Renommer">✎</button>
          <button type="button" class="suppr" data-fl-suppr="${i}" title="Retirer le lien" aria-label="Retirer le lien">×</button>
        </span>
      </div>
      <div class="fl-site">${echapper(nomDuSite(l.url))}</div>
    </li>`;
}

export function sectionLiens(t) {
  const liste = t.liens || [];
  return `
    <section class="fiche-section" id="liens-section">
      <h4>Liens</h4>
      ${liste.length ? `<ul class="liens">${liste.map(element).join('')}</ul>` : '<p class="discret fl-vide">Aucun lien.</p>'}
      ${ui.formLien ? `
      <div class="fl-form">
        <input type="text" id="fl-adresse" placeholder="Adresse (https://…)" aria-label="Adresse du lien">
        <input type="text" id="fl-libelle" placeholder="Nom affiché (facultatif)" aria-label="Nom affiché">
        <div class="fl-form-boutons">
          <button type="button" class="bouton violet" id="fl-lien-ok">Ajouter</button>
          <button type="button" class="bouton" id="fl-lien-annuler">Annuler</button>
        </div>
      </div>` : ''}
      <div class="fl-ajout">
        <button type="button" class="bouton" id="fl-ajouter-lien">+ Ajouter un lien web</button>
      </div>
    </section>`;
}

// Après l'affichage de la fiche : remet le curseur dans le champ en cours
export function apresAffichageLiens() {
  if (ui.formLien) $('fl-adresse')?.focus();
  if (ui.renomme !== null) { const el = document.querySelector('[data-fl-nom]'); el?.focus(); el?.select(); }
}

async function ajouterLien() {
  const url = adresseValide($('fl-adresse').value);
  if (!url) { toast('Adresse invalide (exemple : https://exemple.fr)'); $('fl-adresse').focus(); return; }
  const libelle = $('fl-libelle').value.trim() || nomDuSite(url);
  const t = tacheParId(etat.ficheId);
  ui.formLien = false;
  await modifier(t, (x) => { x.liens = [...(x.liens || []), { libelle, url }]; }, 'Lien ajouté');
  redessiner();
}

async function enregistrerNom(el) {
  const i = +el.dataset.flNom;
  const t = tacheParId(etat.ficheId);
  ui.renomme = null;
  const nom = el.value.trim();
  if (t && nom && nom !== t.liens[i].libelle) await modifier(t, (x) => { x.liens[i].libelle = nom; }, 'Renommé');
  redessiner();
}

export async function clicLiens(e) {
  const t = tacheParId(etat.ficheId);
  if (!t) return false;
  const b = e.target.closest('button');
  if (!b || !b.closest('#liens-section')) return false;
  const d = b.dataset;

  if (d.flSuppr !== undefined) {
    const i = +d.flSuppr;
    await modifier(t, (x) => { x.liens.splice(i, 1); }, 'Lien retiré');
    redessiner();
  } else if (d.flRenommer !== undefined) {
    ui.renomme = +d.flRenommer; redessiner();
  } else if (b.id === 'fl-ajouter-lien') {
    ui.formLien = true; redessiner();
  } else if (b.id === 'fl-lien-annuler') {
    ui.formLien = false; redessiner();
  } else if (b.id === 'fl-lien-ok') {
    await ajouterLien();
  } else return false;
  return true;
}

export function toucheLiens(e) {
  if (e.target.closest('.fl-form') && e.key === 'Enter') { e.preventDefault(); ajouterLien(); return true; }
  if (e.target.closest('.fl-form') && e.key === 'Escape') { e.stopPropagation(); ui.formLien = false; redessiner(); return true; }
  if (e.target.dataset?.flNom !== undefined) {
    if (e.key === 'Enter') { e.preventDefault(); enregistrerNom(e.target); return true; }
    if (e.key === 'Escape') { e.stopPropagation(); ui.renomme = null; redessiner(); return true; }
  }
  return false;
}

export function sortieLiens(e) {
  if (e.target.dataset?.flNom !== undefined && ui.renomme !== null) enregistrerNom(e.target);
}

// Nouvelle fiche ouverte : on referme formulaire et renommage
export function reinitialiserLiens() { ui.formLien = false; ui.renomme = null; }
