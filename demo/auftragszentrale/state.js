/* ============================================
   state.js — die einzige Quelle der Wahrheit

   Home, Aufträge, Kalender und Rechnungen lesen alle aus diesem
   Modul. Es gibt keine zweite Kopie eines Auftrags: die Karte, der
   Kalendereintrag und die Akte zeigen dasselbe Objekt.

   Persistenz: localStorage. Bilder werden bewusst NICHT persistiert
   (Quota ~5 MB) — nach einem Reload bleibt der Verlaufseintrag samt
   Beschriftung erhalten, das Bild selbst wird als "nur in dieser
   Sitzung" gekennzeichnet. Die UI sagt das dem Nutzer.
   ============================================ */

import { uid, parseZahl, istEmail, mengePruefen, preisPruefen } from './util.js';
import { seedAuftraege, seedRechnungen } from './seed.js';

const KEY = 'pt-auftragszentrale-v1';
const VERSION = 1;

/** Fiktiver Beispiel-Stundensatz. Wird im Entwurf sichtbar als Beispiel markiert. */
export const BEISPIEL_STUNDENSATZ = 58;

const store = { auftraege: [], rechnungen: [] };
const hoerer = new Set();

/* ── Persistenz ──────────────────────────── */

/**
 * Vor dem Schreiben in localStorage die Object-URLs entfernen.
 *
 * Die Bilddaten selbst liegen in IndexedDB (siehe fotos.js); hier bleibt nur
 * die `fotoId` stehen, über die das Bild nach einem Reload wiedergefunden wird.
 * Eine Object-URL ist nach dem Reload wertlos und darf nicht mitgespeichert werden.
 */
function fuerSpeicher(auftrag) {
  const ohneUrl = ({ src, fotoSrc, ...rest }) => rest;
  return {
    ...auftrag,
    anhaenge: (auftrag.anhaenge || []).map(ohneUrl),
    verlauf: (auftrag.verlauf || []).map(v => v.typ === 'foto' ? ohneUrl(v) : v),
  };
}

/**
 * Speicherzustand, den die UI anzeigen kann. 'fluechtig' heißt: die Änderung
 * steht in dieser Sitzung, ist aber NICHT dauerhaft gesichert. Das darf nicht
 * als Erfolg durchgehen — sonst glaubt Edin, seine Arbeit sei sicher.
 */
export const speicher = { status: 'ok', fehler: null, zuletzt: null };
const speicherHoerer = new Set();

export function onSpeicher(fn) { speicherHoerer.add(fn); return () => speicherHoerer.delete(fn); }
function meldeSpeicher() { speicherHoerer.forEach(fn => fn(speicher)); }

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      version: VERSION,
      auftraege: store.auftraege.map(fuerSpeicher),
      rechnungen: store.rechnungen,
    }));
    const vorher = speicher.status;
    speicher.status = 'ok';
    speicher.fehler = null;
    speicher.zuletzt = new Date().toISOString();
    if (vorher !== 'ok') meldeSpeicher();
    return true;
  } catch (e) {
    // Privates Fenster, volle Quota oder gesperrte Site-Daten. Die Demo läuft
    // weiter — aber die UI muss das sagen, nicht nur die Konsole.
    speicher.status = 'fluechtig';
    speicher.fehler = e && e.name === 'QuotaExceededError'
      ? 'Der lokale Speicher des Browsers ist voll.'
      : 'Der Browser lässt kein dauerhaftes Speichern zu (privates Fenster oder gesperrte Site-Daten).';
    meldeSpeicher();
    console.warn('Speichern nicht möglich — Änderungen gelten nur in dieser Sitzung.', e);
    return false;
  }
}

/** Erneuter Speicherversuch, z.B. über den Knopf im Speicher-Hinweis. */
export function erneutSpeichern() {
  const ok = save();
  if (ok) meldeSpeicher();
  return ok;
}

