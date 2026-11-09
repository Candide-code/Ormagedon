// Fiche de tâche : panneau de droite pour tout modifier
import { etat, $, hooks, CASES } from '../noyau/etat.js';
import { echapper, dateFr, classeStatut, tacheParId, categorieDe, toast } from '../noyau/outils.js';
import { enregistrer } from '../noyau/stockage.js';
import { jalonsTries } from './jalons.js';
import { supprimerTache } from './suppression.js';
import { sectionLiens, apresAffichageLiens, clicLiens, toucheLiens, sortieLiens, reinitialiserLiens, brancherLiens } from './liens.js';

export function ouvrirFiche(id) {
  if (etat.ficheId !== id) reinitialiserLiens();
  etat.ficheId = id;
  afficherFiche();
  document.body.classList.add('fiche-ouverte');
  $('fiche').setAttribute('aria-hidden', 'false');
}

export function fermerFiche() {
  // Enregistre d'abord un champ en cours de saisie dans la fiche
  if (document.activeElement && $('fiche').contains(document.activeElement)) document.activeElement.blur();
  etat.ficheId = null;
  document.body.classList.remove('fiche-ouverte');
  $('fiche').setAttribute('aria-hidden', 'true');
}

export function afficherFiche() {
  const d = etat.donnees;
  const t = tacheParId(etat.ficheId);
  if (!t) return;
  const cat = categorieDe(t);
  const champ = (label, html) => `<label class="champ"><span>${label}</span>${html}</label>`;
  const select = (nom, valeurs, actuelle) => `<select data-champ="${nom}">${valeurs.map((v) => `<option value="${echapper(v.valeur ?? v)}" ${(v.valeur ?? v) === actuelle ? 'selected' : ''}>${echapper(v.libelle ?? v)}</option>`).join('')}</select>`;
  const deps = (t.dependances || []).map((id) => {
    const x = tacheParId(id);
    return x
      ? `<li><button class="code lien" data-ouvrir="${echapper(x.id)}">${echapper(x.id)}</button> ${echapper(x.titre)} <span class="statut ${classeStatut(x.statut)}">${echapper(x.statut)}</span></li>`
      : `<li class="discret">${echapper(id)} (introuvable)</li>`;
  }).join('');

  $('fiche-contenu').innerHTML = `
    <div class="fiche-tete">
      <span class="code">${echapper(t.id)}</span>
      <button class="fermer" id="fiche-fermer" aria-label="Fermer la fiche">×</button>
    </div>
    <textarea class="fiche-titre" data-champ="titre" rows="2" aria-label="Titre">${echapper(t.titre)}</textarea>
    <textarea data-champ="description" rows="3" placeholder="Description en une phrase" aria-label="Description">${echapper(t.description)}</textarea>

    <div class="fiche-grille">
      ${champ('Statut', select('statut', d.statuts, t.statut))}
      ${champ('Case de la matrice', select('case', [{ valeur: 'a_classer', libelle: 'À classer' }, ...CASES.map((c) => ({ valeur: c.id, libelle: c.id.slice(1) + ' · ' + c.nom }))], t.case || 'a_classer'))}
      ${champ('Catégorie', select('categorie', [{ valeur: '', libelle: 'Sans catégorie' }, ...d.categories.map((c) => c.nom)], t.categorie || ''))}
      ${cat && cat.sous.length ? champ('Sous-catégorie', select('sousCategorie', cat.sous, t.sousCategorie)) : ''}
      ${champ('Échéance', `<input type="date" data-champ="echeance" value="${echapper(t.echeance)}">`)}
    </div>

    <section class="fiche-section">
      <h4>Todo</h4>
      <ul class="todo">
        ${(t.todo || []).map((x, i) => `
          <li class="${x.fait ? 'fait' : ''}">
            <input type="checkbox" data-todo="${i}" ${x.fait ? 'checked' : ''} aria-label="Fait">
            <input type="text" class="todo-texte" data-todo-texte="${i}" value="${echapper(x.texte)}" aria-label="Étape">
            <button class="suppr" data-todo-suppr="${i}" aria-label="Supprimer l'étape">×</button>
          </li>`).join('')}
      </ul>
      <input type="text" id="todo-ajout" placeholder="+ Ajouter une étape (Entrée)">
    </section>

    <section class="fiche-section">
      <h4>Jalons concernés</h4>
      <div class="jalons-choix">
        ${jalonsTries().map((j) => `
          <label class="case-cocher"><input type="checkbox" data-jalon="${echapper(j.id)}" ${(t.jalons || []).includes(j.id) ? 'checked' : ''}> ${dateFr(j.date)} · ${echapper(j.titre)}</label>`).join('')}
      </div>
    </section>

    <section class="fiche-section">
      <h4>Dépend de</h4>
      <input type="text" data-champ="dependances" value="${echapper((t.dependances || []).join(', '))}" placeholder="Codes séparés par des virgules (ex. C1, C2)">
      ${deps ? `<ul class="deps">${deps}</ul>` : ''}
    </section>

    <section class="fiche-section">
      <h4>Notes</h4>
      <textarea data-champ="notes" rows="3" placeholder="Notes libres">${echapper(t.notes)}</textarea>
    </section>

    ${sectionLiens(t)}

    <div class="fiche-pied">
      <button class="bouton danger" id="supprimer">Supprimer la tâche</button>
    </div>`;
  apresAffichageLiens();
}

