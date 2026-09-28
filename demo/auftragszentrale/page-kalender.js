/* ============================================
   page-kalender.js — dieselben Aufträge nach Termin

   Kein eigener Datenbestand: der Kalender liest dieselben Aufträge wie die
   Kartenansicht. Ein neu erfasster oder korrigierter Termin steht deshalb
   sofort hier, und ein Klick öffnet dieselbe Akte wie die Karte.

   Desktop: Wochenraster mit Stundenspalte — erst dadurch sieht man, wo der
   Nachmittag noch frei ist. Ohne Raster hängen alle Termine gleich hoch
   unter dem Datum und die Woche lässt sich nicht planen.

   Handy: Datumsstreifen mit der Anzahl der Einsätze je Tag (eine Zahl sagt
   mehr als ein Punkt) plus die Termine des gewählten Tages als Liste.
   ============================================ */

import { esc, icon, fmtUhr, parseTermin, tagKey, heuteKey,
         wochentagKurz, wochentag, monatName, fmtDatum, istHandy } from './util.js';
import * as state from './state.js';
import { badge, leerZustand } from './ui.js';
import { akteOeffnen } from './akte.js';

/** Angezeigter Tag (Handy) bzw. Tag innerhalb der angezeigten Woche (Desktop). */
let anker = new Date();

/** Sichtbarer Zeitbereich des Rasters. Wird erweitert, wenn Termine früher/später liegen. */
const RASTER_VON = 7;
const RASTER_BIS = 19;
const STUNDE_PX = 66;   // muss zu .wkal-stunde / .wkal-raster in styles.css passen

export function renderKalender(el) {
  el.innerHTML = istHandy() ? handyAnsicht() : wochenAnsicht();
  binden(el);
}

/* ── Daten ───────────────────────────────── */

function termineAn(key) {
  return state.alleAuftraege()
    .filter(a => a.termin && tagKey(parseTermin(a.termin)) === key)
    .sort(state.nachTermin);
}

const tagePlus = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Montag der Woche, in der d liegt. */
function wochenStart(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));   // Sonntag = 0 → 6
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Kalenderwoche nach ISO 8601 — in Deutschland die übliche Zählung. */
function kalenderwoche(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
  const jahresStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - jahresStart) / 86400000 + 1) / 7);
}

const stundeVon = (a) => { const d = parseTermin(a.termin); return d.getHours() + d.getMinutes() / 60; };

/* ── Desktop: Woche mit Stundenraster ────── */

