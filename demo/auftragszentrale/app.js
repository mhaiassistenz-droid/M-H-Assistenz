/* ============================================
   app.js — Router, Navigation, Uhr

   Vier Bereiche, eine Datenquelle. Der Router hält nur fest, welche
   Seite sichtbar ist; die Daten kommen in jeder Ansicht frisch aus
   state.js, damit Karte, Kalendereintrag und Rechnung nie auseinanderlaufen.
   ============================================ */

import { $, esc, icon, HANDY_MQ } from './util.js';
import * as flows from './flows.js';
import { hinweisHtml, zugangKnopf } from './freischalten.js';
import * as state from './state.js';
import { bestaetigen, toast, alleSheetsSchliessen } from './ui.js';
import { bilderNachladen } from './fotos.js';

import { renderHome }       from './page-home.js';
import { renderAuftraege }  from './page-auftraege.js';
import { renderKalender }   from './page-kalender.js';
import { renderRechnungen } from './page-rechnungen.js';
import { renderAufgaben, aufgabenVerlassen } from './page-aufgaben.js';

const ROUTEN = [
  { id: 'home',       label: 'Home',       ikone: 'home',      render: renderHome },
  { id: 'auftraege',  label: 'Aufträge',   ikone: 'auftraege', render: renderAuftraege },
  { id: 'kalender',   label: 'Kalender',   ikone: 'kalender',  render: renderKalender },
  { id: 'aufgaben',   label: 'Aufgaben',   ikone: 'aufgaben',  render: renderAufgaben },
  { id: 'rechnungen', label: 'Rechnungen', ikone: 'rechnung',  render: renderRechnungen },
];

let aktiv = 'home';

/* ── Navigation zeichnen ─────────────────── */

function navZeichnen() {
  const zaehler = {
    home: null,
    auftraege: state.alleAuftraege().filter(a => a.status !== 'erledigt').length,
    kalender: null,
    aufgaben: state.offeneAufgaben().length,
    rechnungen: state.alleRechnungen().filter(r => r.status === 'entwurf').length,
  };

  $('#navDesktop').innerHTML =
    `<div class="sb-section-label">Bereiche</div>` +
    ROUTEN.map(r => `
      <button class="nav-item ${r.id === aktiv ? 'active' : ''}" data-route="${r.id}" type="button">
        ${icon(r.ikone, 'nav-icon')}${r.label}
        ${zaehler[r.id] ? `<span class="nav-count">${zaehler[r.id]}</span>` : ''}
      </button>`).join('');

  $('#navMobile').innerHTML = ROUTEN.map(r => `
    <button class="tab ${r.id === aktiv ? 'active' : ''}" data-route="${r.id}" type="button"
            aria-current="${r.id === aktiv ? 'page' : 'false'}">
      ${icon(r.ikone)}<span>${r.label}</span>
    </button>`).join('');

  document.querySelectorAll('[data-route]').forEach(b =>
    b.addEventListener('click', () => gehe(b.dataset.route)));
}

/* ── Routing ─────────────────────────────── */

export function gehe(id, { scrollTop = true } = {}) {
  if (!ROUTEN.some(r => r.id === id)) id = 'home';
  if (aktiv === 'aufgaben' && id !== 'aufgaben') aufgabenVerlassen();
  aktiv = id;
  if (location.hash !== '#' + id) location.hash = id;

  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle('active', p.id === 'page-' + id));

  $('#crumbSeite').textContent = ROUTEN.find(r => r.id === id).label;
  seiteZeichnen();
  navZeichnen();
  if (scrollTop) window.scrollTo({ top: 0 });
}

/** Nur die sichtbare Seite neu bauen — offene Overlays bleiben unberührt. */
function seiteZeichnen() {
  const route = ROUTEN.find(r => r.id === aktiv);
  route.render($('#page-' + route.id));
  bilderNachladen($('#page-' + route.id));
}

/**
 * Sichtbarer Speicherhinweis. Solange localStorage schreibt, ist er unsichtbar;
 * schlägt das Speichern fehl, muss Edin das sehen — sonst hält er Arbeit für
 * gesichert, die beim nächsten Reload weg ist.
 */
function speicherHinweisZeichnen(zustand) {
  const leiste = $('#speicherHinweis');
  if (!leiste) return;

  if (zustand.status === 'ok') { leiste.hidden = true; leiste.innerHTML = ''; return; }

  leiste.hidden = false;
  leiste.innerHTML = `
    <div class="warnleiste">
      <div>
        <strong>Änderungen gelten nur in dieser Sitzung.</strong>
        ${esc(zustand.fehler || '')} Beim Schließen des Browsers gehen sie verloren.
      </div>
      <button class="btn btn-sm" data-erneut type="button">Erneut speichern</button>
    </div>`;
  leiste.querySelector('[data-erneut]').addEventListener('click', () => {
    if (state.erneutSpeichern()) toast('Gespeichert.');
    else toast('Speichern ist weiterhin nicht möglich.');
  });
}

/* ── Start ───────────────────────────────── */

function uhr() {
  const d = new Date();
  $('#clock').textContent =
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function start() {
  state.load();

  // Jede Datenänderung zeichnet die sichtbare Seite und die Zähler neu.
  state.subscribe(() => { seiteZeichnen(); navZeichnen(); });
  state.onSpeicher(speicherHinweisZeichnen);
  speicherHinweisZeichnen(state.speicher);

  $('#btnReset').addEventListener('click', async () => {
    const ja = await bestaetigen({
      titel: 'Demo zurücksetzen',
      text: 'Alle erfassten Aufträge, Notizen, Fotos und Rechnungsentwürfe werden gelöscht. '
          + 'Danach ist die App leer. Das lässt sich nicht rückgängig machen.',
      jaText: 'Zurücksetzen',
      warnend: true,
    });
    if (!ja) return;
    alleSheetsSchliessen();
    state.zuruecksetzen();
    gehe('home');
    toast('Alles gelöscht. Die App ist leer.');
  });

  window.addEventListener('hashchange', () => {
    const id = location.hash.replace('#', '');
    if (id && id !== aktiv) gehe(id);
  });

  // Desktop-Spalten und Handy-Filter sind unterschiedliche Ansichten
  // derselben Daten — beim Wechsel der Breite neu aufbauen.
  window.matchMedia(HANDY_MQ).addEventListener('change', () => seiteZeichnen());

  uhr();
  setInterval(uhr, 30000);

  // Einmal klären, ob ein echter Dienst dahintersteht, BEVOR die erste Seite
  // entsteht. Sonst behaupten Fußzeile und Knöpfe im ersten Moment „Demo",
  // obwohl wirklich ausgewertet und versendet wird.
  const echterDienst = await flows.verfuegbar();

  // Der Hinweis in der Seitenleiste steht fest im HTML. Laeuft wirklich ein
  // Dienst dahinter, darf dort nicht weiter „simuliert" stehen — die Daten
  // bleiben erfunden, die Verarbeitung ist es nicht.
  if (echterDienst) {
    const hinweis = $('[data-demo-hinweis]');
    if (hinweis) hinweis.innerHTML = hinweisHtml(flows.zugangsmodus());
  }
  zugangKnopf($('#btnZugang'));

  gehe(location.hash.replace('#', '') || 'home', { scrollTop: false });
}

start();

// Der Reset-Knopf der Seitenleiste ist auf dem Handy nicht sichtbar —
// Home blendet ihn dort eigenständig ein und ruft diesen Weg auf.
export const resetAusloesen = () => $('#btnReset').click();
