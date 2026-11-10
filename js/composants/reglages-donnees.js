// Réglages › Données (dans le rideau des Réglages, voir reglages.js).
// Exporter ce projet ou tous les projets : un fichier .json dans les Téléchargements
// (sur iPhone, Safari demande où l'enregistrer). La date du dernier export est rappelée.
// Importer : on choisit un fichier exporté (PC ou téléphone) ; ses projets sont ajoutés
// sans jamais en écraser un. Un seul projet importé : il s'ouvre ; plusieurs : « Mes projets ».
import { etat, $, hooks, repartirDeZero } from '../noyau/etat.js';
import { toast, dateHeure } from '../noyau/outils.js';
import { listerProjets, contenuExport, derniersExports, noterExport, importerProjets, ouvrirProjet } from '../noyau/stockage.js';

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// « Lancement boutique » → « lancement-boutique » (sans accents ni signes)
function nomFichier(texte) {
  const s = texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return s || 'projet';
}
function dateFichier() {
  const d = new Date();
  const deux = (n) => String(n).padStart(2, '0');
  return `${deux(d.getDate())}-${deux(d.getMonth() + 1)}-${d.getFullYear()}`;
}

const rappel = (iso) => `<p class="discret rg-rappel">${iso ? 'Dernier export : ' + dateHeure(iso) : 'Jamais exporté sur cet appareil'}</p>`;

export function htmlDonnees() {
  const exports = derniersExports();
  const n = listerProjets().length;
  return `
    <section class="rg-section">
      <h3 class="rg-sous-titre">Exporter</h3>
      <p class="discret rg-aide">Crée un fichier de sauvegarde (.json) dans tes Téléchargements.</p>
      <div class="rg-export">
        <button type="button" class="bouton" data-exporter="projet">Exporter ce projet</button>
        ${rappel(exports[etat.donnees.id])}
      </div>
      <div class="rg-export">
        <button type="button" class="bouton" data-exporter="tous">Tout exporter (${pluriel(n, 'projet')})</button>
        ${rappel(exports.tous)}
      </div>
    </section>
    <section class="rg-section">
      <h3 class="rg-sous-titre">Importer</h3>
      <p class="discret rg-aide">Ajoute les projets d'un fichier exporté. Aucun projet existant n'est remplacé.</p>
      <button type="button" class="bouton" data-importer>Importer un fichier</button>
      <input type="file" id="rg-fichier" accept=".json,application/json" hidden>
    </section>`;
}

// Lit le fichier choisi et ajoute ses projets
async function importer(fichier, nav) {
  let contenu;
  try {
    contenu = JSON.parse(await fichier.text());
  } catch {
    toast("Ce fichier n'est pas un export d'Ormagedon");
    return;
  }
  let resultat;
  try {
    resultat = await importerProjets(contenu);
  } catch (err) {
    toast(err.message);
    nav.afficher('[data-importer]');
    return;
  }
  const { ids, ignores } = resultat;
  const ignoresTexte = ignores ? ` (${pluriel(ignores, 'projet')} ignoré${ignores > 1 ? 's' : ''} : abîmé ou d'une version plus récente)` : '';
  if (!ids.length) { toast('Aucun projet importé' + ignoresTexte); return; }
  nav.fermer();
  if (ids.length === 1 && (await ouvrirProjet(ids[0]))) {
    repartirDeZero();
    location.hash = 'accueil';
    hooks.afficher(); // si on était déjà sur le tableau de bord, l'adresse ne change pas
    toast(`« ${etat.donnees.projet.nom} » importé${ignoresTexte}`);
  } else {
    location.hash = 'projets';
    toast(`${pluriel(ids.length, 'projet')} importé${ids.length > 1 ? 's' : ''}${ignoresTexte}`);
  }
}

// Fabrique le fichier et le donne au navigateur comme un téléchargement
function telecharger(nom, contenu) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Exporte un projet (ouvert ou non) ; renvoie le nom du fichier, ou '' si rien à exporter.
// Aussi utilisé par « Exporter puis supprimer » dans « Mes projets ».
export async function exporterProjet(id) {
  const contenu = await contenuExport([id]);
  if (!contenu.projets.length) { toast('Rien à exporter'); return ''; }
  const nom = `${nomFichier(contenu.projets[0].projet.nom || '')}-${dateFichier()}.json`;
  telecharger(nom, contenu);
  noterExport(id);
  return nom;
}

async function exporter(quoi, nav) {
  let nom;
  if (quoi === 'tous') {
    const contenu = await contenuExport(listerProjets().map((p) => p.id));
    if (!contenu.projets.length) { toast('Rien à exporter'); return; }
    nom = `ormagedon-tous-les-projets-${dateFichier()}.json`;
    telecharger(nom, contenu);
    noterExport('tous');
  } else {
    nom = await exporterProjet(etat.donnees.id);
    if (!nom) return;
  }
  nav.afficher(`[data-exporter="${quoi}"]`);
  toast('Fichier exporté : ' + nom);
}

// Appelé par reglages.js ; renvoie true si le clic est traité
export function clicDonnees(e, nav) {
  if (e.target.closest('[data-importer]')) {
    const champ = $('rg-fichier');
    champ.value = ''; // pour pouvoir choisir deux fois le même fichier
    champ.onchange = () => { if (champ.files[0]) importer(champ.files[0], nav); };
    champ.click(); // ouvre la fenêtre de choix de fichier (PC) ou l'app Fichiers (téléphone)
    return true;
  }
  const b = e.target.closest('[data-exporter]');
  if (!b) return false;
  exporter(b.dataset.exporter, nav);
  return true;
}
