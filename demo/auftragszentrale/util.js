/* ============================================
   util.js — kleine Helfer, keine Fachlogik
   ============================================ */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Eindeutige ID für neue Aufträge, Verlaufseinträge, Positionen. */
export function uid(prefix = 'id') {
  return prefix + '-' + Math.random().toString(36).slice(2, 9);
}

/** HTML-Escaping — alle Nutzereingaben laufen hier durch, bevor sie ins DOM gehen. */
export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/* ── Datum / Uhrzeit ─────────────────────── */

/** '2026-09-22T14:00' → Date. Bewusst lokale Zeit, keine UTC-Verschiebung. */
export function parseTermin(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d) ? null : d;
}

export const tagKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function heuteKey() { return tagKey(new Date()); }

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WT_KURZ    = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONATE     = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export const wochentag     = (d) => WOCHENTAGE[d.getDay()];
export const wochentagKurz = (d) => WT_KURZ[d.getDay()];
export const monatName     = (d) => MONATE[d.getMonth()];

export function fmtDatum(d) {
  if (!d) return 'Kein Termin';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function fmtUhr(d) {
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Heute, 14:00" / "Morgen, 08:30" / "Do, 24.09.2026, 08:30" */
export function fmtTermin(iso) {
  const d = parseTermin(iso);
  if (!d) return 'Kein Termin';
  const k = tagKey(d), heute = heuteKey();
  const morgen = tagKey(new Date(Date.now() + 864e5));
  const gestern = tagKey(new Date(Date.now() - 864e5));
  if (k === heute)   return `Heute, ${fmtUhr(d)}`;
  if (k === morgen)  return `Morgen, ${fmtUhr(d)}`;
  if (k === gestern) return `Gestern, ${fmtUhr(d)}`;
  return `${wochentagKurz(d)}, ${fmtDatum(d)}, ${fmtUhr(d)}`;
}

/** Für <input type="datetime-local"> */
export function toInputDatetime(iso) {
  const d = parseTermin(iso);
  if (!d) return '';
  return `${tagKey(d)}T${fmtUhr(d)}`;
}

/** Relativer Zeitstempel für den Dokumentationsverlauf. */
export function fmtVerlaufZeit(iso) {
  const d = parseTermin(iso);
  if (!d) return '';
  return tagKey(d) === heuteKey()
    ? `Heute, ${fmtUhr(d)} Uhr`
    : `${fmtDatum(d)}, ${fmtUhr(d)} Uhr`;
}

/* ── Zahlen ──────────────────────────────── */

export function fmtEuro(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function fmtStunden(h) {
  if (h === null || h === undefined || isNaN(h)) return '—';
  const s = Number(h);
  return (Number.isInteger(s) ? s : s.toLocaleString('de-DE', { maximumFractionDigits: 2 })) +
         (s === 1 ? ' Stunde' : ' Stunden');
}

/**
 * Rohtext → Zahl. Komma und Punkt gelten beide als Dezimaltrenner, aber nur
 * einer davon: "1.500" wäre sonst mal 1,5 und mal 1500 — eine stille Umdeutung,
 * die auf einer Rechnung nichts zu suchen hat.
 *
 * Gibt null zurück bei leer UND bei ungültig. Wer den Unterschied braucht
 * (Validierung), nimmt zahlPruefen().
 */
export function parseZahl(v) {
  const p = zahlPruefen(v);
  return p.status === 'ok' ? p.wert : null;
}

/**
 * Prüft eine Zahleneingabe und sagt, was daran nicht stimmt.
 *
 * @param {*} v                        Rohwert aus dem Eingabefeld
 * @param {object} [regeln]
 * @param {number} [regeln.minimum]    kleinster zulässiger Wert
 * @param {boolean} [regeln.echtGroesser] true: muss echt größer als minimum sein
 * @returns {{status:'leer'|'ungueltig'|'unzulaessig'|'ok', wert:number|null, hinweis:string}}
 */
export function zahlPruefen(v, regeln = {}) {
  if (v === null || v === undefined) return { status: 'leer', wert: null, hinweis: '' };

  const roh = String(v).trim();
  if (roh === '') return { status: 'leer', wert: null, hinweis: '' };

  // Mehr als ein Trennzeichen ist mehrdeutig — lieber nachfragen als raten.
  const trenner = (roh.match(/[.,]/g) || []).length;
  if (trenner > 1) {
    return { status: 'ungueltig', wert: null,
             hinweis: 'Nur ein Komma als Dezimaltrennzeichen, z. B. 1,5' };
  }

  const normiert = roh.replace(',', '.');
  if (!/^-?\d*\.?\d+$/.test(normiert)) {
    return { status: 'ungueltig', wert: null, hinweis: 'Bitte nur Ziffern, z. B. 1,5' };
  }

  const n = Number(normiert);
  // Fängt NaN und Infinity ab — beides käme sonst bis in die Rechnungssumme.
  if (!Number.isFinite(n)) {
    return { status: 'ungueltig', wert: null, hinweis: 'Keine gültige Zahl' };
  }

  const { minimum, echtGroesser } = regeln;
  if (minimum !== undefined) {
    const zuKlein = echtGroesser ? n <= minimum : n < minimum;
    if (zuKlein) {
      return {
        status: 'unzulaessig', wert: null,
        hinweis: echtGroesser ? `Muss größer als ${zahlZuFeld(minimum)} sein`
                              : `Darf nicht kleiner als ${zahlZuFeld(minimum)} sein`,
      };
    }
  }
  return { status: 'ok', wert: n, hinweis: '' };
}

/** Mengen: endlich und echt größer null. */
export const mengePruefen = (v) => zahlPruefen(v, { minimum: 0, echtGroesser: true });

/** Preise: endlich und nicht negativ. Null ist erlaubt (kostenlose Position). */
export const preisPruefen = (v) => zahlPruefen(v, { minimum: 0 });

/**
 * E-Mail-Syntaxprüfung. Bewusst schlicht: genau ein @, beidseitig etwas dran,
 * hinten ein Punkt mit Endung. Sie soll Tippfehler wie "ungueltig" abfangen,
 * nicht RFC 5322 nachbilden.
 */
export function istEmail(v) {
  const s = String(v ?? '').trim();
  if (!s || /\s/.test(s)) return false;
  return /^[^@]+@[^@]+\.[A-Za-z]{2,}$/.test(s);
}

/** Für Zahlenfelder: null darf nicht als "0" oder "null" im Input landen. */
export const zahlZuFeld = (n) =>
  (n === null || n === undefined || isNaN(n)) ? '' : String(n).replace('.', ',');

/* ── Icons (inline SVG, Stroke folgt currentColor) ── */

export const ICON = {
  home:      '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  auftraege: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 2v4M16 2v4M7 11h6M7 15h4"/>',
  kalender:  '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  rechnung:  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
  plus:      '<path d="M12 5v14M5 12h14"/>',
  kamera:    '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  bilder:    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  mikro:     '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>',
  notiz:     '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  uhr:       '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  material:  '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  offen:     '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  play:      '<polygon points="5 3 19 12 5 21 5 3"/>',
  check:     '<path d="M20 6 9 17l-5-5"/>',
  zurueck:   '<path d="m15 18-6-6 6-6"/>',
  vor:       '<path d="m9 18 6-6-6-6"/>',
  schliessen:'<path d="M18 6 6 18M6 6l12 12"/>',
  papierkorb:'<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  stift:     '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  senden:    '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  funke:     '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/>',
  ort:       '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  person:    '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  telefon:   '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
};

/** <svg> mit den Klassen/Größen der Referenz. */
export function icon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name] || ''}</svg>`;
}

/* ── Breakpoint ──────────────────────────── */

/** Muss mit dem Breakpoint in styles.css übereinstimmen. */
export const HANDY_MQ = '(max-width: 860px)';
export const istHandy = () => window.matchMedia(HANDY_MQ).matches;
