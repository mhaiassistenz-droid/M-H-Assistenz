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

import { uid, parseZahl, istEmail, mengePruefen, preisPruefen, tagKey } from './util.js';

const KEY = 'pt-auftragszentrale-v1';
// Version 2 (28.09.2026): die App startet leer. Ein gespeicherter Stand mit
// anderer Version wird verworfen, damit keine alten Beispielaufträge übrig bleiben.
// Version 3 (30.09.2026): Zeit- und Materialeinträge tragen eine `kostenstelle`
// (String oder null = „noch zuordnen"); Positionen übernehmen sie. Fachregel 12:
// bewusst erhöht — jeder Browser beginnt danach leer. Ebenfalls mit Version 3:
// ein lokaler Kundenstamm (`kunden`), der wie alles andere leer beginnt.
const VERSION = 3;

/** Längste zulässige Kostenstellen-Bezeichnung. */
const KOSTENSTELLE_MAX = 60;

/** Fiktiver Beispiel-Stundensatz. Wird im Entwurf sichtbar als Beispiel markiert. */
export const BEISPIEL_STUNDENSATZ = 58;

const store = { auftraege: [], rechnungen: [], kunden: [], aufgaben: [] };
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
      kunden: store.kunden,
      aufgaben: store.aufgaben,
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
        store.kunden     = Array.isArray(daten.kunden) ? daten.kunden : [];
        // Aufgaben kamen nach dem Ausliefern von Version 3 dazu (30.09.2026). Bewusst
        // KEIN Versionssprung: die Liste ist rein additiv, ein älterer Stand lädt
        // einfach ohne sie. Ein Sprung hätte jeden Browser — auch Edins — geleert.
        store.aufgaben   = Array.isArray(daten.aufgaben) ? daten.aufgaben : [];
        return;
      }
    } catch (e) {
      console.warn('Gespeicherter Stand unlesbar — starte leer.', e);
    }
  }
  zuruecksetzen(false);
}

