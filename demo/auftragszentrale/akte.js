/* ============================================
   akte.js — die Auftragsakte

   Eine Akte je Auftrag. Sie geht aus Home, aus der Auftragskarte und
   aus dem Kalendereintrag identisch auf — es ist dasselbe Objekt, keine
   Kopie. Oben steht, was vereinbart wurde; darunter, was tatsächlich
   passiert ist. Diese Trennung ist der Kern: die Rechnung entsteht
   später ausschließlich aus dem unteren Teil.
   ============================================ */

import { esc, icon, uid, fmtTermin, fmtVerlaufZeit, fmtStunden, parseZahl, zahlZuFeld } from './util.js';
import * as fotos from './fotos.js';
import * as state from './state.js';
import { sheetOeffnen, sheetSchliessen, bestaetigen, toast, badge, hinweisBox, leerZustand } from './ui.js';

/* Beispiel-Sprachnotiz. Fest hinterlegt — es wird nichts aufgenommen
   und nichts erkannt, und die UI sagt das an jeder Stelle. */
const SPRACH_BEISPIEL = 'Dichtung getauscht, eineinhalb Stunden gearbeitet. Eine weitere Stelle ist noch offen.';

/** Was eine echte Spracherkennung aus dem Satz machen würde — hier fest verdrahtet. */
const SPRACH_AUFBEREITUNG = {
  arbeit: 'Dichtung getauscht',
  stunden: 1.5,
  offen: 'Eine weitere Stelle ist noch offen.',
};

const ART = {
  notiz:    { label: 'Notiz',       ikone: 'notiz' },
  foto:     { label: 'Foto',        ikone: 'bilder' },
  zeit:     { label: 'Arbeitszeit', ikone: 'uhr' },
  material: { label: 'Material',    ikone: 'material' },
  offen:    { label: 'Offener Punkt', ikone: 'offen' },
  sprache:  { label: 'Sprachnotiz', ikone: 'mikro' },
};

/** Öffnet die Akte. Einziger Einstieg — aus allen drei Ansichten derselbe. */
export function akteOeffnen(auftragId) {
  const holen = () => state.auftrag(auftragId);
  if (!holen()) return;

  sheetOeffnen({
    titel: holen().kunde || 'Auftrag',
    kopfAktion: () => `
      <button class="btn btn-sm" data-bearbeiten type="button">
        ${icon('stift')} Korrigieren
      </button>`,
    body: () => koerper(holen()),
    foot: () => fussleiste(holen()),
    bind: (el, api) => binden(el, api, auftragId),
  });
}

/* ── Darstellung ─────────────────────────── */

