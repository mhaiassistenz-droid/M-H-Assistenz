/* ============================================
   home-geld.js — Geldverlauf auf der Startseite

   Zwei Linien über einen wählbaren Zeitraum:

     A  Bezahlt        Summe der vermerkten Zahlungseingänge je Abschnitt
     B  Neue Aufträge  Anzahl der in diesem Abschnitt erfassten Aufträge

   Die grosse Zahl oben ist die Summe der bereits BEZAHLTEN Rechnungen im
   gewählten Zeitraum — nicht die Anzahl und nicht der versendete Betrag.
   Bezahlt heisst: in state.js ausdrücklich vermerkt. Aus „versendet" wird
   hier nie auf „bezahlt" geschlossen (Fachregel 5: nichts wird geraten).

   Zwei Grössen, zwei Achsen: links Euro, rechts Anzahl. Beide auf eine
   Achse zu legen hiesse, Beträge und Stückzahlen vergleichbar zu machen,
   die es nicht sind.

   Die Kurve ist monoton kubisch interpoliert (Fritsch–Carlson). Eine
   gewöhnliche Spline würde zwischen zwei Punkten über den grösseren
   hinausschiessen und damit Werte zeigen, die es nie gab.
   ============================================ */

import { esc, icon, fmtEuro, fmtDatum, parseTermin, monatName, istHandy } from './util.js';
import * as state from './state.js';

/* ── Zeiträume ───────────────────────────── */

const mitternacht = (d) => { const k = new Date(d); k.setHours(0, 0, 0, 0); return k; };

/** Montag der Woche, in der `d` liegt. */
function wochenStart(d) {
  const k = mitternacht(d);
  const versatz = (k.getDay() + 6) % 7;   // Montag = 0
  k.setDate(k.getDate() - versatz);
  return k;
}

/** 1. des Monats, in dem `d` liegt. */
function monatStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

/**
 * Kalenderwoche `n` Wochen vor der aktuellen — 0 ist diese Woche,
 * 1 die letzte, 2 die vorletzte. Montag bis Montag, Ende ausschliesslich.
 */
function wocheBereich(n) {
  const von = wochenStart(new Date());
  von.setDate(von.getDate() - n * 7);
  const bis = new Date(von); bis.setDate(bis.getDate() + 7);
  return { von, bis };
}

/**
 * Kalendermonat `n` Monate vor dem aktuellen — 1 ist der letzte Monat.
 * Voller Monat, vom 1. bis zum 1. des Folgemonats.
 */
function monatBereich(n) {
  const heute = new Date();
  const von = new Date(heute.getFullYear(), heute.getMonth() - n, 1);
  const bis = new Date(heute.getFullYear(), heute.getMonth() - n + 1, 1);
  return { von, bis };
}

/** Rollierendes Fenster: die letzten `n` Monate bis heute (morgen exklusiv). */
function trailingBereich(n) {
  const heute = mitternacht(new Date());
  const von = new Date(heute); von.setMonth(von.getMonth() - n);
  const bis = new Date(heute); bis.setDate(bis.getDate() + 1);
  return { von, bis };
}

const ZEITRAEUME = {
  diese_woche:     { label: 'Diese Woche',      bereich: () => wocheBereich(0),    einheit: 'tag'   },
  letzte_woche:    { label: 'Letzte Woche',     bereich: () => wocheBereich(1),    einheit: 'tag'   },
  vorletzte_woche: { label: 'Vorletzte Woche',  bereich: () => wocheBereich(2),    einheit: 'tag'   },
  letzter_monat:   { label: 'Letzter Monat',    bereich: () => monatBereich(1),    einheit: 'woche' },
  letzte_3_monate: { label: 'Letzte 3 Monate',  bereich: () => trailingBereich(3), einheit: 'woche' },
  letzte_6_monate: { label: 'Letzte 6 Monate',  bereich: () => trailingBereich(6), einheit: 'monat' },
};

let gewaehlterZeitraum = 'letzte_3_monate';

/* ── Abschnitte bauen ────────────────────── */

