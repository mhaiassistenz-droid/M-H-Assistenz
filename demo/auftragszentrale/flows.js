/* ============================================
   flows.js — echte Erkennung, wenn ein Backend da ist

   Die Demo läuft weiterhin ohne alles: liegt kein Backend hinter der Seite,
   melden die Funktionen hier `verfuegbar() === false`, und die Oberfläche
   bleibt bei ihren gekennzeichneten Beispielen. Steht ein Backend bereit,
   wird wirklich aufgenommen und wirklich ausgewertet.

   Drei Betriebsarten (`zugangsmodus()`):
     'proxy'  lokaler Proxy (werkstatt/proxy.py) auf demselben Ursprung. Er setzt
              den Token selbst; alles ist echt, auch der Rechnungsversand.
     'direkt' öffentliche Demo mit Zugangscode: Sprache, Foto und KI-Änderung gehen
              direkt an n8n, der Code wandert als Header mit. Der Rechnungsversand
              bleibt simuliert (`versandEcht() === false`).
     'aus'    weder noch: die Oberfläche bleibt bei ihren gekennzeichneten Beispielen.

   Bewusst enthält diese Datei **keinen Schlüssel**. Die Adresse von n8n darf
   öffentlich stehen — ohne den Code antwortet der Server mit 403. Der Code kommt
   nie aus dem Quelltext: er wird eingegeben oder per Link (`#z=...`) übergeben und
   nur im Browser des Nutzers gespeichert (Fachregel 13).

   Ein Ergebnis von hier ist immer ein **Vorschlag**, nie ein bestätigter
   Wert: `geprueft` ist stets false, und `fehlend` zählt auf, was nicht
   erkannt wurde. Was fehlt, wird benannt und nicht geraten.
   ============================================ */

const BASIS = '/api';                                    // lokaler Proxy
const N8N = 'https://n8n.mhassistenz.de/webhook';        // direkter Weg (nur mit Code)
const N8N_ZIEL = {
  sprache: 'pt-sprache',
  foto: 'pt-foto',
  preiskorrektur: 'pt-preiskorrektur',
  rechnungskorrektur: 'pt-rechnungskorrektur',
};
const CODE_KEY = 'pt-zugangscode';

/* ── Zugangscode ─────────────────────────── */

export function zugangscode() {
  try { return localStorage.getItem(CODE_KEY) || ''; } catch { return ''; }
}

export function zugangscodeSetzen(code) {
  try { localStorage.setItem(CODE_KEY, String(code).trim()); } catch { /* Speicher gesperrt */ }
  zuruecksetzen();
}

export function zugangscodeLoeschen() {
  try { localStorage.removeItem(CODE_KEY); } catch { /* egal */ }
  zuruecksetzen();
}

/* Ein Link mit `#z=CODE` schaltet frei und verschwindet sofort aus der Adressleiste.
   Das muss beim Laden dieses Moduls passieren, noch bevor irgendein anderes Modul
   `verfuegbar()` fragt — und bevor der Router das Fragment als Seite liest. Klickt
   jemand den Link in einer schon offenen Seite an, lädt sie danach neu. */
function codeAusAdresse() {
  if (typeof location === 'undefined') return false;
  const treffer = /^#z=([A-Za-z0-9-]{8,64})$/.exec(location.hash);
  if (!treffer) return false;
  try { localStorage.setItem(CODE_KEY, treffer[1]); } catch { /* Speicher gesperrt */ }
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* egal */ }
  return true;
}
codeAusAdresse();
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => { if (codeAusAdresse()) location.reload(); });
}

/* ── Verfügbarkeit ───────────────────────── */

let bekannt = null;   // null = noch nicht geprüft
let modus = 'aus';    // 'proxy' | 'direkt' | 'aus'

/**
 * Prüft einmalig, ob echte Auswertung möglich ist. Das Ergebnis wird gemerkt,
 * damit nicht jeder Dialog erneut anfragt. Erst der Proxy, dann ein gespeicherter
 * Zugangscode.
 * @returns {Promise<boolean>}
 */
export async function verfuegbar() {
  if (bekannt !== null) return bekannt;
  try {
    const steuerung = new AbortController();
    const abbruch = setTimeout(() => steuerung.abort(), 2000);
    const antwort = await fetch(`${BASIS}/status`, { signal: steuerung.signal });
    clearTimeout(abbruch);
    if (antwort.ok) { modus = 'proxy'; bekannt = true; return true; }
  } catch { /* kein Proxy da */ }
  if (zugangscode()) { modus = 'direkt'; bekannt = true; return true; }
  modus = 'aus';
  bekannt = false;
  return false;
}