function koerper(a) {
  const st = state.STATUS[a.status];
  const rs = state.rechnungsStatus(a.id);
  const rsInfo = state.RECHNUNGSSTATUS[rs];
  const stunden = state.summeStunden(a);

  return `
    <div class="akte-kopf">
      <div class="akte-status">
        ${badge(st.label, st.art)}
        ${badge(rsInfo.label, rsInfo.art)}
      </div>

      <div class="akte-kunde">${esc(a.kunde) || 'Ohne Kunde'}</div>
      ${a.ansprechpartner ? `<div class="akte-zeile">${icon('person')}<span>${esc(a.ansprechpartner)}</span></div>` : ''}
      ${a.adresse ? `<div class="akte-zeile">${icon('ort')}<span>${esc(a.adresse)}</span></div>` : ''}
      <div class="akte-zeile">${icon('kalender')}<span>${esc(fmtTermin(a.termin))}</span></div>
      ${(a.telefon || a.email) ? `
        <div class="akte-zeile">${icon('telefon')}<span>
          ${esc([a.telefon, a.email].filter(Boolean).join(' · '))}
        </span></div>` : ''}

      <div class="akte-aufgabe">
        <div class="akte-aufgabe-l">Vereinbarte Aufgabe</div>
        ${esc(a.aufgabe) || '<span class="f-val leer">Keine Aufgabe hinterlegt</span>'}
      </div>
    </div>

    ${a.status === 'erledigt' && a.abschluss ? abschlussBlock(a) : ''}

    <div>
      <div class="section-head erste">
        <div class="section-title">Vor Ort dokumentieren</div>
      </div>
      <div class="doc-actions">
        <button class="doc-btn" data-akt="foto-kamera" type="button">${icon('kamera')}Foto aufnehmen</button>
        <button class="doc-btn" data-akt="foto-galerie" type="button">${icon('bilder')}Bilder hinzufügen</button>
        <button class="doc-btn" data-akt="sprache" type="button">${icon('mikro')}Einsprechen</button>
        <button class="doc-btn" data-akt="notiz" type="button">${icon('notiz')}Notiz schreiben</button>
        <button class="doc-btn" data-akt="zeit" type="button">${icon('uhr')}Zeit erfassen</button>
        <button class="doc-btn" data-akt="material" type="button">${icon('material')}Material erfassen</button>
      </div>
      <input type="file" accept="image/*" capture="environment" data-file-kamera hidden>
      <input type="file" accept="image/*" multiple data-file-galerie hidden>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">Dokumentation</div>
        <div class="kopf-zusatz">
          ${stunden > 0 ? `<span class="section-hint">${esc(fmtStunden(stunden))}</span>` : ''}
          <span class="section-hint">${a.verlauf.length} ${a.verlauf.length === 1 ? 'Eintrag' : 'Einträge'}</span>
        </div>
      </div>
      ${a.verlauf.length
        ? `<div class="card-body verlauf">${[...a.verlauf].reverse().map(verlaufZeile).join('')}</div>`
        : leerZustand('Noch nichts dokumentiert.',
            'Foto, Notiz, Zeit oder Material oben hinzufügen — die vereinbarte Aufgabe bleibt davon unberührt.')}
    </div>`;
}

function verlaufZeile(v) {
  const art = ART[v.typ] || ART.notiz;
  let detail = '';

  if (v.typ === 'zeit') {
    detail = `<div class="vl-detail">${esc(fmtStunden(v.stunden))}</div>`;
  } else if (v.typ === 'material') {
    const teile = [`${zahlZuFeld(v.menge) || '—'} ${esc(v.einheit || '')}`.trim()];
    if (v.lieferant) teile.push(`Lieferant: ${esc(v.lieferant)}`);
    detail = `<div class="vl-detail">${teile.join(' · ')}</div>`;
  } else if (v.typ === 'foto') {
    if (v.fotoUrl) {
      // Mitgeliefertes Beispielbild — liegt als Datei bei, nicht im Bildspeicher.
      detail = `<div class="vl-foto">
          <img src="${esc(v.fotoUrl)}" alt="${esc(v.text || 'Foto zur Dokumentation')}">
        </div>`;
    } else if (v.fotoId) {
      // Die Quelle setzt fotos.bilderNachladen() nach dem Rendern.
      detail = `<div class="vl-foto" data-foto-huelle>
          <img data-foto-id="${esc(v.fotoId)}" alt="${esc(v.text || 'Foto zur Dokumentation')}">
        </div>`;
    } else {
      detail = `<div class="vl-foto-weg">${v.nurDieseSitzung
        ? 'Konnte nicht dauerhaft gespeichert werden — nur in dieser Sitzung vorhanden.'
        : 'Zu diesem Eintrag ist keine Bilddatei hinterlegt.'}</div>`;
    }
  } else if (v.typ === 'sprache' && v.transkript) {
    detail = `<div class="vl-detail zitat">„${esc(v.transkript)}"</div>`;
  }

  return `
    <div class="vl" data-vl="${v.id}">
      <div class="vl-ico ${v.typ}">${icon(art.ikone)}</div>
      <div class="vl-mid">
        <div class="vl-top">
          <span class="vl-art">${art.label}</span>
          <span class="vl-ts">${esc(fmtVerlaufZeit(v.ts))}</span>
          ${v.simuliert ? '<span class="vl-marke">Beispiel</span>' : ''}
        </div>
        <div class="vl-text">${esc(v.text) || '<span class="f-val leer">Ohne Text</span>'}</div>
        ${detail}
      </div>
      <div class="vl-akt">
        <button class="icon-btn" data-vl-edit="${v.id}" type="button" aria-label="Eintrag bearbeiten">${icon('stift')}</button>
        <button class="icon-btn" data-vl-del="${v.id}" type="button" aria-label="Eintrag entfernen">${icon('papierkorb')}</button>
      </div>
    </div>`;
}

