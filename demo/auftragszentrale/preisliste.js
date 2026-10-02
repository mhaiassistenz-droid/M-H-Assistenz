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

/* ── Kandidaten für den Preis-Agenten ─────────
   Die KI wählt nie frei aus der ganzen Liste. Die App sucht pro Position die
   plausibelsten Artikel heraus — nur mit passender Einheit und nur mit einem
   echten Wort- oder Synonym-Treffer. Gibt es keinen, wird die KI für diese
   Position gar nicht gefragt und der Preis bleibt offen (Fachregel 5). */

/** Wörter, die nichts über die Leistung sagen. */
const STOPP = new Set(['und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'mit', 'ohne',
  'fuer', 'von', 'vom', 'zum', 'zur', 'auf', 'aus', 'bei', 'nach', 'inkl', 'inklusive', 'pro', 'per', 'je', 'als', 'wie',
  'arbeitszeit', 'stunde', 'stunden', 'std', 'stk', 'stueck', 'pauschale', 'monat', 'einsatz', 'etage', 'raum', 'qm',
  'zeit', 'arbeit', 'arbeiten', 'gemacht', 'erledigt', 'durchgefuehrt', 'neu', 'alt', 'test', 'beispielartikel']);

/** Wortstämme, die dasselbe meinen. Ein Treffer über eine Gruppe zählt schwächer als ein direktes Wort.
    Die ersten beiden Gruppen sind Tätigkeiten („tauschen", „reinigen") — sie sagen nicht,
    WAS gemacht wurde, und zählen deshalb nur als Bonus, nie allein als Beleg. */
const TAETIGKEIT = 2;
const SYNONYME = [
  ['wechsel', 'tausch', 'erneuer', 'ersetz', 'austausch', 'montier', 'einbau', 'eingebaut'],
  ['reinig', 'putz', 'saeuber', 'wisch'],
  ['siphon', 'geruchsversch', 'ablaufgarnitur'],
  ['licht', 'lampe', 'leuchtmittel', 'birne', 'leuchte', 'led'],
  ['hecke', 'gehoelz', 'strauch', 'straeuch', 'rueckschnitt', 'schnitt'],
  ['rasen', 'maeh', 'gartenpflege', 'gras'],
  ['fenster', 'glas', 'scheibe'],
  ['muell', 'tonne', 'abfall'],
  ['winter', 'schnee', 'streu', 'glaette', 'raeum'],
  ['anfahrt', 'fahrt', 'fahrtkost'],
  ['kehr', 'fege', 'aussenreinig', 'gehweg', 'hof'],
  ['entruempel', 'raeumung', 'aufloes', 'sperrmuell'],
  ['repar', 'montage', 'instandhalt', 'ausbesser'],
  ['treppe', 'treppenhaus'],
  ['boden', 'fussboden', 'parkett', 'laminat'],
  ['notdienst', 'havarie', 'notfall', 'rohrbruch'],
  ['kontroll', 'begehung', 'pruef', 'check', 'sichtkontroll'],
  ['armatur', 'wasserhahn', 'mischbatterie', 'hahn'],
  ['tuer', 'zarge'],
  ['zaun', 'zaunlatte', 'pfosten'],
  ['backofen', 'ofen'], ['dunstabzug', 'abzugshaube'], ['kochfeld', 'ceran', 'induktion'],
  ['wc', 'toilette', 'klo', 'urinal'],
  ['teppich', 'spruehextrakt'], ['jalousie', 'rollo', 'lamelle'],
];

const normalText = (s) => String(s || '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/m²|m2\b/g, ' ');

/** Bedeutungstragende Wörter (≥ 3 Buchstaben, ohne Füllwörter). */
export function woerter(s) {
  return [...new Set((normalText(s).match(/[a-z]{3,}/g) || []).filter(w => !STOPP.has(w)))];
}

const gruppenVon = (wort) => SYNONYME.map((g, i) => g.some(st => wort.includes(st)) ? i : -1).filter(i => i >= 0);

/** „gereinigt", „getauscht", „Reinigung" — nur Tätigkeit. „Baufeinreinigung" ist dagegen eine Sache:
    Ein Wort zählt als reine Tätigkeit, wenn es kaum länger ist als der Tätigkeitsstamm. */
function nurTaetigkeit(wort) {
  if (gruppenVon(wort).some(g => g >= TAETIGKEIT)) return false;
  return SYNONYME.slice(0, TAETIGKEIT).some(g => g.some(st => wort.includes(st) && wort.length - st.length <= 4));
}

/** Zwei Wörter meinen dasselbe Wort: gleich oder eines steckt im anderen (≥ 4 Buchstaben, z. B. „fenster" in „fensterreinigung"). */
const gleichesWort = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a)));