/** Wie die Auswertung gerade läuft. Erst nach `verfuegbar()` verlässlich. */
export const zugangsmodus = () => modus;

/** Nur über den lokalen Proxy geht eine Rechnung wirklich an sevDesk. */
export async function versandEcht() {
  await verfuegbar();
  return modus === 'proxy';
}

/** Nur für Tests: erzwingt eine erneute Prüfung. */
export function zuruecksetzen() { bekannt = null; modus = 'aus'; }

/* ── Adresse und Kopfzeilen je nach Betriebsart ── */

function ziel(weg, query = '') {
  const q = query ? `?${query}` : '';
  return modus === 'direkt' ? `${N8N}/${N8N_ZIEL[weg]}${q}` : `${BASIS}/${weg}${q}`;
}

function kopfzeilen(typ) {
  const h = { 'Content-Type': typ };
  if (modus === 'direkt') h['X-PT-Token'] = zugangscode();
  return h;
}

/** Lehnt n8n den Code ab (403), wird er entfernt — ein toter Code soll nicht hängen bleiben. */
function codeAbgelehnt(antwort) {
  if (modus !== 'direkt' || antwort.status !== 403) return null;
  zugangscodeLoeschen();
  return { ok: false, fehler: 'Der Zugangscode wird nicht akzeptiert und wurde entfernt. '
    + 'Bitte unter „KI-Funktionen freischalten“ neu eingeben.' };
}

/* ── Aufnahme ────────────────────────────── */

/**
 * Startet eine Mikrofonaufnahme.
 *
 * Kein stiller Fehlschlag: verweigert der Browser den Zugriff, kommt ein
 * Fehler mit Klartext zurück, den die Oberfläche anzeigen kann.
 *
 * Der Stream wird mit herausgegeben: daran hängt die Aussteuerungsanzeige
 * (`pegel.js`). Beendet wird er ausschließlich hier, damit das Mikrofon
 * nicht versehentlich offen bleibt.
 *
 * @returns {Promise<{stream: MediaStream, stoppen: () => Promise<Blob>, abbrechen: () => void}>}
 */
export async function aufnahmeStarten() {
  // Browser geben das Mikrofon nur auf gesicherten Seiten frei: HTTPS oder
  // localhost. Ruft jemand die Seite über eine einfache http-Adresse auf —
  // etwa über die Netzwerkadresse des Rechners vom Handy aus — fehlt
  // `mediaDevices` schlicht. Ohne diese Unterscheidung stünde dort „kein
  // Mikrofon gefunden", und man würde am falschen Ende suchen.
  if (window.isSecureContext === false) {
    throw new Error('Aufnehmen geht nur über eine gesicherte Verbindung (https). '
      + 'Diese Seite läuft über eine ungesicherte Adresse — am Rechner unter '
      + 'localhost funktioniert es, auf anderen Geräten erst mit https.');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Dieser Browser gibt kein Mikrofon frei. '
      + 'Auf dem Handy braucht es dafür eine https-Adresse.');
  }

  let spur;
  try {
    spur = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    const grund = e && e.name === 'NotAllowedError'
      ? 'Zugriff auf das Mikrofon wurde abgelehnt.'
      : 'Kein Mikrofon gefunden.';
    throw new Error(grund);
  }

  // Safari kann kein webm, Chrome kein mp4 — nehmen, was vorhanden ist.
  const typ = ['audio/webm', 'audio/mp4', 'audio/ogg']
    .find(t => window.MediaRecorder?.isTypeSupported?.(t)) || '';

  const rekorder = new MediaRecorder(spur, typ ? { mimeType: typ } : undefined);
  const stuecke = [];
  rekorder.ondataavailable = (e) => { if (e.data && e.data.size) stuecke.push(e.data); };
  rekorder.start();

  const spurenBeenden = () => spur.getTracks().forEach(t => t.stop());

  return {
    stream: spur,
    stoppen: () => new Promise((fertig) => {
      rekorder.onstop = () => {
        spurenBeenden();
        fertig(new Blob(stuecke, { type: rekorder.mimeType || typ || 'audio/webm' }));
      };
      if (rekorder.state !== 'inactive') rekorder.stop(); else rekorder.onstop();
    }),
    abbrechen: () => {
      try { if (rekorder.state !== 'inactive') rekorder.stop(); } catch { /* egal */ }
      spurenBeenden();
    },
  };
}

/* ── Auswertung ──────────────────────────── */

