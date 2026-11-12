// Installer l'app (étape 1.8, point 5), en bas de « Mes projets » :
//   - PC et Android : bouton « ⬇ Installer l'app », seulement quand le navigateur le propose
//     (événement beforeinstallprompt) ; il disparaît une fois l'app installée ;
//   - iPhone / iPad : Apple n'a pas de bouton (un site ne peut pas lancer l'installation) :
//     une ligne d'aide en gris, avec un × pour la masquer (mémorisé sur l'appareil),
//     car depuis Safari on ne peut pas savoir si l'app est déjà installée.
// Dans l'app installée, rien ne s'affiche.
import { $ } from '../noyau/etat.js';

const CLE_AIDE = 'ormagedon-aide-installation'; // « masquee » : l'aide iPhone a été fermée
let proposition = null; // l'événement gardé, pour ouvrir la fenêtre d'installation au clic

const estInstallee = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
// iPad récent : il se présente comme un Mac, mais avec un écran tactile
const estApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const aideMasquee = () => { try { return localStorage.getItem(CLE_AIDE) === 'masquee'; } catch { return false; } };

// Icône « Partager » de l'iPhone (carré avec une flèche vers le haut)
const ICONE_PARTAGER = '<svg class="icone-partager" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';

function contenu() {
  if (estInstallee()) return '';
  if (proposition) {
    return `<button type="button" class="bouton" data-installer>⬇ Installer l'app</button>
      <span class="discret">Sur cet appareil, dans sa propre fenêtre, même sans internet.</span>`;
  }
  if (estApple() && !aideMasquee()) {
    return `<p class="discret installation-aide">Pour installer l'app : touche Partager ${ICONE_PARTAGER} puis « Sur l'écran d'accueil ».</p>
      <button type="button" class="fermer" data-fermer-aide title="Masquer" aria-label="Masquer l'aide pour installer">×</button>`;
  }
  return '';
}

// Emplacement prévu dans « Mes projets » (vues/projets.js)
export function blocInstallation() {
  return `<div class="installation" id="installation">${contenu()}</div>`;
}

function rafraichir() {
  const bloc = $('installation');
  if (bloc) bloc.innerHTML = contenu();
}

// Le navigateur propose l'installation : on garde sa fenêtre pour le clic sur le bouton
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  proposition = e;
  rafraichir();
});
window.addEventListener('appinstalled', () => { proposition = null; rafraichir(); });

$('contenu').addEventListener('click', async (e) => {
  if (!(e.target instanceof Element)) return;
  if (e.target.closest('[data-installer]') && proposition) {
    const p = proposition;
    proposition = null; // une fenêtre ne s'ouvre qu'une fois ; le navigateur la reproposera s'il le veut
    rafraichir();
    try { await p.prompt(); await p.userChoice; } catch { /* fenêtre refusée par le navigateur */ }
    return;
  }
  if (e.target.closest('[data-fermer-aide]')) {
    try { localStorage.setItem(CLE_AIDE, 'masquee'); } catch { /* sans importance */ }
    rafraichir();
  }
});