const kurzDatum = (d) => `${d.getDate()}.${d.getMonth() + 1}.`;

/**
 * Teilt [von, bis) in Abschnitte der gegebenen Einheit. Der erste und letzte
 * Abschnitt werden auf den Zeitraum gekappt — sonst zählte eine Kalenderwoche,
 * die über den Monatsrand hinausragt, auch Tage aus dem Nachbarmonat mit.
 */
function bucketBauen(von, bis, einheit) {
  const liste = [];
  if (einheit === 'tag') {
    let cur = mitternacht(von);
    while (cur < bis) {
      const naechster = new Date(cur); naechster.setDate(naechster.getDate() + 1);
      liste.push({ von: new Date(Math.max(cur, von)), bis: new Date(Math.min(naechster, bis)), label: kurzDatum(cur) });
      cur = naechster;
    }
  } else if (einheit === 'woche') {
    let cur = wochenStart(von);
    while (cur < bis) {
      const naechster = new Date(cur); naechster.setDate(naechster.getDate() + 7);
      liste.push({ von: new Date(Math.max(cur, von)), bis: new Date(Math.min(naechster, bis)), label: kurzDatum(cur) });
      cur = naechster;
    }
  } else {
    let cur = monatStart(von);
    while (cur < bis) {
      const naechster = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      liste.push({ von: new Date(Math.max(cur, von)), bis: new Date(Math.min(naechster, bis)), label: monatName(cur).slice(0, 3) });
      cur = naechster;
    }
  }
  return liste.map(a => ({ ...a, geld: 0, auftraege: 0 }));
}

/** Abschnitte des gewählten, benannten Zeitraums. */
function abschnitte(schluessel) {
  const z = ZEITRAEUME[schluessel] || ZEITRAEUME['letzte_3_monate'];
  const { von, bis } = z.bereich();
  return bucketBauen(von, bis, z.einheit);
}

/** Index des Abschnitts, in den `d` fällt — oder -1. */
function abschnittFuer(liste, d) {
  if (!d || Number.isNaN(d.getTime())) return -1;
  const t = d.getTime();
  return liste.findIndex(a => t >= a.von.getTime() && t < a.bis.getTime());
}

/**
 * Füllt die Abschnitte aus dem Datenbestand.
 * Nur vermerkte Zahlungen zählen; eine versendete Rechnung ohne Vermerk
 * bleibt bewusst aussen vor.
 */
function datenSammeln(liste) {
  for (const r of state.alleRechnungen()) {
    if (!state.istBezahlt(r)) continue;
    const betrag = Number(r.zahlung.betrag);
    if (!Number.isFinite(betrag)) continue;
    const i = abschnittFuer(liste, parseTermin(r.zahlung.am));
    if (i >= 0) liste[i].geld += betrag;
  }
  for (const a of state.alleAuftraege()) {
    const i = abschnittFuer(liste, parseTermin(a.angelegtAm));
    if (i >= 0) liste[i].auftraege += 1;
  }
  return liste;
}

/* ── Skalen ──────────────────────────────── */

const TEILUNG = 4;   // vier Abschnitte, also fünf Rasterlinien

/**
 * Obergrenze für eine Stückzahl-Achse: immer ein Vielfaches der Teilung,
 * damit jede Rasterlinie auf einer ganzen Zahl liegt. Ohne das stünde an
 * zwei Linien dieselbe gerundete Zahl — eine Achse, die sich wiederholt,
 * ist keine Achse.
 */
function obergrenzeAnzahl(max) {
  const schritt = Math.max(1, Math.ceil(Math.max(0, max) / TEILUNG));
  return schritt * TEILUNG;
}

/** Obergrenze auf einen glatten Wert aufrunden, damit die Achse lesbar bleibt. */
function obergrenze(max) {
  if (max <= 0) return 1;
  const stufe = Math.pow(10, Math.floor(Math.log10(max)));
  for (const f of [1, 2, 2.5, 5, 10]) {
    if (max <= stufe * f) return stufe * f;
  }
  return stufe * 10;
}

/* ── Kurve ───────────────────────────────── */

