/* Startseite: aktueller Einsatz, Tageslage und nächste Büroschritte.
   Alle Angaben kommen aus state.js; Home hält keinen eigenen Datenstand. */
import { esc, icon, fmtUhr, fmtTermin, parseTermin, heuteKey, tagKey,
         wochentag, monatName, fmtEuro, istHandy } from './util.js';
import * as flows from './flows.js';
import * as state from './state.js';
import { badge } from './ui.js';
import { akteOeffnen } from './akte.js';
import { geldPanel, geldBinden } from './home-geld.js';
import { rechnungsFilterSetzen } from './page-rechnungen.js';

/* Steht ein echter Dienst dahinter, darf die Fusszeile nicht weiter von
   Simulation sprechen. Die Pruefung ist asynchron; bis sie da ist, gilt die
   vorsichtigere Aussage. */
let echterDienst = false;
flows.verfuegbar().then((ja) => {
  if (!ja) return;
  echterDienst = true;
});

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
  // Freigabe bedeutet: alle noch nicht versendeten Rechnungen. Das entspricht
  // der Rechnungsliste und schließt auch bereits erstellte Belege ein.
  const entwuerfe = state.alleRechnungen().filter(r => !state.istVersendet(r))
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
        ${geldPanel()}

        <section class="home-panel home-overview" aria-labelledby="home-overview-title">
          <div class="home-panel-head"><h2 id="home-overview-title">Dein Überblick</h2></div>
          ${ueberblickKreis(heutige.length, laufend.length, entwuerfe.length)}
          <dl class="home-metrics">
            ${kennzahl('Einsätze heute', heutige.length, 'Offen oder in Arbeit', 'heute')}
            ${kennzahl('In Arbeit', laufend.length, 'Alle laufenden Aufträge', 'arbeit')}
            ${kennzahl('Entwürfe', entwuerfe.length, 'Bereit zur Prüfung', 'entwurf')}
          </dl>
        </section>

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

        ${rechnungsFreigabe(entwuerfe.length)}

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

        ${abzurechnen.length ? `<section class="home-panel home-unbilled" aria-labelledby="home-unbilled-title">
          <div class="home-panel-head"><h2 id="home-unbilled-title">Erledigt · Rechnung noch offen</h2><span class="home-count">${abzurechnen.length}</span></div>
          ${abzurechnen.map(a => zeileAuftrag(a)).join('')}
        </section>` : ''}
      </div>

      ${istHandy() ? `<div class="home-fuss">
        ${echterDienst
          ? `<div class="hinweis"><span>Fiktive Kundendaten. Foto-Auswertung, Spracherkennung und Rechnungsversand laufen über echte Dienste.</span></div>`
          : `<div class="hinweis"><span class="hinweis-marke">Demo</span><span>Bitte keine echten Kundendaten eingeben. Foto-Auswertung, Spracherkennung und Rechnungsversand sind simuliert.</span></div>`}
        <button class="btn btn-block" data-reset type="button">Demo zurücksetzen</button>
      </div>` : ''}
    </div>`;
  binden(el);
}

function ueberblickKreis(heute, inArbeit, entwuerfe) {
  const werte = [heute, inArbeit, entwuerfe].map(wert => Math.max(0, Number(wert) || 0));
  const summe = werte.reduce((summe, wert) => summe + wert, 0);
  // Einzelbögen statt sich wiederholender Dashmuster. Die runden Enden gehören
  // zur belegten Fläche: beide Kappen und ein sichtbarer Spalt werden abgezogen.
  const radius = 110;
  const vollkreis = Math.PI * 2;
  const aktiveSegmente = werte.filter(wert => wert > 0).length;
  const punkt = winkel => `${(125 + radius * Math.cos(winkel)).toFixed(5)} ${(125 + radius * Math.sin(winkel)).toFixed(5)}`;
  let start = -Math.PI / 2;
  const segmente = werte.map((wert, index) => {
    if (!wert) return ''; // Eine Null bekommt wie in der Vorlage kein Segment.
    const winkel = wert / summe * vollkreis;
    // Extrem kleine Werte erhalten dünnere Bögen, damit auch deren Kappen
    // innerhalb des tatsächlichen Anteils bleiben und nichts überlappen kann.
    const breite = Math.min(30, 2 * radius * Math.sin(winkel / 6));
    const kappe = Math.asin(breite / (2 * radius));
    const luecke = Math.min(0.045, winkel * 0.08);
    const von = start + kappe + luecke / 2;
    const bis = start + winkel - kappe - luecke / 2;
    const d = aktiveSegmente === 1
      ? 'M 125 15 A 110 110 0 1 1 125 235 A 110 110 0 1 1 125 15'
      : `M ${punkt(von)} A 110 110 0 ${bis - von > Math.PI ? 1 : 0} 1 ${punkt(bis)}`;
    start += winkel;
    const art = ['heute', 'arbeit', 'entwurf'][index];
    return `<path class="home-overview-segment ${art}" data-chart-segment="${art}"
      d="${d}" pathLength="1" style="stroke-width:${breite};--segment-delay:${index * .05}s" />`;
  }).join('');
  return `<div class="home-overview-visual">
    <div class="home-overview-chart" role="img" aria-label="Tageslage. Einsätze heute: ${werte[0]}. In Arbeit: ${werte[1]}. Entwürfe: ${werte[2]}.">
      <svg viewBox="0 0 250 250" aria-hidden="true" focusable="false">
        <circle class="home-overview-track" cx="125" cy="125" r="110" />
        ${segmente}
      </svg>
      <span class="home-overview-centre"><small>Einsätze heute</small><strong>${werte[0]}</strong></span>
    </div>
  </div>`;
}

function kennzahl(label, wert, beschreibung, art) {
  return `<div class="home-metric ${art}" data-chart-key="${art}" data-chart-value="${wert}" data-chart-label="${label}">
    <dt><button class="home-metric-control" type="button" aria-label="${label}: ${wert} – im Diagramm anzeigen" aria-pressed="false" title="${beschreibung}"><span class="home-metric-dot" aria-hidden="true"></span>${label}</button></dt>
    <dd>${wert}</dd>
  </div>`;
}

/* Visuelle Vanilla-Entsprechung der InvoiceApprovalCard. Der Zustand kommt
   ausschließlich aus state.js; die Karte hält keine eigene Rechnungsliste. */
function rechnungsFreigabe(anzahl) {
  const count = Math.max(0, Math.floor(Number(anzahl) || 0));
  const plural = count === 1 ? 'Rechnung' : 'Rechnungen';
  const hinweis = count === 0
    ? 'Aktuell sind keine Rechnungen freizugeben.'
    : 'Prüfen, freigeben und anschließend absenden.';
  return `<section class="home-panel home-invoices invoice-approval-card" aria-labelledby="invoice-approval-title">
    <div class="invoice-approval-head">
      <h2 id="invoice-approval-title">Freizugebende Rechnungen</h2>
      <span class="invoice-approval-icon" aria-hidden="true">${icon('rechnung')}</span>
    </div>
    <div class="invoice-approval-status">
      <div class="invoice-approval-status-head">
        <p>Zur Freigabe</p>
        <span aria-hidden="true">${icon('vor')}</span>
      </div>
      <p class="invoice-approval-number" aria-live="polite" aria-atomic="true">
        <strong class="invoice-approval-count">${count.toLocaleString('de-DE')}</strong>
        <span>${plural}</span>
      </p>
      <p class="invoice-approval-copy">${hinweis}</p>
    </div>
    <div class="invoice-approval-foot">
      <span>Rechnungen freigeben</span>
      <a class="invoice-link" href="#rechnungen" data-rechnungen-alle>Alle Rechnungen ansehen ${icon('vor')}</a>
    </div>
  </section>`;
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
  geldBinden(el, () => renderHome(el));
  const overview = el.querySelector('.home-overview');
  const centre = overview.querySelector('.home-overview-centre');
  const rows = [...overview.querySelectorAll('[data-chart-key]')];
  let gewaehlt = null;
  const zeigen = key => {
    const row = rows.find(row => row.dataset.chartKey === key) || rows[0];
    centre.querySelector('strong').textContent = row.dataset.chartValue;
    centre.querySelector('small').textContent = row.dataset.chartLabel;
    rows.forEach(row => {
      const aktiv = row.dataset.chartKey === key;
      row.classList.toggle('is-active', aktiv);
      row.querySelector('button').setAttribute('aria-pressed', String(row.dataset.chartKey === gewaehlt));
    });
    overview.querySelectorAll('[data-chart-segment]').forEach(segment => {
      segment.classList.toggle('is-active', segment.dataset.chartSegment === key);
    });
  };
  rows.forEach(row => {
    const key = row.dataset.chartKey;
    row.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') zeigen(key); });
    row.querySelector('button').addEventListener('focus', () => zeigen(key));
    row.querySelector('button').addEventListener('click', () => {
      gewaehlt = gewaehlt === key ? null : key;
      zeigen(gewaehlt);
    });
  });
  overview.querySelectorAll('[data-chart-segment]').forEach(segment => {
    segment.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') zeigen(segment.dataset.chartSegment);
    });
    segment.addEventListener('click', () => {
      const key = segment.dataset.chartSegment;
      gewaehlt = gewaehlt === key ? null : key;
      zeigen(gewaehlt);
    });
  });
  overview.addEventListener('pointerleave', () => zeigen(gewaehlt));
  overview.addEventListener('focusout', event => {
    if (!overview.contains(event.relatedTarget)) zeigen(gewaehlt);
  });
  overview.addEventListener('keydown', event => {
    if (event.key === 'Escape') { gewaehlt = null; zeigen(null); }
  });
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
  el.querySelectorAll('[data-rechnungen-alle]').forEach(link =>
    link.addEventListener('click', () => rechnungsFilterSetzen('alle')));
  el.querySelector('[data-reset]')?.addEventListener('click', async () => {
    const { resetAusloesen } = await import('./app.js');
    resetAusloesen();
  });
}