/** Alles löschen: keine Aufträge, keine Rechnungen. Es gibt keine Beispieldaten mehr. */
export function zuruecksetzen(melden = true) {
  store.auftraege  = [];
  store.rechnungen = [];
  store.kunden     = [];
  store.aufgaben   = [];
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

/* ── Kundenstamm ─────────────────────────── */

/*
 * Wiederkehrende Auftraggeber wie die Diakonie: Name, Ansprechpartner, Kontakt und
 * Rechnungsadresse stehen einmal hier und werden beim Erfassen vorgeschlagen. Die
 * Objektadresse bleibt Sache des Auftrags — ein Kunde hat oft mehrere Objekte
 * (`objekte` sind nur Vorschläge). `kostenstellen` sind die Vorschläge für die
 * Zuordnung einzelner Tätigkeiten (Schritt 2).
 *
 * Fachregel 12: der Stamm beginnt leer. Beispielkunden gibt es nur in tests/seed.js.
 */
export const alleKunden = () => [...store.kunden].sort((a, b) => a.name.localeCompare(b.name, 'de'));
export const kunde = (id) => store.kunden.find(k => k.id === id) || null;

const kundeSauber = (d) => ({
  name: String(d.name || '').trim(),
  ansprechpartner: String(d.ansprechpartner || '').trim(),
  email: String(d.email || '').trim(),
  telefon: String(d.telefon || '').trim(),
  rechnungsadresse: String(d.rechnungsadresse || '').trim(),
  objekte: [...new Set((d.objekte || []).map(o => String(o).trim()).filter(Boolean))],
  kostenstellen: [...new Set((d.kostenstellen || []).map(kostenstelleNormal).filter(Boolean))],
});

/** Legt einen Kunden an — oder ergänzt den vorhandenen gleichen Namens, statt ihn zu doppeln. */
export function kundeMerken(daten) {
  const neu = kundeSauber(daten);
  if (!neu.name) return null;
  const vorhanden = store.kunden.find(k => k.name.toLowerCase() === neu.name.toLowerCase());
  if (vorhanden) {
    // Nur Lücken füllen und Listen ergänzen — gespeicherte Angaben nicht still ersetzen.
    for (const f of ['ansprechpartner', 'email', 'telefon', 'rechnungsadresse']) {
      if (!vorhanden[f] && neu[f]) vorhanden[f] = neu[f];
    }
    vorhanden.objekte = [...new Set([...(vorhanden.objekte || []), ...neu.objekte])];
    vorhanden.kostenstellen = [...new Set([...(vorhanden.kostenstellen || []), ...neu.kostenstellen])];
    commit();
    return vorhanden;
  }
  const k = { id: uid('k'), ...neu };
  store.kunden.push(k);
  commit();
  return k;
}

/* ── Aufgaben ────────────────────────────── */

/*
 * Dinge, die zu erledigen sind, aber keine Arbeit vor Ort und keine Rechnungsposition:
 * „Zaunpfosten nachbestellen", „Silikon kaufen". Optional an einen Auftrag gebunden.
 * Abgehakte bleiben einen Tag sichtbar (zum Rückgängigmachen) und verschwinden dann
 * aus der Liste. Ob etwas eine Aufgabe ist, entscheidet Edin — die App rät das nicht.
 */
const AUFGABE_SICHTBAR_MS = 24 * 60 * 60 * 1000;

/** Offene Aufgaben zuerst (älteste oben), danach die heute abgehakten. */
export function sichtbareAufgaben(jetzt = Date.now()) {
  const offen = store.aufgaben.filter(x => !x.erledigtAm)
    .sort((a, b) => (a.angelegtAm || '').localeCompare(b.angelegtAm || ''));
  const kuerzlich = store.aufgaben
    .filter(x => x.erledigtAm && jetzt - Date.parse(x.erledigtAm) < AUFGABE_SICHTBAR_MS)
    .sort((a, b) => (b.erledigtAm || '').localeCompare(a.erledigtAm || ''));
  return { offen, kuerzlich };
}

export const offeneAufgaben = () => store.aufgaben.filter(x => !x.erledigtAm);
/** Die Aufgabe, die aus einem Dokumentationseintrag entstand — damit sie nicht doppelt entsteht. */
export const aufgabeZuEintrag = (eintragId) => store.aufgaben.find(x => x.quelleEintragId === eintragId) || null;
export const aufgabenZuAuftrag = (auftragId) => store.aufgaben.filter(x => x.auftragId === auftragId && !x.erledigtAm);

/*
 * Beim Einsprechen ausdrücklich als Aufgabe Gesagtes herausfinden:
 * „Als Aufgabe muss noch der Zaunpfosten bestellt werden", „Aufgabe: Silikon kaufen",
 * „Neue Aufgabe Leiter zurückbringen", „… auf die Aufgabenliste".
 * Nur mit diesem Stichwort — sonst würde geraten, was eine Aufgabe ist (Fachregel 5).
 * Das Ergebnis ist ein Vorschlag; Edin bestätigt oder korrigiert ihn in der Prüfansicht.
 */
const AUFGABE_STICHWORT = /\b(?:als|neue)\s+aufgabe\b\s*[:,–-]?\s*|\baufgabe\s*[:–-]\s*|\b(?:auf\s+die\s+aufgabenliste|zu\s+den\s+aufgaben)\b\s*[:,–-]?\s*/i;

export function aufgabenAusTranskript(text) {
  const saetze = String(text || '').split(/(?<=[.!?])\s+|\n+/);
  const gefunden = [];
  for (const satz of saetze) {
    const m = satz.match(AUFGABE_STICHWORT);
    if (!m) continue;
    const rest = `${satz.slice(0, m.index)} ${satz.slice(m.index + m[0].length)}`
      .replace(/\s+/g, ' ').trim()
      .replace(/^[,:;–-]\s*/, '').replace(/[.!?,;]+$/, '')
      // „…, das kommt auf die Aufgabenliste" — Füllrest ohne Inhalt
      .replace(/,?\s*(?:das|dies|es)\s+(?:kommt|geht|muss)\s*$/i, '').trim();
    if (rest.length < 3) continue;
    gefunden.push(rest.charAt(0).toUpperCase() + rest.slice(1));
  }
  return [...new Set(gefunden)];
}

export function aufgabeAnlegen({ text, auftragId = null, quelleEintragId = null }) {
  // Großzügige Grenze nur gegen Missbrauch — normale Notizen werden nie gekürzt.
  const t = String(text || '').trim().slice(0, 2000);
  if (!t) return null;
  const neu = {
    id: uid('t'), text: t,
    auftragId: auftragId && auftrag(auftragId) ? auftragId : null,
    quelleEintragId: quelleEintragId || null,
    angelegtAm: new Date().toISOString(), erledigtAm: null,
  };
  store.aufgaben.push(neu);
  commit();
  return neu;
}

/** Abhaken oder zurücknehmen. */
export function aufgabeErledigt(id, erledigt = true) {
  const x = store.aufgaben.find(a => a.id === id);
  if (!x) return null;
  x.erledigtAm = erledigt ? new Date().toISOString() : null;
  commit();
  return x;
}

export function aufgabeEntfernen(id) {
  const i = store.aufgaben.findIndex(a => a.id === id);
  if (i < 0) return false;
  store.aufgaben.splice(i, 1);
  commit();
  return true;
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
  // Eine offene Aufgabe, die aus diesem Eintrag entstand, folgt seiner Korrektur —
  // sonst stünde in „Aufgaben" weiter der alte Wortlaut. Erledigte bleiben, wie sie waren.
  if (typeof patch.text === 'string' && patch.text.trim()) {
    const t = store.aufgaben.find(x => x.quelleEintragId === eintragId && !x.erledigtAm);
    if (t) t.text = patch.text.trim().slice(0, 2000);
  }
  commit();
  return e;
}

/* Bewusst: Eine Aufgabe, die aus diesem Eintrag entstand, bleibt beim Löschen erhalten.
   Wer eine Notiz entfernt, soll nicht nebenbei eine offene Aufgabe verlieren. */
export function verlaufEntfernen(auftragId, eintragId) {
  const a = auftrag(auftragId);
  if (!a) return false;
  const i = a.verlauf.findIndex(v => v.id === eintragId);
  if (i < 0) return false;
  a.verlauf.splice(i, 1);
  commit();
  return true;
}

/* ── Tätigkeiten und Kostenstellen ───────── */

/** Leer heißt „noch zuordnen" (null) — nie ein geratener Wert. */
export function kostenstelleNormal(v) {
  const t = typeof v === 'string' ? v.trim().slice(0, KOSTENSTELLE_MAX) : '';
  return t || null;
}

/** Alle in diesem Auftrag schon vergebenen Kostenstellen, zum Wiederverwenden. */
export const kostenstellenImAuftrag = (a) =>
  [...new Set([
    ...(a?.kundeId ? kunde(a.kundeId)?.kostenstellen || [] : []),
    ...(a?.verlauf || []).map(v => v.kostenstelle),
  ].filter(Boolean))].sort((x, y) => x.localeCompare(y, 'de'));

/** Zeit- und Materialeinträge, denen noch keine Kostenstelle zugeordnet ist. */
export const ohneKostenstelle = (a) =>
  (a?.verlauf || []).filter(v => (v.typ === 'zeit' || v.typ === 'material') && !v.kostenstelle);

const RUNDUNG = 1e-9;

/**
 * Teilt einen Zeiteintrag in einzelne Tätigkeiten.
 *
 * Eine nur insgesamt genannte Zeit wird NICHT verteilt (Fachregel 5): Tätigkeiten
 * ohne eigene Stunden bleiben „Zeit offen" (stunden: null), und was von der
 * Gesamtzeit nicht ausdrücklich zugeordnet wurde, bleibt als eigener Eintrag
 * „Nicht verteilte Einsatzzeit" sichtbar stehen. So geht keine Stunde verloren
 * und keine wird erfunden.
 *
 * @param {Array<{text:string, stunden:number|null, kostenstelle:string|null}>} teile
 * @returns {{ok:boolean, grund?:string, ids?:string[]}}
 */
export function taetigkeitTeilen(auftragId, eintragId, teile) {
  const a = auftrag(auftragId);
  const i = a ? a.verlauf.findIndex(v => v.id === eintragId) : -1;
  if (i < 0) return { ok: false, grund: 'Eintrag nicht gefunden' };
  const alt = a.verlauf[i];
  if (alt.typ !== 'zeit') return { ok: false, grund: 'Nur Arbeitszeit lässt sich aufteilen' };
  if (!Array.isArray(teile) || teile.length < 2) return { ok: false, grund: 'Bitte mindestens zwei Tätigkeiten angeben' };

  const sauber = [];
  for (const [n, t] of teile.entries()) {
    const text = String(t.text || '').trim();
    if (!text) return { ok: false, grund: `Tätigkeit ${n + 1}: Beschreibung fehlt` };
    const std = t.stunden === null || t.stunden === undefined || t.stunden === '' ? null : Number(t.stunden);
    if (std !== null && !(Number.isFinite(std) && std > 0)) {
      return { ok: false, grund: `Tätigkeit ${n + 1}: Stunden müssen größer als 0 sein oder leer bleiben` };
    }
    sauber.push({ text, stunden: std, kostenstelle: kostenstelleNormal(t.kostenstelle) });
  }

  const gesamt = Number(alt.stunden) > 0 ? Number(alt.stunden) : null;
  const verteilt = sauber.reduce((s, t) => s + (t.stunden || 0), 0);
  if (gesamt !== null && verteilt > gesamt + RUNDUNG) {
    return { ok: false, grund: 'Die Einzelzeiten ergeben mehr als die erfasste Gesamtzeit. '
      + 'Bitte zuerst die Gesamtzeit korrigieren.' };
  }

  const basis = { typ: 'zeit', ts: alt.ts, simuliert: !!alt.simuliert, geteiltAus: alt.id };
  const neu = sauber.map(t => ({ ...basis, id: uid('v'), ...t }));
  const rest = gesamt !== null ? Math.round((gesamt - verteilt) * 100) / 100 : 0;
  if (rest > 0) {
    neu.push({ ...basis, id: uid('v'), text: `Nicht verteilte Einsatzzeit (${alt.text || 'Arbeitszeit'})`,
      stunden: rest, kostenstelle: null, nichtVerteilt: true });
  }
  a.verlauf.splice(i, 1, ...neu);
  commit();
  return { ok: true, ids: neu.map(v => v.id) };
}

/**
 * Führt Zeiteinträge wieder zusammen. Nur wenn alle Stunden bekannt sind — sonst
 * entstünde eine Summe, die niemand so angegeben hat. Die Kostenstelle bleibt nur
 * erhalten, wenn alle dieselbe haben; sonst ist sie wieder „noch zuordnen".
 */
export function taetigkeitenZusammenfuehren(auftragId, eintragIds) {
  const a = auftrag(auftragId);
  if (!a) return { ok: false, grund: 'Auftrag nicht gefunden' };
  const teile = a.verlauf.filter(v => eintragIds.includes(v.id));
  if (teile.length < 2) return { ok: false, grund: 'Bitte mindestens zwei Tätigkeiten auswählen' };
  if (teile.some(v => v.typ !== 'zeit')) return { ok: false, grund: 'Nur Arbeitszeiten lassen sich zusammenführen' };
  if (teile.some(v => !(Number(v.stunden) > 0))) {
    return { ok: false, grund: 'Bei mindestens einer Tätigkeit ist die Zeit noch offen. '
      + 'Bitte zuerst eintragen — sonst stimmt die Summe nicht.' };
  }
  const ks = new Set(teile.map(v => v.kostenstelle || null));
  const zusammen = {
    id: uid('v'), typ: 'zeit', ts: teile[0].ts, simuliert: teile.some(v => v.simuliert),
    text: teile.map(v => v.text).filter(Boolean).join('; '),
    stunden: Math.round(teile.reduce((s, v) => s + Number(v.stunden), 0) * 100) / 100,
    kostenstelle: ks.size === 1 ? [...ks][0] : null,
  };
  a.verlauf = a.verlauf.filter(v => !eintragIds.includes(v.id) || v.id === teile[0].id);
  a.verlauf.splice(a.verlauf.findIndex(v => v.id === teile[0].id), 1, zusammen);
  commit();
  return { ok: true, id: zusammen.id };
}

/* ── Einsatzbericht (Schritt 4) ─────────── */

/*
 * Der Bericht besteht ausschließlich aus dem, was dokumentiert und von Edin
 * übernommen wurde — wie der Rechnungsentwurf (Fachregel 3). Die vereinbarte
 * Aufgabe steht getrennt als Referenz daneben, nie als erledigte Arbeit.
 *
 * Auswahl je Eintrag über `imBericht`: Fotos sind standardmäßig drin, Notizen
 * standardmäßig nicht (oft intern). „Wichtig"-Hinweise und Sprach-Transkripte sind
 * interne Arbeitsnotizen und kommen nie in den Bericht.
 */
export const imBericht = (v) =>
  v.typ === 'foto' ? v.imBericht !== false
  : v.typ === 'notiz' ? v.imBericht === true
  : v.typ === 'zeit' || v.typ === 'material' || v.typ === 'offen';

/** Alles, was auf dem Bericht steht — als reine Daten, damit es sich einfrieren lässt. */
export function berichtDaten(a) {
  const drin = (a.verlauf || []).filter(imBericht);
  const kopie = (v) => ({ id: v.id, text: v.text || '', beispiel: !!v.simuliert });
  return {
    kunde: a.kunde || '',
    objekt: a.adresse || '',
    termin: a.termin || null,
    aufgabe: a.aufgabe || '',
    arbeiten: drin.filter(v => v.typ === 'zeit').map(v => ({ ...kopie(v),
      stunden: Number(v.stunden) > 0 ? Number(v.stunden) : null, kostenstelle: v.kostenstelle ?? null })),
    material: drin.filter(v => v.typ === 'material').map(v => ({ ...kopie(v),
      menge: Number(v.menge) > 0 ? Number(v.menge) : null, einheit: v.einheit || '', kostenstelle: v.kostenstelle ?? null })),
    stundenGesamt: summeStunden(a),
    ergebnis: a.abschluss?.ergebnis || '',
    offen: drin.filter(v => v.typ === 'offen').map(kopie),
    anmerkungen: drin.filter(v => v.typ === 'notiz').map(kopie),
    fotos: drin.filter(v => v.typ === 'foto').map(v => ({ ...kopie(v), fotoId: v.fotoId || null, fotoUrl: v.fotoUrl || null })),
  };
}

/* ── Bestätigte Berichtsfassungen (Schritt 5) ── */

/*
 * Ein bestätigter Bericht ändert sich nicht rückwirkend — dasselbe Prinzip wie der
 * eingefrorene Beleg (Fachregel 4). `berichtBestaetigen` legt eine tiefe Kopie
 * genau der Fassung ab, die der Kunde gesehen hat. Spätere Dokumentation erscheint
 * nur als Nachtrag (`berichtNachtraege`); eine neue Bestätigung erzeugt eine weitere
 * Fassung, die alte bleibt unverändert stehen.
 *
 * Die Unterschrift selbst ist ein Bild und liegt in IndexedDB (fotos.js); hier steht
 * nur ihre ID. Alles liegt ausschließlich in diesem Browser — kein Archiv.
 */
const tiefeKopie = (x) => JSON.parse(JSON.stringify(x));

export const berichtFassungen = (a) => a?.berichte || [];
export const letzteFassung = (a) => berichtFassungen(a).at(-1) || null;

/** Gleicht die gezeigte Fassung mit dem aktuellen Stand ab — gezeigt = bestätigt. */
export const berichtUnveraendert = (a, gezeigt) =>
  JSON.stringify(berichtDaten(a)) === JSON.stringify(gezeigt);

/**
 * @param {object} o
 * @param {object} o.gezeigt       genau die Daten, die dem Kunden angezeigt wurden
 * @param {string} o.name          wer bestätigt
 * @param {string|null} o.unterschriftId  Bild in IndexedDB
 * @param {boolean} [o.nurDieseSitzung]   Bild konnte nicht dauerhaft gespeichert werden
 */
export function berichtBestaetigen(auftragId, { gezeigt, name, unterschriftId, nurDieseSitzung = false }) {
  const a = auftrag(auftragId);
  if (!a) return { ok: false, grund: 'Auftrag nicht gefunden' };
  const wer = String(name || '').trim();
  if (!wer) return { ok: false, grund: 'Bitte den Namen der Person eintragen, die bestätigt.' };
  if (!gezeigt || !berichtUnveraendert(a, gezeigt)) {
    return { ok: false, grund: 'Der Bericht hat sich geändert, seit er angezeigt wurde. Bitte erneut öffnen und zeigen.' };
  }
  const fassung = {
    id: uid('b'),
    nummer: berichtFassungen(a).length + 1,
    am: new Date().toISOString(),
    name: wer,
    unterschriftId: unterschriftId || null,
    nurDieseSitzung: !!nurDieseSitzung,
    stand: tiefeKopie(gezeigt),
  };
  a.berichte = [...berichtFassungen(a), fassung];
  commit();
  return { ok: true, fassung };
}

/**
 * Was sich seit der letzten bestätigten Fassung geändert hat — nur zur Anzeige als
 * Nachtrag. Die Fassung selbst wird nie angefasst.
 */
export function berichtNachtraege(a) {
  const f = letzteFassung(a);
  if (!f) return null;
  const jetzt = berichtDaten(a);
  const eintraege = (b) => ['arbeiten', 'material', 'offen', 'anmerkungen', 'fotos']
    .flatMap(k => (b[k] || []).map(x => ({ ...x, bereich: k })));
  const vorher = new Map(eintraege(f.stand).map(x => [x.id, x]));
  const nachher = new Map(eintraege(jetzt).map(x => [x.id, x]));
  const neu = [...nachher.values()].filter(x => !vorher.has(x.id));
  const entfernt = [...vorher.values()].filter(x => !nachher.has(x.id));
  const geaendert = [...nachher.values()].filter(x => vorher.has(x.id)
    && JSON.stringify(vorher.get(x.id)) !== JSON.stringify(x));
  const kopf = ['kunde', 'objekt', 'termin', 'ergebnis'].filter(k => (f.stand[k] ?? '') !== (jetzt[k] ?? ''));
  return { neu, geaendert, entfernt, kopf, leer: !neu.length && !geaendert.length && !entfernt.length && !kopf.length };
}

/** Foto oder Notiz in den Bericht aufnehmen bzw. herausnehmen. */
export function berichtAuswahl(auftragId, eintragId, an) {
  return verlaufUpdate(auftragId, eintragId, { imBericht: !!an });
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
  // 'gestellt' = echt über den Rechnungsdienst versendet. Ohne diesen Zweig hieße
  // eine herausgegebene Rechnung auf der Karte „Entwurf" (Befund 28.09.2026).
  // 'erstellt' bleibt bewusst Entwurf: der Versand muss noch nachgeholt werden.
  return r.status === 'versendet' || r.status === 'gestellt' ? r.status : 'entwurf';
}

export const RECHNUNGSSTATUS = {
  keine:     { label: 'Keine Rechnung',   art: 'neutral' },
  entwurf:   { label: 'Entwurf',          art: 'geplant' },
  // Die Rechnung liegt im Rechnungsdienst, ist aber noch nicht beim Kunden.
  // Eigener Zustand, weil beides falsch waere: als „Versendet" gefuehrt liefe
  // ihr niemand hinterher, als „Entwurf" entstuende beim naechsten Versuch
  // eine zweite Rechnung.
  erstellt:  { label: 'Erstellt',         art: 'geplant' },
  versendet: { label: 'Versendet (Demo)', art: 'fertig'  },
  gestellt:  { label: 'Versendet',        art: 'fertig'  },
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
      // Abweichende Rechnungsadresse (z. B. Hauptverwaltung) vor der Objektadresse.
      email: a.email, adresse: a.rechnungsadresse || a.adresse,
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
        kostenstelle: v.kostenstelle ?? null,
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
        kostenstelle: v.kostenstelle ?? null,
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
  if (!a || istVersendet(r)) return { nachgetragen: [], entfernt: [], kostenstelle: [] };

  const imEntwurf = new Set(r.positionen.map(p => p.quelleEintragId).filter(Boolean));

  const nachgetragen = a.verlauf.filter(v =>
    (v.typ === 'zeit' || v.typ === 'material') && !imEntwurf.has(v.id));

  // Positionen, deren Quelle inzwischen aus der Dokumentation gelöscht wurde.
  const imVerlauf = new Set(a.verlauf.map(v => v.id));
  const entfernt = r.positionen.filter(p => p.quelleEintragId && !imVerlauf.has(p.quelleEintragId));

  // Kostenstelle in der Dokumentation nachträglich zugeordnet oder geändert.
  // Wird nicht still übernommen (Fachregel 9) — nur angezeigt und auf Knopfdruck gesetzt.
  const quelle = new Map(a.verlauf.map(v => [v.id, v]));
  const kostenstelle = r.positionen.filter(p => {
    const v = p.quelleEintragId && quelle.get(p.quelleEintragId);
    return v && (v.kostenstelle ?? null) !== (p.kostenstelle ?? null);
  }).map(p => ({ positionId: p.id, alt: p.kostenstelle ?? null, neu: quelle.get(p.quelleEintragId).kostenstelle ?? null, text: p.text }));

  return { nachgetragen, entfernt, kostenstelle };
}

/** Übernimmt die Kostenstellen aus der Dokumentation in die betroffenen Positionen. */
export function kostenstellenAbgleichen(rechnungId) {
  const r = rechnung(rechnungId);
  if (!r || istVersendet(r)) return 0;
  const { kostenstelle } = entwurfAbgleich(r);
  for (const k of kostenstelle) {
    const p = r.positionen.find(x => x.id === k.positionId);
    if (p) p.kostenstelle = k.neu;
  }
  if (kostenstelle.length) commit();
  return kostenstelle.length;
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
export const istVersendet = (r) => !!r && (r.status === 'versendet' || r.status === 'gestellt');

/** True, wenn die Rechnung im Rechnungsdienst liegt, aber noch nicht beim Kunden. */
export const istErstellt = (r) => !!r && r.status === 'erstellt';

/**
 * Hält fest, dass die Rechnung im Rechnungsdienst angelegt wurde.
 *
 * Bewusst getrennt vom Versand: zwischen „liegt dort" und „ist beim Kunden"
 * kann einiges schiefgehen, und beides als einen Zustand zu führen war der
 * Fehler, den wir hier gerade nicht machen. Die Nummer kommt vom Dienst —
 * die App erfindet keine eigene.
 */
export function rechnungErstelltVermerken(rechnungId, dienstDaten) {
  const r = rechnung(rechnungId);
  if (!r) return { ok: false, grund: 'Rechnung nicht gefunden' };
  if (istVersendet(r)) return { ok: false, grund: 'Diese Rechnung wurde bereits versendet' };

  r.status = 'erstellt';
  r.dienst = {
    name: 'sevDesk',
    id: dienstDaten?.sevdeskId ?? null,
    nummer: dienstDaten?.nummer ?? null,
    referenz: dienstDaten?.referenz ?? r.id,
    angelegtAm: new Date().toISOString(),
  };
  commit();
  return { ok: true, rechnung: r };
}

/**
 * Setzt "Versendet" nach einem echten Versand über den Rechnungsdienst.
 *
 * Friert denselben Beleg ein wie der simulierte Versand — Fachregel 4 gilt
 * hier genauso: was herausgegeben ist, ändert sich nie wieder. Zusätzlich
 * wird die Nummer des Dienstes übernommen, damit Beleg und Buchhaltung
 * dieselbe Nummer tragen.
 */
export function rechnungGestellt(rechnungId, dienstDaten) {
  const r = rechnung(rechnungId);
  if (!r) return { ok: false, grund: 'Rechnung nicht gefunden' };
  if (istVersendet(r)) return { ok: false, grund: 'Diese Rechnung wurde bereits versendet' };

  if (dienstDaten?.nummer) r.nummer = dienstDaten.nummer;

  r.dienst = {
    ...(r.dienst || {}),
    name: 'sevDesk',
    id: dienstDaten?.sevdeskId ?? r.dienst?.id ?? null,
    nummer: dienstDaten?.nummer ?? null,
    referenz: dienstDaten?.referenz ?? r.id,
    versendetAm: new Date().toISOString(),
    versendetAn: dienstDaten?.versendetAn ?? null,
  };

  r.beleg = belegEinfrieren(r);
  r.status = 'gestellt';
  r.versand = { am: new Date().toISOString(), an: dienstDaten?.versendetAn ?? null, echt: true };
  commit();
  return { ok: true, rechnung: r };
}

/* ── Zahlungseingang ─────────────────────── */

/**
 * Ob das Geld da ist, ist eine EIGENE Achse — kein weiterer Rechnungsstatus.
 *
 * Genau wie Arbeitsstatus und Rechnungsstatus unabhängig sind (Fachregel 1),
 * sagt "Versendet" nichts über die Zahlung. Beides in einen Status zu pressen
 * hiesse entweder, versendeten Rechnungen niemand mehr hinterherläuft, oder
 * bezahlte Rechnungen als offen zu führen.
 *
 * Der Betrag wird beim Vermerken aus dem eingefrorenen Beleg KOPIERT und nie
 * neu gerechnet: bezahlt wurde der herausgegebene Betrag, nicht der, den eine
 * spätere Rechnung ergäbe (Fachregel 4).
 */
export const istBezahlt = (r) => !!r && !!r.zahlung && !!r.zahlung.am;

/** Summe aller vermerkten Zahlungen. Nur was vermerkt ist, zählt — nie geschätzt. */
export const bezahlteRechnungen = () => store.rechnungen.filter(istBezahlt);

/**
 * Hält fest, dass eine herausgegebene Rechnung bezahlt wurde.
 * `am` ist ein Tagesschlüssel ('YYYY-MM-DD'); ohne Angabe gilt heute.
 */
export function zahlungVermerken(rechnungId, am) {
  const r = rechnung(rechnungId);
  if (!r) return { ok: false, grund: 'Rechnung nicht gefunden' };
  // Eine Rechnung, die den Betrieb nie verlassen hat, kann nicht bezahlt sein.
  if (!istVersendet(r)) return { ok: false, grund: 'Nur eine herausgegebene Rechnung kann bezahlt sein' };

  const betrag = r.beleg?.summen?.brutto;
  // Kein festgeschriebener Betrag → kein Zahlungsvermerk. Nichts wird geraten.
  if (!Number.isFinite(betrag)) return { ok: false, grund: 'Kein festgeschriebener Betrag vorhanden' };

  const tag = typeof am === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(am) ? am : tagKey(new Date());
  r.zahlung = { am: tag, betrag, vermerktAm: new Date().toISOString() };
  commit();
  return { ok: true, rechnung: r };
}

/** Zahlungsvermerk zurücknehmen — ein Vertipper darf korrigierbar bleiben. */
export function zahlungZuruecknehmen(rechnungId) {
  const r = rechnung(rechnungId);
  if (!r) return { ok: false, grund: 'Rechnung nicht gefunden' };
  r.zahlung = null;
  commit();
  return { ok: true, rechnung: r };
}

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