/**
 * Monoton kubische Interpolation (Fritsch–Carlson).
 * Schiesst garantiert nicht über die Stützstellen hinaus.
 */
function glatterPfad(punkte) {
  const n = punkte.length;
  if (n === 0) return '';
  if (n === 1) return `M ${punkte[0].x} ${punkte[0].y}`;

  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(punkte[i + 1].x - punkte[i].x);
    m.push((punkte[i + 1].y - punkte[i].y) / (punkte[i + 1].x - punkte[i].x));
  }

  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) { t.push(0); continue; }
    const w1 = 2 * dx[i] + dx[i - 1];
    const w2 = dx[i] + 2 * dx[i - 1];
    t.push((w1 + w2) / (w1 / m[i - 1] + w2 / m[i]));
  }
  t.push(m[n - 2]);

  let d = `M ${punkte[0].x.toFixed(2)} ${punkte[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C ${(punkte[i].x + h).toFixed(2)} ${(punkte[i].y + t[i] * h).toFixed(2)},`
       + ` ${(punkte[i + 1].x - h).toFixed(2)} ${(punkte[i + 1].y - t[i + 1] * h).toFixed(2)},`
       + ` ${punkte[i + 1].x.toFixed(2)} ${punkte[i + 1].y.toFixed(2)}`;
  }
  return d;
}

/* ── Zeichnen ────────────────────────────── */

/**
 * Maße im viewBox-Raster. Am Handy ist die Fläche rund ein Drittel so breit,
 * also skaliert auch die Schrift mit herunter — 12 Einheiten wären dort etwa
 * 6 px auf dem Glas. Edin liest das draußen. Deshalb eigene Maße statt einer
 * CSS-Regel, die gegen die Skalierung nicht ankommt.
 */
const BREIT  = { b: 760, h: 300, links: 64,  rechts: 714, oben: 22, unten: 244, schrift: 12, achsAbstand: 12 };
const SCHMAL = { b: 760, h: 330, links: 118, rechts: 672, oben: 24, unten: 250, schrift: 26, achsAbstand: 14 };
const masse = () => (istHandy() ? SCHMAL : BREIT);

