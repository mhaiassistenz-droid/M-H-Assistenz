/* ============================================
   bericht.js — Einsatzbericht (Schritt 4)

   Die Ansicht, die Edin dem Kunden zeigen kann: Objekt, Datum, ausgeführte
   Arbeiten, Zeiten, Material, ausgewählte Fotos und offene Punkte. Bewusst
   getrennt von der Akte — die Akte ist Edins Arbeitsfläche mit internen
   Notizen, der Bericht ist das, was nach außen geht.

   Grundlage ist ausschließlich die übernommene Dokumentation (`berichtDaten`
   in state.js). Die vereinbarte Aufgabe steht getrennt als Referenz daneben,
   genau wie im Rechnungsentwurf (Fachregel 3).

   Ehrlich über den Speicherort: der Bericht existiert nur in diesem Browser.
   Das Wort „archiviert" kommt hier nicht vor, solange es kein zentrales
   Archiv gibt.
   ============================================ */

import { esc, icon, uid, fmtDatum, fmtStunden, parseTermin, fmtUhr, zahlZuFeld } from './util.js';
import * as fotos from './fotos.js';
import * as state from './state.js';
import { sheetOeffnen, sheetSchliessen, hinweisBox, leerZustand, toast, badge } from './ui.js';
import { ABSENDER } from './rechnung.js';

/** Öffnet den Bericht zu einem Auftrag. */
export function berichtOeffnen(auftragId, danach) {
  if (!state.auftrag(auftragId)) return;
  sheetOeffnen({
    titel: 'Einsatzbericht',
    body: () => koerper(state.auftrag(auftragId)),
    foot: () => {
      const a = state.auftrag(auftragId);
      const n = state.berichtNachtraege(a);
      const bestaetigen = !n ? 'Bestätigen lassen' : n.leer ? '' : 'Nachtrag bestätigen';
      return `
        <button class="btn" data-bericht-drucken type="button">${icon('rechnung')} Drucken / PDF</button>
        ${bestaetigen
          ? `<button class="btn btn-primaer" data-bericht-bestaetigen type="button">${esc(bestaetigen)}</button>`
          : '<button class="btn" data-bericht-zu type="button">Zurück zur Akte</button>'}`;
    },
    bind: (el, api) => {
      el.querySelector('.sheet').classList.add('sheet-bericht');
      el.querySelectorAll('[data-bericht-wahl]').forEach(b => b.addEventListener('change', () => {
        state.berichtAuswahl(auftragId, b.dataset.berichtWahl, b.checked);
        api.render();
      }));
      el.querySelector('[data-bericht-zu]')?.addEventListener('click', sheetSchliessen);
      el.querySelector('[data-bericht-bestaetigen]')?.addEventListener('click', () =>
        unterschriftOeffnen(auftragId, () => api.render()));
      el.querySelector('[data-bericht-drucken]').addEventListener('click', () => drucken(el));
    },
    onClose: () => danach?.(),
  });
}

/**
 * Drucken bzw. „Als PDF sichern" über den Druckdialog des Browsers — lokal, ohne
 * Dienst. Gedruckt wird nur das erste Dokument im Sheet: die zuletzt bestätigte
 * Fassung, sonst der aktuelle Bericht (siehe @media print in styles.css).
 */
function drucken(el) {
  el.querySelectorAll('.druck-ziel').forEach(d => d.classList.remove('druck-ziel'));
  el.querySelector('[data-bericht-dok]')?.classList.add('druck-ziel');
  document.body.classList.add('druckt-bericht');
  const fertig = () => { document.body.classList.remove('druckt-bericht'); window.removeEventListener('afterprint', fertig); };
  window.addEventListener('afterprint', fertig);
  window.print();
}

