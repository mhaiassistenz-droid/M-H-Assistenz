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
import { freischaltenKnopf } from './freischalten.js';
import * as state from './state.js';
import { sheetOeffnen, sheetSchliessen, bestaetigen, toast, badge, hinweisBox, leerZustand } from './ui.js';
import { voicing } from './voicing.js';

/* Beispiel-Sprachnotiz. Fest hinterlegt — es wird nichts aufgenommen
   und nichts erkannt, und die UI sagt das an jeder Stelle. */
const SPRACH_BEISPIEL = 'Dichtung getauscht, eineinhalb Stunden gearbeitet. Eine weitere Stelle ist noch offen.';

/** Was eine echte Spracherkennung aus dem Satz machen würde — hier fest verdrahtet. */
const SPRACH_AUFBEREITUNG = {
  arbeit: 'Dichtung getauscht',
  stunden: 1.5,
  offen: 'Eine weitere Stelle ist noch offen.',
};

/** Diese Einträge können mit einem Tipp zur Aufgabe werden — Zeit und Material nicht,
    die gehören auf die Rechnung. */
const ALS_AUFGABE = new Set(['notiz', 'offen', 'wichtig']);

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

  // Ein Diktierknopf je geöffneter Akte. Er überlebt das Neuzeichnen der Akte;
  // eine laufende Aufnahme hängt sich beim nächsten bind() wieder an (voicing.js).
  let api = null;
  const stimme = voicing({
    kontext: 'doku',
    label: 'Schnell diktieren',
    beispiel: DIKTAT_BEISPIEL,
    freischalten: false,
    demoText: '<strong>Diktat ist simuliert.</strong> Es wird nichts aufgenommen; der Knopf liefert ein hinterlegtes Beispiel.',
    onErgebnis: (antwort, echt) => diktatAufnehmen(auftragId, () => api?.render(), antwort, echt),
  });

  api = sheetOeffnen({
    titel: 'Auftragsakte',
    kopfAktion: () => `
      <button class="btn btn-sm" data-bearbeiten type="button">
        ${icon('stift')} Korrigieren
      </button>`,
    body: () => koerper(holen(), stimme),
    foot: () => fussleiste(holen()),
    bind: (el, a) => { stimme.binden(el); binden(el, a, auftragId); },
    onClose: () => stimme.abbrechen(),
  });
}

/* ── Darstellung ─────────────────────────── */