export function load() {
  let roh = null;
  try { roh = localStorage.getItem(KEY); } catch { roh = null; }

  if (roh) {
    try {
      const daten = JSON.parse(roh);
      if (daten && daten.version === VERSION && Array.isArray(daten.auftraege)) {
        store.auftraege  = daten.auftraege;
        store.rechnungen = Array.isArray(daten.rechnungen) ? daten.rechnungen : [];
        return;
      }
    } catch (e) {
      console.warn('Gespeicherter Stand unlesbar — starte mit Beispieldaten.', e);
    }
  }
  zuruecksetzen(false);
}

/** Beispieldaten wiederherstellen. */
export function zuruecksetzen(melden = true) {
  store.auftraege  = seedAuftraege();
  store.rechnungen = seedRechnungen();
  save();
  // Bilder liegen in IndexedDB und müssen eigens weg, sonst bleiben Waisen zurück.
  import('./fotos.js').then(f => f.alleLoeschen()).catch(() => {});
  if (melden) emit();
}

/* ── Änderungs-Benachrichtigung ──────────── */

export function subscribe(fn) { hoerer.add(fn); return () => hoerer.delete(fn); }
function emit() { hoerer.forEach(fn => fn()); }

/** Speichern + alle Ansichten neu zeichnen. Jede Mutation endet hier. */
function commit() { save(); emit(); }

/* ── Aufträge lesen ──────────────────────── */

export const alleAuftraege = () => store.auftraege;
export const auftrag = (id) => store.auftraege.find(a => a.id === id) || null;

export const STATUS = {
  geplant:  { label: 'Geplant',   art: 'geplant' },
  inarbeit: { label: 'In Arbeit', art: 'arbeit'  },
  erledigt: { label: 'Erledigt',  art: 'fertig'  },
};

export const auftraegeNachStatus = (status) =>
  store.auftraege.filter(a => a.status === status).sort(nachTermin);

/** Aufträge ohne Termin ans Ende, sonst chronologisch. */
export function nachTermin(a, b) {
  if (!a.termin && !b.termin) return 0;
  if (!a.termin) return 1;
  if (!b.termin) return -1;
  return a.termin.localeCompare(b.termin);
}

/* ── Aufträge schreiben ──────────────────── */

export function auftragAnlegen(daten) {
  const neu = {
    id: uid('a'),
    kunde: '', ansprechpartner: '', email: '', telefon: '', adresse: '',
    aufgabe: '', termin: '',
    status: 'geplant',
    erfasstUeber: 'manuell',
    anhaenge: [],
    verlauf: [],
    abschluss: null,
    rechnungId: null,
    angelegtAm: new Date().toISOString(),
    ...daten,
  };
  store.auftraege.push(neu);
  commit();
  return neu;
}

export function auftragUpdate(id, patch) {
  const a = auftrag(id);
  if (!a) return null;
  Object.assign(a, patch);
  commit();
  return a;
}

export function statusSetzen(id, status) {
  if (!STATUS[status]) return null;
  return auftragUpdate(id, { status });
}

/** Abschließen: Ergebnis und offene Punkte festhalten, Status auf erledigt. */
export function auftragAbschliessen(id, { ergebnis, offenePunkte }) {
  return auftragUpdate(id, {
    status: 'erledigt',
    abschluss: { am: new Date().toISOString(), ergebnis, offenePunkte: offenePunkte || [] },
  });
}

/* ── Dokumentationsverlauf ───────────────── */

export function verlaufHinzufuegen(auftragId, eintrag) {
  const a = auftrag(auftragId);
  if (!a) return null;
  const neu = { id: uid('v'), ts: new Date().toISOString(), simuliert: false, ...eintrag };
  a.verlauf.push(neu);
  commit();
  return neu;
}

export function verlaufUpdate(auftragId, eintragId, patch) {
  const a = auftrag(auftragId);
  const e = a && a.verlauf.find(v => v.id === eintragId);
  if (!e) return null;
  Object.assign(e, patch);
  commit();
  return e;
}

export function verlaufEntfernen(auftragId, eintragId) {
  const a = auftrag(auftragId);
  if (!a) return false;
  const i = a.verlauf.findIndex(v => v.id === eintragId);
  if (i < 0) return false;
  a.verlauf.splice(i, 1);
  commit();
  return true;
}