function abschlussBlock(a) {
  const ab = a.abschluss;
  return `
    <div class="card">
      <div class="card-head"><div class="card-title">Abschluss</div>${badge('Erledigt', 'fertig')}</div>
      <div class="card-body stapel">
        <div>
          <div class="akte-aufgabe-l">Ergebnis</div>
          <div class="f-val">${esc(ab.ergebnis) || '—'}</div>
        </div>
        ${ab.offenePunkte?.length ? `
          <div>
            <div class="akte-aufgabe-l">Offene Punkte</div>
            <ul class="liste-offen">${ab.offenePunkte.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
          </div>` : ''}
      </div>
    </div>`;
}

function fussleiste(a) {
  if (a.status === 'geplant') {
    return `<button class="btn btn-primaer btn-block" data-starten type="button">${icon('play')} Arbeit starten</button>`;
  }
  if (a.status === 'inarbeit') {
    return `<button class="btn btn-primaer btn-block" data-abschliessen type="button">${icon('check')} Arbeit abschließen</button>`;
  }

  // Erledigt: Arbeitsstatus bleibt, nur der Rechnungsweg geht weiter.
  const rs = state.rechnungsStatus(a.id);
  const label = rs === 'keine'      ? 'Rechnung erstellen'
              : rs === 'entwurf'    ? 'Rechnungsentwurf öffnen'
              :                       'Rechnung ansehen';
  return `
    <button class="btn" data-wieder-oeffnen type="button">Wieder in Arbeit</button>
    <button class="btn btn-primaer" data-zur-rechnung type="button">${icon('rechnung')} ${label}</button>`;
}

/* ── Interaktion ─────────────────────────── */

function binden(el, api, auftragId) {
  const a = () => state.auftrag(auftragId);
  const neuZeichnen = () => api.render();

  fotos.bilderNachladen(el);

  el.querySelector('[data-bearbeiten]')?.addEventListener('click', async () => {
    const { erfassungOeffnen } = await import('./erfassen.js');
    erfassungOeffnen({ bearbeiten: auftragId, danach: neuZeichnen });
  });

  /* ── Dokumentations-Aktionen ── */
  el.querySelectorAll('[data-akt]').forEach(b => b.addEventListener('click', () => {
    const akt = b.dataset.akt;
    if (akt === 'foto-kamera')  return el.querySelector('[data-file-kamera]').click();
    if (akt === 'foto-galerie') return el.querySelector('[data-file-galerie]').click();
    if (akt === 'sprache')      return spracheDialog(auftragId, neuZeichnen);
    if (akt === 'notiz')        return notizDialog(auftragId, neuZeichnen);
    if (akt === 'zeit')         return zeitDialog(auftragId, null, neuZeichnen);
    if (akt === 'material')     return materialDialog(auftragId, null, neuZeichnen);
  }));

  el.querySelector('[data-file-kamera]')?.addEventListener('change', e => fotosUebernehmen(e, auftragId, neuZeichnen));
  el.querySelector('[data-file-galerie]')?.addEventListener('change', e => fotosUebernehmen(e, auftragId, neuZeichnen));

  /* ── Verlauf bearbeiten / entfernen ── */
  el.querySelectorAll('[data-vl-edit]').forEach(b => b.addEventListener('click', () => {
    const v = a().verlauf.find(x => x.id === b.dataset.vlEdit);
    if (!v) return;
    if (v.typ === 'zeit')     return zeitDialog(auftragId, v, neuZeichnen);
    if (v.typ === 'material') return materialDialog(auftragId, v, neuZeichnen);
    return textDialog(auftragId, v, neuZeichnen);
  }));

  el.querySelectorAll('[data-vl-del]').forEach(b => b.addEventListener('click', async () => {
    const v = a().verlauf.find(x => x.id === b.dataset.vlDel);
    if (!v) return;
    const ja = await bestaetigen({
      titel: 'Eintrag entfernen',
      text: `„${(v.text || 'Dieser Eintrag').slice(0, 90)}" wird aus der Dokumentation entfernt. `
          + 'Die vereinbarte Aufgabe bleibt erhalten.',
      jaText: 'Entfernen', warnend: true,
    });
    if (!ja) return;
    state.verlaufEntfernen(auftragId, v.id);
    neuZeichnen();
    toast('Eintrag entfernt.');
  }));

  /* ── Statuswechsel ── */
  el.querySelector('[data-starten]')?.addEventListener('click', () => {
    state.statusSetzen(auftragId, 'inarbeit');
    neuZeichnen();
    toast('Auftrag steht jetzt auf „In Arbeit".');
  });

  el.querySelector('[data-abschliessen]')?.addEventListener('click', () => abschlussDialog(auftragId, neuZeichnen));

  el.querySelector('[data-wieder-oeffnen]')?.addEventListener('click', async () => {
    const ja = await bestaetigen({
      titel: 'Wieder in Arbeit setzen',
      text: 'Der Auftrag geht zurück auf „In Arbeit". Dokumentation und ein vorhandener '
          + 'Rechnungsentwurf bleiben unverändert erhalten.',
      jaText: 'Zurücksetzen',
    });
    if (!ja) return;
    state.auftragUpdate(auftragId, { status: 'inarbeit' });
    neuZeichnen();
  });

  el.querySelector('[data-zur-rechnung]')?.addEventListener('click', async () => {
    const { rechnungOeffnen } = await import('./rechnung.js');
    rechnungOeffnen(auftragId, neuZeichnen);
  });
}

/* ── Fotos ───────────────────────────────── */

/**
 * Bilder landen in IndexedDB (fotos.js) und überstehen damit den Reload.
 * Schlägt das Speichern fehl, wird der Eintrag trotzdem angelegt — aber
 * ausdrücklich als „nur in dieser Sitzung" markiert. Ein Speicherfehler darf
 * nie wie eine gelungene dauerhafte Ablage aussehen.
 */
async function fotosUebernehmen(e, auftragId, neuZeichnen) {
  const dateien = [...(e.target.files || [])];
  e.target.value = '';           // damit dieselbe Datei erneut gewählt werden kann
  if (!dateien.length) return;

  let gespeichert = 0;
  const probleme = [];

  for (const datei of dateien) {
    const fotoId = uid('foto');
    const erg = await fotos.speichern(fotoId, datei);

    if (erg.ok) {
      state.verlaufHinzufuegen(auftragId, {
        typ: 'foto', text: datei.name.replace(/\.[^.]+$/, ''),
        fotoName: datei.name, fotoId,
      });
      gespeichert++;
    } else {
      probleme.push(erg.grund);
      // Format- oder Größenfehler: gar nicht erst als Eintrag anlegen.
      if (!/Format|zu groß/.test(erg.grund)) {
        state.verlaufHinzufuegen(auftragId, {
          typ: 'foto', text: datei.name.replace(/\.[^.]+$/, ''),
          fotoName: datei.name, fotoId: null, nurDieseSitzung: true,
        });
      }
    }
  }

  neuZeichnen();

  if (probleme.length) {
    await hinweisDialog('Bild konnte nicht gespeichert werden', probleme);
  } else {
    toast(gespeichert === 1 ? 'Foto gespeichert.' : `${gespeichert} Bilder gespeichert.`);
  }
}

/** Schlichter Hinweis mit einer Liste von Gründen. */
function hinweisDialog(titel, gruende) {
  return new Promise((fertig) => {
    sheetOeffnen({
      titel,
      body: () => `<div class="state-box error">
        <ul class="liste-offen">${gruende.map(g => `<li>${esc(g)}</li>`).join('')}</ul>
      </div>`,
      foot: () => `<button class="btn btn-block" data-zu type="button">Verstanden</button>`,
      bind: (el) => el.querySelector('[data-zu]').addEventListener('click', sheetSchliessen),
      onClose: fertig,
    });
  });
}

/* ── Dialoge ─────────────────────────────── */

function notizDialog(auftragId, neuZeichnen) {
  sheetOeffnen({
    titel: 'Notiz schreiben',
    body: () => `
      <div class="f">
        <label class="f-label" for="nz">Was ist vor Ort passiert?</label>
        <textarea class="inp" id="nz" rows="5"
          placeholder="z. B. Siphon gereinigt, Ablauf läuft wieder frei."></textarea>
      </div>
      <div class="hint-note">Die Notiz kommt in den Verlauf. Die ursprünglich vereinbarte
        Aufgabe wird davon nicht überschrieben.</div>`,
    foot: () => `
      <button class="btn" data-ab type="button">Abbrechen</button>
      <button class="btn btn-primaer" data-ok type="button">Notiz speichern</button>`,
    bind: (el) => {
      const ta = el.querySelector('#nz');
      setTimeout(() => ta.focus(), 60);
      el.querySelector('[data-ab]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-ok]').addEventListener('click', () => {
        const text = ta.value.trim();
        if (!text) return toast('Bitte zuerst etwas eintragen.');
        state.verlaufHinzufuegen(auftragId, { typ: 'notiz', text });
        sheetSchliessen(); neuZeichnen(); toast('Notiz gespeichert.');
      });
    },
  });
}

/** Bearbeiten eines vorhandenen Text-Eintrags (Notiz, offener Punkt, Foto-Beschriftung). */
function textDialog(auftragId, v, neuZeichnen) {
  sheetOeffnen({
    titel: 'Eintrag bearbeiten',
    body: () => `
      <div class="f">
        <label class="f-label" for="tx">${esc((ART[v.typ] || ART.notiz).label)}</label>
        <textarea class="inp" id="tx" rows="4">${esc(v.text || '')}</textarea>
      </div>`,
    foot: () => `
      <button class="btn" data-ab type="button">Abbrechen</button>
      <button class="btn btn-primaer" data-ok type="button">Speichern</button>`,
    bind: (el) => {
      el.querySelector('[data-ab]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-ok]').addEventListener('click', () => {
        // Korrigierte Beispieltexte gelten als von Edin geprüft.
        state.verlaufUpdate(auftragId, v.id, { text: el.querySelector('#tx').value.trim(), simuliert: false });
        sheetSchliessen(); neuZeichnen(); toast('Eintrag aktualisiert.');
      });
    },
  });
}

function zeitDialog(auftragId, v, neuZeichnen) {
  sheetOeffnen({
    titel: v ? 'Arbeitszeit bearbeiten' : 'Arbeitszeit erfassen',
    body: () => `
      <div class="fields">
        <div class="f">
          <label class="f-label" for="zs">Stunden</label>
          <input class="inp" id="zs" inputmode="decimal" placeholder="z. B. 1,5"
                 value="${esc(zahlZuFeld(v?.stunden))}">
        </div>
        <div class="f">
          <label class="f-label" for="zt">Wofür</label>
          <input class="inp" id="zt" placeholder="z. B. Dichtung tauschen" value="${esc(v?.text || '')}">
        </div>
      </div>
      <div class="hint-note">Halbe Stunden als Komma schreiben: 1,5 statt 1.5.</div>`,
    foot: () => `
      <button class="btn" data-ab type="button">Abbrechen</button>
      <button class="btn btn-primaer" data-ok type="button">Speichern</button>`,
    bind: (el) => {
      el.querySelector('[data-ab]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-ok]').addEventListener('click', () => {
        const stunden = parseZahl(el.querySelector('#zs').value);
        const text = el.querySelector('#zt').value.trim();
        if (stunden === null || stunden <= 0) return toast('Bitte eine Stundenzahl größer als 0 eintragen.');
        if (!text) return toast('Bitte eintragen, wofür die Zeit angefallen ist.');
        if (v) state.verlaufUpdate(auftragId, v.id, { stunden, text, simuliert: false });
        else   state.verlaufHinzufuegen(auftragId, { typ: 'zeit', stunden, text });
        sheetSchliessen(); neuZeichnen(); toast('Arbeitszeit gespeichert.');
      });
    },
  });
}

function materialDialog(auftragId, v, neuZeichnen) {
  sheetOeffnen({
    titel: v ? 'Material bearbeiten' : 'Material erfassen',
    body: () => `
      <div class="f">
        <label class="f-label" for="mb">Bezeichnung</label>
        <input class="inp" id="mb" placeholder="z. B. Dichtungssatz Standard" value="${esc(v?.text || '')}">
      </div>
      <div class="fields">
        <div class="f">
          <label class="f-label" for="mm">Menge</label>
          <input class="inp" id="mm" inputmode="decimal" placeholder="z. B. 2" value="${esc(zahlZuFeld(v?.menge))}">
        </div>
        <div class="f">
          <label class="f-label" for="me">Einheit</label>
          <input class="inp" id="me" placeholder="Stück" value="${esc(v?.einheit || 'Stück')}">
        </div>
      </div>
      <div class="f">
        <label class="f-label" for="ml">Lieferant <span class="opt">(optional)</span></label>
        <input class="inp" id="ml" placeholder="Woher das Material stammt" value="${esc(v?.lieferant || '')}">
      </div>
      <div class="hint-note">Der Preis wird erst im Rechnungsentwurf eingetragen —
        hier geht es nur darum, was verbaut wurde.</div>`,
    foot: () => `
      <button class="btn" data-ab type="button">Abbrechen</button>
      <button class="btn btn-primaer" data-ok type="button">Speichern</button>`,
    bind: (el) => {
      el.querySelector('[data-ab]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-ok]').addEventListener('click', () => {
        const text = el.querySelector('#mb').value.trim();
        if (!text) return toast('Bitte eine Bezeichnung eintragen.');
        const daten = {
          text,
          menge: parseZahl(el.querySelector('#mm').value),
          einheit: el.querySelector('#me').value.trim() || 'Stück',
          lieferant: el.querySelector('#ml').value.trim(),
        };
        if (v) state.verlaufUpdate(auftragId, v.id, { ...daten, simuliert: false });
        else   state.verlaufHinzufuegen(auftragId, { typ: 'material', ...daten });
        sheetSchliessen(); neuZeichnen(); toast('Material gespeichert.');
      });
    },
  });
}

/* ── Sprachnotiz (simuliert) ─────────────── */

function spracheDialog(auftragId, neuZeichnen) {
  let phase = 'bereit';     // bereit → laeuft → pruefen
  let sekunden = 0;
  let ticker = null;
  let felder = { ...SPRACH_AUFBEREITUNG };

  const uhrzeit = () =>
    `${String(Math.floor(sekunden / 60)).padStart(2, '0')}:${String(sekunden % 60).padStart(2, '0')}`;

  const sheet = sheetOeffnen({
    titel: 'Einsprechen',
    body: () => {
      if (phase === 'pruefen') {
        return `
          ${hinweisBox('<strong>Beispiel-Aufbereitung.</strong> Der folgende Text wurde nicht aus Ihrer Stimme '
            + 'erkannt — er ist im Demo-Code fest hinterlegt, damit Sie sehen, wie das Ergebnis aussähe. '
            + 'Bitte prüfen und korrigieren.')}
          <div class="card">
            <div class="card-head"><div class="card-title">Beispieltranskript</div></div>
            <div class="card-body zitat">
              „${esc(SPRACH_BEISPIEL)}"
            </div>
          </div>
          <div class="f">
            <label class="f-label" for="sa">Ausgeführte Arbeit</label>
            <input class="inp" id="sa" value="${esc(felder.arbeit)}">
          </div>
          <div class="f">
            <label class="f-label" for="ss">Arbeitszeit in Stunden</label>
            <input class="inp" id="ss" inputmode="decimal" value="${esc(zahlZuFeld(felder.stunden))}">
          </div>
          <div class="f">
            <label class="f-label" for="so">Offener Punkt <span class="opt">(leer lassen, wenn keiner)</span></label>
            <input class="inp" id="so" value="${esc(felder.offen)}">
          </div>
          <div class="hint-note">Mengen und Preise bleiben bewusst offen — die trägt niemand
            für Sie ein. Sie kommen erst im Rechnungsentwurf dazu.</div>`;
      }

      return `
        ${hinweisBox('<strong>Aufnahme ist simuliert.</strong> Die Demo greift nicht auf das Mikrofon zu '
          + 'und zeichnet nichts auf. Start und Stopp zeigen nur den Ablauf.')}
        <div class="rec-box ${phase === 'laeuft' ? 'laeuft' : ''}">
          <div class="rec-dot">${icon('mikro')}</div>
          <div class="rec-timer">${uhrzeit()}</div>
          <div class="rec-status">${phase === 'laeuft'
            ? 'Aufnahme läuft (simuliert)' : 'Bereit'}</div>
        </div>`;
    },
    foot: () => {
      if (phase === 'bereit')  return `<button class="btn btn-primaer btn-block" data-start type="button">${icon('mikro')} Aufnahme starten</button>`;
      if (phase === 'laeuft')  return `<button class="btn btn-primaer btn-block" data-stop type="button">Aufnahme stoppen</button>`;
      return `<button class="btn" data-nochmal type="button">Nochmal</button>
              <button class="btn btn-primaer" data-ok type="button">In Dokumentation übernehmen</button>`;
    },
    bind: (el) => {
      el.querySelector('[data-start]')?.addEventListener('click', () => {
        phase = 'laeuft'; sekunden = 0;
        ticker = setInterval(() => { sekunden++; sheet.render(); }, 1000);
        sheet.render();
      });

      el.querySelector('[data-stop]')?.addEventListener('click', () => {
        clearInterval(ticker); ticker = null;
        phase = 'pruefen';
        sheet.render();
      });

      el.querySelector('[data-nochmal]')?.addEventListener('click', () => {
        phase = 'bereit'; sekunden = 0; felder = { ...SPRACH_AUFBEREITUNG };
        sheet.render();
      });

      el.querySelector('[data-ok]')?.addEventListener('click', () => {
        felder = {
          arbeit:  el.querySelector('#sa').value.trim(),
          stunden: parseZahl(el.querySelector('#ss').value),
          offen:   el.querySelector('#so').value.trim(),
        };
        if (!felder.arbeit) return toast('Bitte eintragen, welche Arbeit ausgeführt wurde.');

        // Ein Sprach-Eintrag plus die daraus abgeleiteten, prüfbaren Einzelteile.
        state.verlaufHinzufuegen(auftragId, {
          typ: 'sprache', text: 'Sprachnotiz aufgenommen (Beispiel)',
          transkript: SPRACH_BEISPIEL, simuliert: true,
        });
        state.verlaufHinzufuegen(auftragId, { typ: 'notiz', text: felder.arbeit, simuliert: true });
        if (felder.stunden !== null && felder.stunden > 0) {
          state.verlaufHinzufuegen(auftragId, { typ: 'zeit', text: felder.arbeit, stunden: felder.stunden, simuliert: true });
        }
        if (felder.offen) {
          state.verlaufHinzufuegen(auftragId, { typ: 'offen', text: felder.offen, simuliert: true });
        }
        sheetSchliessen(); neuZeichnen(); toast('In die Dokumentation übernommen.');
      });
    },
    onClose: () => { if (ticker) clearInterval(ticker); },
  });
}

/* ── Abschluss ───────────────────────────── */

function abschlussDialog(auftragId, neuZeichnen) {
  const a = state.auftrag(auftragId);
  const stunden = state.summeStunden(a);
  const offen = state.offenePunkte(a);
  const notizen = a.verlauf.filter(v => v.typ === 'notiz');
  const material = a.verlauf.filter(v => v.typ === 'material');

  // Vorschlag aus den Notizen — Edin bestätigt oder überschreibt ihn.
  const vorschlag = notizen.map(n => n.text).join(' ');

  sheetOeffnen({
    titel: 'Arbeit abschließen',
    body: () => `
      <div class="hint-note">Bitte kurz prüfen, was dokumentiert ist. Was hier steht,
        ist später die Grundlage für den Rechnungsentwurf.</div>

      <div class="card">
        <div class="card-head"><div class="card-title">Was dokumentiert wurde</div></div>
        <div class="card-body stapel">
          <div class="f"><div class="f-label">Arbeitszeit gesamt</div>
            <div class="f-val ${stunden ? '' : 'leer'}">${stunden ? esc(fmtStunden(stunden)) : 'Keine Zeit erfasst'}</div></div>
          <div class="f"><div class="f-label">Material</div>
            <div class="f-val ${material.length ? '' : 'leer'}">${material.length
              ? material.map(m => esc(`${zahlZuFeld(m.menge) || '?'} ${m.einheit || ''} ${m.text}`.trim())).join('<br>')
              : 'Kein Material erfasst'}</div></div>
          <div class="f"><div class="f-label">Fotos</div>
            <div class="f-val ${a.verlauf.some(v => v.typ === 'foto') ? '' : 'leer'}">${
              a.verlauf.filter(v => v.typ === 'foto').length || 'Keine'}</div></div>
        </div>
      </div>

      <div class="f">
        <label class="f-label" for="ae">Ergebnis für den Kunden</label>
        <textarea class="inp" id="ae" rows="3"
          placeholder="Was wurde erledigt?">${esc(vorschlag)}</textarea>
      </div>

      <div>
        <div class="akte-aufgabe-l">Offene Punkte</div>
        ${offen.length
          ? `<ul class="liste-offen">${offen.map(o => `<li>${esc(o.text)}</li>`).join('')}</ul>
             <div class="hint-note">Offene Punkte werden im Rechnungsentwurf
               ausdrücklich nicht als Leistung berechnet.</div>`
          : `<div class="f-val leer">Keine offenen Punkte dokumentiert.</div>`}
      </div>`,
    foot: () => `
      <button class="btn" data-ab type="button">Zurück</button>
      <button class="btn btn-primaer" data-ok type="button">${icon('check')} Als erledigt markieren</button>`,
    bind: (el) => {
      el.querySelector('[data-ab]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-ok]').addEventListener('click', () => {
        const ergebnis = el.querySelector('#ae').value.trim();
        if (!ergebnis) return toast('Bitte kurz beschreiben, was erledigt wurde.');
        state.auftragAbschliessen(auftragId, { ergebnis, offenePunkte: offen.map(o => o.text) });
        sheetSchliessen(); neuZeichnen();
        toast('Auftrag ist erledigt. Die Rechnung ist davon noch unberührt.');
      });
    },
  });
}
