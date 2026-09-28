/* ============================================
   pegel.js — Aussteuerungsanzeige für Sprachaufnahmen

   Senkrechte Balken, die mit der Stimme mitgehen: laut wird hoch, still
   wird zur geraden Linie. Neue Werte laufen rechts herein, alte wandern
   nach links heraus.

   Wichtig für die Umsetzung: diese Anzeige schreibt **direkt ins DOM**
   und löst kein Neuzeichnen des Overlays aus. Vorher zeichnete der
   Sekundenzähler das gesamte Sheet jede Sekunde neu (`zeichnen()` in
   ui.js ersetzt `innerHTML` komplett) — das sah aus wie Flackern, weil
   bei jedem Durchgang auch alle Symbole neu entstanden.

   Bewegt wird ausschließlich `transform: scaleY()`. Das läuft auf dem
   Compositor und erzwingt kein neues Layout.
   ============================================ */

/** So viele Balken zeigt die laufende Anzeige. */
export const BALKEN = 44;

/** Ruhewert: die gerade Linie bei Stille. Nie ganz null, sonst wirkt es tot. */
const RUHE = 0.05;

/** Abstand zwischen zwei gespeicherten Werten für das Standbild (ms). */
const ABTASTUNG = 70;

/** Leeres Balkenfeld — kommt so ins Sheet-HTML. */
export const pegelFeld = (marke = 'pegel') =>
  `<div class="pegel" data-${marke}>${
    Array.from({ length: BALKEN }, () => '<span></span>').join('')
  }</div>`;

/**
 * Misst die Lautstärke eines Mikrofon-Streams.
 *
 * @param {MediaStream} stream
 * @returns {{wert: () => number, schliessen: () => void}} Wert zwischen 0 und 1
 */
export function messerStarten(stream) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return { wert: () => RUHE, schliessen: () => {} };

  let ctx;
  try {
    ctx = new Ctx();
  } catch {
    return { wert: () => RUHE, schliessen: () => {} };
  }

  const quelle = ctx.createMediaStreamSource(stream);
  const analyse = ctx.createAnalyser();
  analyse.fftSize = 512;
  analyse.smoothingTimeConstant = 0.6;
  quelle.connect(analyse);

  const daten = new Uint8Array(analyse.fftSize);

  return {
    wert() {
      analyse.getByteTimeDomainData(daten);
      // Effektivwert der Auslenkung um die Mittellinie.
      let summe = 0;
      for (let i = 0; i < daten.length; i++) {
        const x = (daten[i] - 128) / 128;
        summe += x * x;
      }
      const rms = Math.sqrt(summe / daten.length);
      // Sprache liegt roh bei etwa 0,02 bis 0,25. Angehoben und leicht
      // gestaucht, damit normales Reden den Ausschlag gut ausfüllt und
      // lautes Reden nicht sofort oben anschlägt.
      const s = Math.pow(Math.min(1, rms * 3.6), 0.75);
      return Math.max(RUHE, s);
    },
    schliessen() {
      try { quelle.disconnect(); } catch { /* egal */ }
      try { ctx.close(); } catch { /* egal */ }
    },
  };
}

/**
 * Lässt die Balken laufen und sammelt nebenbei den Verlauf der ganzen Aufnahme.
 *
 * @param {HTMLElement} feld   Element aus `pegelFeld()`
 * @param {{wert: () => number}} messer
 * @returns {{stoppen: () => number[]}} beim Stoppen der gesammelte Verlauf
 */
export function anzeigeStarten(feld, messer) {
  if (!feld) return { stoppen: () => [] };

  const balken = [...feld.children];
  const sichtbar = new Array(balken.length).fill(RUHE);
  const verlauf = [];
  let laeuft = true;
  let zuletztGemerkt = 0;

  const schritt = (jetzt) => {
    if (!laeuft) return;

    const v = messer.wert();
    sichtbar.push(v);
    sichtbar.shift();

    // Für das Standbild reicht ein Wert alle paar Hundertstel.
    if (jetzt - zuletztGemerkt >= ABTASTUNG) {
      verlauf.push(v);
      zuletztGemerkt = jetzt;
    }

    for (let i = 0; i < balken.length; i++) {
      balken[i].style.transform = `scaleY(${sichtbar[i].toFixed(3)})`;
    }
    requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);

  return {
    stoppen() {
      laeuft = false;
      return verlauf;
    },
  };
}

/**
 * Rechnet den Verlauf einer Aufnahme auf die Balkenanzahl herunter.
 *
 * Das Ergebnis ist das stehende Bild der fertigen Aufnahme — man sieht,
 * ob überhaupt etwas drauf ist und wo geredet wurde.
 */
export function standbild(verlauf, anzahl = BALKEN) {
  if (!verlauf || !verlauf.length) return new Array(anzahl).fill(RUHE);

  const werte = new Array(anzahl);
  const proBalken = verlauf.length / anzahl;
  for (let i = 0; i < anzahl; i++) {
    const von = Math.floor(i * proBalken);
    const bis = Math.max(von + 1, Math.floor((i + 1) * proBalken));
    let hoechster = 0;
    for (let k = von; k < bis && k < verlauf.length; k++) {
      if (verlauf[k] > hoechster) hoechster = verlauf[k];
    }
    werte[i] = Math.max(RUHE, hoechster);
  }
  return werte;
}

/** Setzt ein Standbild in ein Balkenfeld. */
export function standbildZeichnen(feld, werte) {
  if (!feld) return;
  const balken = [...feld.children];
  for (let i = 0; i < balken.length; i++) {
    balken[i].style.transform = `scaleY(${(werte[i] ?? RUHE).toFixed(3)})`;
  }
}
