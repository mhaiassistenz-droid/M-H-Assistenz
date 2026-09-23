/* ============================================
   page-home.js — der Startbildschirm

   Beantwortet die drei Fragen, die Edin morgens hat: Was steht heute an?
   Woran arbeite ich gerade? Was muss ich noch abrechnen? Jede Zeile führt
   direkt in den Vorgang — nichts muss gesucht werden.
   ============================================ */

import { esc, icon, fmtUhr, parseTermin, heuteKey, tagKey,
         wochentag, monatName, fmtEuro, istHandy } from './util.js';
import * as state from './state.js';
import { badge, leerZustand } from './ui.js';
import { akteOeffnen } from './akte.js';

export function renderHome(el) {
  const heute = heuteKey();
  const alle = state.alleAuftraege();

  const heutige = alle
    .filter(a => a.termin && tagKey(parseTermin(a.termin)) === heute && a.status !== 'erledigt')
    .sort(state.nachTermin);

  const laufend = alle.filter(a => a.status === 'inarbeit').sort(state.nachTermin);

  const entwuerfe = state.alleRechnungen()
    .filter(r => r.status === 'entwurf')
    .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));

  // Erledigte Aufträge, für die noch gar keine Rechnung existiert.
  const abzurechnen = alle.filter(a => a.status === 'erledigt' && state.rechnungsStatus(a.id) === 'keine');

  const d = new Date();

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title" id="t-home">${wochentag(d)}, ${d.getDate()}. ${monatName(d)}</h1>
        <div class="page-sub">${zusammenfassung(heutige.length, laufend.length, entwuerfe.length)}</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primaer" data-neu type="button">${icon('plus')} Auftrag erfassen</button>
      </div>
    </div>

    <div class="section-head erste">
      <div class="section-title">Heutige Einsätze</div>
      <span class="section-hint">${heutige.length || 'keine'}</span>
    </div>
    <div class="card">${heutige.length
      ? heutige.map(zeileAuftrag).join('')
      : leerZustand('Für heute ist kein Einsatz eingetragen.',
          'Termine erscheinen hier, sobald ein Auftrag für heute erfasst ist.')}</div>

    <div class="section-head">
      <div class="section-title">Laufende Arbeiten</div>
      <span class="section-hint">${laufend.length || 'keine'}</span>
    </div>
    <div class="card">${laufend.length
      ? laufend.map(zeileAuftrag).join('')
      : leerZustand('Gerade läuft nichts.',
          'Ein Auftrag landet hier, sobald „Arbeit starten" gedrückt wurde.')}</div>

    <div class="section-head">
      <div class="section-title">Rechnungsentwürfe zur Prüfung</div>
      <span class="section-hint">${entwuerfe.length || 'keine'}</span>
    </div>
    <div class="card">${entwuerfe.length
      ? entwuerfe.map(zeileEntwurf).join('')
      : leerZustand('Kein Entwurf offen.',
          'Entwürfe entstehen aus erledigten Aufträgen.')}</div>

    ${abzurechnen.length ? `
      <div class="section-head">
        <div class="section-title">Erledigt, noch nicht abgerechnet</div>
        <span class="section-hint">${abzurechnen.length}</span>
      </div>
      <div class="card">${abzurechnen.map(zeileAuftrag).join('')}</div>` : ''}

    ${istHandy() ? `
      <div class="home-fuss">
        <div class="hinweis">
          <span class="hinweis-marke">Demo</span>
          <span>Fiktive Daten. Foto-Auswertung, Spracherkennung und Rechnungsversand sind simuliert.</span>
        </div>
        <button class="btn btn-block" data-reset type="button">Demo zurücksetzen</button>
      </div>` : ''}`;

  binden(el);
}

function zusammenfassung(heute, laufend, entwuerfe) {
  if (!heute && !laufend && !entwuerfe) return 'Nichts offen. Guten Start in den Tag.';
  const t = [];
  if (heute)     t.push(`${heute} ${heute === 1 ? 'Einsatz' : 'Einsätze'} heute`);
  if (laufend)   t.push(`${laufend} in Arbeit`);
  if (entwuerfe) t.push(`${entwuerfe} ${entwuerfe === 1 ? 'Entwurf' : 'Entwürfe'} zu prüfen`);
  return t.join(' · ');
}

function zeileAuftrag(a) {
  const st = state.STATUS[a.status];
  const rs = state.RECHNUNGSSTATUS[state.rechnungsStatus(a.id)];
  const d = parseTermin(a.termin);

  return `
    <button class="row-item" data-auftrag="${a.id}" type="button">
      <span class="row-zeit">${d ? fmtUhr(d) : '—'}</span>
      <span class="row-mid">
        <span class="row-t">${esc(a.aufgabe) || 'Ohne Aufgabe'}</span>
        <span class="row-s">${esc(a.kunde)}${a.adresse ? ' · ' + esc(a.adresse) : ''}</span>
      </span>
      <span class="row-end">
        ${badge(st.label, st.art)}
        ${state.rechnungsStatus(a.id) !== 'keine' ? badge(rs.label, rs.art) : ''}
        ${icon('vor', 'row-chev')}
      </span>
    </button>`;
}

function zeileEntwurf(r) {
  const a = state.auftrag(r.auftragId);
  const s = state.summen(r);

  return `
    <button class="row-item" data-entwurf="${r.id}" type="button">
      <span class="row-mid">
        <span class="row-t">${esc(r.empfaenger.name) || 'Ohne Kunde'}</span>
        <span class="row-s">${esc(r.nummer)}${a ? ' · ' + esc(a.aufgabe) : ''}</span>
      </span>
      <span class="row-end">
        ${s.vollstaendig
          ? `<span class="row-betrag">${fmtEuro(s.brutto)}</span>`
          : badge(`${s.luecken} offen`, 'arbeit')}
        ${icon('vor', 'row-chev')}
      </span>
    </button>`;
}

function binden(el) {
  el.querySelector('[data-neu]')?.addEventListener('click', async () => {
    const { erfassungOeffnen } = await import('./erfassen.js');
    erfassungOeffnen();
  });

  el.querySelectorAll('[data-auftrag]').forEach(b =>
    b.addEventListener('click', () => akteOeffnen(b.dataset.auftrag)));

  el.querySelectorAll('[data-entwurf]').forEach(b =>
    b.addEventListener('click', async () => {
      const { entwurfOeffnen } = await import('./rechnung.js');
      entwurfOeffnen(b.dataset.entwurf);
    }));

  el.querySelector('[data-reset]')?.addEventListener('click', async () => {
    const { resetAusloesen } = await import('./app.js');
    resetAusloesen();
  });
}
