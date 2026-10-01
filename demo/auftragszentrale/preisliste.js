/* ============================================
   preisliste.js — Edins Preisliste lesen (ohne DOM)

   Edin pflegt seine Artikel in sevDesk und hat sie als CSV geschickt — in zwei
   Formen: dem sevDesk-Export („Art.-Nr.;…;Verkaufspreis;Kategorie;…") und einer
   Import-Vorlage („Artikelnummer;…;Verkaufspreis (Netto);Umsatzsteuer;…"). Beides
   wird hier gelesen, ebenso Zellen, die er aus Numbers oder Excel kopiert (Tabs).

   Regeln wie überall in der App: Ein Preis, der sich nicht eindeutig lesen lässt
   („1.234,50"), wird nicht umgedeutet, sondern als Problem gemeldet und bleibt
   leer (Fachregel 5). Keine Zeile verschwindet still — was übersprungen wird,
   steht in `probleme`.

   Bewusst ohne Abhängigkeit vom Browser: läuft auch in Node (tests/preisliste.mjs).
   ============================================ */

import { preisPruefen, zahlPruefen } from './util.js';

const MAX_ZEILEN = 2000;
const MAX_NAME = 200;
const MAX_TEXT = 600;

/** Spaltennamen → Feld. Verglichen wird klein, ohne Leer- und Satzzeichen. */
const SPALTEN = {
  nr:           ['artikelnummer', 'artnr', 'artikelnr', 'nr', 'nummer', 'artikel', 'sku'],
  name:         ['name', 'bezeichnung', 'artikelname', 'leistung', 'artikelbezeichnung'],
  einheit:      ['einheit', 'me', 'mengeneinheit'],
  preis:        ['verkaufspreisnetto', 'preisnetto', 'verkaufspreis', 'nettopreis', 'einzelpreis', 'preis', 'vk'],
  ust:          ['umsatzsteuer', 'steuersatz', 'ust', 'mwst', 'mwstsatz'],
  kategorie:    ['kategorie', 'gruppe', 'warengruppe', 'artikelgruppe'],
  beschreibung: ['beschreibung', 'text', 'langtext', 'artikelbeschreibung'],
};

const schluessel = (s) => String(s || '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]/g, '');

/** „m2" und „qm" werden einheitlich „m²" — sonst sähe dieselbe Einheit verschieden aus. */
export function einheitNormal(e) {
  const t = String(e || '').trim();
  if (/^(m2|m²|qm)$/i.test(t)) return 'm²';
  if (/^(m3|m³|cbm)$/i.test(t)) return 'm³';
  return t;
}

/** Zuschläge in Prozent (z. B. „Wochenende +25 %") sind kein Stückpreis. */
export const istZuschlag = (a) => a && (a.einheit === '%' || /^prozent$/i.test(a.einheit || ''));

/** Abrechnung nach Stunden — für Arbeitszeit wählbar. */
export const istStundenArtikel = (a) => a && /^(std\.?|stunde|stunden|h)$/i.test(String(a.einheit || '').trim());

/* ── CSV ─────────────────────────────────── */

/** Trennzeichen aus der Kopfzeile ableiten (außerhalb von Anführungszeichen gezählt). */
function trennzeichen(kopf) {
  const zaehl = { ';': 0, ',': 0, '\t': 0 };
  let inQ = false;
  for (const ch of kopf) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in zaehl) zaehl[ch]++;
  }
  const [best, anzahl] = Object.entries(zaehl).sort((a, b) => b[1] - a[1])[0];
  return anzahl > 0 ? best : ';';
}

/** RFC-4180-artig: Anführungszeichen, verdoppelte "" und Zeilenumbrüche im Feld. */
export function csvZeilen(text, trenner) {
  const zeilen = [];
  let feld = '', zeile = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { feld += '"'; i++; } else inQ = false;
      } else feld += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === trenner) { zeile.push(feld); feld = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      zeile.push(feld); zeilen.push(zeile); zeile = []; feld = '';
    } else feld += ch;
  }
  if (feld !== '' || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  return zeilen;
}

/**
 * Liest eine Preisliste aus Text (CSV-Datei oder eingefügte Tabellenzellen).
 *
 * @returns {{
 *   ok: boolean, fehler?: string,
 *   artikel: Array<{nr,name,einheit,preis,ust,kategorie,beschreibung}>,
 *   probleme: string[], format: string, spalten: string[],
 *   felder: string[]   // welche Felder die Datei überhaupt enthält
 * }}
 */