async function senden(weg, daten, kontext) {
  await verfuegbar();
  let antwort;
  try {
    antwort = await fetch(ziel(weg, `kontext=${encodeURIComponent(kontext)}`), {
      method: 'POST',
      headers: kopfzeilen(daten.type || 'application/octet-stream'),
      body: daten,
    });
  } catch {
    return { ok: false, fehler: 'Die Auswertung ist nicht erreichbar. Läuft der Server noch?' };
  }
  const abgelehnt = codeAbgelehnt(antwort);
  if (abgelehnt) return abgelehnt;

  let ergebnis;
  try {
    ergebnis = await antwort.json();
  } catch {
    return { ok: false, fehler: `Unerwartete Antwort (HTTP ${antwort.status}).` };
  }

  // Der Server antwortet auch im Fehlerfall mit Klartext — unverändert weitergeben.
  if (!ergebnis || typeof ergebnis !== 'object') {
    return { ok: false, fehler: 'Die Antwort war nicht lesbar.' };
  }
  return ergebnis;
}

/**
 * Wertet eine Sprachaufnahme aus.
 * @param {Blob} blob
 * @param {'erfassen'|'doku'} kontext
 */
export const spracheAuswerten = (blob, kontext) => senden('sprache', blob, kontext);

/**
 * Wertet ein Bild aus.
 * @param {File|Blob} datei
 * @param {'erfassen'|'doku'} kontext
 */
export const fotoAuswerten = (datei, kontext) => senden('foto', datei, kontext);

/**
 * Lässt eine kurze Anweisung gegen genau EINE Rechnungsposition auswerten.
 *
 * Bewusst nur eine Position pro Aufruf: übergäbe man die ganze Liste, müsste
 * das Modell erst raten, welche Position gemeint ist — das war im Test ein
 * echtes Problem (siehe Entscheidung vom 27.09.). Der Knopf sitzt an der
 * Position selbst, also ist die Zuordnung schon vor dem Aufruf geklärt.
 *
 * Antwortformen: `{ ergebnis: 'vorschlag', neuerPreis, alterPreis, ... }`
 * wenn eine Zahl genannt wurde, `{ ergebnis: 'frage', frage }` wenn nicht —
 * dann fragt die KI aktiv nach, statt zu raten (Fachregel 5).
 */
export async function preisAnweisung({ anweisung, position }) {
  const daten = {
    anweisung,
    positionen: [{
      index: 0,
      text: position.text || '',
      menge: position.menge,
      einheit: position.einheit,
      preis: position.preis,
    }],
  };
  await verfuegbar();
  try {
    const antwort = await fetch(ziel('preiskorrektur'), {
      method: 'POST',
      headers: kopfzeilen('application/json'),
      body: JSON.stringify(daten),
    });
    const abgelehnt = codeAbgelehnt(antwort);
    if (abgelehnt) return abgelehnt;
    const ergebnis = await antwort.json();
    return (ergebnis && typeof ergebnis === 'object')
      ? ergebnis
      : { ok: false, fehler: 'Die Antwort war nicht lesbar.' };
  } catch {
    return { ok: false, fehler: 'Die Auswertung ist nicht erreichbar. Läuft der Server noch?' };
  }
}

/* ── Rechnung an den Rechnungsdienst ─────── */

/**
 * Übergibt eine Rechnung an sevDesk und versendet sie optional.
 *
 * `referenz` ist der Schlüssel gegen Doppelrechnungen: derselbe Wert führt
 * niemals zu einer zweiten Rechnung. Deshalb wird hier die Rechnungs-ID der
 * App genommen — sie ändert sich nie.
 *
 * Der Empfänger muss ausdrücklich mitgegeben werden. Das ist Absicht: in der
 * Demo stehen `.example`-Adressen in den Daten, und an eine Kundenadresse
 * darf aus einer Vorführung heraus nichts hinausgehen.
 */
/**
 * Lässt eine freie Anweisung gegen die GANZE Rechnung auswerten — jede
 * Position, Kopftext, Fusstext, Empfänger. Anders als `preisAnweisung()`
 * (die bewusst auf eine Position beschränkt ist) muss diese Funktion selbst
 * zuordnen, was gemeint ist. Der Flow fragt aktiv nach, statt zu raten,
 * sobald das nicht eindeutig ist (Fachregel 5 und 11).
 */
