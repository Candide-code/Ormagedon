// Bloc « Jalons » du tableau de bord : date + avancement des tâches liées.
// « + Jalon » ouvre la petite fenêtre (dialogue.js) : titre et date obligatoires,
// case « Date à vérifier ». Code J1, J2… (numéro suivant le plus grand, comme les tâches).
// Clic sur la ligne d'un jalon : même fenêtre, déjà remplie, pour le modifier.
// Un jalon dont la date est passée est grisé.
import { etat, $, hooks } from '../noyau/etat.js';
import { echapper, dateFr, joursAvant, toast } from '../noyau/outils.js';
import { enregistrer } from '../noyau/stockage.js';
import { dialogue } from './dialogue.js';

const HORS_COMPTE = ['Reporté', 'Abandonné'];

export const jalonsTries = () => [...etat.donnees.jalons].sort((a, b) => a.date.localeCompare(b.date));

function ligneJalon(j, taches) {
  // Tâches liées à ce jalon (hors reportées et abandonnées) : faites / total
  const liees = taches.filter((t) => (t.jalons || []).includes(j.id) && !HORS_COMPTE.includes(t.statut));
  const faites = liees.filter((t) => t.statut === 'Fait').length;
  const avancement = liees.length
    ? ` <span class="avancement ${faites === liees.length ? 'complet' : ''}" title="Tâches faites sur tâches nécessaires : ${liees.map((t) => t.id).join(', ')}">${faites}/${liees.length}</span>`
    : '';
  const passe = j.date && joursAvant(j.date) < 0;
  // Toute la ligne est un bouton : clic = modifier le jalon
  return `<li${passe ? ' class="jalon-passe"' : ''}><button type="button" class="jalon-ligne" data-modifier-jalon="${echapper(j.id)}" title="${passe ? 'Date passée · ' : ''}Modifier ${echapper(j.id)}"><span class="jalon-titre">${echapper(j.titre)}${j.aVerifier ? ' <span class="a-verifier">date à vérifier</span>' : ''}</span><span class="discret nowrap">${j.date ? dateFr(j.date) : ''}${avancement}</span></button></li>`;
}

export function blocJalons() {
  const jalons = jalonsTries();
  return `
    <section class="bloc">
      <div class="liste-tete">
        <h2>Jalons</h2>
        <button type="button" class="bouton" data-nouveau-jalon>+ Jalon</button>
      </div>
      ${jalons.length
        ? `<ul class="liste">${jalons.map((j) => ligneJalon(j, etat.donnees.taches)).join('')}</ul>`
        : '<p class="discret jalons-vide">Aucun jalon pour l\'instant</p>'}
    </section>`;
}

// Contenu de la fenêtre (j = jalon à modifier, ou rien pour un nouveau)
const htmlFenetre = (j = {}) => `
  <label class="dialogue-champ"><span>Titre</span>
    <input type="text" id="dj-titre" maxlength="120" value="${echapper(j.titre || '')}" autocomplete="off"></label>
  <label class="dialogue-champ"><span>Date</span>
    <input type="date" id="dj-date" value="${echapper(j.date || '')}"></label>
  <label class="case-cocher"><input type="checkbox" id="dj-verifier"${j.aVerifier ? ' checked' : ''}> Date à vérifier</label>
  <p class="dialogue-erreur" role="alert" hidden></p>`;

// Lit les champs ; titre ou date manquant : message et la fenêtre reste ouverte
function lireChamps(valeur, f) {
  if (valeur === 'supprimer') return valeur; // pas besoin de champs remplis pour supprimer
  const titre = f.querySelector('#dj-titre');
  const date = f.querySelector('#dj-date');
  const erreur = f.querySelector('.dialogue-erreur');
  const manque = !titre.value.trim() ? [titre, 'Donne un titre au jalon.'] : !date.value ? [date, 'Choisis une date.'] : null;
  if (manque) {
    erreur.textContent = manque[1];
    erreur.hidden = false;
    manque[0].focus();
    return false;
  }
  return { titre: titre.value.trim(), date: date.value, aVerifier: f.querySelector('#dj-verifier').checked };
}