export function preislisteLesen(text) {
  const roh = String(text || '').replace(/^﻿/, '');
  const leer = (fehler) => ({ ok: false, fehler, artikel: [], probleme: [], format: '', spalten: [], felder: [] });
  if (!roh.trim()) return leer('Die Datei ist leer.');

  const ersteZeile = roh.split(/\r?\n/).find(z => z.trim()) || '';
  const trenner = trennzeichen(ersteZeile);
  const zeilen = csvZeilen(roh, trenner).filter(z => z.some(f => f.trim()));
  if (zeilen.length < 2) return leer('Es wurde keine Tabelle mit Überschrift und Artikeln gefunden.');

  // Kopfzeile zuordnen. Jede Spalte darf nur einmal belegt werden; die erste Treffer-
  // Spalte gewinnt („Verkaufspreis" vor „Einkaufspreis", das gar nicht gemappt ist).
  const kopf = zeilen[0].map(schluessel);
  const index = {};
  for (const [feld, namen] of Object.entries(SPALTEN)) {
    for (const n of namen) {
      const i = kopf.indexOf(n);
      if (i >= 0 && !Object.values(index).includes(i)) { index[feld] = i; break; }
    }
  }
  if (index.name === undefined) return leer('Keine Spalte „Name" oder „Bezeichnung" gefunden. Bitte die Datei mit Überschriftszeile exportieren.');
  if (index.preis === undefined) return leer('Keine Preisspalte gefunden (z. B. „Verkaufspreis" oder „Preis (Netto)").');

  const format = trenner === '\t' ? 'Tabelle (eingefügt)'
    : kopf.includes('artnr') && kopf.includes('kategorie') ? 'sevDesk-Export'
    : kopf.includes('artikelnummer') ? 'sevDesk-Importvorlage' : 'CSV';

  const artikel = [], probleme = [];
  const gesehen = new Map();
  const daten = zeilen.slice(1);
  if (daten.length > MAX_ZEILEN) probleme.push(`Nur die ersten ${MAX_ZEILEN} Zeilen wurden gelesen.`);

  daten.slice(0, MAX_ZEILEN).forEach((z, k) => {
    const zeileNr = k + 2;   // wie in der Tabelle: Zeile 1 ist die Überschrift
    const wert = (feld) => index[feld] === undefined ? '' : String(z[index[feld]] ?? '').trim();

    const name = wert('name').slice(0, MAX_NAME);
    if (!name) { probleme.push(`Zeile ${zeileNr}: ohne Namen — übersprungen.`); return; }

    const nr = wert('nr').slice(0, 60) || null;
    const preisRoh = wert('preis').replace(/\s*(€|eur)\s*$/i, '');
    const p = preisPruefen(preisRoh);
    let preis = null;
    if (p.status === 'ok') preis = p.wert;
    else if (p.status === 'leer') probleme.push(`Zeile ${zeileNr} (${nr || name}): kein Preis — bleibt offen.`);
    else probleme.push(`Zeile ${zeileNr} (${nr || name}): Preis „${preisRoh}" nicht eindeutig lesbar — bleibt offen.`);

    const ustRoh = wert('ust').replace('%', '').trim();
    const u = zahlPruefen(ustRoh, { minimum: 0 });
    const ust = u.status === 'ok' ? u.wert : null;

    const a = {
      nr, name,
      einheit: einheitNormal(wert('einheit')) || 'Stk.',
      preis, ust,
      kategorie: wert('kategorie').slice(0, 60) || '',
      beschreibung: wert('beschreibung').slice(0, MAX_TEXT),
    };

    // Doppelte Artikelnummer in derselben Datei: die spätere Zeile gilt — gesagt wird es.
    const key = nr || `name:${name.toLowerCase()}`;
    if (gesehen.has(key)) {
      probleme.push(`Zeile ${zeileNr}: Artikelnummer ${nr || name} kommt doppelt vor — die spätere Zeile gilt.`);
      artikel[gesehen.get(key)] = a;
    } else {
      gesehen.set(key, artikel.length);
      artikel.push(a);
    }
  });

  if (!artikel.length) return { ...leer('Keine Artikel mit Namen gefunden.'), probleme };
  return { ok: true, artikel, probleme, format, spalten: zeilen[0], felder: Object.keys(index) };
}

/** Schlüssel, über den eine Preisliste mit einer neuen Datei abgeglichen wird. */
export const artikelSchluessel = (a) => a.nr || `name:${a.name.toLowerCase()}`;

const VERGLEICHSFELDER = ['name', 'einheit', 'preis', 'kategorie', 'beschreibung', 'ust'];

/**
 * Ein vorhandener Artikel mit den Werten aus einer neuen Datei. Felder, die die neue
 * Datei gar nicht hat (z. B. keine Spalte „Kategorie"), bleiben wie sie waren —
 * sonst würde eine ältere, schmalere Liste die Kategorien still löschen.
 */
export function artikelAktualisiert(alt, neu, felderDerDatei = VERGLEICHSFELDER) {
  if (!alt) return { ...neu };
  const aus = { ...alt };
  for (const f of VERGLEICHSFELDER) if (felderDerDatei.includes(f)) aus[f] = neu[f];
  return aus;
}

/**
 * Was ändert sich, wenn diese Artikel übernommen werden?
 * `zusammen`: neue kommen dazu, vorhandene mit gleicher Nummer werden aktualisiert,
 *             alle anderen bleiben. `ersetzen`: die alte Liste fällt komplett weg.
 */
export function preislisteVergleich(alt, neu, modus = 'zusammen', felderDerDatei = VERGLEICHSFELDER) {
  const altMap = new Map(alt.map(a => [artikelSchluessel(a), a]));
  const neuMap = new Map(neu.map(a => [artikelSchluessel(a), a]));
  const ergebnis = { neu: [], geaendert: [], gleich: 0, entfaellt: [] };
  for (const [k, a] of neuMap) {
    const vorher = altMap.get(k);
    if (!vorher) { ergebnis.neu.push(a); continue; }
    const danach = modus === 'ersetzen' ? a : artikelAktualisiert(vorher, a, felderDerDatei);
    const diff = VERGLEICHSFELDER.filter(f => (vorher[f] ?? null) !== (danach[f] ?? null));
    if (diff.length) ergebnis.geaendert.push({ alt: vorher, neu: danach, felder: diff });
    else ergebnis.gleich++;
  }
  if (modus === 'ersetzen') {
    for (const [k, a] of altMap) if (!neuMap.has(k)) ergebnis.entfaellt.push(a);
  }
  return ergebnis;
}