export async function rechnungKorrektur({ anweisung, rechnung }) {
  const daten = {
    anweisung,
    kopftext: rechnung.kopftext || '',
    fusstext: rechnung.fusstext || '',
    empfaenger: {
      name: rechnung.empfaenger?.name || '',
      adresse: rechnung.empfaenger?.adresse || '',
      email: rechnung.empfaenger?.email || '',
      ansprechpartner: rechnung.empfaenger?.ansprechpartner || '',
    },
    positionen: (rechnung.positionen || []).map((p, i) => ({
      index: i, text: p.text, menge: p.menge, einheit: p.einheit, preis: p.preis,
    })),
  };
  await verfuegbar();
  try {
    const antwort = await fetch(ziel('rechnungskorrektur'), {
      method: 'POST',
      headers: kopfzeilen('application/json'),
      body: JSON.stringify(daten),
    });
    const abgelehnt = codeAbgelehnt(antwort);
    if (abgelehnt) return abgelehnt;
    const ergebnis = await antwort.json();
    return (ergebnis && typeof ergebnis === 'object')
      ? ergebnis
      : { ok: false, fehler: 'Die Antwort war nicht lesbar.' };
  } catch {
    return { ok: false, fehler: 'Die Auswertung ist nicht erreichbar. Läuft der Server noch?' };
  }
}

export async function rechnungUebergeben({ rechnung, auftrag, versandAn, betreff, nachricht }) {
  // Harte Sperre: nur über den lokalen Proxy geht eine Rechnung wirklich an sevDesk.
  // Mit Zugangscode in der öffentlichen Demo bleibt der Versand simuliert.
  if (!(await versandEcht())) {
    return { ok: false, fehler: 'Der Rechnungsversand ist in dieser Demo simuliert.' };
  }
  const positionen = (rechnung.positionen || []).map(p => ({
    text: p.text,
    menge: p.menge,
    einheit: p.einheit,
    preis: p.preis,
    // Solange ein Preis nur ein Beispiel ist, gilt er als offen. Der Flow
    // lehnt die Rechnung dann ab, statt einen Platzhalter zu berechnen.
    preisOffen: p.preisIstBeispiel === true || p.preis === null || p.preis === undefined,
  }));

  const daten = {
    referenz: rechnung.id,
    versenden: !!versandAn,
    versandAn: versandAn || '',
    betreff: betreff || '',
    nachricht: nachricht || '',
    kunde: {
      name: rechnung.empfaenger?.name || '',
      adresse: rechnung.empfaenger?.adresse || auftrag?.adresse || '',
      email: rechnung.empfaenger?.email || '',
      ansprechpartner: rechnung.empfaenger?.ansprechpartner || '',
    },
    leistungsdatum: (auftrag?.termin || '').slice(0, 10),
    kopftext: auftrag?.aufgabe || '',
    steuersatz: rechnung.ustSatz ?? 19,
    positionen,
  };

  try {
    const antwort = await fetch(`${BASIS}/rechnung`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    });
    const ergebnis = await antwort.json();
    return (ergebnis && typeof ergebnis === 'object')
      ? ergebnis
      : { ok: false, fehler: 'Die Antwort war nicht lesbar.' };
  } catch {
    return { ok: false, fehler: 'Der Rechnungsdienst ist nicht erreichbar. Läuft der Server noch?' };
  }
}

/* ── Hilfen für die Oberfläche ───────────── */

/**
 * Macht aus einem Vorschlag Formularwerte für die Auftragserfassung.
 *
 * Ein nicht erkannter Wert wird zu einem leeren Feld — nie zu einer
 * Vermutung. Der Termin braucht ein echtes Datum; „Freitag" allein ist
 * keines und bleibt deshalb leer.
 */
export function alsFormularwerte(vorschlag) {
  if (!vorschlag) return {};
  const t = vorschlag.termin || {};
  const datum = t.datum || '';
  const zeit = t.zeit || '';
  return {
    kunde:           vorschlag.kunde || '',
    ansprechpartner: vorschlag.ansprechpartner || '',
    email:           vorschlag.email || '',
    telefon:         vorschlag.telefon || '',
    adresse:         vorschlag.adresse || '',
    aufgabe:         vorschlag.aufgabe || '',
    termin:          datum ? (zeit ? `${datum}T${zeit}` : `${datum}T08:00`) : '',
  };
}

/** Lesbare Auflistung dessen, was offen geblieben ist. */
export function fehlendText(fehlend) {
  if (!fehlend || !fehlend.length) return '';
  const namen = {
    kunde: 'Kunde', ansprechpartner: 'Ansprechpartner', email: 'E-Mail',
    telefon: 'Telefon', adresse: 'Adresse', aufgabe: 'Aufgabe', termin: 'Termin',
    arbeit: 'Arbeit', stunden: 'Stunden', offen: 'Offener Punkt',
    beschriftung: 'Beschriftung', beschreibung: 'Beschreibung',
    'erkennbares Motiv': 'ein erkennbares Motiv',
    'lesbarer Auftragstext': 'lesbarer Auftragstext',
  };
  return fehlend.map(k => namen[k] || k).join(', ');
}
