/* ============================================
   page-auftraege.js — der Überblick

   Desktop: drei Spalten nebeneinander, damit der ganze Bestand auf
   einen Blick da ist. Handy: dieselben drei Kategorien als Filter über
   einer einspaltigen Liste — nebeneinander wären die Karten dort zu eng.

   Der Status steht immer zusätzlich als Text auf der Karte, nicht nur
   als Farbe. Rot kommt hier nicht vor: das bleibt echten Fehlern.
   ============================================ */

import { esc, icon, fmtTermin, istHandy } from './util.js';
import * as state from './state.js';
import { badge, leerZustand } from './ui.js';
import { akteOeffnen } from './akte.js';

const SPALTEN = [
  { status: 'geplant',  label: 'Geplant'   },
  { status: 'inarbeit', label: 'In Arbeit' },
  { status: 'erledigt', label: 'Erledigt'  },
];

/** Aktiver Filter auf dem Handy. Überlebt den Ansichtswechsel. */
let filter = 'geplant';

export function renderAuftraege(el) {
  const zahl = Object.fromEntries(SPALTEN.map(s => [s.status, state.auftraegeNachStatus(s.status).length]));
  const gesamt = state.alleAuftraege().length;

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title" id="t-auftraege">Aufträge</h1>
        <div class="page-sub">${gesamt} ${gesamt === 1 ? 'Auftrag' : 'Aufträge'} · Arbeitsstatus und
          Rechnungsstatus stehen getrennt auf jeder Karte</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primaer" data-neu type="button">${icon('plus')} Auftrag erfassen</button>
      </div>
    </div>

    ${gesamt === 0
      ? `<div class="card">${leerZustand('Noch kein Auftrag erfasst.',
          'Über „Auftrag erfassen" den ersten anlegen — per Foto, manuell oder eingesprochen.')}</div>`
      : istHandy() ? handyAnsicht(zahl) : boardAnsicht()}`;

  binden(el);
}

/* ── Desktop: drei Spalten ───────────────── */

function boardAnsicht() {
  return `<div class="board">${SPALTEN.map(sp => {
    const liste = state.auftraegeNachStatus(sp.status);
    return `
      <div class="board-col">
        <div class="col-head">${sp.label}<span class="col-n">${liste.length}</span></div>
        ${liste.length
          ? liste.map(karte).join('')
          : `<div class="state-box">Nichts ${sp.label.toLowerCase()}</div>`}
      </div>`;
  }).join('')}</div>`;
}

/* ── Handy: Filter + eine Spalte ─────────── */

function handyAnsicht(zahl) {
  const liste = state.auftraegeNachStatus(filter);
  const sp = SPALTEN.find(s => s.status === filter);

  return `
    <div class="filterzeile">
      <div class="chips">
      ${SPALTEN.map(s => `
        <button class="chip ${s.status === filter ? 'active' : ''}" data-filter="${s.status}" type="button">
          ${s.label}<span class="chip-count">${zahl[s.status]}</span>
        </button>`).join('')}
      </div>
    </div>
    <div class="board-col">
      ${liste.length
        ? liste.map(karte).join('')
        : leerZustand(`Nichts ${sp.label.toLowerCase()}.`,
            filter === 'geplant' ? 'Neue Aufträge landen zuerst hier.'
          : filter === 'inarbeit' ? 'Ein Auftrag kommt hierher, sobald „Arbeit starten" gedrückt wurde.'
          : 'Abgeschlossene Aufträge sammeln sich hier.')}
    </div>`;
}

/* ── Karte ───────────────────────────────── */

function karte(a) {
  const st = state.STATUS[a.status];
  const rs = state.RECHNUNGSSTATUS[state.rechnungsStatus(a.id)];

  return `
    <button class="auf-card" data-auftrag="${a.id}" type="button">
      <div class="ac-aufgabe">${esc(a.aufgabe) || 'Ohne Aufgabe'}</div>
      <div class="ac-kunde">${esc(a.kunde) || 'Ohne Kunde'}</div>
      ${a.adresse ? `<div class="ac-meta">${icon('ort')}<span>${esc(a.adresse)}</span></div>` : ''}
      <div class="ac-meta">${icon('kalender')}<span class="ac-termin">${esc(fmtTermin(a.termin))}</span></div>
      <div class="ac-foot">
        ${badge(st.label, st.art, true)}
        ${badge(rs.label, rs.art, true)}
      </div>
    </button>`;
}

/* ── Interaktion ─────────────────────────── */

function binden(el) {
  el.querySelector('[data-neu]')?.addEventListener('click', async () => {
    const { erfassungOeffnen } = await import('./erfassen.js');
    erfassungOeffnen();
  });

  el.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    renderAuftraege(el);
  }));

  el.querySelectorAll('[data-auftrag]').forEach(b =>
    b.addEventListener('click', () => akteOeffnen(b.dataset.auftrag)));
}