function wochenAnsicht() {
  const start = wochenStart(anker);
  const tage = Array.from({ length: 7 }, (_, i) => tagePlus(start, i));
  const ende = tage[6];
  const heute = heuteKey();

  const alleDerWoche = tage.flatMap(d => termineAn(tagKey(d)));

  // Raster so weit aufziehen, dass kein Termin außerhalb liegt.
  const von = Math.min(RASTER_VON, ...alleDerWoche.map(a => Math.floor(stundeVon(a))));
  const bis = Math.max(RASTER_BIS, ...alleDerWoche.map(a => Math.ceil(stundeVon(a)) + 1));
  const stunden = Array.from({ length: bis - von }, (_, i) => von + i);

  const spanne = start.getMonth() === ende.getMonth()
    ? `${start.getDate()}.–${ende.getDate()}. ${monatName(ende)} ${ende.getFullYear()}`
    : `${start.getDate()}. ${monatName(start)} – ${ende.getDate()}. ${monatName(ende)} ${ende.getFullYear()}`;

  return `
    <div class="page-head">
      <div>
        <h1 class="page-title" id="t-kalender">Kalender</h1>
        <div class="page-sub">${alleDerWoche.length} ${alleDerWoche.length === 1 ? 'Termin' : 'Termine'}
          in dieser Woche · dieselben Aufträge wie in der Kartenansicht</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primaer" data-neu type="button">${icon('plus')} Auftrag erfassen</button>
      </div>
    </div>

    <div class="cal-bar">
      <button class="btn btn-sm" data-vor="-7" type="button" aria-label="Vorige Woche">${icon('zurueck')}</button>
      <button class="btn btn-sm" data-heute type="button">Heute</button>
      <button class="btn btn-sm" data-vor="7" type="button" aria-label="Nächste Woche">${icon('vor')}</button>
      <span class="cal-span">${esc(spanne)}</span>
      <span class="cal-kw">KW ${kalenderwoche(start)}</span>
    </div>

    <div class="wkal">
      <div class="wkal-kopf">
        <div class="wkal-kopf-eck"></div>
        ${tage.map(d => {
          const key = tagKey(d);
          const n = termineAn(key).length;
          return `
            <div class="wkal-tag ${key === heute ? 'heute' : ''}">
              <div class="wkal-wt">${wochentagKurz(d)}</div>
              <div class="wkal-d">${d.getDate()}</div>
              <span class="wkal-anzahl ${n ? '' : 'keine'}">${n ? `${n} ${n === 1 ? 'Einsatz' : 'Einsätze'}` : '–'}</span>
            </div>`;
        }).join('')}
      </div>

      <div class="wkal-koerper">
        <div class="wkal-stunden">
          ${stunden.map(h => `<div class="wkal-stunde">${String(h).padStart(2, '0')}:00</div>`).join('')}
        </div>
        ${tage.map(d => {
          const key = tagKey(d);
          return `
            <div class="wkal-spalte ${key === heute ? 'heute' : ''}">
              ${stunden.map(() => '<div class="wkal-raster"></div>').join('')}
              ${terminBloecke(termineAn(key), von)}
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

/**
 * Positioniert die Termine eines Tages im Raster.
 * Termine zur selben Stunde teilen sich die Spaltenbreite, damit keiner
 * hinter einem anderen verschwindet.
 */
function terminBloecke(liste, rasterVon) {
  if (!liste.length) return '';

  // Gruppieren, was sich innerhalb derselben Stunde überschneidet.
  const gruppen = [];
  for (const a of liste) {
    const h = stundeVon(a);
    const passend = gruppen.find(g => Math.abs(g.stunde - h) < 1);
    if (passend) passend.eintraege.push(a);
    else gruppen.push({ stunde: h, eintraege: [a] });
  }

  return gruppen.flatMap(g =>
    g.eintraege.map((a, i) => {
      const oben = (stundeVon(a) - rasterVon) * STUNDE_PX;
      const breite = 100 / g.eintraege.length;
      const st = state.STATUS[a.status];
      const d = parseTermin(a.termin);

      return `
        <button class="wkal-termin ${st.art}" data-auftrag="${a.id}" type="button"
                style="top:${oben + 2}px; min-height:${STUNDE_PX - 6}px;
                       left:calc(${i * breite}% + 3px); width:calc(${breite}% - 6px);"
                title="${esc(`${fmtUhr(d)} · ${a.aufgabe} · ${a.kunde}${a.adresse ? ' · ' + a.adresse : ''}`)}">
          <div class="wkal-t-zeit">${fmtUhr(d)}</div>
          <div class="wkal-t-titel">${esc(a.aufgabe) || 'Ohne Aufgabe'}</div>
          <div class="wkal-t-kunde">${esc(a.kunde)}</div>
        </button>`;
    })).join('');
}

/* ── Handy: Datumsstreifen + Tagesliste ──── */

function handyAnsicht() {
  const heute = heuteKey();
  const gewaehlt = tagKey(anker);
  const start = wochenStart(anker);
  // Genau eine Woche: sie muss vollständig aufs Bild, Sonntag eingeschlossen.
  // Vorher lagen 14 Tage in einem Querscroller, und Samstag/Sonntag fielen raus.
  const streifen = Array.from({ length: 7 }, (_, i) => tagePlus(start, i));
  const liste = termineAn(gewaehlt);

  return `
    <div class="page-head">
      <div>
        <h1 class="page-title" id="t-kalender">Kalender</h1>
        <div class="page-sub">${wochentag(anker)}, ${fmtDatum(anker)} · KW ${kalenderwoche(anker)}</div>
      </div>
    </div>

    <div class="cal-bar">
      <button class="btn btn-sm" data-vor="-7" type="button" aria-label="Woche zurück">${icon('zurueck')}</button>
      <button class="btn btn-sm" data-heute type="button">Heute</button>
      <button class="btn btn-sm" data-vor="7" type="button" aria-label="Woche vor">${icon('vor')}</button>
    </div>

    <div class="daystrip">${streifen.map(d => {
      const key = tagKey(d);
      const n = termineAn(key).length;
      return `
        <button class="daybtn ${key === gewaehlt ? 'active' : ''} ${key === heute ? 'heute' : ''}"
                data-tag="${key}" type="button"
                aria-label="${wochentag(d)}, ${fmtDatum(d)}, ${n} ${n === 1 ? 'Einsatz' : 'Einsätze'}">
          <div class="daybtn-wt">${wochentagKurz(d)}</div>
          <div class="daybtn-d">${d.getDate()}</div>
          <span class="daybtn-n ${n ? '' : 'keine'}">${n || '–'}</span>
        </button>`;
    }).join('')}</div>

    <div class="tag-liste">
      ${liste.length
        ? liste.map(tagesEintrag).join('')
        : `<div class="card">${leerZustand('Kein Termin an diesem Tag.',
            'Die Zahl unter jedem Datum oben zeigt, wie viele Einsätze anstehen.')}</div>`}
    </div>

    <div class="btn-zeile kal-neu">
      <button class="btn btn-primaer btn-block" data-neu type="button">${icon('plus')} Auftrag erfassen</button>
    </div>`;
}

function tagesEintrag(a) {
  const d = parseTermin(a.termin);
  const st = state.STATUS[a.status];

  return `
    <button class="tag-ev ${st.art}" data-auftrag="${a.id}" type="button">
      <span class="tag-ev-zeit">${fmtUhr(d)}</span>
      <span class="tag-ev-mid">
        <span class="tag-ev-titel">${esc(a.aufgabe) || 'Ohne Aufgabe'}</span>
        <span class="tag-ev-kunde">${esc(a.kunde)}</span>
        ${a.adresse ? `<span class="tag-ev-ort">${esc(a.adresse)}</span>` : ''}
        <span class="tag-ev-foot">${badge(st.label, st.art, true)}</span>
      </span>
    </button>`;
}

/* ── Interaktion ─────────────────────────── */

function binden(el) {
  const neu = () => renderKalender(el);

  el.querySelectorAll('[data-vor]').forEach(b => b.addEventListener('click', () => {
    anker = tagePlus(anker, Number(b.dataset.vor));
    neu();
  }));

  el.querySelector('[data-heute]')?.addEventListener('click', () => { anker = new Date(); neu(); });

  el.querySelectorAll('[data-tag]').forEach(b => b.addEventListener('click', () => {
    const [j, m, t] = b.dataset.tag.split('-').map(Number);
    anker = new Date(j, m - 1, t);
    neu();
  }));

  el.querySelector('[data-neu]')?.addEventListener('click', async () => {
    const { erfassungOeffnen } = await import('./erfassen.js');
    erfassungOeffnen();
  });

  el.querySelectorAll('[data-auftrag]').forEach(b =>
    b.addEventListener('click', () => akteOeffnen(b.dataset.auftrag)));
}