/** Summe aller dokumentierten Stunden — für Karten und Akte. */
export const summeStunden = (a) =>
  (a.verlauf || []).filter(v => v.typ === 'zeit')
    .reduce((s, v) => s + (Number(v.stunden) || 0), 0);

export const offenePunkte = (a) =>
  (a.verlauf || []).filter(v => v.typ === 'offen');

/* ── Rechnungen lesen ────────────────────── */

export const alleRechnungen = () => store.rechnungen;
export const rechnung = (id) => store.rechnungen.find(r => r.id === id) || null;
export const rechnungZuAuftrag = (auftragId) =>
  store.rechnungen.find(r => r.auftragId === auftragId) || null;

/**
 * Rechnungsstatus eines Auftrags — bewusst unabhängig vom Arbeitsstatus.
 * 'keine' → noch kein Entwurf, 'entwurf' → in Bearbeitung, 'versendet' → Demo-Versand bestätigt.
 */
export function rechnungsStatus(auftragId) {
  const r = rechnungZuAuftrag(auftragId);
  if (!r) return 'keine';
  return r.status === 'versendet' ? 'versendet' : 'entwurf';
}

export const RECHNUNGSSTATUS = {
  keine:     { label: 'Keine Rechnung',   art: 'neutral' },
  entwurf:   { label: 'Entwurf',          art: 'geplant' },
  versendet: { label: 'Versendet (Demo)', art: 'fertig'  },
};

/**
 * Summen einer Rechnung. `vollstaendig` ist false, sobald eine Position
 * keine Menge oder keinen Preis hat — dann wird bewusst kein Betrag behauptet.
 */
export function summen(r) {
  let netto = 0, vollstaendig = true, luecken = 0;
  for (const p of r.positionen) {
    // Nur was die Validierung passiert, darf in die Summe. Eine negative
    // Menge würde sonst als Gutschrift durchgehen, die es hier nicht gibt.
    const m = mengePruefen(p.menge), pr = preisPruefen(p.preis);
    if (m.status !== 'ok' || pr.status !== 'ok') { vollstaendig = false; luecken++; continue; }
    netto += m.wert * pr.wert;
  }
  const ust = netto * (r.ustSatz / 100);
  return { netto, ust, brutto: netto + ust, vollstaendig, luecken };
}

/* ── Rechnungen schreiben ────────────────── */

/**
 * Entwurf für einen erledigten Auftrag öffnen.
 * Existiert bereits einer, wird GENAU DIESER zurückgegeben — es entsteht
 * nie eine zweite Rechnung zum selben Auftrag und nichts wird neu generiert.
 */
export function rechnungOeffnenOderErstellen(auftragId) {
  const vorhanden = rechnungZuAuftrag(auftragId);
  if (vorhanden) return { rechnung: vorhanden, neu: false };

  const a = auftrag(auftragId);
  if (!a) return { rechnung: null, neu: false };

  const neu = {
    id: uid('r'),
    auftragId,
    nummer: naechsteNummer(),
    datum: new Date().toISOString(),
    status: 'entwurf',
    empfaenger: {
      name: a.kunde, ansprechpartner: a.ansprechpartner,
      email: a.email, adresse: a.adresse,
    },
    positionen: positionenAusVerlauf(a),
    ustSatz: 19,
    versand: null,
    erstelltAm: new Date().toISOString(),
  };
  store.rechnungen.push(neu);
  a.rechnungId = neu.id;
  commit();
  return { rechnung: neu, neu: true };
}

function naechsteNummer() {
  const jahr = new Date().getFullYear();
  const n = store.rechnungen.length + 42; // fiktiver Startzähler
  return `E-${jahr}-${String(n).padStart(4, '0')}`;
}

/**
 * Positionen aus dem, was tatsächlich dokumentiert wurde.
 *
 * Bewusst NICHT aus der vereinbarten Aufgabe: angefragte Arbeit ist nicht
 * automatisch ausgeführte Arbeit. Jeder Verlaufseintrag wird genau einmal
 * übernommen (nachvollziehbar über quelleEintragId), Notizen und offene
 * Punkte werden nicht zu Positionen — sie erscheinen im Entwurf als
 * Referenz bzw. als Abweichung.
 */
