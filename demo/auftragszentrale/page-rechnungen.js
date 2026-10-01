/* ============================================
   page-rechnungen.js — der Geldpfad

   Entwürfe und simuliert versendete Rechnungen. Jede Zeile verlinkt
   zurück auf ihren Auftrag, jeder Auftrag auf seine Rechnung — dupliziert
   wird nichts. Ein Betrag wird nur gezeigt, wenn er vollständig ist.
   ============================================ */

import { esc, icon, fmtEuro, fmtDatum, parseTermin } from './util.js';
import * as state from './state.js';
import { badge, leerZustand } from './ui.js';
import { akteOeffnen } from './akte.js';

let filter = 'alle';   // alle | entwurf | versendet

/* Home verlinkt ausdrücklich auf die vollständige Rechnungsliste. Ein zuvor
   gewählter Filter darf diesen Weg daher nicht zu einer leeren Liste machen. */
export function rechnungsFilterSetzen(wert) {
  filter = ['alle', 'entwurf', 'versendet'].includes(wert) ? wert : 'alle';
}

export function renderRechnungen(el) {
  const alle = [...state.alleRechnungen()]
    .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

  // „Erstellt" heisst: liegt im Rechnungsdienst, ist aber noch nicht beim
  // Kunden. Fuer Edin ist das weiterhin offen, also steht es bei den
  // Entwuerfen — mit eigenem Schild, damit der Unterschied sichtbar bleibt.
  const entwuerfe = alle.filter(r => !state.istVersendet(r));
  // Demo-Versand und echter Versand gehoeren in dieselbe Gruppe: fuer Edin
  // ist beides "raus".
  const versendet = alle.filter(r => state.istVersendet(r));
  const liste = filter === 'entwurf' ? entwuerfe : filter === 'versendet' ? versendet : alle;

  // Erledigte Aufträge ohne jede Rechnung — sonst wären sie hier unsichtbar.
  const ohne = state.alleAuftraege()
    .filter(a => a.status === 'erledigt' && state.rechnungsStatus(a.id) === 'keine');

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title" id="t-rechnungen">Rechnungen</h1>
        <div class="page-sub">${alle.length} ${alle.length === 1 ? 'Rechnung' : 'Rechnungen'} ·
          ${entwuerfe.length} im Entwurf</div>
      </div>
      <button class="btn" data-preisliste type="button">${icon('liste')} Preisliste${state.alleArtikel().length
        ? ` <span class="chip-count">${state.alleArtikel().length}</span>` : ''}</button>
    </div>

    ${alle.length ? `
      <div class="filterzeile">
        <div class="chips">
        ${[['alle', 'Alle', alle.length],
           ['entwurf', 'Offen', entwuerfe.length],
           ['versendet', 'Versendet', versendet.length]].map(([id, label, n]) => `
          <button class="chip ${filter === id ? 'active' : ''}" data-filter="${id}" type="button">
            ${label}<span class="chip-count">${n}</span>
          </button>`).join('')}
        </div>
      </div>` : ''}

    <div class="card">${liste.length
      ? liste.map(zeile).join('')
      : leerZustand(
          alle.length ? 'In dieser Auswahl ist nichts.' : 'Noch keine Rechnung.',
          'Eine Rechnung entsteht in der Akte eines erledigten Auftrags über „Rechnung erstellen".')}</div>

    ${ohne.length ? `
      <div class="section-head">
        <div class="section-title">Erledigt, noch ohne Rechnung</div>
        <span class="section-hint">${ohne.length}</span>
      </div>
      <div class="card">${ohne.map(zeileAuftragOhne).join('')}</div>` : ''}`;

  binden(el);
}

function zeile(r) {
  const a = state.auftrag(r.auftragId);
  const s = state.summen(r);
  const rs = state.RECHNUNGSSTATUS[r.status] || state.RECHNUNGSSTATUS.entwurf;
  const art = s.vollstaendig ? rs.art : 'arbeit';

  return `
    <button class="row-item ${art}" data-rechnung="${r.id}" type="button">
      <span class="row-mid">
        <span class="row-t">${esc(r.empfaenger.name) || 'Ohne Kunde'}</span>
        <span class="row-s">
          <span class="mono">${esc(r.nummer)}</span> ·
          ${esc(fmtDatum(parseTermin(r.datum)))}${a ? ' · ' + esc(a.aufgabe) : ''}
        </span>
      </span>
      <span class="row-end">
        ${s.vollstaendig
          ? `<span class="row-betrag">${fmtEuro(s.brutto)}</span>`
          : badge(`${s.luecken} offen`, 'arbeit')}
        ${badge(rs.label, rs.art)}
        ${icon('vor', 'row-chev')}
      </span>
    </button>`;
}

function zeileAuftragOhne(a) {
  return `
    <button class="row-item" data-auftrag="${a.id}" type="button">
      <span class="row-mid">
        <span class="row-t">${esc(a.kunde) || 'Ohne Kunde'}</span>
        <span class="row-s">${esc(a.aufgabe)}</span>
      </span>
      <span class="row-end">
        ${badge('Keine Rechnung', 'neutral')}
        ${icon('vor', 'row-chev')}
      </span>
    </button>`;
}

function binden(el) {
  el.querySelector('[data-preisliste]')?.addEventListener('click', async () => {
    const { preislisteOeffnen } = await import('./preisliste-ui.js');
    preislisteOeffnen();
  });

  el.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    renderRechnungen(el);
  }));

  el.querySelectorAll('[data-rechnung]').forEach(b =>
    b.addEventListener('click', async () => {
      const { entwurfOeffnen } = await import('./rechnung.js');
      entwurfOeffnen(b.dataset.rechnung);
    }));

  // Führt in die Akte — von dort startet "Rechnung erstellen".
  el.querySelectorAll('[data-auftrag]').forEach(b =>
    b.addEventListener('click', () => akteOeffnen(b.dataset.auftrag)));
}
