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
import * as flows from './flows.js';
import * as pegel from './pegel.js';
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
  wichtig:  { label: 'Wichtig', ikone: 'offen' },
  sprache:  { label: 'Sprachnotiz', ikone: 'mikro' },
};

/** Öffnet die Akte. Einziger Einstieg — aus allen drei Ansichten derselbe. */
export function akteOeffnen(auftragId) {
  const holen = () => state.auftrag(auftragId);
  if (!holen()) return;

  sheetOeffnen({
    titel: 'Auftragsakte',
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

  return `
    <div class="akte-kopf">
      <div class="akte-status">
        ${badge(st.label, st.art)}
        ${badge(rsInfo.label, rsInfo.art)}
      </div>

      <div class="akte-kunde">${esc(a.kunde) || 'Ohne Kunde'}</div>
      ${a.adresse ? `<div class="akte-zeile">${icon('ort')}<span>${esc(a.adresse)}</span></div>` : ''}
      <div class="akte-zeile">${icon('kalender')}<span>${esc(fmtTermin(a.termin))}</span></div>
      ${(a.ansprechpartner || a.telefon || a.email) ? `
        <details class="akte-kontakt">
          <summary>Kontakt anzeigen</summary>
          ${a.ansprechpartner ? `<div class="akte-zeile">${icon('person')}<span>${esc(a.ansprechpartner)}</span></div>` : ''}
          ${(a.telefon || a.email) ? `<div class="akte-zeile">${icon('telefon')}<span>${esc([a.telefon, a.email].filter(Boolean).join(' · '))}</span></div>` : ''}
        </details>` : ''}

      <div class="akte-aufgabe">
        <div class="akte-aufgabe-l">Vereinbarte Aufgabe</div>
        ${esc(a.aufgabe) || '<span class="f-val leer">Keine Aufgabe hinterlegt</span>'}
      </div>
      ${arbeitsweg(a.status)}
    </div>

    ${a.status === 'erledigt' && a.abschluss ? abschlussBlock(a) : ''}

    <div class="doku-layout">
    <section class="doku-erfassen" aria-label="Dokumentation ergänzen">
      <div class="section-head erste">
        <div>
          <div class="section-title">Vor Ort dokumentieren</div>
          <div class="section-intro">Was haben Sie gemacht?</div>
        </div>
      </div>
      <div class="doc-actions">
        <div class="doc-group"><div class="doc-group-title">Fotos und Notizen</div>
        <button class="doc-btn doc-nachweis" data-akt="foto-kamera" type="button"><span class="doc-ico">${icon('kamera')}</span><span>Foto aufnehmen</span></button>
        <button class="doc-btn doc-nachweis" data-akt="foto-galerie" type="button"><span class="doc-ico">${icon('bilder')}</span><span>Bilder hinzufügen</span></button>
        <button class="doc-btn doc-nachweis" data-akt="sprache" type="button"><span class="doc-ico">${icon('mikro')}</span><span>Einsprechen</span></button>
        <button class="doc-btn doc-nachweis" data-akt="notiz" type="button"><span class="doc-ico">${icon('notiz')}</span><span>Notiz schreiben</span></button>
        </div>
        <div class="doc-group"><div class="doc-group-title">Für die Rechnung</div>
        <button class="doc-btn doc-abrechnung" data-akt="zeit" type="button"><span class="doc-ico">${icon('uhr')}</span><span>Zeit erfassen</span></button>
        <button class="doc-btn doc-abrechnung" data-akt="material" type="button"><span class="doc-ico">${icon('material')}</span><span>Material erfassen</span></button>
        </div>
      </div>
      <input type="file" accept="image/*" capture="environment" data-file-kamera hidden>
      <input type="file" accept="image/*" multiple data-file-galerie hidden>
    </section>

    <section class="doku-history" aria-label="Dokumentationsverlauf">
      <div class="card-head">
        <div><h2 class="card-title">Dokumentation</h2><p class="doku-hint">Alles zum Einsatz auf einen Blick</p></div>
        <span class="doku-count" aria-label="${a.verlauf.length} Einträge">${a.verlauf.length}</span>
      </div>
      ${dokumentationsUeberblick(a)}
      <h3 class="doku-verlauf-title">Alle Einträge <span>Neueste zuerst</span></h3>
      ${a.verlauf.length
        ? `<ol class="verlauf doku-timeline">${[...a.verlauf].reverse().map(verlaufZeile).join('')}</ol>`
        : leerZustand('Noch nichts dokumentiert.',
            'Foto, Notiz, Zeit oder Material oben hinzufügen — die vereinbarte Aufgabe bleibt davon unberührt.')}
      ${a.verlauf.length ? `
        <div class="vl-anhaengen">
          <button class="btn btn-still btn-block" data-akt="notiz" type="button">${icon('plus')} Notiz ergänzen</button>
        </div>` : ''}
    </section>
    </div>`;
}

function dokumentationsUeberblick(a) {
  const zeiten = a.verlauf.filter(v => v.typ === 'zeit');
  const material = a.verlauf.filter(v => v.typ === 'material');
  const offen = state.offenePunkte(a);
  const wichtig = a.verlauf.filter(v => v.typ === 'wichtig');
  const notizen = a.verlauf.filter(v => v.typ === 'notiz');
  const liste = (eintraege, text, leer) => eintraege.length
    ? `<ul>${eintraege.map(v => `<li>${esc(text(v))}</li>`).join('')}</ul>`
    : `<p class="doku-empty">${leer}</p>`;
  return `<div class="doku-ueberblick">
    ${wichtig.length ? `<section class="doku-fakten wichtig"><h3>${icon('offen')} Wichtig <span>${wichtig.length}</span></h3>${liste(wichtig, v => v.text, '')}</section>` : ''}
    <section class="doku-fakten arbeit"><h3>${icon('uhr')} Arbeitszeit <span>${esc(fmtStunden(state.summeStunden(a)))}</span></h3>
      ${liste(zeiten, v => `${fmtStunden(v.stunden)} — ${v.text || 'Ohne Beschreibung'}`, 'Noch keine Arbeitszeit erfasst.')}</section>
    <section class="doku-fakten material"><h3>${icon('material')} Material <span>${material.length} Posten</span></h3>
      ${liste(material, v => `${zahlZuFeld(v.menge) || 'Menge offen'} ${v.einheit || ''} — ${v.text || 'Ohne Bezeichnung'}`, 'Noch kein Material erfasst.')}</section>
    <section class="doku-fakten offen"><h3>${icon('offen')} Offene Punkte <span>${offen.length}</span></h3>
      ${liste(offen, v => v.text, 'Keine offenen Punkte dokumentiert.')}</section>
    <section class="doku-fakten notizen"><h3>${icon('notiz')} Notizen <span>${notizen.length}</span></h3>
      ${liste(notizen, v => v.text, 'Noch keine Notiz erfasst.')}</section>
  </div>`;
}

/* Der Weg bleibt sichtbar, statt dass sich Edin die nächste Station merken muss.
   Farbe unterstützt den Text: grün = erledigt, ocker = jetzt dran, grau = später. */
function arbeitsweg(status) {
  const dokumentation = status === 'erledigt' ? 'is-done' : status === 'inarbeit' ? 'is-active' : 'is-next';
  const abschluss = status === 'erledigt' ? 'is-done' : 'is-next';
  const rechnung = status === 'erledigt' ? 'is-active' : 'is-next';
  return `
    <ol class="workflow-path" aria-label="Ablauf für diesen Auftrag">
      <li class="workflow-step ${dokumentation}"><span class="workflow-dot"></span><span>Dokumentieren</span></li>
      <li class="workflow-step ${abschluss}"><span class="workflow-dot"></span><span>Abschließen</span></li>
      <li class="workflow-step ${rechnung}"><span class="workflow-dot"></span><span>Rechnung prüfen</span></li>
    </ol>`;
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
    <li class="vl ${v.typ === 'offen' ? 'vl-offen' : v.typ === 'wichtig' ? 'vl-wichtig' : ''}" data-vl="${v.id}">
      <div class="vl-ico ${esc(v.typ)}" aria-hidden="true">${icon(art.ikone)}</div>
      <article class="vl-mid">
        <div class="vl-top">
          <span class="vl-art">${art.label}</span>
          <time class="vl-ts" datetime="${esc(v.ts)}">${esc(fmtVerlaufZeit(v.ts))}</time>
          ${v.simuliert ? '<span class="vl-marke">Beispiel</span>' : ''}
        </div>
        <div class="vl-text">${esc(v.text) || '<span class="f-val leer">Ohne Text</span>'}</div>
        ${detail}
      <div class="vl-akt">
        <button class="icon-btn" data-vl-edit="${v.id}" type="button" aria-label="Eintrag bearbeiten">${icon('stift')}</button>
        <button class="icon-btn" data-vl-del="${v.id}" type="button" aria-label="Eintrag entfernen">${icon('papierkorb')}</button>
      </div>
      </article>
    </li>`;
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
    return `<button class="btn btn-primaer btn-block doku-abschluss" data-abschliessen type="button">${icon('check')} Arbeit abschließen</button>`;
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
  el.querySelector('.sheet').classList.add('sheet-doku');
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
      const eintrag = state.verlaufHinzufuegen(auftragId, {
        typ: 'foto', text: datei.name.replace(/\.[^.]+$/, ''),
        fotoName: datei.name, fotoId,
      });
      gespeichert++;
      // Nur die Beschriftung: "IMG_4821" sagt spaeter niemandem etwas.
      // Bewusst kein Material aus dem Bild — daraus wuerden Rechnungspositionen,
      // und die gehoeren bestaetigt, nicht nebenbei erzeugt.
      if (eintrag) beschriftungNachtragen(auftragId, eintrag.id, datei, neuZeichnen);
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

/**
 * Holt im Hintergrund eine Beschriftung fuer ein frisch abgelegtes Bild.
 *
 * Laeuft absichtlich nebenher: klappt es nicht, bleibt der Dateiname stehen.
 * Ein Fehlschlag darf den Ablauf nicht aufhalten und wird nicht als Ergebnis
 * ausgegeben.
 */
async function beschriftungNachtragen(auftragId, eintragId, datei, neuZeichnen) {
  if (!(await flows.verfuegbar())) return;
  const antwort = await flows.fotoAuswerten(datei, 'doku');
  if (!antwort.ok || !antwort.vorschlag) return;

  const titel = antwort.vorschlag.beschriftung;
  if (!titel) return;

  state.verlaufUpdate(auftragId, eintragId, {
    text: titel,
    beschreibung: antwort.vorschlag.beschreibung || '',
    erkannterText: antwort.vorschlag.erkannterText || '',
  });
  neuZeichnen();
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

function notizDialog(auftragId, neuZeichnen, v = null) {
  let entwurf = v?.text || '';
  let wichtig = v?.typ === 'wichtig';
  let beispiel = !!v?.simuliert;
  sheetOeffnen({
    titel: v ? 'Notiz bearbeiten' : 'Notiz schreiben',
    body: () => `
      <div class="f">
        <label class="f-label" for="nz">Was ist vor Ort passiert?</label>
        <textarea class="inp" id="nz" rows="5"
          placeholder="z. B. Siphon gereinigt, Ablauf läuft wieder frei.">${esc(entwurf)}</textarea>
      </div>
      <button class="btn notiz-diktieren" data-notiz-sprache type="button">${icon('mikro')} Per Sprache ergänzen</button>
      <label class="f-check"><input type="checkbox" data-wichtig ${wichtig ? 'checked' : ''}> Als wichtigen Hinweis rot hervorheben</label>
      <div class="hint-note">Gesprochene Ergänzungen werden an diesen Text angehängt. Erst „Notiz speichern“ übernimmt die Notiz.</div>`,
    foot: () => `
      <button class="btn" data-ab type="button">Abbrechen</button>
      <button class="btn btn-primaer" data-ok type="button">Notiz speichern</button>`,
    bind: (el) => {
      const ta = el.querySelector('#nz');
      ta.addEventListener('input', () => { entwurf = ta.value; });
      el.querySelector('[data-wichtig]').addEventListener('change', e => { wichtig = e.target.checked; });
      el.querySelector('[data-notiz-sprache]').addEventListener('click', () => {
        entwurf = ta.value;
        spracheDialog(auftragId, neuZeichnen, { onText: (text, simuliert) => {
          entwurf = [entwurf.trim(), text.trim()].filter(Boolean).join('\n\n');
          beispiel ||= simuliert;
        } });
      });
      el.querySelector('[data-ab]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-ok]').addEventListener('click', () => {
        const text = ta.value.trim();
        if (!text) return toast('Bitte zuerst etwas eintragen.');
        const daten = { typ: wichtig ? 'wichtig' : 'notiz', text, simuliert: beispiel };
        if (v) state.verlaufUpdate(auftragId, v.id, daten);
        else state.verlaufHinzufuegen(auftragId, daten);
        sheetSchliessen(); neuZeichnen(); toast('Notiz gespeichert.');
      });
    },
  });
}

/** Bearbeiten eines vorhandenen Text-Eintrags (Notiz, offener Punkt, Foto-Beschriftung). */
function textDialog(auftragId, v, neuZeichnen) {
  if (v.typ === 'notiz' || v.typ === 'wichtig') return notizDialog(auftragId, neuZeichnen, v);
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

function spracheDialog(auftragId, neuZeichnen, { onText } = {}) {
  let phase = 'bereit';     // bereit → laeuft → wertetAus → pruefen
  let sekunden = 0;
  let ticker = null;
  let felder = { arbeit: '', stunden: null, offen: '', wichtig: '' };
  let echt = false;
  let aufnahme = null;
  let messer = null;        // Lautstärkemessung am Mikrofonstrom
  let anzeige = null;       // laufende Balkenanzeige
  let welle = [];           // Verlauf der Aufnahme, für das stehende Bild
  let transkript = '';      // echtes Transkript, wenn vorhanden
  let material = [];        // erkanntes Material, je Eintrag bestätigbar
  let problem = null;
  let geschlossen = false;
  let startet = false;
  let notizEntwurf = '';
  let aufnahmen = 0;
  const dienstBereit = flows.verfuegbar();
  const verbinden = (alt, neu) => [alt, neu].filter(t => typeof t === 'string' && t.trim()).join('\n\n');

  // Jede Aufnahme ergänzt den lokalen Entwurf. Erst die Übernahme schreibt
  // neue Verlaufseinträge; bereits gespeicherte Einträge werden nie ersetzt.
  const antwortErgaenzen = (antwort) => {
    const v = antwort.vorschlag || {};
    const text = typeof antwort.transkript === 'string' ? antwort.transkript : '';
    const zeit = parseZahl(v.stunden);
    transkript = verbinden(transkript, text);
    felder = {
      arbeit: verbinden(felder.arbeit, v.arbeit),
      stunden: zeit !== null && zeit > 0 ? (parseZahl(felder.stunden) || 0) + zeit : felder.stunden,
      offen: verbinden(felder.offen, v.offen),
      wichtig: verbinden(felder.wichtig, v.wichtig),
    };
    material.push(...(Array.isArray(v.material) ? v.material : []).filter(m => m && typeof m.text === 'string').map(m => ({ ...m, an: true })));
    // Die bestehende Auswertung kann einen Notiztext liefern; ansonsten bleibt
    // das vollständige Transkript erhalten, damit Zusatzinformationen nicht
    // durch die enger gefassten Arbeits-/Materialfelder verloren gehen.
    notizEntwurf = verbinden(notizEntwurf, v.notiz || text || v.arbeit);
    aufnahmen++;
  };

  const pruefwerteMerken = (el) => {
    if (onText) { notizEntwurf = el.querySelector('#sprach-notiz').value; return true; }
    const zeitText = el.querySelector('#ss').value;
    const zeit = parseZahl(zeitText);
    if (zeitText.trim() && (zeit === null || zeit < 0)) {
      toast('Bitte die Arbeitszeit als gültige, nicht negative Zahl eintragen.');
      return false;
    }
    felder = {
      arbeit: el.querySelector('#sa').value.trim(), stunden: zeit,
      offen: el.querySelector('#so').value.trim(), wichtig: el.querySelector('#sw').value.trim(),
    };
    return true;
  };

  const uhrzeit = () =>
    `${String(Math.floor(sekunden / 60)).padStart(2, '0')}:${String(sekunden % 60).padStart(2, '0')}`;

  const pegelBeenden = () => {
    if (anzeige) { welle = anzeige.stoppen(); anzeige = null; }
    if (messer) { messer.schliessen(); messer = null; }
  };

  const sheet = sheetOeffnen({
    titel: onText ? 'Notiz per Sprache ergänzen' : 'Einsprechen',
    body: () => {
      if (phase === 'wertetAus') {
        return `
          <div class="rec-box">
            ${pegel.pegelFeld('standbild')}
            <div class="rec-status">Aufnahme: ${esc(uhrzeit())}</div>
          </div>
          <div class="state-box">Aufnahme wird ausgewertet …
            <div class="state-hint">Erst wird der Text erkannt, dann werden Arbeit, Zeit und
              Material herausgezogen.</div>
          </div>`;
      }

      if (phase === 'pruefen') {
        if (onText) return `
          ${echt ? hinweisBox('Aus Ihrer Spracheingabe. Bitte prüfen; der Text wird an Ihre bestehende Notiz angehängt.', 'Vorschlag')
            : hinweisBox('Beispieltext — diese Demo nimmt keine Stimme auf. Der Text wird an die Notiz angehängt.')}
          <div class="f"><label class="f-label" for="sprach-notiz">Ergänzung für Ihre Notiz</label>
            <textarea class="inp" id="sprach-notiz" rows="7">${esc(notizEntwurf)}</textarea></div>
          <details class="sprach-original"><summary>Alle erkannten Worte ansehen (${aufnahmen} ${aufnahmen === 1 ? 'Aufnahme' : 'Aufnahmen'})</summary>
            <div class="zitat">${esc(transkript)}</div></details>`;
        return `
          <div class="hint-note">${aufnahmen} ${aufnahmen === 1 ? 'Aufnahme' : 'Aufnahmen'} gesammelt. Frühere Einträge bleiben erhalten. Weitere Aufnahmen werden ergänzt.</div>
          ${echt
            ? hinweisBox('<strong>Aus Ihrer Aufnahme erkannt.</strong> Die Angaben sind ein Vorschlag '
              + 'und noch nicht übernommen. Bitte prüfen und korrigieren.', 'Vorschlag')
            : hinweisBox('<strong>Beispiel-Aufbereitung.</strong> Der folgende Text wurde nicht aus Ihrer Stimme '
              + 'erkannt — er ist im Demo-Code fest hinterlegt, damit Sie sehen, wie das Ergebnis aussähe. '
              + 'Bitte prüfen und korrigieren.')}
          ${echt ? `
          <div class="rec-box">
            ${pegel.pegelFeld('standbild')}
            <div class="rec-status">Aufnahme: ${esc(uhrzeit())}</div>
          </div>` : ''}
          <div class="card">
            <div class="card-head"><div class="card-title">${echt ? 'Transkript' : 'Beispieltranskript'}</div></div>
            <div class="card-body zitat">
              „${esc(transkript)}"
            </div>
          </div>
          ${material.length ? `
          <div class="card">
            <div class="card-head"><div class="card-title">Erkanntes Material</div></div>
            <div class="card-body stapel">
              ${material.map((m, i) => `
                <label class="f-check">
                  <input type="checkbox" data-mat="${i}" ${m.an ? 'checked' : ''}>
                  <span>${esc([m.menge, m.einheit, m.text].filter(Boolean).join(' '))}</span>
                </label>`).join('')}
              <div class="hint-note">Nur angehaktes Material wird übernommen. Preise bleiben offen.</div>
            </div>
          </div>` : ''}
          <div class="f">
            <label class="f-label" for="sa">Ausgeführte Arbeit</label>
            <textarea class="inp" id="sa" rows="3">${esc(felder.arbeit)}</textarea>
          </div>
          <div class="f">
            <label class="f-label" for="ss">Arbeitszeit in Stunden</label>
            <input class="inp" id="ss" inputmode="decimal" value="${esc(zahlZuFeld(felder.stunden))}">
          </div>
          <div class="f">
            <label class="f-label" for="so">Offener Punkt <span class="opt">(leer lassen, wenn keiner)</span></label>
            <textarea class="inp" id="so" rows="2">${esc(felder.offen)}</textarea>
          </div>
          <div class="f sprach-wichtig">
            <label class="f-label" for="sw">Wichtig <span class="opt">(zusätzlicher Hinweis)</span></label>
            <textarea class="inp" id="sw" rows="2" placeholder="Zum Beispiel: Schlüssel beim Hausmeister abgeben.">${esc(felder.wichtig)}</textarea>
            <button class="btn btn-sm" data-als-wichtig type="button">Erkannten Text hier ergänzen</button>
            <p class="doku-hint">Steht rot in der Übersicht. Wird nicht als Rechnungsposition übernommen.</p>
          </div>
          <div class="hint-note">Mengen und Preise bleiben bewusst offen — die trägt niemand
            für Sie ein. Sie kommen erst im Rechnungsentwurf dazu.</div>`;
      }

      return `
        ${echt
          ? hinweisBox('Die Aufnahme wird zum Erkennen übertragen und dort nicht gespeichert. '
            + 'Sagen Sie, was Sie gemacht haben, wie lange, und was noch offen ist.', '')
          : hinweisBox('<strong>Aufnahme ist simuliert.</strong> Die Demo greift nicht auf das Mikrofon zu '
            + 'und zeichnet nichts auf. Start und Stopp zeigen nur den Ablauf.')}
        ${problem ? `<div class="state-box error">${esc(problem)}</div>` : ''}
        ${aufnahmen ? `<div class="hint-note">${aufnahmen} ${aufnahmen === 1 ? 'Aufnahme bleibt' : 'Aufnahmen bleiben'} erhalten. Sie ergänzen jetzt weitere Angaben.</div>` : ''}
        <div class="rec-box ${phase === 'laeuft' ? 'laeuft' : ''}">
          ${phase === 'laeuft' && echt
            ? pegel.pegelFeld('pegel')
            : `<div class="rec-dot">${icon('mikro')}</div>`}
          <div class="rec-timer" data-uhr>${uhrzeit()}</div>
          <div class="rec-status">${phase === 'laeuft'
            ? (echt ? 'Aufnahme läuft — sprechen Sie' : 'Aufnahme läuft (simuliert)') : 'Bereit'}</div>
        </div>`;
    },
    foot: () => {
      if (phase === 'wertetAus') return `<button class="btn btn-block" disabled type="button">Wird ausgewertet …</button>`;
      if (phase === 'bereit')  return `${aufnahmen ? '<button class="btn" data-zur-pruefung type="button">Bisherige Angaben prüfen</button>' : ''}<button class="btn btn-primaer btn-block" data-start type="button">${icon('mikro')} Aufnahme starten</button>`;
      if (phase === 'laeuft')  return `<button class="btn btn-primaer btn-block rec-stop" data-stop type="button"><span class="rec-stop-icon" aria-hidden="true"></span> Aufnahme stoppen</button>`;
      return `<button class="btn" data-nochmal type="button">Weiteres ergänzen</button>
              <button class="btn btn-primaer" data-ok type="button">${onText ? 'An Notiz anhängen' : 'In Dokumentation übernehmen'}</button>`;
    },
    bind: (el) => {
      el.querySelector('.sheet').classList.add('sheet-doku-aufnahme');
      el.querySelector('[data-zur-pruefung]')?.addEventListener('click', () => { phase = 'pruefen'; sheet.render(); });
      el.querySelector('[data-als-wichtig]')?.addEventListener('click', () => {
        const feld = el.querySelector('#sw');
        feld.value = verbinden(feld.value, transkript);
      });
      el.querySelectorAll('[data-mat]').forEach(box =>
        box.addEventListener('change', () => {
          const i = Number(box.dataset.mat);
          if (material[i]) material[i].an = box.checked;
        }));

      // Laufende Aufnahme zeichnet das Sheet NICHT neu — sonst flackert es
      // im Sekundentakt. Uhr und Balken werden direkt am Element nachgezogen.
      if (phase === 'laeuft') {
        const uhrEl = el.querySelector('[data-uhr]');
        ticker = setInterval(() => {
          sekunden++;
          if (uhrEl) uhrEl.textContent = uhrzeit();
        }, 1000);

        const feld = el.querySelector('[data-pegel]');
        if (feld && messer) {
          feld.classList.add('aktiv');
          anzeige = pegel.anzeigeStarten(feld, messer);
        }
      }

      const standEl = el.querySelector('[data-standbild]');
      if (standEl) {
        standEl.classList.add('standbild');
        pegel.standbildZeichnen(standEl, pegel.standbild(welle));
      }

      el.querySelector('[data-start]')?.addEventListener('click', async (event) => {
        if (startet) return;
        startet = true;
        event.currentTarget.disabled = true;
        problem = null;
        welle = [];
        echt = await dienstBereit;
        if (geschlossen) return;
        if (echt) {
          try {
            aufnahme = await flows.aufnahmeStarten();
            if (geschlossen) { aufnahme.abbrechen(); return; }
            messer = pegel.messerStarten(aufnahme.stream);
          } catch (e) {
            problem = e.message;
            startet = false;
            sheet.render();
            return;
          }
        }
        phase = 'laeuft'; sekunden = 0;
        startet = false;
        sheet.render();
      });

      el.querySelector('[data-stop]')?.addEventListener('click', async () => {
        clearInterval(ticker); ticker = null;
        pegelBeenden();

        if (!echt) {
          antwortErgaenzen({ transkript: SPRACH_BEISPIEL, vorschlag: SPRACH_AUFBEREITUNG });
          phase = 'pruefen'; sheet.render(); return;
        }

        phase = 'wertetAus';
        sheet.render();
        let antwort;
        try {
          const blob = await aufnahme.stoppen();
          aufnahme = null;
          if (geschlossen) return;
          antwort = await flows.spracheAuswerten(blob, 'doku');
        } catch (e) {
          antwort = { ok: false, fehler: e.message || 'Aufnahme konnte nicht ausgewertet werden.' };
        }
        if (geschlossen) return;
        if (!antwort.ok) {
          problem = antwort.fehler || 'Die Auswertung ist fehlgeschlagen.';
          phase = 'bereit'; sekunden = 0;
          sheet.render();
          return;
        }
        antwortErgaenzen(antwort);
        phase = 'pruefen';
        sheet.render();
      });

      el.querySelector('[data-nochmal]')?.addEventListener('click', () => {
        if (!pruefwerteMerken(el)) return;
        phase = 'bereit'; sekunden = 0;
        welle = []; problem = null;
        sheet.render();
      });

      el.querySelector('[data-ok]')?.addEventListener('click', () => {
        if (!pruefwerteMerken(el)) return;
        if (onText) {
          if (!notizEntwurf.trim()) return toast('Bitte zuerst eine Ergänzung eintragen.');
          onText(notizEntwurf.trim(), !echt);
          sheetSchliessen();
          toast('An Notiz angehängt — zum Übernehmen bitte noch speichern.');
          return;
        }
        // Eine ergänzende Aufnahme beschreibt nicht immer erneut die ganze
        // Aufgabe — wer nur noch Material oder einen offenen Punkt nachträgt,
        // soll das ohne Wiederholung tun können. Nur eine Arbeitszeit braucht
        // zwingend einen Text dazu, sonst stünde auf der Rechnung eine Position
        // ohne Leistungsbeschreibung.
        const hatZeit = felder.stunden !== null && felder.stunden > 0;
        const hatMaterial = material.some(m => m.an && m.text);
        if (hatZeit && !felder.arbeit) return toast('Für die Arbeitszeit fehlt noch, welche Arbeit das war.');
        if (!felder.arbeit && !hatZeit && !hatMaterial && !felder.offen && !felder.wichtig && !transkript.trim()) {
          return toast('Bitte etwas eintragen, das übernommen werden soll.');
        }

        // Ein Sprach-Eintrag plus die daraus abgeleiteten, prüfbaren Einzelteile.
        // `simuliert` sagt die Wahrheit über die Herkunft: bei echter Aufnahme
        // ist der Eintrag nicht simuliert, sondern von Edin bestätigt.
        state.verlaufHinzufuegen(auftragId, {
          typ: 'sprache',
          text: echt ? 'Sprachnotiz aufgenommen' : 'Sprachnotiz aufgenommen (Beispiel)',
          transkript,
          simuliert: !echt,
        });
        if (felder.arbeit) {
          state.verlaufHinzufuegen(auftragId, { typ: 'notiz', text: felder.arbeit, simuliert: !echt });
        }
        if (hatZeit) {
          state.verlaufHinzufuegen(auftragId, { typ: 'zeit', text: felder.arbeit, stunden: felder.stunden, simuliert: !echt });
        }
        // Nur angehaktes Material wird übernommen. Daraus werden später
        // Rechnungspositionen — ungeprüft darf hier nichts durchrutschen.
        for (const m of material) {
          if (!m.an || !m.text) continue;
          state.verlaufHinzufuegen(auftragId, {
            typ: 'material', text: m.text,
            menge: m.menge ?? null, einheit: m.einheit || 'Stück',
            lieferant: '', simuliert: !echt,
          });
        }
        if (felder.offen) {
          state.verlaufHinzufuegen(auftragId, { typ: 'offen', text: felder.offen, simuliert: !echt });
        }
        if (felder.wichtig) {
          state.verlaufHinzufuegen(auftragId, { typ: 'wichtig', text: felder.wichtig, simuliert: !echt });
        }
        sheetSchliessen(); neuZeichnen(); toast('In die Dokumentation übernommen.');
      });
    },
    onClose: () => {
      geschlossen = true;
      if (ticker) clearInterval(ticker);
      pegelBeenden();
      if (aufnahme) aufnahme.abbrechen();
    },
    vorRender: () => { if (ticker) { clearInterval(ticker); ticker = null; } },
  });

  dienstBereit.then((ja) => {
    if (geschlossen || startet || phase !== 'bereit') return;
    echt = ja;
    sheet.render();
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
      <button class="btn btn-primaer doku-abschluss" data-ok type="button">${icon('check')} Als erledigt markieren</button>`,
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