export function geldPanel() {
  const VB = masse();
  const z = ZEITRAEUME[gewaehlterZeitraum] || ZEITRAEUME['8w'];
  const liste = datenSammeln(abschnitte(gewaehlterZeitraum));

  const summeGeld = liste.reduce((s, a) => s + a.geld, 0);
  const summeAuftraege = liste.reduce((s, a) => s + a.auftraege, 0);
  const leer = summeGeld === 0 && summeAuftraege === 0;

  const rohGeld = Math.max(...liste.map(a => a.geld));
  const maxGeld = obergrenze(rohGeld);
  const maxAnzahl = obergrenzeAnzahl(Math.max(...liste.map(a => a.auftraege)));

  const breite = VB.rechts - VB.links;
  const hoehe = VB.unten - VB.oben;
  const xFuer = i => liste.length === 1
    ? VB.links + breite / 2
    : VB.links + (i / (liste.length - 1)) * breite;
  const yGeld = v => VB.unten - (v / maxGeld) * hoehe;
  const yAnzahl = v => VB.unten - (v / maxAnzahl) * hoehe;

  const punkteGeld = liste.map((a, i) => ({ x: xFuer(i), y: yGeld(a.geld) }));
  const punkteAnzahl = liste.map((a, i) => ({ x: xFuer(i), y: yAnzahl(a.auftraege) }));

  // Ohne jede Zahlung im Zeitraum gibt es keine sinnvolle Euro-Achse. Dann steht
  // dort nur die Null — eine Skala über einer leeren Reihe wäre eine Erfindung.
  const raster = Array.from({ length: TEILUNG + 1 }, (_, k) => k / TEILUNG).map(f => {
    const y = VB.unten - f * hoehe;
    const geldLabel = rohGeld > 0 || f === 0 ? achseGeld(maxGeld * f) : '';
    return `<line class="geld-raster" x1="${VB.links}" y1="${y.toFixed(1)}" x2="${VB.rechts}" y2="${y.toFixed(1)}" />
      <text class="geld-achse links" font-size="${VB.schrift}" x="${VB.links - VB.achsAbstand}" y="${(y + VB.schrift / 3).toFixed(1)}">${esc(geldLabel)}</text>
      <text class="geld-achse rechts" font-size="${VB.schrift}" x="${VB.rechts + VB.achsAbstand}" y="${(y + VB.schrift / 3).toFixed(1)}">${maxAnzahl * f}</text>`;
  }).join('');

  // Beschriftungsdichte nach verfügbarer Breite — sonst klebt die Achse zusammen.
  const jeder = istHandy()
    ? (liste.length > 10 ? 4 : liste.length > 6 ? 2 : 1)
    : (liste.length > 10 ? 2 : 1);
  const letzter = liste.length - 1;
  // Vom Ende her takten: der jüngste Abschnitt trägt immer seine Beschriftung,
  // und die Abstände bleiben trotzdem gleich. Vom Anfang her getaktet stünden
  // sonst die letzten beiden Daten aneinander.
  const zeigen = (i) => (letzter - i) % jeder === 0;
  const beschriftung = liste.map((a, i) => zeigen(i)
    ? `<text class="geld-achse unten" font-size="${VB.schrift}" x="${xFuer(i).toFixed(1)}" y="${VB.unten + VB.schrift * 2}">${esc(a.label)}</text>` : '').join('');

  const treffer = liste.map((a, i) => {
    const halb = liste.length > 1 ? breite / (liste.length - 1) / 2 : breite / 2;
    const von = Math.max(VB.links - 8, xFuer(i) - halb);
    const bis = Math.min(VB.rechts + 8, xFuer(i) + halb);
    return `<rect class="geld-treffer" data-punkt="${i}" x="${von.toFixed(1)}" y="${VB.oben}"
      width="${(bis - von).toFixed(1)}" height="${hoehe}" />`;
  }).join('');

  const beschreibung = `Geldverlauf über ${z.label}. Bezahlt insgesamt ${fmtEuro(summeGeld)}, `
    + `${summeAuftraege} ${summeAuftraege === 1 ? 'neuer Auftrag' : 'neue Aufträge'}. `
    + liste.map(a => `${a.label}: ${fmtEuro(a.geld)}, ${a.auftraege}`).join('. ');

  return `
    <section class="home-panel home-geld" aria-labelledby="home-geld-title">
      <div class="home-panel-head">
        <h2 id="home-geld-title">Geldverlauf</h2>
        <div class="geld-zeitraum">
          <select class="geld-select" data-zeitraum aria-label="Zeitraum">
            ${Object.entries(ZEITRAEUME).map(([id, e]) => `
              <option value="${id}"${id === gewaehlterZeitraum ? ' selected' : ''}>${esc(e.label)}</option>`).join('')}
          </select>
          ${icon('chevronab', 'geld-select-pfeil')}
        </div>
      </div>

      <div class="geld-kopf">
        <div class="geld-zeitspanne">${esc(spanne(gewaehlterZeitraum))}</div>
        <div class="geld-summe-zeile">
          <div class="geld-summe">${fmtEuro(summeGeld)}</div>
          ${trendSchild(gewaehlterZeitraum, summeGeld)}
        </div>
        <div class="geld-summe-label">bereits bezahlt${summeGeld > 0 ? '' : ' — noch keine Zahlung vermerkt'}</div>
      </div>

      <div class="geld-flaeche">
        <svg viewBox="0 0 ${VB.b} ${VB.h}" role="img" aria-label="${esc(beschreibung)}">
          <defs>
            <linearGradient id="geldFlaeche" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--geld-bezahlt)" stop-opacity="0.15" />
              <stop offset="100%" stop-color="var(--geld-bezahlt)" stop-opacity="0" />
            </linearGradient>
            <filter id="geldPunktSchatten" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="rgba(17,24,39,0.35)" />
            </filter>
          </defs>
          ${raster}
          ${beschriftung}
          <line class="geld-faden" x1="0" y1="${VB.oben}" x2="0" y2="${VB.unten}" hidden />
          ${leer ? '' : `
            <path class="geld-flaeche-verlauf" d="${glatterPfad(punkteGeld)} L ${VB.rechts} ${VB.unten} L ${VB.links} ${VB.unten} Z" />
            <path class="geld-linie auftraege" d="${glatterPfad(punkteAnzahl)}" />
            <path class="geld-linie bezahlt" d="${glatterPfad(punkteGeld)}" />
            ${hoehepunkte(liste, xFuer, yGeld)}`}
          <g class="geld-marker" hidden>
            <circle class="geld-punkt auftraege" r="${istHandy() ? 9 : 5}" cx="0" cy="0" />
            <circle class="geld-punkt bezahlt" r="${istHandy() ? 9 : 5}" cx="0" cy="0" />
          </g>
          ${leer ? '' : treffer}
        </svg>
        <div class="geld-tipp" hidden></div>
        ${leer ? `<p class="geld-leer">Für diesen Zeitraum liegen keine Daten vor.
          Bezahlte Rechnungen erscheinen hier, sobald der Zahlungseingang im Beleg vermerkt ist.</p>` : ''}
      </div>

      <div class="geld-legende">
        <span class="geld-legende-eintrag bezahlt">Bezahlt <em>€</em></span>
        <span class="geld-legende-eintrag auftraege">Neue Aufträge <em>Anzahl</em></span>
      </div>
    </section>`;
}