function koerper(a) {
  const f = state.letzteFassung(a);
  const hinweis = hinweisBox('Bericht aus Ihrer Dokumentation. Er liegt nur in diesem Browser — es gibt noch '
    + 'kein zentrales Archiv. Absender und Daten dieser Demo sind erfunden.');
  if (!f) return `${hinweis}${dokument(state.berichtDaten(a))}${auswahl(a)}`;

  const n = state.berichtNachtraege(a);
  const aeltere = state.berichtFassungen(a).slice(0, -1).reverse();
  return `
    ${hinweis}
    <div class="bericht-status">${badge(`Bestätigte Fassung ${f.nummer} (Demo)`, 'fertig')}
      <span>vom ${esc(zeitpunkt(f.am))} · ${esc(f.name)}</span></div>
    ${dokument(f.stand, { zusatz: unterschriftBlock(f) })}
    ${nachtragBlock(n)}
    ${aeltere.length ? `
      <details class="bericht-aeltere"><summary>Frühere Fassungen (${aeltere.length})</summary>
        ${aeltere.map(x => `<div class="bericht-status">${badge(`Fassung ${x.nummer}`, 'neutral')}
          <span>vom ${esc(zeitpunkt(x.am))} · ${esc(x.name)}</span></div>
          ${dokument(x.stand, { zusatz: unterschriftBlock(x), markierung: 'alt' })}`).join('')}
      </details>` : ''}
    <details class="bericht-aktuell"><summary>Aktuellen Stand ansehen und Auswahl ändern</summary>
      ${dokument(state.berichtDaten(a), { markierung: 'aktuell' })}
      ${auswahl(a)}
    </details>`;
}

const zeitpunkt = (iso) => { const d = parseTermin(iso); return d ? `${fmtDatum(d)}, ${fmtUhr(d)} Uhr` : '—'; };

function unterschriftBlock(f) {
  return `
    <div class="bericht-unterschrift">
      <div class="abgleich-l">Bestätigt durch ${esc(f.name)} am ${esc(zeitpunkt(f.am))}</div>
      ${f.unterschriftId
        ? `<div class="bericht-sig" data-foto-huelle><img data-foto-id="${esc(f.unterschriftId)}" alt="Unterschrift ${esc(f.name)}"></div>`
        : '<div class="bericht-leer">Unterschrift nicht verfügbar</div>'}
      ${f.nurDieseSitzung ? '<div class="bericht-leer">Die Unterschrift konnte nicht dauerhaft gespeichert werden — nur in dieser Sitzung vorhanden.</div>' : ''}
      <div class="bericht-demo">Demo-Unterschrift — keine rechtsverbindliche Bestätigung, nur in diesem Browser gespeichert.</div>
    </div>`;
}

function nachtragBlock(n) {
  if (!n || n.leer) return '<div class="hint-note" data-nachtrag-leer>Seit der Bestätigung hat sich nichts geändert.</div>';
  const zeile = (x) => `<li>${esc(BEREICH[x.bereich] || '')}: ${esc(x.text || 'ohne Text')}</li>`;
  return `
    <div class="abgleich-box" data-nachtrag>
      <div class="abgleich-kopf">Nachtrag seit der Bestätigung</div>
      <p class="doku-hint">Die bestätigte Fassung oben bleibt unverändert. Diese Änderungen sind noch nicht bestätigt.</p>
      ${n.neu.length ? `<div class="abgleich-l">Neu</div><ul class="liste-offen">${n.neu.map(zeile).join('')}</ul>` : ''}
      ${n.geaendert.length ? `<div class="abgleich-l">Geändert</div><ul class="liste-offen">${n.geaendert.map(zeile).join('')}</ul>` : ''}
      ${n.entfernt.length ? `<div class="abgleich-l">Nicht mehr im Bericht</div><ul class="liste-offen">${n.entfernt.map(zeile).join('')}</ul>` : ''}
      ${n.kopf.length ? `<div class="abgleich-l">Geänderte Angaben</div><ul class="liste-offen">${n.kopf.map(k => `<li>${esc(KOPF[k])}</li>`).join('')}</ul>` : ''}
    </div>`;
}

const BEREICH = { arbeiten: 'Arbeit', material: 'Material', offen: 'Offener Punkt', anmerkungen: 'Anmerkung', fotos: 'Foto' };
const KOPF = { kunde: 'Kunde', objekt: 'Objekt', termin: 'Einsatztermin', ergebnis: 'Ergebnis' };

/* ── Unterschrift (Demo) ─────────────────── */

/**
 * Der Kunde sieht genau die Fassung, die er bestätigt: sie wird beim Öffnen
 * festgehalten und beim Speichern mit dem aktuellen Stand verglichen.
 */