function positionenAusVerlauf(a) {
  const pos = [];
  const gesehen = new Set();

  for (const v of a.verlauf) {
    if (gesehen.has(v.id)) continue;
    gesehen.add(v.id);

    if (v.typ === 'zeit') {
      pos.push({
        id: uid('p'),
        text: (v.text || 'Arbeitszeit') + ' (Arbeitszeit)',
        menge: Number(v.stunden) || null,
        einheit: 'Std.',
        preis: BEISPIEL_STUNDENSATZ,
        preisIstBeispiel: true,
        herkunft: 'dokumentiert',
        quelleEintragId: v.id,
        zusatz: false,
      });
    } else if (v.typ === 'material') {
      pos.push({
        id: uid('p'),
        text: v.text || 'Material',
        menge: Number(v.menge) || null,
        einheit: v.einheit || 'Stück',
        preis: null, // Materialpreis kennt nur Edin — bleibt bewusst offen
        herkunft: 'dokumentiert',
        quelleEintragId: v.id,
        zusatz: false,
      });
    }
  }
  return pos;
}

/**
 * Welche dokumentierten Leistungen stehen (noch) nicht im Entwurf?
 *
 * Wird Dokumentation nachgetragen, nachdem der Entwurf schon existiert, ging das
 * bisher still unter. Der Abgleich macht es sichtbar — ohne etwas zu überschreiben,
 * was Edin von Hand korrigiert hat.
 */
export function entwurfAbgleich(r) {
  const a = auftrag(r.auftragId);
  if (!a || istVersendet(r)) return { nachgetragen: [], entfernt: [] };

  const imEntwurf = new Set(r.positionen.map(p => p.quelleEintragId).filter(Boolean));

  const nachgetragen = a.verlauf.filter(v =>
    (v.typ === 'zeit' || v.typ === 'material') && !imEntwurf.has(v.id));

  // Positionen, deren Quelle inzwischen aus der Dokumentation gelöscht wurde.
  const imVerlauf = new Set(a.verlauf.map(v => v.id));
  const entfernt = r.positionen.filter(p => p.quelleEintragId && !imVerlauf.has(p.quelleEintragId));

  return { nachgetragen, entfernt };
}

/** Übernimmt genau die angegebenen Verlaufseinträge als neue Positionen. */
export function positionenNachtragen(rechnungId, eintragIds) {
  const r = rechnung(rechnungId);
  if (!r || istVersendet(r)) return 0;
  const a = auftrag(r.auftragId);
  if (!a) return 0;

  const vorhanden = new Set(r.positionen.map(p => p.quelleEintragId).filter(Boolean));
  const zuErgaenzen = a.verlauf.filter(v => eintragIds.includes(v.id) && !vorhanden.has(v.id));
  if (!zuErgaenzen.length) return 0;

  r.positionen.push(...positionenAusVerlauf({ verlauf: zuErgaenzen }));
  commit();
  return zuErgaenzen.length;
}

export function rechnungUpdate(id, patch) {
  const r = rechnung(id);
  if (!r) return null;
  // Auch eine noch offene Editor-Ebene darf einen herausgegebenen Beleg nicht mehr anfassen.
  if (istVersendet(r)) return null;
  Object.assign(r, patch);
  commit();
  return r;
}

export function positionUpdate(rechnungId, posId, patch) {
  const r = rechnung(rechnungId);
  if (istVersendet(r)) return null;
  const p = r && r.positionen.find(x => x.id === posId);
  if (!p) return null;
  Object.assign(p, patch);
  // Sobald Edin den Preis anfasst, ist es kein Beispielwert mehr.
  if ('preis' in patch) p.preisIstBeispiel = false;
  commit();
  return p;
}

export function positionHinzufuegen(rechnungId) {
  const r = rechnung(rechnungId);
  if (!r || istVersendet(r)) return null;
  const p = {
    id: uid('p'), text: '', menge: null, einheit: 'Std.', preis: null,
    herkunft: 'manuell', quelleEintragId: null, zusatz: false,
  };
  r.positionen.push(p);
  commit();
  return p;
}

