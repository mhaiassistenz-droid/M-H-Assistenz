/* ============================================
   ui.js — geteilte Bausteine

   Overlay-Stack: Die Auftragsakte kann den Rechnungsentwurf öffnen,
   der Entwurf die Versandvorschau. Jede Ebene kennt ihren Rückweg,
   damit Edin nie in einer Sackgasse landet.

   Overlays rendern sich bewusst selbst neu (nicht über state.subscribe),
   sonst verliert ein Eingabefeld beim Tippen den Fokus.
   ============================================ */

import { esc, icon } from './util.js';
import { bilderNachladen } from './fotos.js';

const stack = [];
const host = () => document.getElementById('overlay');
let zuletztGezeichnet = null;   // welche Ebene zuletzt oben gezeichnet wurde

/* ── Overlay / Sheet ─────────────────────── */

/**
 * @param {object} o
 * @param {string} o.titel           Kopfzeile
 * @param {() => string} o.body      HTML des Inhalts (wird bei render() neu erzeugt)
 * @param {() => string} [o.foot]    HTML der festen Fußleiste
 * @param {(el: HTMLElement, api) => void} [o.bind]  Event-Handler nach jedem Rendern
 * @param {() => void} [o.vorRender] Aufräumen vor jedem Neuzeichnen (Zeitgeber, Animationen)
 * @param {() => void} [o.onClose]
 * @param {(el: HTMLElement|null) => void} [o.vorSchliessen]
 *        Nur wenn der Nutzer die Ebene wegklickt (X, Klick daneben, Esc): letzte
 *        Gelegenheit, den Stand aus dem DOM zu sichern. Nicht beim programmatischen
 *        Schließen nach dem Speichern — sonst entstünde ein gerade gelöschter Entwurf neu.
 */
export function sheetOeffnen(o) {
  stack.push(o);
  zeichnen();
  return api(stack.length - 1);
}

/** Oberste Ebene schließen. Ist es die letzte, verschwindet das Overlay ganz. */
export function sheetSchliessen() {
  const o = stack.pop();
  if (o?.onClose) o.onClose();
  zeichnen();
}

/** Schließen durch den Nutzer: erst sichern lassen, dann schließen. */
function nutzerSchliessen() {
  const o = stack[stack.length - 1];
  if (o?.vorSchliessen) o.vorSchliessen(host().firstElementChild);
  sheetSchliessen();
}

export function alleSheetsSchliessen() {
  // Nur die oberste Ebene hat ein DOM; die darunter bekommen null.
  stack.forEach((o, i) => o.vorSchliessen?.(i === stack.length - 1 ? host().firstElementChild : null));
  while (stack.length) { const o = stack.pop(); if (o?.onClose) o.onClose(); }
  zeichnen();
}

/** Ebene durch eine andere ersetzen — für "Akte → Rechnungsvorschau" ohne Stapelwuchs. */
export function sheetErsetzen(o) {
  if (stack.length) stack.pop();
  stack.push(o);
  zeichnen();
  return api(stack.length - 1);
}

function api(index) {
  return {
    /** Nur diese Ebene neu zeichnen (z.B. nach dem Anlegen eines Verlaufseintrags). */
    render: () => { if (stack.length - 1 === index) zeichnen(); },
    schliessen: sheetSchliessen,
  };
}

