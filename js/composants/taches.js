// Liste des tâches du tableau de bord + modification directe des textes.
// Clic sur un titre ou une description : on modifie, puis on clique ailleurs
// (ou Entrée pour un titre, Échap pour annuler) et c'est enregistré.
import { $ } from '../noyau/etat.js';
import { echapper, dateFr, classeStatut, tacheParId, toast } from '../noyau/outils.js';
import { enregistrer } from '../noyau/api.js';
import { boutonSupprimer } from './suppression.js';

export function listeTaches(taches) {
  if (!taches.length) return '<p class="discret">Aucune tâche dans cette catégorie.</p>';
  return `
    <ul class="taches">
      ${taches.map((t) => `
        <li>
          <div class="tache-tete">
            <button class="code lien" data-ouvrir="${echapper(t.id)}" title="Ouvrir la fiche">${echapper(t.id)}</button>
            <span class="tache-titre editable" contenteditable="true" spellcheck="true" data-id="${echapper(t.id)}" data-champ="titre" title="Clique pour modifier">${echapper(t.titre)}</span>
            <span class="etiquette">${echapper(t.categorie)}${t.sousCategorie ? ' › ' + echapper(t.sousCategorie) : ''}</span>
            <span class="statut ${classeStatut(t.statut)}">${echapper(t.statut)}</span>
            <span class="discret nowrap tache-date">${t.echeance ? 'avant le ' + dateFr(t.echeance) : ''}</span>
            ${boutonSupprimer(echapper(t.id))}
          </div>
          <p class="discret editable" contenteditable="true" spellcheck="true" data-id="${echapper(t.id)}" data-champ="description" data-vide="Ajouter une description…" title="Clique pour modifier">${echapper(t.description)}</p>
          ${t.notes ? `<p class="note">${echapper(t.notes)}</p>` : ''}
        </li>`).join('')}
    </ul>`;
}

const contenu = $('contenu');

contenu.addEventListener('focusin', (e) => {
  const el = e.target.closest('.editable');
  if (el) el.dataset.avant = el.textContent;
});

contenu.addEventListener('keydown', (e) => {
  const el = e.target.closest('.editable');
  if (!el) return;
  if (e.key === 'Escape') { el.textContent = el.dataset.avant || ''; el.blur(); }
  else if (e.key === 'Enter' && el.dataset.champ === 'titre') { e.preventDefault(); el.blur(); }
});

contenu.addEventListener('focusout', async (e) => {
  const el = e.target.closest('.editable');
  if (!el) return;
  const texte = el.textContent.replace(/\s+/g, ' ').trim();
  const tache = tacheParId(el.dataset.id);
  if (!tache || texte === (tache[el.dataset.champ] || '')) { el.textContent = texte; return; }
  if (el.dataset.champ === 'titre' && !texte) { el.textContent = tache.titre; toast('Le titre ne peut pas être vide'); return; }
  tache[el.dataset.champ] = texte;
  if (await enregistrer()) toast('Enregistré');
});
