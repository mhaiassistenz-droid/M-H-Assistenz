/* Startseite: aktueller Einsatz, Tageslage und nächste Büroschritte.
   Alle Angaben kommen aus state.js; Home hält keinen eigenen Datenstand. */
import { esc, icon, fmtUhr, fmtTermin, parseTermin, heuteKey, tagKey,
         wochentag, monatName, fmtEuro, istHandy } from './util.js';
import * as state from './state.js';
import { badge } from './ui.js';
import { akteOeffnen } from './akte.js';

export function renderHome(el) {
  const heute = heuteKey();
  const alle = state.alleAuftraege();
  const offen = alle.filter(a => a.status !== 'erledigt').sort(state.nachTermin);
  const heutige = offen.filter(a => {
    const d = parseTermin(a.termin);
    return d && tagKey(d) === heute;
  });
  const laufend = offen.filter(a => a.status === 'inarbeit');
  const geplant = offen.filter(a => a.status === 'geplant');
  // Vergangene offene Termine bleiben weiter unten sichtbar.
  const naechster = geplant.find(a => {
    const d = parseTermin(a.termin);
    return d && tagKey(d) >= heute;
  });
  const aktuell = laufend[0] || naechster || geplant[0];
  const weitereHeute = heutige.filter(a => a.id !== aktuell?.id && a.status !== 'inarbeit');
  const weitereLaufend = laufend.filter(a => a.id !== aktuell?.id);
  const vergangene = geplant.filter(a => {
    const d = parseTermin(a.termin);
    return a.id !== aktuell?.id && (!d || tagKey(d) < heute);
  });
  const entwuerfe = state.alleRechnungen().filter(r => r.status === 'entwurf')
    .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
  const abzurechnen = alle.filter(a => a.status === 'erledigt' && state.rechnungsStatus(a.id) === 'keine');
  const d = new Date();
  const gruss = d.getHours() < 11 ? 'Guten Morgen' : d.getHours() < 18 ? 'Guten Tag' : 'Guten Abend';

  el.innerHTML = `
    <div class="home-dashboard">
      <header class="home-head">
        <div>
          <h1 class="page-title" id="t-home">${gruss}, Edin</h1>
          <p class="home-date">${wochentag(d)}, ${d.getDate()}. ${monatName(d)}
            <span class="home-date-detail">${heutige.length} ${heutige.length === 1 ? 'offener Einsatz' : 'offene Einsätze'} heute</span></p>
        </div>
        <button class="btn btn-primaer" data-neu type="button">${icon('plus')} Auftrag erfassen</button>
      </header>

      <div class="home-grid">
        <section class="home-panel home-current" aria-labelledby="home-current-title">
          <div class="home-panel-head">
            <h2 id="home-current-title">${laufend.length ? 'Aktuell in Arbeit' : 'Nächster Einsatz'}</h2>
            ${aktuell ? badge(state.STATUS[aktuell.status].label, state.STATUS[aktuell.status].art) : ''}
          </div>
          ${aktuell ? fokusAuftrag(aktuell) : `
            <div class="home-empty home-empty-focus">
              <span class="home-empty-icon">${icon('check')}</span>
              <h3>Platz für den nächsten Auftrag.</h3>
              <p>Momentan ist kein Einsatz offen. Einen vereinbarten Auftrag kannst du direkt erfassen.</p>
              <button class="btn" data-neu type="button">${icon('plus')} Auftrag erfassen</button>
            </div>`}
        </section>

        <section class="home-panel home-overview" aria-labelledby="home-overview-title">
          <div class="home-panel-head"><h2 id="home-overview-title">Dein Überblick</h2></div>
          <dl class="home-metrics">
            ${kennzahl('Einsätze heute', heutige.length, 'Offen oder in Arbeit', 'kalender')}
            ${kennzahl('In Arbeit', laufend.length, 'Alle laufenden Aufträge', 'play')}
            ${kennzahl('Entwürfe', entwuerfe.length, 'Bereit zur Prüfung', 'rechnung')}
          </dl>
        </section>

        <section class="home-panel home-schedule" aria-labelledby="home-schedule-title">
          <div class="home-panel-head">
            <h2 id="home-schedule-title">${aktuell && heutige.some(a => a.id === aktuell.id) ? 'Heute noch anstehend' : 'Heutige Einsätze'}</h2>
            <a class="home-link" href="#kalender">Kalender ${icon('vor')}</a>
          </div>
          ${weitereHeute.length ? weitereHeute.map(a => zeileAuftrag(a, true)).join('')
            : `<div class="home-empty"><p>Keine weiteren geplanten Einsätze heute.</p><span>Die nächsten Termine findest du im Kalender.</span></div>`}
          ${weitereLaufend.length ? `<h3 class="home-list-label">Weitere laufende Arbeiten</h3>${weitereLaufend.map(a => zeileAuftrag(a)).join('')}` : ''}
          ${vergangene.length ? `<h3 class="home-list-label">Termin prüfen</h3>${vergangene.map(a => zeileAuftrag(a)).join('')}` : ''}
          <a class="home-panel-link" href="#auftraege">Alle Aufträge ansehen ${icon('vor')}</a>
        </section>

        <section class="home-panel home-invoices" aria-labelledby="home-invoices-title">
          <div class="home-panel-head"><h2 id="home-invoices-title">Rechnungen prüfen</h2><span class="home-count">${entwuerfe.length}</span></div>
          ${entwuerfe.length ? entwuerfe.map(zeileEntwurf).join('') : `
            <div class="home-empty"><p>Kein Entwurf offen.</p><span>Rechnungsentwürfe entstehen aus der dokumentierten Arbeit.</span></div>`}
          <a class="home-panel-link" href="#rechnungen">Alle Rechnungen ansehen ${icon('vor')}</a>
        </section>

        ${abzurechnen.length ? `<section class="home-panel home-unbilled" aria-labelledby="home-unbilled-title">
          <div class="home-panel-head"><h2 id="home-unbilled-title">Erledigt · Rechnung noch offen</h2><span class="home-count">${abzurechnen.length}</span></div>
          ${abzurechnen.map(a => zeileAuftrag(a)).join('')}
        </section>` : ''}
      </div>

      ${istHandy() ? `<div class="home-fuss">
        <div class="hinweis"><span class="hinweis-marke">Demo</span><span>Fiktive Daten. Foto-Auswertung, Spracherkennung und Rechnungsversand sind simuliert.</span></div>
        <button class="btn btn-block" data-reset type="button">Demo zurücksetzen</button>
      </div>` : ''}
    </div>`;
  binden(el);
}