function unterschriftOeffnen(auftragId, danach) {
  const gezeigt = state.berichtDaten(state.auftrag(auftragId));
  let name = '';
  let gezeichnet = false;
  let speichert = false;

  sheetOeffnen({
    titel: 'Bericht bestätigen',
    body: () => `
      ${hinweisBox('<strong>Demo-Unterschrift.</strong> Das ist keine rechtsverbindliche Bestätigung. '
        + 'Sie wird nur in diesem Browser gespeichert — es gibt kein zentrales Archiv.')}
      <p class="doku-hint">Das bestätigt der Kunde — genau diese Fassung:</p>
      ${dokument(gezeigt, { markierung: 'zeigen' })}
      <div class="f">
        <label class="f-label" for="us-name">Name der Person, die bestätigt</label>
        <input class="inp" id="us-name" value="${esc(name)}" placeholder="z. B. Frau Beispiel" autocomplete="off">
      </div>
      <div class="f">
        <div class="f-label" id="us-label">Unterschrift</div>
        <canvas class="sig-feld" data-sig width="600" height="200" aria-labelledby="us-label" role="img"></canvas>
        <button class="btn btn-sm" data-sig-leeren type="button">Unterschrift löschen</button>
      </div>`,
    foot: () => `
      <button class="btn" data-us-ab type="button">Abbrechen</button>
      <button class="btn btn-primaer" data-us-ok type="button">Speichern (Demo)</button>`,
    bind: (el) => {
      const canvas = el.querySelector('[data-sig]');
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1F2937';
      let zieht = false;
      const punkt = (e) => {
        const r = canvas.getBoundingClientRect();
        return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height];
      };
      canvas.addEventListener('pointerdown', (e) => {
        zieht = true; canvas.setPointerCapture?.(e.pointerId);
        ctx.beginPath(); ctx.moveTo(...punkt(e));
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!zieht) return;
        ctx.lineTo(...punkt(e)); ctx.stroke(); gezeichnet = true;
      });
      const ende = () => { zieht = false; };
      canvas.addEventListener('pointerup', ende);
      canvas.addEventListener('pointercancel', ende);
      el.querySelector('[data-sig-leeren]').addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height); gezeichnet = false;
      });
      el.querySelector('#us-name').addEventListener('input', (e) => { name = e.target.value; });
      el.querySelector('[data-us-ab]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-us-ok]').addEventListener('click', async () => {
        if (speichert) return;
        if (!name.trim()) { toast('Bitte den Namen eintragen.'); el.querySelector('#us-name').focus(); return; }
        if (!gezeichnet) return toast('Bitte im Feld unterschreiben lassen.');
        if (!state.berichtUnveraendert(state.auftrag(auftragId), gezeigt)) {
          return toast('Der Bericht hat sich geändert, seit er angezeigt wurde. Bitte erneut öffnen.');
        }
        speichert = true;
        const blob = await new Promise(fertig => canvas.toBlob(fertig, 'image/png'));
        const id = uid('sig');
        const gesichert = blob ? await fotos.speichern(id, new File([blob], 'unterschrift.png', { type: 'image/png' })) : { ok: false };
        const erg = state.berichtBestaetigen(auftragId, {
          gezeigt, name, unterschriftId: gesichert.ok ? id : null, nurDieseSitzung: !gesichert.ok,
        });
        speichert = false;
        if (!erg.ok) return toast(erg.grund);
        sheetSchliessen();
        danach?.();
        toast(`Fassung ${erg.fassung.nummer} bestätigt (Demo).`);
      });
    },
  });
}