/** Einheitsklasse: nur gleiche Klassen dürfen zueinander. */
export function einheitKlasse(e) {
  const roh = String(e || '').trim();
  if (!roh) return null;
  if (/^(m²|m2|qm)$/i.test(roh)) return 'flaeche';
  if (/^(m³|m3|cbm)$/i.test(roh)) return 'volumen';
  const t = normalText(roh).replace(/\./g, '').trim();
  if (/^(std|stunde|stunden|h)$/.test(t)) return 'zeit';
  if (/^(m|lfm|meter)$/.test(t)) return 'laenge';
  if (t === '%' || t === 'prozent') return 'prozent';
  return 'anzahl';   // Stück, Stk., Pauschale, Einsatz, Raum, Etage, Monat, Tag …
}

/**
 * Wie gut passt ein Artikel zu einem Text? 2 Punkte je direkt gleichem Wort im
 * Namen, 1 je gemeinsamer Sach-Synonymgruppe, 0,5 je Wort nur in der Beschreibung.
 * Gemeinsame Tätigkeit („tauschen" ~ „wechseln") gibt 0,5 Bonus, zählt aber nicht
 * als `beleg`. `direkt`: mindestens ein Wort stimmt wirklich überein.
 */
export function passung(text, a) {
  const tw = woerter(text);
  const nw = woerter(a.name);
  const bw = woerter(a.beschreibung || '');
  let beleg = 0, bonus = 0, direkt = false;
  const gruppenText = new Set(tw.flatMap(gruppenVon));
  const gruppenName = new Set(nw.flatMap(gruppenVon));
  for (const w of tw) {
    if (nurTaetigkeit(w)) {
      // reine Tätigkeitswörter („gereinigt", „getauscht"): höchstens Bonus
      if (nw.some(n => gleichesWort(w, n))) bonus += 0.5;
      continue;
    }
    if (nw.some(n => gleichesWort(w, n))) { beleg += 2; direkt = true; }
    else if (bw.some(n => gleichesWort(w, n))) beleg += 0.5;
  }
  for (const g of gruppenText) {
    if (!gruppenName.has(g)) continue;
    if (g < TAETIGKEIT) bonus += 0.5; else beleg += 1;
  }
  return { punkte: beleg >= 1 ? beleg + bonus : beleg, beleg, direkt };
}

/**
 * Bis zu `n` Kandidaten für eine Rechnungsposition, bestes zuerst.
 * Ohne passende Einheit oder ohne jeden Treffer: leer.
 */
export function kandidatenFuer(position, artikelListe, n = 5) {
  const klasse = einheitKlasse(position.einheit);
  // Ohne Einheit lässt sich nicht prüfen, ob ein Artikel passt — dann gar keine Kandidaten.
  if (!klasse) return [];
  return artikelListe
    .filter(a => !istZuschlag(a))
    .filter(a => einheitKlasse(a.einheit) === klasse)
    .map(a => ({ a, ...passung(position.text, a) }))
    .filter(x => x.beleg >= 1)
    .sort((x, y) => y.punkte - x.punkte)
    .slice(0, n);
}

/** Kandidaten für eine freie Anweisung („nimm die Gartenpflege nach Fläche") — ohne Einheitsfilter. */
export function kandidatenFuerText(text, artikelListe, n = 8) {
  return artikelListe
    .filter(a => !istZuschlag(a))
    .map(a => ({ a, ...passung(text, a) }))
    .filter(x => x.beleg >= 1)
    .sort((x, y) => y.punkte - x.punkte)
    .slice(0, n)
    .map(x => x.a);
}

/** Schlüssel, unter dem sich die App Edins Zuordnung „dieser Text → dieser Artikel" merkt. */
export function lernSchluessel(text) {
  return woerter(String(text || '').replace(/\(arbeitszeit\)/i, '')).sort().join(' ');
}