function kennzahl(label, wert, beschreibung, ikone) {
  return `<div class="home-metric">
    <dt><span class="home-metric-icon">${icon(ikone)}</span><span>${label}<small>${beschreibung}</small></span></dt>
    <dd>${wert}</dd>
  </div>`;
}

function fokusAuftrag(a) {
  const anzahl = a.verlauf.length;
  return `<div class="home-focus-body">
      <p class="home-focus-date">${icon('kalender')}${esc(fmtTermin(a.termin))}</p>
      <h3 class="home-focus-title">${esc(a.aufgabe) || 'Ohne Aufgabe'}</h3>
      <p class="home-customer">${esc(a.kunde)}</p>
      <p class="home-address">${icon('ort')}${esc(a.adresse) || 'Objektadresse fehlt'}</p>
    </div>
    <div class="home-focus-foot">
      <span class="home-progress">${icon('notiz')}${anzahl ? `${anzahl} ${anzahl === 1 ? 'Eintrag' : 'Einträge'} dokumentiert` : 'Noch keine Dokumentation'}</span>
      <button class="btn btn-primaer" data-auftrag="${esc(a.id)}" type="button">Auftrag öffnen ${icon('vor')}</button>
    </div>`;
}

function zeileAuftrag(a, nurUhr = false) {
  const st = state.STATUS[a.status];
  const d = parseTermin(a.termin);
  return `<button class="home-job" data-auftrag="${esc(a.id)}" type="button">
    <span class="home-job-time">${nurUhr && d ? fmtUhr(d) : esc(fmtTermin(a.termin))}</span>
    <span class="home-job-content"><span class="home-job-title">${esc(a.aufgabe) || 'Ohne Aufgabe'}</span>
      <span class="home-job-customer">${esc(a.kunde)}</span>
      ${a.adresse ? `<span class="home-job-address">${esc(a.adresse)}</span>` : ''}
      ${badge(st.label, st.art)}
    </span>${icon('vor', 'home-chevron')}
  </button>`;
}

function zeileEntwurf(r) {
  const a = state.auftrag(r.auftragId);
  const s = state.summen(r);
  return `<button class="home-invoice" data-entwurf="${esc(r.id)}" type="button">
    <span class="home-invoice-number">${icon('rechnung')}${esc(r.nummer)}</span>
    <span class="home-invoice-customer">${esc(r.empfaenger.name) || 'Ohne Kunde'}</span>
    ${a ? `<span class="home-invoice-task">${esc(a.aufgabe)}</span>` : ''}
    <span class="home-invoice-total">${s.vollstaendig ? fmtEuro(s.brutto)
      : badge(`${s.luecken} ${s.luecken === 1 ? 'Angabe fehlt' : 'Angaben fehlen'}`, 'arbeit')}</span>
    <span class="home-invoice-action">Entwurf prüfen ${icon('vor')}</span>
  </button>`;
}

function binden(el) {
  el.querySelectorAll('[data-neu]').forEach(b => b.addEventListener('click', async () => {
    const { erfassungOeffnen } = await import('./erfassen.js');
    erfassungOeffnen();
  }));
  el.querySelectorAll('[data-auftrag]').forEach(b =>
    b.addEventListener('click', () => akteOeffnen(b.dataset.auftrag)));
  el.querySelectorAll('[data-entwurf]').forEach(b => b.addEventListener('click', async () => {
    const { entwurfOeffnen } = await import('./rechnung.js');
    entwurfOeffnen(b.dataset.entwurf);
  }));
  el.querySelector('[data-reset]')?.addEventListener('click', async () => {
    const { resetAusloesen } = await import('./app.js');
    resetAusloesen();
  });
}