/**
 * „03.08. – 25.09.2026" — die Spanne über dem Betrag, wie in der Vorlage.
 * Zeigt den tatsächlichen Zeitraum, nicht „bis heute": „Letzte Woche" endet
 * am Sonntag, nicht am aktuellen Tag.
 */
function spanne(schluessel) {
  const z = ZEITRAEUME[schluessel] || ZEITRAEUME['letzte_3_monate'];
  const { von, bis } = z.bereich();
  const heute = mitternacht(new Date());
  const p = (n) => String(n).padStart(2, '0');
  const bisTag = new Date(bis); bisTag.setDate(bisTag.getDate() - 1);   // letzter eingeschlossener Tag
  const ende = bisTag.getTime() >= heute.getTime() ? 'heute' : fmtDatum(bisTag);
  return `${p(von.getDate())}.${p(von.getMonth() + 1)}. – ${ende}`;
}

/**
 * Setzt einen hervorgehobenen Punkt auf den höchsten Zahlungseingang —
 * in der Vorlage sind das die beiden Spitzen. Ohne Zahlung kein Punkt:
 * eine Markierung auf einer Nullreihe behauptete ein Ereignis.
 */
function hoehepunkte(liste, xFuer, yGeld) {
  const hoechster = liste.reduce((best, a, i) => (a.geld > (liste[best]?.geld ?? -1) ? i : best), -1);
  if (hoechster < 0 || !liste[hoechster] || liste[hoechster].geld <= 0) return '';
  const r = istHandy() ? 9 : 6;
  return `<circle class="geld-spitze" cx="${xFuer(hoechster).toFixed(1)}" cy="${yGeld(liste[hoechster].geld).toFixed(1)}"
    r="${r}" filter="url(#geldPunktSchatten)" />`;
}

/**
 * Veränderung gegenüber dem gleich langen Zeitraum davor.
 * Gab es davor nichts, gibt es auch keinen Prozentwert — aus 0 lässt sich
 * keine Steigerung rechnen, und geraten wird hier nichts (Fachregel 5).
 */