function koerper(a, stimme) {
  const offen = offeneAufnahme(a.id);
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
      ${(a.ansprechpartner || a.telefon || a.email || a.rechnungsadresse) ? `
        <details class="akte-kontakt">
          <summary>Kontakt anzeigen</summary>
          ${a.ansprechpartner ? `<div class="akte-zeile">${icon('person')}<span>${esc(a.ansprechpartner)}</span></div>` : ''}
          ${(a.telefon || a.email) ? `<div class="akte-zeile">${icon('telefon')}<span>${esc([a.telefon, a.email].filter(Boolean).join(' · '))}</span></div>` : ''}
          ${a.rechnungsadresse ? `<div class="akte-zeile">${icon('rechnung')}<span>Rechnung an: ${esc(a.rechnungsadresse)}</span></div>` : ''}
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
      ${offen ? `
        <div class="hint-note offen-aufnahme" data-offen-aufnahme>
          <span>${offen.aufnahmen === 1 ? 'Eine Aufnahme ist' : `${offen.aufnahmen} Aufnahmen sind`} noch nicht übernommen.</span>
          <span class="btn-zeile">
            <button class="btn btn-sm btn-primaer" data-offen-pruefen type="button">Prüfen</button>
            <button class="btn btn-sm btn-warn" data-offen-verwerfen type="button">Verwerfen</button>
          </span>
        </div>` : ''}
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
      <div class="doku-diktat">${stimme ? stimme.html() : ''}</div>
      <input type="file" accept="image/*" capture="environment" data-file-kamera hidden>
      <input type="file" accept="image/*" multiple data-file-galerie hidden>
    </section>

    <section class="doku-history" aria-label="Dokumentationsverlauf">
      <div class="card-head">
        <div><h2 class="card-title">Dokumentation</h2><p class="doku-hint">Alles zum Einsatz auf einen Blick</p></div>
        <span class="doku-kopf-akt">
          <button class="btn btn-sm" data-bericht type="button">${icon('rechnung')} Bericht</button>
          <span class="doku-count" aria-label="${a.verlauf.length} Einträge">${a.verlauf.length}</span>
        </span>
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
  const ohneKst = state.ohneKostenstelle(a).length;
  const aufgaben = state.aufgabenZuAuftrag(a.id);
  const liste = (eintraege, text, leer) => eintraege.length
    ? `<ul>${eintraege.map(v => `<li>${esc(text(v))}</li>`).join('')}</ul>`
    : `<p class="doku-empty">${leer}</p>`;
  return `<div class="doku-ueberblick">
    ${wichtig.length ? `<section class="doku-fakten wichtig"><h3>${icon('offen')} Wichtig <span>${wichtig.length}</span></h3>${liste(wichtig, v => v.text, '')}</section>` : ''}
    <section class="doku-fakten arbeit"><h3>${icon('uhr')} Arbeitszeit <span>${esc(fmtStunden(state.summeStunden(a)))}</span></h3>
      ${liste(zeiten, v => `${v.stunden === null ? 'Zeit offen' : fmtStunden(v.stunden)} — ${v.text || 'Ohne Beschreibung'} · ${kstText(v)}`, 'Noch keine Arbeitszeit erfasst.')}
      ${zeiten.length || material.length ? `
        <div class="doku-kst">
          ${ohneKst ? `<span class="doku-kst-offen">${ohneKst} ${ohneKst === 1 ? 'Eintrag' : 'Einträge'} ohne Kostenstelle</span>` : ''}
          <button class="btn btn-sm" data-taetigkeiten type="button">Tätigkeiten &amp; Kostenstellen</button>
        </div>` : ''}</section>
    <section class="doku-fakten material"><h3>${icon('material')} Material <span>${material.length} Posten</span></h3>
      ${liste(material, v => `${zahlZuFeld(v.menge) || 'Menge offen'} ${v.einheit || ''} — ${v.text || 'Ohne Bezeichnung'} · ${kstText(v)}`, 'Noch kein Material erfasst.')}</section>
    ${aufgaben.length ? `<section class="doku-fakten aufgaben"><h3>${icon('aufgaben')} Aufgaben <span>${aufgaben.length}</span></h3>${liste(aufgaben, x => x.text, '')}</section>` : ''}
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
    detail = `<div class="vl-detail">${v.stunden === null ? '<span class="vl-offen-wert">Zeit offen</span>' : esc(fmtStunden(v.stunden))}
      · <span class="${v.kostenstelle ? '' : 'vl-offen-wert'}">${esc(kstText(v))}</span></div>`;
  } else if (v.typ === 'material') {
    const teile = [`${zahlZuFeld(v.menge) || '—'} ${esc(v.einheit || '')}`.trim()];
    if (v.lieferant) teile.push(`Lieferant: ${esc(v.lieferant)}`);
    teile.push(`<span class="${v.kostenstelle ? '' : 'vl-offen-wert'}">${esc(kstText(v))}</span>`);
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
          ${ALS_AUFGABE.has(v.typ) && state.aufgabeZuEintrag(v.id) ? `<span class="vl-marke-aufgabe">${icon('aufgaben')} Als Aufgabe angelegt</span>` : ''}
        </div>
        <div class="vl-text">${esc(v.text) || '<span class="f-val leer">Ohne Text</span>'}</div>
        ${detail}
      <div class="vl-akt">
        ${ALS_AUFGABE.has(v.typ) && !state.aufgabeZuEintrag(v.id)
          ? `<button class="btn btn-sm vl-als-aufgabe" data-vl-aufgabe="${v.id}" type="button">${icon('aufgaben')} Als Aufgabe</button>` : ''}
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

  el.querySelector('[data-taetigkeiten]')?.addEventListener('click', () => taetigkeitenDialog(auftragId, neuZeichnen));

  el.querySelectorAll('[data-vl-aufgabe]').forEach(b => b.addEventListener('click', () => {
    const v = a().verlauf.find(x => x.id === b.dataset.vlAufgabe);
    if (!v || state.aufgabeZuEintrag(v.id)) return;
    state.aufgabeAnlegen({ text: v.text, auftragId, quelleEintragId: v.id });
    neuZeichnen();
    toast('Aufgabe angelegt — steht links unter „Aufgaben".');
  }));

  /* ── Noch nicht übernommene Aufnahme ── */
  el.querySelector('[data-offen-pruefen]')?.addEventListener('click', () => offeneAufnahmeOeffnen(auftragId, neuZeichnen));
  el.querySelector('[data-offen-verwerfen]')?.addEventListener('click', async () => {
    const ja = await bestaetigen({
      titel: 'Aufnahme verwerfen', text: 'Die noch nicht übernommene Aufnahme wird gelöscht und ist danach weg.',
      jaText: 'Verwerfen', warnend: true,
    });
    if (!ja) return;
    offeneAufnahmeLoeschen(auftragId);
    neuZeichnen();
    toast('Aufnahme verworfen.');
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

  el.querySelector('[data-bericht]')?.addEventListener('click', async () => {
    const { berichtOeffnen } = await import('./bericht.js');
    berichtOeffnen(auftragId, neuZeichnen);
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

/**
 * Kostenstellen-Eingabe mit Vorschlägen aus diesem Auftrag. Freitext, weil Edins
 * Nummernsystem noch nicht bekannt ist; leer bleibt „noch zuordnen" (Fachregel 5).
 */
function kostenstelleFeld(auftragId, id, wert, extraAttr = '') {
  const liste = state.kostenstellenImAuftrag(state.auftrag(auftragId));
  return `
    <input class="inp" id="${id}" list="${id}-liste" value="${esc(wert || '')}"
      placeholder="noch zuordnen" autocomplete="off" ${extraAttr}>
    <datalist id="${id}-liste">${liste.map(k => `<option value="${esc(k)}">`).join('')}</datalist>`;
}

/** „KST 200" bzw. ausdrücklich „noch zuordnen" — nie leer, damit nichts übersehen wird. */
const kstText = (v) => v.kostenstelle ? `Kostenstelle ${v.kostenstelle}` : 'Kostenstelle noch zuordnen';

/**
 * Notiz direkt, ohne die Akte zu öffnen — für die Zwischennotiz „von Auftrag zu
 * Auftrag" (1f). Derselbe Dialog wie in der Akte, derselbe Entwurfsschutz.
 */
export function notizOeffnen(auftragId) {
  if (!state.auftrag(auftragId)) return;
  notizDialog(auftragId, () => {});
}

/* Ungespeicherte Notiz je Auftrag und Eintrag. Liegt in localStorage wie der
   Auftragsentwurf in erfassen.js: X, Klick daneben, Esc, Ansichtswechsel oder ein
   Reload dürfen frisch Getipptes oder Diktiertes nicht verwerfen (1d). */
const notizKey = (auftragId, v) => `pt-notiz-entwurf-${auftragId}-${v?.id ?? 'neu'}`;

function notizEntwurfLaden(key) {
  try { const roh = localStorage.getItem(key); return roh ? JSON.parse(roh) : null; } catch { return null; }
}
function notizEntwurfSichern(key, daten) {
  try { localStorage.setItem(key, JSON.stringify(daten)); } catch { /* nur diese Sitzung */ }
}
function notizEntwurfLoeschen(key) {
  try { localStorage.removeItem(key); } catch { /* egal */ }
}

function notizDialog(auftragId, neuZeichnen, v = null) {
  const key = notizKey(auftragId, v);
  const original = { text: v?.text || '', wichtig: v?.typ === 'wichtig', beispiel: !!v?.simuliert };
  const gesichert = notizEntwurfLaden(key);
  const wiederhergestellt = !!gesichert && (gesichert.text !== original.text || gesichert.wichtig !== original.wichtig);
  let entwurf = wiederhergestellt ? gesichert.text : original.text;
  let wichtig = wiederhergestellt ? !!gesichert.wichtig : original.wichtig;
  let beispiel = wiederhergestellt ? !!gesichert.beispiel : original.beispiel;
  let zeigeWiederhergestellt = wiederhergestellt;
  let alsAufgabe = false;
  const aufgabeMoeglich = !v || !state.aufgabeZuEintrag(v.id);

  /** Nur ein abweichender Stand ist ein Entwurf; sonst gibt es nichts zu sichern. */
  const sichern = () => {
    if (entwurf === original.text && wichtig === original.wichtig) notizEntwurfLoeschen(key);
    else notizEntwurfSichern(key, { text: entwurf, wichtig, beispiel });
  };

  sheetOeffnen({
    titel: v ? 'Notiz bearbeiten' : 'Notiz schreiben',
    body: () => `
      ${zeigeWiederhergestellt ? `
        <div class="hint-note notiz-wieder" data-notiz-wieder>Nicht gespeicherter Entwurf wiederhergestellt.
          <button class="btn btn-sm" data-notiz-verwerfen type="button">Entwurf verwerfen</button></div>` : ''}
      <div class="f">
        <label class="f-label" for="nz">Was ist vor Ort passiert?</label>
        <textarea class="inp" id="nz" rows="5"
          placeholder="z. B. Siphon gereinigt, Ablauf läuft wieder frei.">${esc(entwurf)}</textarea>
      </div>
      <button class="btn notiz-diktieren" data-notiz-sprache type="button">${icon('mikro')} Per Sprache ergänzen</button>
      <label class="f-check"><input type="checkbox" data-wichtig ${wichtig ? 'checked' : ''}> Als wichtigen Hinweis rot hervorheben</label>
      ${aufgabeMoeglich ? `<label class="f-check"><input type="checkbox" data-als-aufgabe ${alsAufgabe ? 'checked' : ''}> Auch als Aufgabe zum Abhaken merken</label>` : ''}
      <div class="hint-note">Gesprochene Ergänzungen werden an diesen Text angehängt. Erst „Notiz speichern“ übernimmt die Notiz.
        Bis dahin bleibt der Entwurf auf diesem Gerät erhalten.</div>`,
    foot: () => `
      <button class="btn" data-ab type="button">Später weiter</button>
      <button class="btn btn-primaer" data-ok type="button">Notiz speichern</button>`,
    bind: (el) => {
      const ta = el.querySelector('#nz');
      ta.addEventListener('input', () => { entwurf = ta.value; sichern(); });
      el.querySelector('[data-wichtig]').addEventListener('change', e => { wichtig = e.target.checked; sichern(); });
      el.querySelector('[data-als-aufgabe]')?.addEventListener('change', e => { alsAufgabe = e.target.checked; });
      el.querySelector('[data-notiz-verwerfen]')?.addEventListener('click', () => {
        ({ text: entwurf, wichtig, beispiel } = original);
        zeigeWiederhergestellt = false;
        notizEntwurfLoeschen(key);
        ta.value = entwurf;
        el.querySelector('[data-wichtig]').checked = wichtig;
        el.querySelector('[data-notiz-wieder]')?.remove();
        toast('Entwurf verworfen.');
      });
      el.querySelector('[data-notiz-sprache]').addEventListener('click', () => {
        entwurf = ta.value;
        spracheDialog(auftragId, neuZeichnen, { onText: (text, simuliert) => {
          entwurf = [entwurf.trim(), text.trim()].filter(Boolean).join('\n\n');
          beispiel ||= simuliert;
          // Diktiertes sofort sichern, nicht erst beim nächsten Tastendruck.
          sichern();
        } });
      });
      el.querySelector('[data-ab]').addEventListener('click', () => {
        entwurf = ta.value; sichern();
        sheetSchliessen();
        if (entwurf !== original.text) toast('Notiz-Entwurf gesichert — beim nächsten Öffnen ist er wieder da.');
      });
      el.querySelector('[data-ok]').addEventListener('click', () => {
        const text = ta.value.trim();
        if (!text) return toast('Bitte zuerst etwas eintragen.');
        const daten = { typ: wichtig ? 'wichtig' : 'notiz', text, simuliert: beispiel };
        const eintrag = v ? state.verlaufUpdate(auftragId, v.id, daten) : state.verlaufHinzufuegen(auftragId, daten);
        const mitAufgabe = alsAufgabe && eintrag && !state.aufgabeZuEintrag(eintrag.id);
        if (mitAufgabe) state.aufgabeAnlegen({ text, auftragId, quelleEintragId: eintrag.id });
        notizEntwurfLoeschen(key);
        sheetSchliessen(); neuZeichnen();
        toast(mitAufgabe ? 'Notiz gespeichert und als Aufgabe angelegt.' : 'Notiz gespeichert.');
      });
    },
    // X, Klick daneben, Esc: den Stand aus dem Feld noch sichern.
    vorSchliessen: (el) => {
      const ta = el?.querySelector('#nz');
      if (ta) { entwurf = ta.value; sichern(); }
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
  // Eine aufgeteilte Tätigkeit darf „Zeit offen" bleiben — die Stunden trägt Edin
  // nach, statt dass eine Schätzung auf der Rechnung landet.
  const zeitDarfOffen = !!v && v.stunden === null;
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
      <div class="f">
        <label class="f-label" for="zk">Kostenstelle <span class="opt">(leer = noch zuordnen)</span></label>
        ${kostenstelleFeld(auftragId, 'zk', v?.kostenstelle)}
      </div>
      <div class="hint-note">Halbe Stunden als Komma schreiben: 1,5 statt 1.5.${zeitDarfOffen
        ? ' Leer lassen, solange die Zeit für diese Tätigkeit noch nicht feststeht.' : ''}</div>`,
    foot: () => `
      <button class="btn" data-ab type="button">Abbrechen</button>
      <button class="btn btn-primaer" data-ok type="button">Speichern</button>`,
    bind: (el) => {
      el.querySelector('[data-ab]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-ok]').addEventListener('click', () => {
        const roh = el.querySelector('#zs').value;
        const stunden = parseZahl(roh);
        const text = el.querySelector('#zt').value.trim();
        const kostenstelle = state.kostenstelleNormal(el.querySelector('#zk').value);
        const offenLassen = zeitDarfOffen && !roh.trim();
        if (!offenLassen && (stunden === null || stunden <= 0)) return toast('Bitte eine Stundenzahl größer als 0 eintragen.');
        if (!text) return toast('Bitte eintragen, wofür die Zeit angefallen ist.');
        const daten = { stunden: offenLassen ? null : stunden, text, kostenstelle };
        if (v) state.verlaufUpdate(auftragId, v.id, { ...daten, simuliert: false });
        else   state.verlaufHinzufuegen(auftragId, { typ: 'zeit', ...daten });
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
      <div class="f">
        <label class="f-label" for="mk">Kostenstelle <span class="opt">(leer = noch zuordnen)</span></label>
        ${kostenstelleFeld(auftragId, 'mk', v?.kostenstelle)}
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
          kostenstelle: state.kostenstelleNormal(el.querySelector('#mk').value),
        };
        if (v) state.verlaufUpdate(auftragId, v.id, { ...daten, simuliert: false });
        else   state.verlaufHinzufuegen(auftragId, { typ: 'material', ...daten });
        sheetSchliessen(); neuZeichnen(); toast('Material gespeichert.');
      });
    },
  });
}

/* ── Noch nicht übernommene Aufnahmen ────── */

/* Was eingesprochen, aber noch nicht in die Dokumentation übernommen wurde, liegt
   bis zur Übernahme in localStorage — sofort nach jeder Auswertung, nicht erst beim
   Bestätigen. Sonst ginge eine Aufnahme mit dem X, einem Ansichtswechsel oder einem
   Reload verloren (1d/1e). Gelöscht wird erst nach Übernahme oder ausdrücklichem
   Verwerfen. */
const offenKey = (auftragId) => `pt-doku-offen-${auftragId}`;

export function offeneAufnahme(auftragId) {
  try { const roh = localStorage.getItem(offenKey(auftragId)); return roh ? JSON.parse(roh) : null; } catch { return null; }
}
function offeneAufnahmeSichern(auftragId, stand) {
  try { localStorage.setItem(offenKey(auftragId), JSON.stringify(stand)); } catch { /* nur diese Sitzung */ }
}
function offeneAufnahmeLoeschen(auftragId) {
  try { localStorage.removeItem(offenKey(auftragId)); } catch { /* egal */ }
}

/** Hat die Aufnahme etwas, das eindeutig in ein Dokumentationsfeld gehört? */
const hatZuordnung = (st) => !!(st && (st.felder?.arbeit || (Number(st.felder?.stunden) > 0)
  || st.material?.length || st.felder?.offen || st.felder?.wichtig || st.aufgaben?.length));

/**
 * Öffnet eine gesicherte Aufnahme wieder: mit eindeutiger Zuordnung in der
 * Prüfansicht, sonst mit der Rückfrage, wohin sie gehört.
 */
function offeneAufnahmeOeffnen(auftragId, neuZeichnen) {
  const st = offeneAufnahme(auftragId);
  if (!st) return;
  if (hatZuordnung(st)) spracheDialog(auftragId, neuZeichnen, { start: 'pruefen' });
  else zuordnungRueckfrage(auftragId, neuZeichnen);
}

/**
 * Freier Text ohne klares Ziel: nicht raten (Fachregel 5), sondern fragen.
 * Keine der Antworten wird zur Rechnungsposition — Notiz, offener Punkt und
 * wichtiger Hinweis stehen nur in der Dokumentation (Fachregel 3).
 */
function zuordnungRueckfrage(auftragId, neuZeichnen) {
  const st = offeneAufnahme(auftragId);
  if (!st) return;
  let text = st.notizEntwurf || st.transkript || '';
  sheetOeffnen({
    titel: 'Wohin gehört das?',
    body: () => `
      ${st.beispiel
        ? hinweisBox('<strong>Beispieltext.</strong> Es wurde nichts aufgenommen — der Text ist im Demo-Code hinterlegt.')
        : hinweisBox('Aus Ihrer Aufnahme. Arbeit, Zeit oder Material waren nicht eindeutig zu erkennen — '
          + 'bitte sagen Sie, wohin der Text gehört.', 'Rückfrage')}
      <div class="f">
        <label class="f-label" for="rf-text">Erkannter Text</label>
        <textarea class="inp" id="rf-text" rows="4">${esc(text)}</textarea>
      </div>
      <div class="rf-wahl">
        <button class="btn" data-rf="notiz" type="button">${icon('notiz')} Als Notiz</button>
        <button class="btn" data-rf="offen" type="button">${icon('offen')} Als offenen Punkt</button>
        <button class="btn" data-rf="wichtig" type="button">${icon('offen')} Als wichtigen Hinweis</button>
        <button class="btn" data-rf="aufgabe" type="button">${icon('aufgaben')} Als Aufgabe (zum Abhaken)</button>
      </div>
      <div class="hint-note">Nichts davon wird eine Rechnungsposition. Arbeitszeit und Material
        bitte über „Zeit erfassen“ bzw. „Material erfassen“ eintragen.</div>`,
    foot: () => `
      <button class="btn btn-warn" data-rf-weg type="button">Aufnahme verwerfen</button>
      <button class="btn" data-rf-spaeter type="button">Später</button>`,
    bind: (el) => {
      const ta = el.querySelector('#rf-text');
      ta.addEventListener('input', () => {
        text = ta.value;
        offeneAufnahmeSichern(auftragId, { ...st, notizEntwurf: text });
      });
      el.querySelectorAll('[data-rf]').forEach(b => b.addEventListener('click', () => {
        const inhalt = ta.value.trim();
        if (!inhalt) return toast('Der Text ist leer — bitte etwas eintragen oder verwerfen.');
        state.verlaufHinzufuegen(auftragId, {
          typ: 'sprache', text: st.beispiel ? 'Sprachnotiz aufgenommen (Beispiel)' : 'Sprachnotiz aufgenommen',
          transkript: st.transkript || inhalt, simuliert: !!st.beispiel,
        });
        if (b.dataset.rf === 'aufgabe') {
          state.aufgabeAnlegen({ text: inhalt, auftragId });
        } else {
          state.verlaufHinzufuegen(auftragId, { typ: b.dataset.rf, text: inhalt, simuliert: !!st.beispiel });
        }
        offeneAufnahmeLoeschen(auftragId);
        sheetSchliessen(); neuZeichnen();
        toast(b.dataset.rf === 'aufgabe' ? 'Als Aufgabe angelegt — steht links unter „Aufgaben".'
          : `Als ${ART[b.dataset.rf].label} übernommen.`);
      }));
      el.querySelector('[data-rf-weg]').addEventListener('click', async () => {
        const ja = await bestaetigen({
          titel: 'Aufnahme verwerfen', text: 'Der erkannte Text wird nicht übernommen und ist danach weg.',
          jaText: 'Verwerfen', warnend: true,
        });
        if (!ja) return;
        offeneAufnahmeLoeschen(auftragId);
        sheetSchliessen(); neuZeichnen(); toast('Aufnahme verworfen.');
      });
      el.querySelector('[data-rf-spaeter]').addEventListener('click', () => { sheetSchliessen(); neuZeichnen(); });
    },
    onClose: () => neuZeichnen(),
  });
}

/** Beispielantwort für den Diktierknopf ohne Backend — dieselbe wie im Einsprechen-Sheet. */
const DIKTAT_BEISPIEL = () => ({ ok: true, transkript: SPRACH_BEISPIEL, vorschlag: SPRACH_AUFBEREITUNG });

/**
 * Ergebnis des Diktierknopfs in der Akte: sofort sichern, dann prüfen lassen.
 * Eindeutig zuordenbar → Prüfansicht mit den erkannten Feldern; sonst Rückfrage.
 */
function diktatAufnehmen(auftragId, neuZeichnen, antwort, echt) {
  const stand = sprachStandErgaenzen(offeneAufnahme(auftragId) || leererSprachStand(), antwort);
  stand.beispiel = stand.beispiel || !echt;
  offeneAufnahmeSichern(auftragId, stand);
  offeneAufnahmeOeffnen(auftragId, neuZeichnen);
}

const leererSprachStand = () => ({
  transkript: '', felder: { arbeit: '', stunden: null, offen: '', wichtig: '' },
  material: [], aufgaben: [], notizEntwurf: '', aufnahmen: 0, beispiel: false,
});

const verbinden = (alt, neu) => [alt, neu].filter(t => typeof t === 'string' && t.trim()).join('\n\n');

/** Eine weitere Auswertung an den gesammelten Stand anhängen — nie ersetzen. */
function sprachStandErgaenzen(st, antwort) {
  const v = antwort.vorschlag || {};
  const text = typeof antwort.transkript === 'string' ? antwort.transkript : '';
  const zeit = parseZahl(v.stunden);
  return {
    ...st,
    transkript: verbinden(st.transkript, text),
    felder: {
      arbeit: verbinden(st.felder.arbeit, v.arbeit),
      stunden: zeit !== null && zeit > 0 ? (parseZahl(st.felder.stunden) || 0) + zeit : st.felder.stunden,
      offen: verbinden(st.felder.offen, v.offen),
      wichtig: verbinden(st.felder.wichtig, v.wichtig),
    },
    material: [...st.material, ...(Array.isArray(v.material) ? v.material : [])
      .filter(m => m && typeof m.text === 'string').map(m => ({ ...m, an: true }))],
    // Nur ausdrücklich „als Aufgabe" Gesagtes — ein Vorschlag, den Edin bestätigt.
    aufgaben: [...(st.aufgaben || []), ...state.aufgabenAusTranskript(text)
      .filter(t => !(st.aufgaben || []).some(x => x.text === t)).map(t => ({ text: t, an: true }))],
    // Die bestehende Auswertung kann einen Notiztext liefern; ansonsten bleibt
    // das vollständige Transkript erhalten, damit Zusatzinformationen nicht
    // durch die enger gefassten Arbeits-/Materialfelder verloren gehen.
    notizEntwurf: verbinden(st.notizEntwurf, v.notiz || text || v.arbeit),
    aufnahmen: st.aufnahmen + 1,
  };
}

/* ── Sprachnotiz ─────────────────────────── */

function spracheDialog(auftragId, neuZeichnen, { onText, start } = {}) {
  let phase = start === 'pruefen' ? 'pruefen' : 'bereit';   // bereit → laeuft → wertetAus → pruefen
  let sekunden = 0;
  let ticker = null;
  let felder = { arbeit: '', stunden: null, offen: '', wichtig: '' };
  // Beim Notizdiktat (onText) sammelt die Notiz selbst; sonst gilt der gesicherte Stand.
  const gesichert = onText ? null : offeneAufnahme(auftragId);
  let beispiel = !!gesichert?.beispiel;
  let echt = gesichert ? !gesichert.beispiel : false;
  let aufnahme = null;
  let messer = null;        // Lautstärkemessung am Mikrofonstrom
  let anzeige = null;       // laufende Balkenanzeige
  let welle = [];           // Verlauf der Aufnahme, für das stehende Bild
  let transkript = '';      // echtes Transkript, wenn vorhanden
  let material = [];        // erkanntes Material, je Eintrag bestätigbar
  let aufgaben = [];        // ausdrücklich „als Aufgabe" Gesagtes, je Eintrag bestätigbar
  let problem = null;
  let geschlossen = false;
  let startet = false;
  let notizEntwurf = '';
  let aufnahmen = 0;
  if (gesichert) {
    ({ transkript, felder, material, notizEntwurf, aufnahmen } = gesichert);
    aufgaben = gesichert.aufgaben || [];
  }
  const dienstBereit = flows.verfuegbar();

  /** Den gesammelten Stand sofort sichern — vor jeder Bestätigung (1e). */
  const sichern = () => {
    if (onText || !aufnahmen) return;
    offeneAufnahmeSichern(auftragId, { transkript, felder, material, aufgaben, notizEntwurf, aufnahmen, beispiel });
  };

  // Jede Aufnahme ergänzt den lokalen Entwurf. Erst die Übernahme schreibt
  // neue Verlaufseinträge; bereits gespeicherte Einträge werden nie ersetzt.
  const antwortErgaenzen = (antwort, alsBeispiel = false) => {
    ({ transkript, felder, material, aufgaben, notizEntwurf, aufnahmen } = sprachStandErgaenzen(
      { transkript, felder, material, aufgaben, notizEntwurf, aufnahmen }, antwort));
    beispiel = beispiel || alsBeispiel;
    sichern();
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
          ${aufgaben.length ? `
          <div class="card" data-sprach-aufgaben>
            <div class="card-head"><div class="card-title">Als Aufgabe gesagt</div></div>
            <div class="card-body stapel">
              ${aufgaben.map((x, i) => `
                <div class="ag-zeile">
                  <label class="aufgabe-haken"><input type="checkbox" data-ag="${i}" ${x.an ? 'checked' : ''}
                    aria-label="Als Aufgabe übernehmen"></label>
                  <input class="inp" data-ag-text="${i}" value="${esc(x.text)}" aria-label="Aufgabe ${i + 1}">
                </div>`).join('')}
              <div class="hint-note">Angehakte Punkte kommen unter „Aufgaben" zum Abhaken — keine Rechnungsposition.</div>
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
            + 'und zeichnet nichts auf. Start und Stopp zeigen nur den Ablauf.' + freischaltenKnopf())}
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
              <button class="btn btn-primaer" data-ok type="button">${onText ? 'An Notiz anhängen' : 'Übernehmen'}</button>`;
    },
    bind: (el) => {
      el.querySelector('.sheet').classList.add('sheet-doku-aufnahme');
      el.querySelector('[data-zur-pruefung]')?.addEventListener('click', () => { phase = 'pruefen'; sheet.render(); });
      el.querySelector('[data-als-wichtig]')?.addEventListener('click', () => {
        const feld = el.querySelector('#sw');
        feld.value = verbinden(feld.value, transkript);
      });
      el.querySelectorAll('[data-ag]').forEach(box => box.addEventListener('change', () => {
        const x = aufgaben[Number(box.dataset.ag)];
        if (x) { x.an = box.checked; sichern(); }
      }));
      el.querySelectorAll('[data-ag-text]').forEach(f => f.addEventListener('input', () => {
        const x = aufgaben[Number(f.dataset.agText)];
        if (x) { x.text = f.value; sichern(); }
      }));
      el.querySelectorAll('[data-mat]').forEach(box =>
        box.addEventListener('change', () => {
          const i = Number(box.dataset.mat);
          if (material[i]) material[i].an = box.checked;
          sichern();
        }));
      // Korrekturen in der Prüfansicht laufen mit in die Sicherung.
      el.querySelectorAll('#sa, #ss, #so, #sw').forEach(f => f.addEventListener('input', () => {
        const zeit = parseZahl(el.querySelector('#ss').value);
        felder = {
          arbeit: el.querySelector('#sa').value.trim(), stunden: zeit,
          offen: el.querySelector('#so').value.trim(), wichtig: el.querySelector('#sw').value.trim(),
        };
        sichern();
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
          antwortErgaenzen({ transkript: SPRACH_BEISPIEL, vorschlag: SPRACH_AUFBEREITUNG }, true);
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
        const neueAufgaben = aufgaben.filter(x => x.an && x.text.trim());
        if (hatZeit && !felder.arbeit) return toast('Für die Arbeitszeit fehlt noch, welche Arbeit das war.');
        if (!felder.arbeit && !hatZeit && !hatMaterial && !felder.offen && !felder.wichtig && !neueAufgaben.length && !transkript.trim()) {
          return toast('Bitte etwas eintragen, das übernommen werden soll.');
        }

        // Ein Sprach-Eintrag plus die daraus abgeleiteten, prüfbaren Einzelteile.
        // `simuliert` sagt die Wahrheit über die Herkunft: bei echter Aufnahme
        // ist der Eintrag nicht simuliert, sondern von Edin bestätigt.
        // Ein gesicherter Beispielstand bleibt Beispiel, auch wenn inzwischen freigeschaltet ist.
        if (beispiel) echt = false;
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
        for (const x of neueAufgaben) state.aufgabeAnlegen({ text: x.text, auftragId });
        offeneAufnahmeLoeschen(auftragId);
        sheetSchliessen(); neuZeichnen();
        toast(neueAufgaben.length
          ? `In die Dokumentation übernommen — ${neueAufgaben.length === 1 ? 'eine Aufgabe' : neueAufgaben.length + ' Aufgaben'} angelegt.`
          : 'In die Dokumentation übernommen.');
      });
    },
    vorSchliessen: () => { if (aufnahmen && !onText) { sichern(); toast('Aufnahme gesichert — sie wartet in der Akte auf Ihre Prüfung.'); } },
    onClose: () => {
      if (!onText) queueMicrotask(neuZeichnen);
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

/* ── Tätigkeiten und Kostenstellen (Schritt 2) ── */

/**
 * Überblick über alle abrechenbaren Einträge: je Zeile Kostenstelle zuordnen,
 * Zeiten teilen oder zusammenführen. Jede Zeile wird später genau eine
 * Rechnungsposition (Fachregel 3) — deshalb nichts automatisch verteilen.
 */
function taetigkeitenDialog(auftragId, neuZeichnen) {
  const sheet = sheetOeffnen({
    titel: 'Tätigkeiten & Kostenstellen',
    body: () => {
      const a = state.auftrag(auftragId);
      const zeiten = a.verlauf.filter(v => v.typ === 'zeit');
      const material = a.verlauf.filter(v => v.typ === 'material');
      const ohne = state.ohneKostenstelle(a).length;
      const zeile = (v, zeit) => `
        <div class="tk-zeile" data-tk="${v.id}">
          ${zeit ? `<label class="tk-wahl" aria-label="Zum Zusammenführen auswählen"><input type="checkbox" data-tk-wahl="${v.id}"></label>` : ''}
          <div class="tk-mitte">
            <div class="tk-text">${esc(v.text) || 'Ohne Beschreibung'}</div>
            <div class="tk-wert">${zeit
              ? (v.stunden === null ? '<span class="vl-offen-wert">Zeit offen</span>' : esc(fmtStunden(v.stunden)))
                + (v.nichtVerteilt ? ' · <span class="vl-offen-wert">nicht auf Tätigkeiten verteilt</span>' : '')
              : esc(`${zahlZuFeld(v.menge) || 'Menge offen'} ${v.einheit || ''}`.trim())}</div>
            <label class="f-label" for="tk-k-${v.id}">Kostenstelle</label>
            ${kostenstelleFeld(auftragId, `tk-k-${v.id}`, v.kostenstelle, `data-tk-kst="${v.id}"`)}
          </div>
          ${zeit ? `<button class="btn btn-sm" data-tk-teilen="${v.id}" type="button">Teilen</button>` : ''}
        </div>`;
      return `
        <div class="hint-note">Jede Zeile wird eine eigene Rechnungsposition. Eine nur insgesamt
          genannte Zeit wird nicht automatisch verteilt — beim Teilen tragen Sie Einzelzeiten
          selbst ein oder lassen sie offen.</div>
        <div class="tk-summe">Arbeitszeit gesamt <strong>${esc(fmtStunden(state.summeStunden(a)))}</strong>
          · ${ohne ? `<span class="vl-offen-wert">${ohne} ohne Kostenstelle</span>` : 'alle zugeordnet'}</div>
        ${zeiten.length ? `<h3 class="tk-titel">Arbeitszeit</h3>${zeiten.map(v => zeile(v, true)).join('')}` : ''}
        ${material.length ? `<h3 class="tk-titel">Material</h3>${material.map(v => zeile(v, false)).join('')}` : ''}
        ${!zeiten.length && !material.length ? leerZustand('Noch keine Zeit und kein Material erfasst.') : ''}`;
    },
    foot: () => `
      <button class="btn" data-tk-zusammen type="button" disabled>Zusammenführen</button>
      <button class="btn btn-primaer" data-tk-fertig type="button">Fertig</button>`,
    bind: (el) => {
      el.querySelectorAll('[data-tk-kst]').forEach(i => i.addEventListener('change', () => {
        state.verlaufUpdate(auftragId, i.dataset.tkKst, { kostenstelle: state.kostenstelleNormal(i.value) });
        sheet.render();
      }));
      const wahl = () => [...el.querySelectorAll('[data-tk-wahl]:checked')].map(b => b.dataset.tkWahl);
      el.querySelectorAll('[data-tk-wahl]').forEach(b => b.addEventListener('change', () => {
        el.querySelector('[data-tk-zusammen]').disabled = wahl().length < 2;
      }));
      el.querySelector('[data-tk-zusammen]').addEventListener('click', () => {
        const erg = state.taetigkeitenZusammenfuehren(auftragId, wahl());
        if (!erg.ok) return toast(erg.grund);
        sheet.render(); toast('Tätigkeiten zusammengeführt.');
      });
      el.querySelectorAll('[data-tk-teilen]').forEach(b => b.addEventListener('click', () => {
        const v = state.auftrag(auftragId).verlauf.find(x => x.id === b.dataset.tkTeilen);
        if (v) teilenDialog(auftragId, v);
      }));
      el.querySelector('[data-tk-fertig]').addEventListener('click', sheetSchliessen);
    },
    onClose: () => queueMicrotask(neuZeichnen),
  });
}

/** Vorschlag für die Zeilen: der eigene Text, an Satzenden getrennt. Edin prüft und ändert. */
function textZerlegen(text) {
  const t = String(text || '').trim();
  if (!t) return ['', ''];

  // Erst an echten Satzgrenzen trennen.
  let teile = t.split(/(?<=[.;!?])\s+|\n+/).map(x => x.replace(/[.;]\s*$/, '').trim()).filter(Boolean);

  // Kommt dabei nur EIN Teil raus, war es vermutlich ein einziger, mit Kommas
  // aneinandergereihter Satz — „Tür nachgestellt, Licht getauscht, Ablauf
  // gereinigt und Zaun repariert". So klingt gesprochene Aufzählung, nicht mit
  // Punkten zwischen jeder Tätigkeit. Dann zusätzlich an Kommas und „und" trennen.
  if (teile.length < 2) {
    // Nur an „Komma + Leerzeichen" trennen: „1,5 Stunden" bleibt ganz.
    teile = t.replace(/\s+und\s+/gi, ', ').split(/,\s+/)
      .map(x => x.replace(/[.;]\s*$/, '').trim()).filter(Boolean);
  }

  return teile.length >= 2 ? teile : [t, ''];
}

function teilenDialog(auftragId, v) {
  let zeilen = textZerlegen(v.text).map(text => ({ text, stunden: '', kostenstelle: v.kostenstelle || '' }));
  const gesamt = Number(v.stunden) > 0 ? Number(v.stunden) : null;

  const summeText = () => {
    const verteilt = zeilen.reduce((s, z) => s + (parseZahl(z.stunden) || 0), 0);
    if (gesamt === null) return `Zugeordnet ${fmtStunden(verteilt)} — der Eintrag hatte keine Gesamtzeit.`;
    const rest = Math.round((gesamt - verteilt) * 100) / 100;
    if (rest < 0) return `Zugeordnet ${fmtStunden(verteilt)} — das ist mehr als die erfassten ${fmtStunden(gesamt)}.`;
    return `Zugeordnet ${fmtStunden(verteilt)} von ${fmtStunden(gesamt)}`
      + (rest > 0 ? ` · ${fmtStunden(rest)} bleiben als „Nicht verteilte Einsatzzeit“ stehen` : '');
  };

  const sheet = sheetOeffnen({
    titel: 'Tätigkeit aufteilen',
    body: () => `
      <div class="hint-note">Die Zeilen sind aus Ihrem Text vorgeschlagen — bitte prüfen. Stunden nur
        eintragen, wenn Sie sie wissen. Was nicht zugeordnet ist, wird nicht geschätzt, sondern bleibt
        als eigene Einsatzzeit sichtbar.</div>
      <div class="tk-summe" data-teilen-summe>${esc(summeText())}</div>
      ${zeilen.map((z, i) => `
        <div class="tk-zeile teilen-zeile">
          <div class="tk-mitte">
            <label class="f-label" for="tl-t-${i}">Tätigkeit ${i + 1}</label>
            <input class="inp" id="tl-t-${i}" data-tl="${i}" data-tl-feld="text" value="${esc(z.text)}">
            <div class="fields">
              <div class="f"><label class="f-label" for="tl-s-${i}">Stunden <span class="opt">(leer = offen)</span></label>
                <input class="inp" id="tl-s-${i}" data-tl="${i}" data-tl-feld="stunden" inputmode="decimal" value="${esc(z.stunden)}"></div>
              <div class="f"><label class="f-label" for="tl-k-${i}">Kostenstelle</label>
                ${kostenstelleFeld(auftragId, `tl-k-${i}`, z.kostenstelle, `data-tl="${i}" data-tl-feld="kostenstelle"`)}</div>
            </div>
          </div>
          ${zeilen.length > 2 ? `<button class="icon-btn" data-tl-weg="${i}" type="button" aria-label="Tätigkeit ${i + 1} entfernen">${icon('papierkorb')}</button>` : ''}
        </div>`).join('')}
      <button class="btn btn-block" data-tl-neu type="button">${icon('plus')} Tätigkeit hinzufügen</button>`,
    foot: () => `
      <button class="btn" data-tl-ab type="button">Abbrechen</button>
      <button class="btn btn-primaer" data-tl-ok type="button">Aufteilen</button>`,
    bind: (el) => {
      el.querySelectorAll('[data-tl]').forEach(i => i.addEventListener('input', () => {
        zeilen[Number(i.dataset.tl)][i.dataset.tlFeld] = i.value;
        el.querySelector('[data-teilen-summe]').textContent = summeText();
      }));
      el.querySelectorAll('[data-tl-weg]').forEach(b => b.addEventListener('click', () => {
        zeilen.splice(Number(b.dataset.tlWeg), 1); sheet.render();
      }));
      el.querySelector('[data-tl-neu]').addEventListener('click', () => {
        zeilen.push({ text: '', stunden: '', kostenstelle: v.kostenstelle || '' }); sheet.render();
      });
      el.querySelector('[data-tl-ab]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-tl-ok]').addEventListener('click', () => {
        const teile = [];
        for (const [n, z] of zeilen.entries()) {
          const roh = String(z.stunden).trim();
          const std = roh ? parseZahl(roh) : null;
          if (roh && (std === null || std <= 0)) return toast(`Tätigkeit ${n + 1}: Stunden als Zahl größer 0 oder leer lassen.`);
          teile.push({ text: z.text, stunden: std, kostenstelle: z.kostenstelle });
        }
        const erg = state.taetigkeitTeilen(auftragId, v.id, teile);
        if (!erg.ok) return toast(erg.grund);
        sheetSchliessen();
        toast(`In ${teile.length} Tätigkeiten aufgeteilt.`);
      });
    },
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
