/* ============================================
   fotos.js — Bildspeicher im Browser (IndexedDB)

   Bilder gehören nicht in localStorage: der fasst rund 5 MB und nimmt nur
   Text, ein Handyfoto als Base64 sprengt ihn sofort. IndexedDB nimmt Blobs
   direkt und hat deutlich mehr Platz.

   Es bleibt reine lokale Browser-Speicherung: nichts wird hochgeladen,
   nichts synchronisiert, es gibt kein Backend. Die Bilder liegen auf dem
   Gerät, auf dem sie aufgenommen wurden.
   ============================================ */

const DB_NAME = 'pt-auftragszentrale-fotos';
const DB_VERSION = 1;
const STORE = 'bilder';

/** Grenzen, die eine verständliche Meldung erzeugen statt eines stillen Fehlschlags. */
export const MAX_BYTES = 12 * 1024 * 1024;   // 12 MB je Bild
export const ERLAUBTE_TYPEN = /^image\/(jpeg|png|webp|heic|heif|gif)$/i;

let dbPromise = null;

function db() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((fertig, fehler) => {
    let anfrage;
    try {
      anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      // Privates Fenster oder gesperrte Site-Daten: IndexedDB kann komplett fehlen.
      return fehler(e);
    }
    anfrage.onupgradeneeded = () => {
      const d = anfrage.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
    };
    anfrage.onsuccess = () => fertig(anfrage.result);
    anfrage.onerror   = () => fehler(anfrage.error);
    anfrage.onblocked = () => fehler(new Error('Datenbank blockiert'));
  });
  return dbPromise;
}

function transaktion(modus, arbeit) {
  return db().then(d => new Promise((fertig, fehler) => {
    const tx = d.transaction(STORE, modus);
    const store = tx.objectStore(STORE);
    let ergebnis;
    try { ergebnis = arbeit(store); } catch (e) { return fehler(e); }
    tx.oncomplete = () => fertig(ergebnis && ergebnis.result !== undefined ? ergebnis.result : ergebnis);
    tx.onerror    = () => fehler(tx.error);
    tx.onabort    = () => fehler(tx.error || new Error('Speichervorgang abgebrochen'));
  }));
}

/** Verfügbarkeit einmal prüfen — die UI soll früh wissen, woran sie ist. */
export async function verfuegbar() {
  try { await db(); return true; } catch { return false; }
}

/**
 * Legt ein Bild ab.
 * @returns {Promise<{ok:true}|{ok:false, grund:string}>} — nie ein stiller Fehlschlag
 */
export async function speichern(id, datei) {
  if (!datei) return { ok: false, grund: 'Keine Datei ausgewählt.' };

  if (datei.type && !ERLAUBTE_TYPEN.test(datei.type)) {
    return { ok: false, grund: `„${datei.name}" ist kein unterstütztes Bildformat.` };
  }
  if (datei.size > MAX_BYTES) {
    const mb = (datei.size / 1024 / 1024).toFixed(1).replace('.', ',');
    return { ok: false, grund: `„${datei.name}" ist mit ${mb} MB zu groß (erlaubt sind 12 MB).` };
  }

  try {
    await transaktion('readwrite', store => store.put({
      blob: datei, name: datei.name, typ: datei.type, groesse: datei.size,
      gespeichertAm: new Date().toISOString(),
    }, id));
    return { ok: true };
  } catch (e) {
    const voll = e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''));
    return {
      ok: false,
      grund: voll
        ? 'Der Bildspeicher des Browsers ist voll. Ältere Fotos entfernen und erneut versuchen.'
        : 'Der Browser konnte das Bild nicht dauerhaft speichern (privates Fenster oder gesperrte Site-Daten).',
    };
  }
}

/** Object-URLs werden zwischengespeichert, damit dasselbe Bild nicht mehrfach anfällt. */
const urlCache = new Map();

/** @returns {Promise<string|null>} Object-URL oder null, wenn das Bild fehlt. */
export async function url(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  try {
    const eintrag = await transaktion('readonly', store => store.get(id));
    if (!eintrag || !eintrag.blob) return null;
    const u = URL.createObjectURL(eintrag.blob);
    urlCache.set(id, u);
    return u;
  } catch {
    return null;
  }
}

export async function loeschen(id) {
  if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
  try { await transaktion('readwrite', store => store.delete(id)); return true; }
  catch { return false; }
}

/** Beim Zurücksetzen der Demo: alles weg. */
export async function alleLoeschen() {
  for (const u of urlCache.values()) URL.revokeObjectURL(u);
  urlCache.clear();
  try { await transaktion('readwrite', store => store.clear()); return true; }
  catch { return false; }
}

/**
 * Setzt nachträglich die Bildquellen im DOM.
 *
 * Das Rendern ist synchron, das Laden aus IndexedDB nicht. Jedes <img> trägt
 * deshalb `data-foto-id` und bekommt seine Quelle, sobald sie da ist. Fehlt das
 * Bild, sagt der Platzhalter das ehrlich, statt ein kaputtes Bild zu zeigen.
 */
export async function bilderNachladen(wurzel = document) {
  const ziele = [...wurzel.querySelectorAll('img[data-foto-id]:not([data-geladen])')];
  await Promise.all(ziele.map(async (el) => {
    const u = await url(el.dataset.fotoId);
    if (u) {
      el.src = u;
      el.setAttribute('data-geladen', '1');
    } else {
      el.setAttribute('data-geladen', 'fehlt');
      const platz = el.closest('[data-foto-huelle]');
      if (platz) {
        platz.innerHTML = `<div class="foto-fehlt">Bild nicht mehr im Browserspeicher vorhanden.</div>`;
      }
    }
  }));
}