function trendSchild(schluessel, summeJetzt) {
  const z = ZEITRAEUME[schluessel] || ZEITRAEUME['letzte_3_monate'];
  const { von, bis } = z.bereich();
  const dauer = bis.getTime() - von.getTime();
  const vorherVon = new Date(von.getTime() - dauer);
  const vorherBis = von;

  let summeVorher = 0;
  for (const r of state.alleRechnungen()) {
    if (!state.istBezahlt(r)) continue;
    const d = parseTermin(r.zahlung.am);
    if (!d || Number.isNaN(d.getTime())) continue;
    if (d >= vorherVon && d < vorherBis) summeVorher += Number(r.zahlung.betrag) || 0;
  }
  if (summeVorher <= 0) return '';

  const wandel = (summeJetzt - summeVorher) / summeVorher * 100;
  const richtung = wandel >= 0 ? 'auf' : 'ab';
  return `<span class="geld-trend ${richtung}" title="Gegenüber den ${ZEITRAEUME[schluessel].label} davor: ${fmtEuro(summeVorher)}">
    ${icon('trendauf')}${Math.abs(wandel).toFixed(2).replace('.', ',')} %</span>`;
}

/** Kurze Achsenbeschriftung: 1.200 € wird zu „1,2k". */
function achseGeld(v) {
  if (v >= 1000) {
    const k = v / 1000;
    return `${(Math.round(k * 10) / 10).toLocaleString('de-DE')}k`;
  }
  return v.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

/* ── Bedienung ───────────────────────────── */

export function geldBinden(el, neuZeichnen) {
  const panel = el.querySelector('.home-geld');
  if (!panel) return;

  panel.querySelector('select[data-zeitraum]')?.addEventListener('change', (ereignis) => {
    gewaehlterZeitraum = ereignis.target.value;
    neuZeichnen();
  });

  const svg = panel.querySelector('.geld-flaeche svg');
  const tipp = panel.querySelector('.geld-tipp');
  const marker = panel.querySelector('.geld-marker');
  if (!svg || !tipp || !marker) return;

  const VB = masse();
  const liste = datenSammeln(abschnitte(gewaehlterZeitraum));
  const maxGeld = obergrenze(Math.max(...liste.map(a => a.geld)));
  const maxAnzahl = obergrenzeAnzahl(Math.max(...liste.map(a => a.auftraege)));
  const breite = VB.rechts - VB.links;
  const hoehe = VB.unten - VB.oben;
  const xFuer = i => liste.length === 1 ? VB.links + breite / 2
    : VB.links + (i / (liste.length - 1)) * breite;

  const kreise = marker.querySelectorAll('circle');
  const faden = panel.querySelector('.geld-faden');

  const zeigen = (i) => {
    const a = liste[i];
    if (!a) return;
    const x = xFuer(i);
    kreise[0].setAttribute('cx', x); kreise[0].setAttribute('cy', VB.unten - (a.auftraege / maxAnzahl) * hoehe);
    kreise[1].setAttribute('cx', x); kreise[1].setAttribute('cy', VB.unten - (a.geld / maxGeld) * hoehe);
    marker.removeAttribute('hidden');
    if (faden) { faden.setAttribute('x1', x); faden.setAttribute('x2', x); faden.removeAttribute('hidden'); }
    tipp.innerHTML = `<strong>${esc(a.label)}</strong>
      <span class="geld-tipp-zeile bezahlt">${fmtEuro(a.geld)} bezahlt</span>
      <span class="geld-tipp-zeile auftraege">${a.auftraege} ${a.auftraege === 1 ? 'neuer Auftrag' : 'neue Aufträge'}</span>`;
    // Am Rand kippt der Kasten nach innen, sonst steht er ausserhalb der Karte.
    const anteil = x / VB.b;
    tipp.dataset.seite = anteil > 0.72 ? 'rechts' : anteil < 0.28 ? 'links' : 'mitte';
    tipp.style.left = `${(anteil * 100).toFixed(2)}%`;
    tipp.removeAttribute('hidden');
  };
  const verbergen = () => {
    marker.setAttribute('hidden', '');
    tipp.setAttribute('hidden', '');
    faden?.setAttribute('hidden', '');
  };

  panel.querySelectorAll('[data-punkt]').forEach(rect => {
    rect.addEventListener('pointerenter', () => zeigen(Number(rect.dataset.punkt)));
    rect.addEventListener('pointerdown', () => zeigen(Number(rect.dataset.punkt)));
  });
  svg.addEventListener('pointerleave', verbergen);
}