function zeichnen() {
  const h = host();
  if (!stack.length) {
    zuletztGezeichnet = null;
    h.innerHTML = '';
    document.body.style.overflow = '';
    return;
  }
  document.body.style.overflow = 'hidden';

  const o = stack[stack.length - 1];
  const zurueck = stack.length > 1;

  // Wer laufende Zeitgeber oder Animationen an das alte DOM gehängt hat,
  // bekommt hier die Gelegenheit, sie zu lösen. Sonst laufen sie nach dem
  // Ersetzen des innerHTML ins Leere und stapeln sich bei jedem Rendern.
  if (o.vorRender) o.vorRender();

  // Dieselbe Ebene zeichnet sich neu (z. B. nach einem Haken): Scrollstand halten und
  // nicht erneut einblenden — sonst springt die Ansicht bei jeder Auswahl nach oben.
  const dieselbe = zuletztGezeichnet === o;
  const scrollJetzt = h.querySelector('.sheet-body')?.scrollTop || 0;
  // Öffnet sich eine Ebene darüber (z. B. die Artikel-Auswahl), merkt sich die alte
  // ihren Scrollstand — beim Zurückkehren steht Edin wieder an derselben Stelle,
  // statt im langen Rechnungsentwurf oben neu anzufangen.
  if (zuletztGezeichnet && !dieselbe && stack.includes(zuletztGezeichnet)) zuletztGezeichnet._scroll = scrollJetzt;
  const scrollVorher = dieselbe ? scrollJetzt : (o._scroll || 0);
  zuletztGezeichnet = o;

  h.innerHTML = `
    <div class="sheet-backdrop" data-backdrop>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(o.titel)}">
        <div class="sheet-head">
          <button class="icon-btn" data-close type="button"
                  aria-label="${zurueck ? 'Zurück' : 'Schließen'}">
            ${icon(zurueck ? 'zurueck' : 'schliessen')}
          </button>
          <div class="sheet-head-t">${esc(o.titel)}</div>
          ${o.kopfAktion ? o.kopfAktion() : ''}
        </div>
        <div class="sheet-body">${o.body()}</div>
        ${o.foot ? `<div class="sheet-foot">${o.foot()}</div>` : ''}
      </div>
    </div>`;

  const wurzel = h.firstElementChild;
  // Zurück auf eine Ebene, die schon zu sehen war: nicht erneut hereinfahren lassen.
  if (dieselbe || o._gezeigt) wurzel.querySelector('.sheet').classList.add('ohne-einblenden');
  o._gezeigt = true;
  if (scrollVorher) wurzel.querySelector('.sheet-body').scrollTop = scrollVorher;
  wurzel.querySelector('[data-close]').addEventListener('click', nutzerSchliessen);
  wurzel.addEventListener('mousedown', (e) => {
    // Klick auf den abgedunkelten Rand schließt — Klick im Sheet nicht.
    if (e.target.hasAttribute('data-backdrop')) nutzerSchliessen();
  });
  if (o.bind) o.bind(wurzel, api(stack.length - 1));
  bilderNachladen(wurzel);
}

// Esc schließt immer die oberste Ebene.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) { e.preventDefault(); nutzerSchliessen(); }
});

/* ── Bestätigung ─────────────────────────── */

/** Für alles, was etwas entfernt oder einen Zustand endgültig setzt. */
export function bestaetigen({ titel, text, jaText = 'Ja, weiter', warnend = false }) {
  return new Promise((loesen) => {
    sheetOeffnen({
      titel,
      body: () => `<div class="hint-note">${esc(text)}</div>`,
      foot: () => `
        <button class="btn" data-nein type="button">Abbrechen</button>
        <button class="btn ${warnend ? 'btn-warn' : 'btn-primaer'}" data-ja type="button">${esc(jaText)}</button>`,
      bind: (el) => {
        el.querySelector('[data-nein]').addEventListener('click', () => { loesen(false); sheetSchliessen(); });
        el.querySelector('[data-ja]').addEventListener('click',   () => { loesen(true);  sheetSchliessen(); });
      },
      onClose: () => loesen(false),
    });
  });
}

/* ── Toast ───────────────────────────────── */

let toastTimer = null;

export function toast(text) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.style.cssText = `
      position: fixed; left: 50%; transform: translateX(-50%);
      bottom: calc(84px + env(safe-area-inset-bottom)); z-index: 400;
      background: oklch(0.22 0.02 265); color: #fff;
      padding: 11px 17px; border-radius: 999px;
      font-size: 13px; font-weight: 500; max-width: min(92vw, 420px);
      text-align: center; box-shadow: 0 8px 24px rgba(15,23,42,.24);
      opacity: 0; transition: opacity .2s; pointer-events: none;`;
    document.body.appendChild(el);
  }
  el.textContent = text;
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

/* ── kleine HTML-Helfer ──────────────────── */

/**
 * Status als Wort plus kleiner gedämpfter Punkt. Die Farbe ist Beiwerk —
 * gelesen wird das Wort, damit es auch bei Sonne und für farbschwache Augen trägt.
 * @param {string} label
 * @param {'geplant'|'arbeit'|'fertig'|'neutral'|'fehler'} art
 * @param {boolean} [gerahmt] für Kartenfüße, wo der Status sich abheben soll
 */
export const badge = (label, art = 'neutral', gerahmt = false) =>
  `<span class="badge ${art}${gerahmt ? ' badge-feld' : ''}"><span class="badge-dot"></span>${esc(label)}</span>`;

/**
 * Kompakter, neutraler Hinweis für simulierte Funktionen.
 *
 * Bewusst zurückhaltend: Die Kennzeichnung muss vorhanden und lesbar sein, darf
 * aber nicht das Lauteste auf dem Bildschirm sein — sonst liest ein Auftraggeber,
 * dem Edin das zeigt, zuerst „Demo".
 */
export const hinweisBox = (text, marke = 'Demo') =>
  `<div class="hinweis">${marke
    ? `<span class="hinweis-marke">${esc(marke)}</span>` : ''}<span>${text}</span></div>`;

export const leerZustand = (text, hinweis = '') =>
  `<div class="state-box">${esc(text)}${hinweis ? `<div class="state-hint">${esc(hinweis)}</div>` : ''}</div>`;