/** Das Dokument selbst — dieselbe Darstellung dient später der bestätigten Fassung. */
export function dokument(b, { zusatz = '', markierung = 'haupt' } = {}) {
  const d = parseTermin(b.termin);
  const beispiel = (x) => x.beispiel ? ' <span class="bericht-beispiel">Beispiel</span>' : '';
  const kst = (x) => x.kostenstelle ? `<span class="bericht-kst">Kostenstelle ${esc(x.kostenstelle)}</span>` : '';

  return `
    <article class="bericht-dok" data-bericht-dok="${markierung}">
      <header class="bericht-kopf">
        <div class="beleg-abs"><strong>${esc(ABSENDER.firma)}</strong>${esc(ABSENDER.inhaber)}<br>${esc(ABSENDER.kontakt)}</div>
        <img class="bericht-logo" src="bilder/pt-logo.png" alt="${esc(ABSENDER.firma)}" width="154" height="130">
      </header>
      <div class="bericht-titel">Einsatzbericht</div>

      <dl class="bericht-meta">
        <div><dt>Kunde</dt><dd>${esc(b.kunde) || '—'}</dd></div>
        <div><dt>Objekt</dt><dd>${esc(b.objekt) || '—'}</dd></div>
        <div><dt>Einsatz</dt><dd>${d ? `${esc(fmtDatum(d))}, ${esc(fmtUhr(d))} Uhr` : '—'}</dd></div>
      </dl>

      <section class="bericht-teil">
        <h3>Ausgeführte Arbeiten</h3>
        ${b.arbeiten.length ? `<ul class="bericht-liste">${b.arbeiten.map(x => `
          <li><span class="bericht-was">${esc(x.text) || 'Ohne Beschreibung'}${beispiel(x)}</span>
            <span class="bericht-wert">${x.stunden === null ? 'Zeit nicht einzeln erfasst' : esc(fmtStunden(x.stunden))}</span>
            ${kst(x)}</li>`).join('')}</ul>
          <p class="bericht-summe">Arbeitszeit gesamt: <strong>${esc(fmtStunden(b.stundenGesamt))}</strong></p>`
        : '<p class="bericht-leer">Keine Arbeitszeit dokumentiert.</p>'}
      </section>

      ${b.material.length ? `
        <section class="bericht-teil">
          <h3>Material</h3>
          <ul class="bericht-liste">${b.material.map(x => `
            <li><span class="bericht-was">${esc(x.text) || 'Material'}${beispiel(x)}</span>
              <span class="bericht-wert">${x.menge === null ? 'Menge offen' : esc(`${zahlZuFeld(x.menge)} ${x.einheit}`.trim())}</span>
              ${kst(x)}</li>`).join('')}</ul>
        </section>` : ''}

      ${b.ergebnis ? `<section class="bericht-teil"><h3>Ergebnis</h3><p>${esc(b.ergebnis)}</p></section>` : ''}

      ${b.anmerkungen.length ? `
        <section class="bericht-teil"><h3>Anmerkungen</h3>
          <ul class="bericht-liste einfach">${b.anmerkungen.map(x => `<li>${esc(x.text)}${beispiel(x)}</li>`).join('')}</ul>
        </section>` : ''}

      <section class="bericht-teil">
        <h3>Offene Punkte</h3>
        ${b.offen.length
          ? `<ul class="bericht-liste einfach">${b.offen.map(x => `<li>${esc(x.text)}${beispiel(x)}</li>`).join('')}</ul>`
          : '<p class="bericht-leer">Keine offenen Punkte.</p>'}
      </section>

      ${b.fotos.length ? `
        <section class="bericht-teil"><h3>Fotos</h3>
          <div class="bericht-fotos">${b.fotos.map(f => `
            <figure>${f.fotoUrl
              ? `<img src="${esc(f.fotoUrl)}" alt="${esc(f.text || 'Foto')}">`
              : f.fotoId ? `<div data-foto-huelle><img data-foto-id="${esc(f.fotoId)}" alt="${esc(f.text || 'Foto')}"></div>`
              : '<div class="bericht-leer">Bild nicht verfügbar</div>'}
              <figcaption>${esc(f.text)}</figcaption></figure>`).join('')}</div>
        </section>` : ''}

      <aside class="bericht-referenz">
        <div class="abgleich-l">Ursprünglich vereinbart — zur Einordnung, kein Nachweis</div>
        <div>${esc(b.aufgabe) || '—'}</div>
      </aside>
      ${zusatz}
    </article>`;
}

/** Was Edin für den Bericht auswählen kann: Fotos (Standard: drin) und Notizen (Standard: nicht). */
function auswahl(a) {
  const waehlbar = a.verlauf.filter(v => v.typ === 'foto' || v.typ === 'notiz');
  return `
    <section class="bericht-auswahl" aria-label="Was steht im Bericht">
      <h3 class="tk-titel">Was steht im Bericht?</h3>
      <p class="doku-hint">Arbeitszeit, Material und offene Punkte stehen immer drin. Fotos und Notizen
        wählen Sie hier. Wichtige Hinweise und Sprachaufnahmen bleiben intern.</p>
      ${waehlbar.length ? waehlbar.map(v => `
        <label class="f-check"><input type="checkbox" data-bericht-wahl="${v.id}" ${state.imBericht(v) ? 'checked' : ''}>
          <span>${v.typ === 'foto' ? 'Foto' : 'Notiz'}: ${esc(v.text || 'ohne Text')}</span></label>`).join('')
        : leerZustand('Keine Fotos oder Notizen dokumentiert.')}
    </section>`;
}