export function positionEntfernen(rechnungId, posId) {
  const r = rechnung(rechnungId);
  if (!r || istVersendet(r)) return false;
  const i = r.positionen.findIndex(p => p.id === posId);
  if (i < 0) return false;
  r.positionen.splice(i, 1);
  commit();
  return true;
}

/**
 * Was vor dem simulierten Versand noch fehlt. Leeres Array = versandbereit.
 * Es wird nichts verschickt und nichts geöffnet — nur der Status wechselt.
 */
export function versandHindernisse(r) {
  const fehlt = [];
  if (!r.empfaenger.name?.trim()) fehlt.push('Kunde / Organisation fehlt');

  const mail = r.empfaenger.email?.trim();
  if (!mail)             fehlt.push('E-Mail-Adresse des Empfängers fehlt');
  else if (!istEmail(mail)) fehlt.push(`„${mail}" ist keine gültige E-Mail-Adresse`);

  if (!r.positionen.length) fehlt.push('Die Rechnung hat keine Positionen');

  r.positionen.forEach((p, i) => {
    const nr = `Position ${i + 1}`;
    if (!p.text?.trim()) fehlt.push(`${nr}: Leistungsbeschreibung fehlt`);

    const m = mengePruefen(p.menge);
    if (m.status === 'leer')      fehlt.push(`${nr}: Menge fehlt`);
    else if (m.status !== 'ok')   fehlt.push(`${nr}: Menge — ${m.hinweis.toLowerCase()}`);

    const pr = preisPruefen(p.preis);
    if (pr.status === 'leer')     fehlt.push(`${nr}: Preis fehlt`);
    else if (pr.status !== 'ok')  fehlt.push(`${nr}: Preis — ${pr.hinweis.toLowerCase()}`);
  });
  return fehlt;
}

/**
 * Friert den vollständigen Belegstand ein.
 *
 * Ohne diesen Schnappschuss läse die Vorschau Aufgabe und Termin weiterhin live
 * aus dem Auftrag — eine Korrektur nach dem Versand würde dann rückwirkend eine
 * bereits herausgegebene Rechnung verändern. Alles, was auf dem Beleg steht,
 * wird deshalb hier kopiert, nicht referenziert.
 */
function belegEinfrieren(r) {
  const a = auftrag(r.auftragId);
  const s = summen(r);
  return {
    eingefrorenAm: new Date().toISOString(),
    nummer: r.nummer,
    datum: r.datum,
    ustSatz: r.ustSatz,
    // Tiefe Kopien — spätere Änderungen am Auftrag laufen ins Leere.
    empfaenger: { ...r.empfaenger },
    positionen: r.positionen.map(p => ({ ...p })),
    summen: { netto: s.netto, ust: s.ust, brutto: s.brutto },
    // Aus dem Auftrag übernommen, damit der Beleg sich selbst erklärt.
    auftragAufgabe: a?.aufgabe ?? '',
    auftragErgebnis: a?.abschluss?.ergebnis ?? '',
    leistungsdatum: a?.termin ?? null,
    offenePunkte: a ? offenePunkte(a).map(o => o.text) : [],
  };
}

/** True, sobald der Beleg herausgegeben ist — dann ist nichts mehr änderbar. */
export const istVersendet = (r) => !!r && r.status === 'versendet';

/**
 * Setzt "Versendet (Demo)". Der Arbeitsstatus des Auftrags bleibt unberührt.
 * Prüft unmittelbar vor der Statusänderung noch einmal — zwischen dem Öffnen
 * der Vorschau und dem Bestätigen kann sich die Rechnung geändert haben.
 */
export function versandSimulieren(rechnungId, nachricht) {
  const r = rechnung(rechnungId);
  if (!r) return { ok: false, hindernisse: ['Rechnung nicht gefunden'] };
  if (istVersendet(r)) return { ok: false, hindernisse: ['Diese Rechnung wurde bereits versendet'] };

  const hindernisse = versandHindernisse(r);
  if (hindernisse.length) return { ok: false, hindernisse };

  r.beleg = belegEinfrieren(r);
  r.status = 'versendet';
  r.versand = { ...nachricht, am: new Date().toISOString() };
  commit();
  return { ok: true, rechnung: r, hindernisse: [] };
}