export async function modifierTache(t, mutation, message = 'Enregistré') {
  mutation(t);
  hooks.afficher();
  if (await enregistrer()) toast(message);
}

function ordreJalons(ids) {
  const ordre = jalonsTries().map((j) => j.id);
  return ids.sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b));
}

const fiche = $('fiche');

fiche.addEventListener('change', async (e) => {
  const t = tacheParId(etat.ficheId);
  if (!t) return;
  const el = e.target;

  if (el.dataset.champ) {
    const nom = el.dataset.champ;
    let valeur = el.value;
    if (nom === 'titre' || nom === 'description') valeur = valeur.replace(/\s+/g, ' ').trim();
    if (nom === 'titre' && !valeur) { el.value = t.titre; toast('Le titre ne peut pas être vide'); return; }
    if (nom === 'dependances') {
      const codes = [...new Set(valeur.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))].filter((c) => c !== t.id);
      const inconnus = codes.filter((c) => !tacheParId(c));
      if (inconnus.length) toast('Code inconnu : ' + inconnus.join(', '));
      await modifierTache(t, (x) => { x.dependances = codes.filter((c) => tacheParId(c)); });
      afficherFiche();
      return;
    }
    await modifierTache(t, (x) => {
      x[nom] = valeur;
      // Nouvelle catégorie : on prend sa première sous-catégorie
      if (nom === 'categorie') { const c = categorieDe(x); x.sousCategorie = (c && c.sous[0]) || ''; }
    });
    if (['categorie', 'statut', 'case'].includes(nom)) afficherFiche();
    return;
  }
  if (el.dataset.todo !== undefined) {
    await modifierTache(t, (x) => { x.todo[+el.dataset.todo].fait = el.checked; });
    afficherFiche();
    return;
  }
  if (el.dataset.todoTexte !== undefined) {
    const texte = el.value.trim();
    await modifierTache(t, (x) => {
      if (texte) x.todo[+el.dataset.todoTexte].texte = texte; else x.todo.splice(+el.dataset.todoTexte, 1);
    });
    if (!texte) afficherFiche();
    return;
  }
  if (el.dataset.jalon) {
    await modifierTache(t, (x) => {
      const set = new Set(x.jalons || []);
      if (el.checked) set.add(el.dataset.jalon); else set.delete(el.dataset.jalon);
      x.jalons = ordreJalons([...set]);
    });
  }
});

fiche.addEventListener('keydown', async (e) => {
  if (toucheLiens(e)) return;
  if (e.target.id === 'todo-ajout' && e.key === 'Enter') {
    const texte = e.target.value.trim();
    const t = tacheParId(etat.ficheId);
    if (!texte || !t) return;
    await modifierTache(t, (x) => { x.todo = x.todo || []; x.todo.push({ texte, fait: false }); }, 'Étape ajoutée');
    afficherFiche();
    $('todo-ajout').focus();
  } else if (e.key === 'Enter' && e.target.classList.contains('fiche-titre')) {
    e.preventDefault(); e.target.blur();
  }
});

fiche.addEventListener('click', async (e) => {
  if (e.target.id === 'fiche-fermer') { fermerFiche(); return; }
  if (await clicLiens(e)) return;
  const lien = e.target.closest('[data-ouvrir]');
  if (lien) { ouvrirFiche(lien.dataset.ouvrir); return; }
  const t = tacheParId(etat.ficheId);
  if (!t) return;
  if (e.target.dataset.todoSuppr !== undefined) {
    await modifierTache(t, (x) => { x.todo.splice(+e.target.dataset.todoSuppr, 1); }, 'Étape supprimée');
    afficherFiche();
  } else if (e.target.id === 'supprimer') {
    await supprimerTache(t.id);
  }
});

fiche.addEventListener('focusout', sortieLiens);
brancherLiens(modifierTache, afficherFiche);

$('voile').addEventListener('click', fermerFiche);
document.addEventListener('keydown', (e) => {
  const cible = e.target instanceof Element ? e.target : null;
  if (e.key === 'Escape' && etat.ficheId && !(cible && cible.closest('.editable'))) fermerFiche();
});

// Ouvrir une fiche depuis la page : clic sur un code (tableau de bord)
$('contenu').addEventListener('click', (e) => {
  const lien = e.target.closest('[data-ouvrir]');
  if (lien) ouvrirFiche(lien.dataset.ouvrir);
});