// j donné : fenêtre « Modifier », avec « Supprimer » à gauche
const fenetre = (titre, j) => dialogue({
  titre,
  html: htmlFenetre(j),
  focus: '#dj-titre',
  valider: lireChamps,
  boutons: [
    ...(j ? [{ valeur: 'supprimer', libelle: 'Supprimer', classe: 'danger a-gauche' }] : []),
    { valeur: null, libelle: 'Annuler' },
    { valeur: 'ok', libelle: 'Enregistrer', classe: 'violet', principal: true },
  ],
});

async function nouveauJalon() {
  const champs = await fenetre('Nouveau jalon');
  if (!champs) return;
  const d = etat.donnees;
  const nums = d.jalons.map((j) => /^J(\d+)$/.exec(j.id)).filter(Boolean).map((m) => +m[1]);
  d.jalons.push({ id: 'J' + (Math.max(0, ...nums) + 1), ...champs });
  hooks.afficher();
  if (await enregistrer()) toast(`Jalon « ${champs.titre} » ajouté`);
}

// Même fenêtre, déjà remplie. Le calendrier et la fiche des tâches suivent tout seuls.
async function modifierJalon(id) {
  const avant = etat.donnees.jalons.find((x) => x.id === id);
  if (!avant) return;
  const champs = await fenetre(`${id} · Modifier`, avant);
  if (!champs) return;
  const j = etat.donnees.jalons.find((x) => x.id === id); // relu : un autre onglet a pu changer le projet
  if (!j) { toast("Ce jalon n'existe plus"); return; }
  if (champs === 'supprimer') { supprimerJalon(j); return; }
  if (j.titre === champs.titre && j.date === champs.date && !!j.aVerifier === champs.aVerifier) return; // rien de changé
  Object.assign(j, champs);
  hooks.afficher();
  if (await enregistrer()) toast(`Jalon « ${champs.titre} » modifié`);
}

// Supprimer : lié à des tâches → fenêtre d'attention (elles restent, seul le lien est retiré) ;
// sinon tout de suite. Puis « Annuler » pendant 8 s (remet le jalon et ses liens).
async function supprimerJalon(jalon) {
  let d = etat.donnees;
  let j = jalon;
  let liees = d.taches.filter((t) => (t.jalons || []).includes(j.id));
  if (liees.length) {
    const n = liees.length;
    const ok = await dialogue({
      titre: 'Attention',
      alerte: true,
      html: `<p>Le jalon <strong>« ${echapper(j.titre)} »</strong> est lié à ${n} tâche${n > 1 ? 's' : ''} (${liees.map((t) => echapper(t.id)).join(', ')}).</p>
        <p>${n > 1 ? 'Elles restent' : 'Elle reste'}, seul le lien est retiré.</p>`,
      boutons: [{ valeur: null, libelle: 'Annuler' }, { valeur: 'ok', libelle: 'Supprimer', classe: 'danger' }],
    });
    if (!ok) return;
    // Relu après la fenêtre : un autre onglet a pu changer le projet entre-temps
    const projetId = d.id;
    d = etat.donnees;
    j = d && d.id === projetId ? d.jalons.find((x) => x.id === jalon.id) : null;
    if (!j) { toast("Ce jalon n'existe plus"); return; }
    liees = d.taches.filter((t) => (t.jalons || []).includes(j.id));
  }
  const ids = liees.map((t) => t.id);
  d.jalons = d.jalons.filter((x) => x !== j);
  d.taches.forEach((t) => { if (t.jalons) t.jalons = t.jalons.filter((x) => x !== j.id); });
  hooks.afficher();
  if (!(await enregistrer())) return;
  toast(`Jalon « ${j.titre} » supprimé`, {
    libelle: 'Annuler',
    faire: async () => {
      const e = etat.donnees;
      if (!e || e.id !== d.id || e.jalons.some((x) => x.id === j.id)) { toast('Impossible de remettre ce jalon'); return; }
      e.jalons.push(j);
      const ordre = jalonsTries().map((x) => x.id);
      e.taches.forEach((t) => {
        if (!ids.includes(t.id)) return;
        t.jalons = ordre.filter((x) => x === j.id || (t.jalons || []).includes(x));
      });
      hooks.afficher();
      if (await enregistrer()) toast(`Jalon « ${j.titre} » remis`);
    },
  });
}

$('contenu').addEventListener('click', (e) => {
  if (!(e.target instanceof Element)) return;
  if (e.target.closest('[data-nouveau-jalon]')) { nouveauJalon(); return; }
  const m = e.target.closest('[data-modifier-jalon]');
  if (m) modifierJalon(m.dataset.modifierJalon);
});
