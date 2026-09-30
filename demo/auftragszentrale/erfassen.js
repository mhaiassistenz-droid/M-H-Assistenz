/* ============================================
   erfassen.js — Auftrag erfassen

   Drei Einstiege (Foto, manuell, einsprechen) führen bewusst auf
   DASSELBE Formular. Foto- und Spracherkennung sind simuliert und
   überall als solche gekennzeichnet; manuell eingeben geht immer.

   Ein angefangenes Formular bleibt im Modul liegen: schließt Edin die
   Erfassung versehentlich oder wechselt die Ansicht, ist beim nächsten
   Öffnen alles noch da.
   ============================================ */

import { esc, icon, uid, toInputDatetime, fmtTermin } from './util.js';
import * as fotos from './fotos.js';
import * as flows from './flows.js';
import * as pegel from './pegel.js';
import { voicing } from './voicing.js';
import { freischaltenKnopf } from './freischalten.js';
import * as state from './state.js';
import { sheetOeffnen, sheetSchliessen, sheetErsetzen, bestaetigen, toast, hinweisBox } from './ui.js';
import { akteOeffnen } from './akte.js';

const LEER = {
  kunde: '', ansprechpartner: '', email: '', telefon: '',
  adresse: '', rechnungsadresse: '', aufgabe: '', termin: '', erfasstUeber: 'manuell',
  kundeId: null,
};

/** Die Eingabefelder. Herkunftsangaben (erfasstUeber, herkunftEcht) sind kein Inhalt. */
const FELDER = ['kunde', 'ansprechpartner', 'email', 'telefon', 'adresse', 'rechnungsadresse', 'aufgabe', 'termin'];
const hatInhalt = (w) => !!w && FELDER.some(k => w[k]);

/**
 * Angefangenes Formular für einen NEUEN Auftrag.
 *
 * Liegt in localStorage, nicht nur im Arbeitsspeicher: „Später weiter" soll auch
 * einen Reload oder ein versehentlich geschlossenes Browserfenster überstehen.
 */
const ENTWURF_KEY = 'pt-auftragszentrale-entwurf-v1';

let entwurf = entwurfLaden();
let bilder = entwurf?.bilder || [];

function entwurfLaden() {
  try {
    const roh = localStorage.getItem(ENTWURF_KEY);
    return roh ? JSON.parse(roh) : null;
  } catch { return null; }
}

function entwurfSichern() {
  try {
    if (!entwurf) localStorage.removeItem(ENTWURF_KEY);
    else localStorage.setItem(ENTWURF_KEY, JSON.stringify({ ...entwurf, bilder }));
  } catch {
    // Kein dauerhafter Speicher: der Entwurf gilt dann nur für diese Sitzung.
  }
}

function entwurfVerwerfen() {
  entwurf = null;
  bilder = [];
  entwurfSichern();
}

/** Was eine Foto-Auswertung liefern würde. Fest hinterlegt, nicht erkannt. */
const FOTO_BEISPIEL = {
  kunde: 'Hausverwaltung Nordpark eG',
  ansprechpartner: 'Frau Sommer',
  email: 'technik@nordpark-eg.example',
  telefon: '0228 5550463',
  adresse: 'Nordparkweg 22, 53111 Bonn',
  aufgabe: 'Handlauf im Treppenhaus Haus B lockert sich, bitte nachziehen und prüfen.',
};

/** Was eine Spracherfassung liefern würde. Ebenfalls fest hinterlegt. */
const SPRACH_TRANSKRIPT =
  'Neuer Auftrag für die Hausverwaltung Nordpark, Nordparkweg zweiundzwanzig. '
  + 'Handlauf im Treppenhaus Haus B ist locker, soll nachgezogen werden. Termin Freitag um zehn.';

/**
 * @param {object} [o]
 * @param {string} [o.bearbeiten]  Auftrags-ID → Korrekturmodus statt Neuanlage
 * @param {Function} [o.danach]    wird nach dem Speichern aufgerufen
 */
export function erfassungOeffnen(o = {}) {
  if (o.bearbeiten) {
    const a = state.auftrag(o.bearbeiten);
    if (!a) return;
    formularOeffnen({ ...a }, { bearbeiten: o.bearbeiten, danach: o.danach });
    return;
  }
  einstiegOeffnen(o);
}

/* ── Einstieg: drei Wege ─────────────────── */

function einstiegOeffnen(o) {
  const angefangen = hatInhalt(entwurf);
  let echt = false;

  const sheet = sheetOeffnen({
    titel: 'Auftrag erfassen',
    body: () => `
      <div class="hint-note">Kunde, Aufgabe und Termin wurden bereits mit dem Kunden
        vereinbart. Hier werden sie nur festgehalten.</div>

      ${angefangen ? `
        <div class="card">
          <div class="card-head"><div class="card-title">Angefangener Auftrag</div></div>
          <div class="card-body">
            <div class="entwurf-name">
              ${esc(entwurf.kunde || entwurf.aufgabe || 'Ohne Bezeichnung')}
            </div>
            <div class="btn-zeile">
              <button class="btn btn-primaer btn-sm" data-weiter type="button">Weiter ausfüllen</button>
              <button class="btn btn-sm btn-warn" data-verwerfen type="button">Verwerfen</button>
            </div>
          </div>
        </div>` : ''}

      <div class="entry-grid">
        <button class="entry-btn" data-weg="foto" type="button">
          <div class="entry-ico">${icon('kamera')}</div>
          <div class="entry-txt">
            <div class="entry-t">Foto / Screenshot</div>
            <div class="entry-s">Auftragszettel oder Nachricht abfotografieren</div>
          </div>
        </button>
        <button class="entry-btn" data-weg="manuell" type="button">
          <div class="entry-ico">${icon('notiz')}</div>
          <div class="entry-txt">
            <div class="entry-t">Manuell eingeben</div>
            <div class="entry-s">Felder direkt ausfüllen</div>
          </div>
        </button>
        <button class="entry-btn" data-weg="sprache" type="button">
          <div class="entry-ico">${icon('mikro')}</div>
          <div class="entry-txt">
            <div class="entry-t">Einsprechen</div>
            <div class="entry-s">Auftrag diktieren statt tippen</div>
          </div>
        </button>
      </div>

      ${echt
        ? hinweisBox('Foto und Sprache werden wirklich ausgewertet. Beide füllen dasselbe Formular '
          + 'mit einem Vorschlag, den Sie danach prüfen und korrigieren.', '')
        : hinweisBox('Foto-Auswertung und Spracherkennung sind in dieser Demo simuliert. '
          + 'Beide füllen das gleiche Formular mit einem gekennzeichneten Beispiel, das Sie danach '
          + 'korrigieren können.' + freischaltenKnopf())}`,
    bind: (el) => {
      el.querySelector('[data-weiter]')?.addEventListener('click', () =>
        sheetErsetzenMitFormular(entwurf, o));

      el.querySelector('[data-verwerfen]')?.addEventListener('click', async () => {
        const ja = await bestaetigen({
          titel: 'Angefangenen Auftrag verwerfen',
          text: 'Die bisher eingetragenen Angaben gehen verloren.',
          jaText: 'Verwerfen', warnend: true,
        });
        if (!ja) return;
        entwurfVerwerfen();
        sheetSchliessen();
        toast('Entwurf verworfen.');
      });

      el.querySelectorAll('[data-weg]').forEach(b => b.addEventListener('click', async () => {
        const weg = b.dataset.weg;
        if (weg === 'manuell') return sheetErsetzenMitFormular({ ...LEER, ...(entwurf || {}) }, o);
        // Foto und Sprache füllen das Formular neu. Ein angefangener Auftrag wird
        // dabei nicht still ersetzt — gleiche Rückfrage wie beim Verwerfen.
        if (hatInhalt(entwurf)) {
          const ja = await bestaetigen({
            titel: 'Angefangenen Auftrag ersetzen?',
            text: `Vorhandene Angaben („${(entwurf.kunde || entwurf.aufgabe || 'ohne Bezeichnung').slice(0, 60)}“) `
              + `werden durch das Ergebnis ${weg === 'foto' ? 'des Fotos' : 'der Aufnahme'} ersetzt. Fortfahren?`,
            jaText: 'Ersetzen', warnend: true,
          });
          if (!ja) return;
        }
        if (weg === 'foto')    return fotoWeg(o);
        if (weg === 'sprache') return sprachWeg(o);
      }));
    },
  });

  flows.verfuegbar().then((ja) => {
    if (!ja) return;
    echt = true;
    sheet.render();
  });
}

function sheetErsetzenMitFormular(daten, o) {
  // Sprach- oder Fototreffer sofort sichern: das Formular wird nur über `value`
  // vorbefüllt, es feuert kein input-Event. Ohne diese Zeile ging ein frisch
  // erkannter Auftrag verloren, sobald jemand das Sheet über das X schloss (1d).
  if (!o?.bearbeiten) { entwurf = { ...LEER, ...daten }; entwurfSichern(); }
  sheetErsetzen(formularKonfig(daten, o));
}

/* ── Weg 1: Foto ─────────────────────────── */

function fotoWeg(o) {
  let vorschau = null;     // {name, fotoId}
  let datei = null;        // die Originaldatei, für die echte Auswertung
  let phase = 'waehlen';   // waehlen → gewaehlt → laeuft → ausgewertet
  let problem = null;      // verständlicher Grund, wenn etwas nicht klappte
  let echt = false;        // Backend erreichbar?
  let ergebnis = null;     // echte Antwort des Flows

  const sheet = sheetErsetzen({
    titel: 'Auftrag per Foto erfassen',
    body: () => {
      if (phase === 'laeuft') {
        return `
          ${vorschau ? bildVorschau([vorschau]) : ''}
          <div class="state-box">Das Bild wird gelesen …
            <div class="state-hint">Das dauert meist ein paar Sekunden.</div>
          </div>`;
      }

      if (phase === 'ausgewertet') {
        // Echte Auswertung: zeigen, was gelesen wurde — und was nicht.
        if (echt && ergebnis) {
          const v = ergebnis.vorschlag;
          const offen = flows.fehlendText(ergebnis.fehlend);
          if (!v) {
            return `
              ${vorschau ? bildVorschau([vorschau]) : ''}
              <div class="state-box error">Auf dem Bild war nichts Lesbares zu erkennen.
                <div class="state-hint">Es wurde bewusst nichts übernommen. Anderes Bild versuchen
                  oder die Angaben von Hand eintragen.</div>
              </div>`;
          }
          return `
            ${hinweisBox('<strong>Aus dem Bild gelesen.</strong> Die Angaben sind ein Vorschlag und '
              + 'nicht geprüft. Bitte im nächsten Schritt kontrollieren.', 'Vorschlag')}
            ${vorschau ? bildVorschau([vorschau]) : ''}
            <div class="card">
              <div class="card-head"><div class="card-title">Erkannte Angaben</div></div>
              <div class="card-body stapel">
                ${zeile('Kunde', v.kunde || NICHT_ERKANNT)}
                ${zeile('Ansprechpartner', v.ansprechpartner || NICHT_ERKANNT)}
                ${zeile('Adresse', v.adresse || NICHT_ERKANNT)}
                ${zeile('Aufgabe', v.aufgabe || NICHT_ERKANNT)}
                ${zeile('Termin', terminText(v.termin))}
              </div>
            </div>
            ${offen ? `<div class="state-box">Nicht erkannt und bewusst offen gelassen: ${esc(offen)}
              <div class="state-hint">Diese Felder bleiben leer, statt geraten zu werden.</div></div>` : ''}`;
        }

        // Ohne Backend bleibt es beim gekennzeichneten Beispiel.
        return `
          ${hinweisBox('<strong>Beispielauswertung.</strong> Diese Angaben wurden nicht aus dem Bild '
            + 'gelesen — sie sind im Demo-Code hinterlegt, damit Sie sehen, wie das Ergebnis aussähe. '
            + 'Im nächsten Schritt können Sie alles korrigieren.')}
          ${vorschau ? bildVorschau([vorschau]) : ''}
          <div class="card">
            <div class="card-head"><div class="card-title">Erkannte Angaben (Beispiel)</div></div>
            <div class="card-body stapel">
              ${zeile('Kunde', FOTO_BEISPIEL.kunde)}
              ${zeile('Ansprechpartner', FOTO_BEISPIEL.ansprechpartner)}
              ${zeile('Adresse', FOTO_BEISPIEL.adresse)}
              ${zeile('Aufgabe', FOTO_BEISPIEL.aufgabe)}
              ${zeile('Termin', 'Nicht erkannt — bitte eintragen')}
            </div>
          </div>`;
      }

      return `
        ${echt
          ? hinweisBox('Das Bild wird zum Lesen an den Auswertungsdienst übertragen und dort nicht '
            + 'gespeichert. Was erkannt wird, ist ein Vorschlag, den Sie danach korrigieren können.', '')
          : hinweisBox('Das Bild bleibt auf dem Gerät. Es wird nichts hochgeladen und nichts '
            + 'automatisch gelesen — die Auswertung im nächsten Schritt ist ein hinterlegtes Beispiel.')}
        ${problem ? `<div class="state-box error">${esc(problem)}</div>` : ''}
        ${vorschau ? bildVorschau([vorschau]) : `
          <div class="state-box">Noch kein Bild gewählt.
            <div class="state-hint">Auf dem Handy öffnet „Foto aufnehmen" direkt die Kamera.</div>
          </div>`}
        <div class="btn-zeile">
          <button class="btn" data-kamera type="button">${icon('kamera')} Foto aufnehmen</button>
          <button class="btn" data-galerie type="button">${icon('bilder')} Aus Galerie wählen</button>
        </div>
        <input type="file" accept="image/*" capture="environment" data-f-kamera hidden>
        <input type="file" accept="image/*" data-f-galerie hidden>`;
    },
    foot: () => {
      if (phase === 'laeuft') {
        return `<button class="btn btn-block" disabled type="button">Wird gelesen …</button>`;
      }
      if (phase === 'ausgewertet') {
        const nichts = echt && ergebnis && !ergebnis.vorschlag;
        return `<button class="btn" data-zurueck type="button">Anderes Bild</button>
                ${nichts ? '' : `<button class="btn btn-primaer" data-uebernehmen type="button">Angaben übernehmen</button>`}`;
      }
      return `<button class="btn btn-primaer btn-block" data-auswerten type="button" ${phase === 'waehlen' ? 'disabled' : ''}>
                ${icon('funke')} ${echt ? 'Bild auswerten' : 'Beispielauswertung anzeigen'}
              </button>`;
    },
    bind: (el) => {
      const waehlen = (sel) => el.querySelector(sel).click();
      el.querySelector('[data-kamera]')?.addEventListener('click', () => waehlen('[data-f-kamera]'));
      el.querySelector('[data-galerie]')?.addEventListener('click', () => waehlen('[data-f-galerie]'));

      ['[data-f-kamera]', '[data-f-galerie]'].forEach(sel =>
        el.querySelector(sel)?.addEventListener('change', async (e) => {
          const gewaehlt = e.target.files?.[0];
          e.target.value = '';
          if (!gewaehlt) return;

          const fotoId = uid('foto');
          const erg = await fotos.speichern(fotoId, gewaehlt);
          if (!erg.ok) {
            problem = erg.grund;
            sheet.render();
            return;
          }
          problem = null;
          datei = gewaehlt;
          vorschau = { name: gewaehlt.name, fotoId };
          phase = 'gewaehlt';
          sheet.render();
        }));

      el.querySelector('[data-auswerten]')?.addEventListener('click', async () => {
        if (!echt) {
          phase = 'ausgewertet';
          sheet.render();
          return;
        }
        phase = 'laeuft';
        sheet.render();
        const antwort = await flows.fotoAuswerten(datei, 'erfassen');
        if (!antwort.ok) {
          // Ein Fehlschlag darf nie wie ein Ergebnis aussehen.
          problem = antwort.fehler || 'Die Auswertung ist fehlgeschlagen.';
          phase = 'gewaehlt';
          sheet.render();
          return;
        }
        ergebnis = antwort;
        phase = 'ausgewertet';
        sheet.render();
      });

      el.querySelector('[data-zurueck]')?.addEventListener('click', () => {
        ergebnis = null;
        phase = vorschau ? 'gewaehlt' : 'waehlen';
        sheet.render();
      });

      el.querySelector('[data-uebernehmen]')?.addEventListener('click', () => {
        if (vorschau) bilder = [vorschau];
        const werte = (echt && ergebnis)
          ? flows.alsFormularwerte(ergebnis.vorschlag)
          : FOTO_BEISPIEL;
        // herkunftEcht: Die Anzeige im Formular darf nicht aus dem Einstieg allein
        // schließen, ob simuliert wurde — nur aus der tatsächlichen Auswertung.
        sheetErsetzenMitFormular({ ...LEER, ...werte, erfasstUeber: 'foto', herkunftEcht: !!(echt && ergebnis) }, o);
      });
    },
  });

  // Nachträglich: sobald bekannt ist, ob echt ausgewertet werden kann,
  // ändern sich Hinweistext und Beschriftung des Knopfs.
  flows.verfuegbar().then((ja) => {
    if (!ja) return;
    echt = true;
    sheet.render();
  });
}

const NICHT_ERKANNT = 'Nicht erkannt — bitte eintragen';

/** „Freitag" ist kein Datum. Ohne Datum bleibt der Termin ausdrücklich offen. */
function terminText(termin) {
  if (!termin || !termin.datum) return NICHT_ERKANNT;
  // Gleiche Schreibweise wie überall sonst — „2026-10-02" liest draußen niemand gern.
  return fmtTermin(`${termin.datum}T${termin.zeit || '08:00'}`);
}

const zeile = (k, v) => `
  <div class="f"><div class="f-label">${esc(k)}</div><div class="f-val">${esc(v)}</div></div>`;

function bildVorschau(liste) {
  return `<div class="foto-grid">${liste.map(b => `
    <div class="foto-thumb" data-foto-huelle>
      <img data-foto-id="${esc(b.fotoId)}" alt="${esc(b.name)}">
    </div>`).join('')}</div>`;
}

/* ── Weg 2: Sprache ──────────────────────── */

function sprachWeg(o) {
  let phase = 'bereit';    // bereit → laeuft → wertetAus → pruefen
  let sekunden = 0, ticker = null;
  let echt = false;
  let aufnahme = null;     // laufende Aufnahme
  let messer = null;       // Lautstärkemessung am Mikrofonstrom
  let anzeige = null;      // laufende Balkenanzeige
  let welle = [];          // Verlauf der Aufnahme, für das stehende Bild
  let ergebnis = null;     // echte Antwort des Flows
  let problem = null;

  const uhrzeit = () =>
    `${String(Math.floor(sekunden / 60)).padStart(2, '0')}:${String(sekunden % 60).padStart(2, '0')}`;

  /** Beendet Messung und Anzeige und merkt sich das Bild der Aufnahme. */
  const pegelBeenden = () => {
    if (anzeige) { welle = anzeige.stoppen(); anzeige = null; }
    if (messer) { messer.schliessen(); messer = null; }
  };

  const sheet = sheetErsetzen({
    titel: 'Auftrag einsprechen',
    body: () => {
      if (phase === 'wertetAus') {
        return `
          <div class="rec-box">
            ${pegel.pegelFeld('standbild')}
            <div class="rec-status">Aufnahme: ${esc(uhrzeit())}</div>
          </div>
          <div class="state-box">Aufnahme wird ausgewertet …
            <div class="state-hint">Erst wird der Text erkannt, dann werden die Angaben herausgezogen.</div>
          </div>`;
      }

      if (phase === 'pruefen') {
        // Echtes Ergebnis
        if (echt && ergebnis) {
          const v = ergebnis.vorschlag || {};
          const offen = flows.fehlendText(ergebnis.fehlend);
          return `
            ${hinweisBox('<strong>Aus Ihrer Aufnahme erkannt.</strong> Die Angaben sind ein Vorschlag '
              + 'und nicht geprüft. Bitte im nächsten Schritt kontrollieren.', 'Vorschlag')}
            <div class="rec-box">
              ${pegel.pegelFeld('standbild')}
              <div class="rec-status">Aufnahme: ${esc(uhrzeit())}</div>
            </div>
            <div class="card">
              <div class="card-head"><div class="card-title">Transkript</div></div>
              <div class="card-body zitat">
                „${esc(ergebnis.transkript || '')}"
              </div>
            </div>
            <div class="card">
              <div class="card-head"><div class="card-title">Daraus abgeleitete Angaben</div></div>
              <div class="card-body stapel">
                ${zeile('Kunde', v.kunde || NICHT_ERKANNT)}
                ${zeile('Ansprechpartner', v.ansprechpartner || NICHT_ERKANNT)}
                ${zeile('Adresse', v.adresse || NICHT_ERKANNT)}
                ${zeile('Aufgabe', v.aufgabe || NICHT_ERKANNT)}
                ${zeile('Termin', terminText(v.termin))}
              </div>
            </div>
            ${offen ? `<div class="state-box">Nicht erkannt und bewusst offen gelassen: ${esc(offen)}
              <div class="state-hint">Diese Felder bleiben leer, statt geraten zu werden.</div></div>` : ''}`;
        }

        // Ohne Backend bleibt das hinterlegte Beispiel
        return `
          ${hinweisBox('<strong>Beispieltranskript.</strong> Es wurde nichts aufgenommen und nichts erkannt. '
            + 'Der Text ist im Demo-Code hinterlegt und zeigt, wie das Ergebnis aussähe.')}
          <div class="card">
            <div class="card-head"><div class="card-title">Transkript (Beispiel)</div></div>
            <div class="card-body zitat">
              „${esc(SPRACH_TRANSKRIPT)}"
            </div>
          </div>
          <div class="card">
            <div class="card-head"><div class="card-title">Daraus abgeleitete Angaben</div></div>
            <div class="card-body stapel">
              ${zeile('Kunde', FOTO_BEISPIEL.kunde)}
              ${zeile('Adresse', FOTO_BEISPIEL.adresse)}
              ${zeile('Aufgabe', FOTO_BEISPIEL.aufgabe)}
              ${zeile('Termin', 'Freitag, 10:00 — bitte Datum bestätigen')}
            </div>
          </div>`;
      }

      return `
        ${echt
          ? hinweisBox('Die Aufnahme wird zum Erkennen übertragen und dort nicht gespeichert. '
            + 'Sagen Sie Kunde, Adresse, Aufgabe und Termin in einem Satz.', '')
          : hinweisBox('<strong>Aufnahme ist simuliert.</strong> Die Demo greift nicht auf das Mikrofon zu.' + freischaltenKnopf())}
        ${problem ? `<div class="state-box error">${esc(problem)}</div>` : ''}
        <div class="rec-box ${phase === 'laeuft' ? 'laeuft' : ''}">
          ${phase === 'laeuft' && echt
            ? pegel.pegelFeld('pegel')
            : `<div class="rec-dot">${icon('mikro')}</div>`}
          <div class="rec-timer" data-uhr>${uhrzeit()}</div>
          <div class="rec-status">${phase === 'laeuft'
            ? (echt ? 'Aufnahme läuft — sprechen Sie' : 'Aufnahme läuft (simuliert)')
            : 'Bereit'}</div>
        </div>`;
    },
    foot: () => {
      if (phase === 'wertetAus') return `<button class="btn btn-block" disabled type="button">Wird ausgewertet …</button>`;
      if (phase === 'bereit') return `<button class="btn btn-primaer btn-block" data-start type="button">${icon('mikro')} Aufnahme starten</button>`;
      if (phase === 'laeuft') return `<button class="btn btn-primaer btn-block" data-stop type="button">Aufnahme stoppen</button>`;
      return `<button class="btn" data-nochmal type="button">Nochmal</button>
              <button class="btn btn-primaer" data-ok type="button">Angaben übernehmen</button>`;
    },
    bind: (el) => {
      // Die laufende Aufnahme darf das Sheet NICHT neu zeichnen: zeichnen()
      // ersetzt das gesamte innerHTML, und einmal pro Sekunde sah das aus
      // wie Flackern. Uhr und Balken werden deshalb direkt am Element
      // nachgezogen.
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

      // Stehendes Bild der fertigen Aufnahme.
      const standEl = el.querySelector('[data-standbild]');
      if (standEl) {
        standEl.classList.add('standbild');
        pegel.standbildZeichnen(standEl, pegel.standbild(welle));
      }

      el.querySelector('[data-start]')?.addEventListener('click', async () => {
        problem = null;
        welle = [];
        if (echt) {
          try {
            aufnahme = await flows.aufnahmeStarten();
            messer = pegel.messerStarten(aufnahme.stream);
          } catch (e) {
            problem = e.message;
            sheet.render();
            return;
          }
        }
        phase = 'laeuft'; sekunden = 0;
        sheet.render();
      });

      el.querySelector('[data-stop]')?.addEventListener('click', async () => {
        clearInterval(ticker); ticker = null;
        pegelBeenden();

        if (!echt) { phase = 'pruefen'; sheet.render(); return; }

        phase = 'wertetAus';
        sheet.render();
        const blob = await aufnahme.stoppen();
        aufnahme = null;
        const antwort = await flows.spracheAuswerten(blob, 'erfassen');
        if (!antwort.ok) {
          problem = antwort.fehler || 'Die Auswertung ist fehlgeschlagen.';
          phase = 'bereit'; sekunden = 0;
          sheet.render();
          return;
        }
        ergebnis = antwort;
        phase = 'pruefen';
        sheet.render();
      });

      el.querySelector('[data-nochmal]')?.addEventListener('click', () => {
        phase = 'bereit'; sekunden = 0; ergebnis = null; welle = [];
        sheet.render();
      });

      el.querySelector('[data-ok]')?.addEventListener('click', () => {
        // Termin bewusst offen lassen, wenn kein echtes Datum gefallen ist:
        // "Freitag um zehn" ist keines.
        const werte = (echt && ergebnis)
          ? flows.alsFormularwerte(ergebnis.vorschlag)
          : { ...FOTO_BEISPIEL, termin: '' };
        sheetErsetzenMitFormular({ ...LEER, ...werte, erfasstUeber: 'sprache', herkunftEcht: !!(echt && ergebnis) }, o);
      });
    },
    onClose: () => {
      if (ticker) clearInterval(ticker);
      pegelBeenden();
      if (aufnahme) aufnahme.abbrechen();
    },
    /** Vor jedem Neuzeichnen: laufende Zeitgeber lösen, sonst laufen sie doppelt. */
    vorRender: () => { if (ticker) { clearInterval(ticker); ticker = null; } },
  });

  flows.verfuegbar().then((ja) => {
    if (!ja) return;
    echt = true;
    sheet.render();
  });
}

/* ── Das gemeinsame Formular ─────────────── */

/**
 * Woher die vorausgefüllten Werte stammen. Entscheidend ist, ob die Auswertung
 * echt lief (`herkunftEcht`) — nicht der gewählte Einstieg. Sonst stand nach
 * einer echten Erkennung weiterhin „Beispielauswertung" da (Befund 29.09.2026).
 */
function herkunftHinweis(werte, bearbeiten) {
  if (bearbeiten || werte.erfasstUeber === 'manuell') return '';
  if (werte.herkunftEcht) {
    const quelle = werte.erfasstUeber === 'foto' ? 'Ihrem Bild' : 'Ihrer Aufnahme';
    return hinweisBox(`Aus ${quelle} erkannt — bitte prüfen.`, 'Vorschlag');
  }
  return hinweisBox('Die vorausgefüllten Angaben stammen aus einer <strong>Beispielauswertung</strong>, '
    + 'nicht aus Ihrem Bild oder Ihrer Stimme. Bitte vor dem Speichern prüfen.');
}

function formularOeffnen(daten, o) { sheetOeffnen(formularKonfig(daten, o)); }

/** Klartext-Namen der Formularfelder für den Prüfdialog. */
const FELD_NAME = {
  kunde: 'Kunde / Organisation', ansprechpartner: 'Ansprechpartner', email: 'E-Mail',
  telefon: 'Telefon', adresse: 'Objektadresse', rechnungsadresse: 'Rechnungsadresse',
  aufgabe: 'Vereinbarte Aufgabe', termin: 'Termin',
};
const FELD_ID = { kunde: 'k', ansprechpartner: 'ap', email: 'em', telefon: 'tel', adresse: 'ad', rechnungsadresse: 'ra', aufgabe: 'af', termin: 'tm' };

/** Was ein Stammkunde ins Formular mitbringt. Objektadresse bewusst nicht — die gehört zum Auftrag. */
const AUS_STAMM = { kunde: 'name', ansprechpartner: 'ansprechpartner', email: 'email', telefon: 'telefon', rechnungsadresse: 'rechnungsadresse' };

/** Was „Per Sprache ergänzen" ohne Backend liefert. Fest hinterlegt, nicht erkannt. */
const ERGAENZUNG_BEISPIEL = {
  ok: true,
  transkript: 'Ansprechpartnerin ist Frau Sommer, Telefon null zwei zwei acht fünf fünf fünf null vier sechs drei. '
    + 'Und bitte zusätzlich den Handlauf im Keller prüfen.',
  vorschlag: {
    ansprechpartner: 'Frau Sommer', telefon: '0228 5550463',
    aufgabe: 'Zusätzlich den Handlauf im Keller prüfen.',
  },
  fehlend: [],
};

function formularKonfig(daten, o = {}) {
  const bearbeiten = o.bearbeiten || null;
  let werte = { ...LEER, ...daten };
  // Felder, die aus einer Spracheingabe stammen und noch nicht angefasst wurden.
  const markiert = new Set();
  let beispielErgaenzt = false;

  /** Aktuelle Feldwerte einsammeln — auch beim Zwischenspeichern des Entwurfs. */
  const lesen = (el) => ({
    kunde:           el.querySelector('#k').value.trim(),
    ansprechpartner: el.querySelector('#ap').value.trim(),
    email:           el.querySelector('#em').value.trim(),
    telefon:         el.querySelector('#tel').value.trim(),
    adresse:         el.querySelector('#ad').value.trim(),
    rechnungsadresse: el.querySelector('#ra').value.trim(),
    aufgabe:         el.querySelector('#af').value.trim(),
    termin:          el.querySelector('#tm').value,
    erfasstUeber:    werte.erfasstUeber,
    herkunftEcht:    !!werte.herkunftEcht,
    kundeMerken: !!el.querySelector('[data-kunde-merken]')?.checked,
    // Die Verbindung zum Stamm gilt nur, solange der Name noch derselbe ist.
    kundeId: werte.kundeId && state.kunde(werte.kundeId)?.name === el.querySelector('#k').value.trim()
      ? werte.kundeId : null,
  });

  /**
   * Stand aus dem DOM übernehmen. `werte` muss mitlaufen: schließt sich eine
   * Ebene darüber (etwa der Prüfdialog), zeichnet sich das Formular aus `werte`
   * neu — ohne das gingen getippte Angaben verloren.
   */
  const merken = (el) => {
    werte = lesen(el);
    if (!bearbeiten) { entwurf = { ...werte }; entwurfSichern(); }
  };

  const stimme = voicing({
    kontext: 'erfassen',
    beispiel: () => ERGAENZUNG_BEISPIEL,
    onErgebnis: (antwort, echt) => ergaenzungPruefen({
      antwort, echt, werte: () => werte,
      uebernehmen: (neueWerte, felder) => {
        werte = { ...werte, ...neueWerte };
        felder.forEach(k => markiert.add(k));
        if (!echt) beispielErgaenzt = true;
        if (!bearbeiten) { entwurf = { ...werte }; entwurfSichern(); }
      },
    }),
  });

  const klasse = (k) => `inp${markiert.has(k) ? ' vorgeschlagen' : ''}`;
  const zusatz = (k) => markiert.has(k)
    ? `<div class="f-vorschlag" data-vorschlag-hinweis="${k}">${beispielErgaenzt
        ? 'Hinterlegtes Beispiel, nicht aus Ihrer Stimme erkannt — bitte prüfen.'
        : 'Aus Spracheingabe ergänzt — bitte prüfen.'}</div>` : '';

  return {
    titel: bearbeiten ? 'Auftragsdaten korrigieren' : 'Auftrag erfassen',
    body: () => `
      ${herkunftHinweis(werte, bearbeiten)}

      <div class="f formular-stimme">
        <div class="f-hilfe">Vergessenes einfach einsprechen. Vorhandene Angaben werden nicht
          überschrieben — Sie sehen jede Änderung, bevor sie ins Formular kommt.</div>
        ${stimme.html()}
      </div>

      ${state.alleKunden().length ? `
        <div class="f">
          <label class="f-label" for="ks">Aus Kundenstamm</label>
          <select class="inp" id="ks">
            <option value="">Neuer oder anderer Kunde</option>
            ${state.alleKunden().map(k => `<option value="${esc(k.id)}" ${k.id === werte.kundeId ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}
          </select>
          <div class="f-hilfe">Füllt Kontakt und Rechnungsadresse vor. Objektadresse und Termin gehören zum Auftrag.</div>
        </div>` : ''}

      <div class="f">
        <label class="f-label" for="k">Kunde / Organisation</label>
        <input class="${klasse('kunde')}" id="k" value="${esc(werte.kunde)}" placeholder="z. B. Hausverwaltung Nordpark eG">
        ${zusatz('kunde')}
      </div>

      <div class="fields">
        <div class="f">
          <label class="f-label" for="ap">Ansprechpartner <span class="opt">(optional)</span></label>
          <input class="${klasse('ansprechpartner')}" id="ap" value="${esc(werte.ansprechpartner)}" placeholder="z. B. Frau Sommer">
          ${zusatz('ansprechpartner')}
        </div>
        <div class="f">
          <label class="f-label" for="tel">Telefon <span class="opt">(optional)</span></label>
          <input class="${klasse('telefon')}" id="tel" type="tel" value="${esc(werte.telefon)}" placeholder="0228 …">
          ${zusatz('telefon')}
        </div>
      </div>

      <div class="f">
        <label class="f-label" for="em">E-Mail <span class="opt">(für die Rechnung)</span></label>
        <input class="${klasse('email')}" id="em" type="email" value="${esc(werte.email)}" placeholder="rechnung@…">
        ${zusatz('email')}
      </div>

      <div class="f">
        <label class="f-label" for="ad">Objektadresse</label>
        <input class="${klasse('adresse')}" id="ad" value="${esc(werte.adresse)}" placeholder="Straße, PLZ, Ort"
          list="ad-liste" autocomplete="off">
        <datalist id="ad-liste">${(state.kunde(werte.kundeId)?.objekte || []).map(o => `<option value="${esc(o)}">`).join('')}</datalist>
        ${zusatz('adresse')}
      </div>

      <div class="f">
        <label class="f-label" for="ra">Rechnungsadresse <span class="opt">(leer = Objektadresse)</span></label>
        <input class="${klasse('rechnungsadresse')}" id="ra" value="${esc(werte.rechnungsadresse)}"
          placeholder="z. B. Hauptverwaltung, falls abweichend">
        ${zusatz('rechnungsadresse')}
      </div>

      <div class="f">
        <label class="f-label" for="af">Vereinbarte Aufgabe</label>
        <textarea class="${klasse('aufgabe')}" id="af" rows="4"
          placeholder="Was wurde mit dem Kunden besprochen?">${esc(werte.aufgabe)}</textarea>
        ${zusatz('aufgabe')}
      </div>

      <div class="f">
        <label class="f-label" for="tm">Termin</label>
        <input class="${klasse('termin')}" id="tm" type="datetime-local" value="${esc(toInputDatetime(werte.termin))}">
        ${zusatz('termin')}
        <div class="f-hilfe">Ein Termin je Auftrag. Er erscheint sofort im Kalender.</div>
      </div>

      ${!bearbeiten && !werte.kundeId && state.alleKunden().every(k => k.name.toLowerCase() !== (werte.kunde || '').toLowerCase()) ? `
        <label class="f-check"><input type="checkbox" data-kunde-merken ${werte.kundeMerken ? 'checked' : ''}>
          <span>Kunde für weitere Aufträge merken</span></label>` : ''}

      ${bilder.length && !bearbeiten ? `
        <div class="f">
          <div class="f-label">Anhänge</div>
          ${bildVorschau(bilder)}
          <div class="f-hilfe">
            Bilder bleiben nur in dieser Sitzung sichtbar.
          </div>
        </div>` : ''}`,

    foot: () => `
      <button class="btn" data-ab type="button">${bearbeiten ? 'Abbrechen' : 'Später weiter'}</button>
      <button class="btn btn-primaer" data-ok type="button">
        ${bearbeiten ? 'Änderungen speichern' : 'Auftrag anlegen'}
      </button>`,

    bind: (el, api) => {
      stimme.binden(el);

      el.querySelector('[data-kunde-merken]')?.addEventListener('change', () => merken(el));

      // Stammkunde gewählt: leere Felder füllen, belegte nur nach Rückfrage ersetzen.
      el.querySelector('#ks')?.addEventListener('change', async (e) => {
        merken(el);
        const k = state.kunde(e.target.value);
        if (!k) { werte = { ...werte, kundeId: null }; api.render(); return; }
        const konflikte = Object.entries(AUS_STAMM)
          .filter(([f, q]) => werte[f] && k[q] && werte[f] !== k[q]).map(([f]) => FELD_NAME[f]);
        let ersetzen = false;
        if (konflikte.length) {
          ersetzen = await bestaetigen({
            titel: 'Angaben aus dem Kundenstamm übernehmen?',
            text: `Bereits eingetragen: ${konflikte.join(', ')}. Mit den gespeicherten Angaben von „${k.name}“ ersetzen?`,
            jaText: 'Ersetzen',
          });
        }
        const neu = { ...werte, kundeId: k.id };
        for (const [f, q] of Object.entries(AUS_STAMM)) {
          if (k[q] && (!neu[f] || ersetzen)) neu[f] = k[q];
        }
        // Hat der Kunde genau ein Objekt, liegt es nahe — aber nur in ein leeres Feld.
        if (!neu.adresse && k.objekte?.length === 1) neu.adresse = k.objekte[0];
        werte = neu;
        if (!bearbeiten) { entwurf = { ...werte }; entwurfSichern(); }
        api.render();
      });

      // Live mitschreiben, damit "Später weiter" wirklich nichts verliert.
      Object.entries(FELD_ID).forEach(([k, id]) => {
        const i = el.querySelector('#' + id);
        i.addEventListener('input', () => {
          // Wer ein vorgeschlagenes Feld anfasst, hat es geprüft.
          if (markiert.delete(k)) {
            i.classList.remove('vorgeschlagen');
            el.querySelector(`[data-vorschlag-hinweis="${k}"]`)?.remove();
          }
          merken(el);
        });
      });

      el.querySelector('[data-ab]').addEventListener('click', () => {
        if (!bearbeiten) {
          merken(el);
          const etwasDrin = hatInhalt(entwurf);
          sheetSchliessen();
          if (etwasDrin) toast('Entwurf gesichert — über „Auftrag erfassen" geht es weiter.');
          return;
        }
        sheetSchliessen();
      });

      el.querySelector('[data-ok]').addEventListener('click', () => {
        const { herkunftEcht, kundeMerken: kundeMerkenGewuenscht, ...neu } = lesen(el);

        // Ein Auftrag gilt als „Geplant", wenn Kunde, Aufgabe, Ort und Termin
        // feststehen — genau das wurde ja vorher mit dem Kunden vereinbart.
        // Wer noch nicht so weit ist, nutzt „Später weiter" und behält einen Entwurf.
        const pflicht = [
          ['#k',  neu.kunde,   'Bitte den Kunden eintragen.'],
          ['#af', neu.aufgabe, 'Bitte die vereinbarte Aufgabe eintragen.'],
          ['#ad', neu.adresse, 'Bitte die Objektadresse eintragen — ohne Einsatzort lässt sich nichts planen.'],
          ['#tm', neu.termin,  'Bitte den vereinbarten Termin eintragen.'],
        ];
        for (const [sel, wert, meldung] of pflicht) {
          if (!wert) {
            const feld = el.querySelector(sel);
            toast(meldung);
            feld.classList.add('luecke');
            feld.focus();
            return;
          }
        }

        if (bearbeiten) {
          state.auftragUpdate(bearbeiten, neu);
          sheetSchliessen();
          o.danach?.();
          toast('Auftragsdaten aktualisiert.');
          return;
        }

        if (kundeMerkenGewuenscht) {
          const k = state.kundeMerken({ name: neu.kunde, ansprechpartner: neu.ansprechpartner, email: neu.email,
            telefon: neu.telefon, rechnungsadresse: neu.rechnungsadresse, objekte: [neu.adresse] });
          if (k) neu.kundeId = k.id;
        }
        const anhaenge = bilder.map(b => ({ name: b.name, fotoId: b.fotoId }));
        const a = state.auftragAnlegen({ ...neu, status: 'geplant', anhaenge });

        // Foto aus der Erfassung erscheint auch im Verlauf, damit es später
        // bei der Rechnung auffindbar ist.
        bilder.forEach(b => state.verlaufHinzufuegen(a.id, {
          typ: 'foto', text: 'Bei der Erfassung hinzugefügt',
          fotoName: b.name, fotoId: b.fotoId,
        }));

        entwurfVerwerfen();
        sheetSchliessen();
        toast('Auftrag angelegt — Status „Geplant".');
        akteOeffnen(a.id);
        o.danach?.();
      });
    },

    // X-Knopf, Klick daneben, Esc: den aktuellen Stand noch sichern (1d).
    vorSchliessen: (el) => { if (el && !bearbeiten && el.querySelector('#k')) merken(el); },
    onClose: () => stimme.abbrechen(),
  };
}

/* ── Spracheingabe prüfen, bevor sie ins Formular kommt ── */

/**
 * Zeigt Bisheriges und Vorschlag nebeneinander. Nichts wird still überschrieben:
 * leere Felder sind zum Eintragen vorgemerkt, belegte Felder bleiben, wie sie sind,
 * bis Edin „Ersetzen" (bzw. bei der Aufgabe „Anhängen") wählt. Erst „Übernehmen"
 * ändert das Formular — gespeichert wird danach wie immer über das Formular.
 */
function ergaenzungPruefen({ antwort, echt, werte, uebernehmen }) {
  const vorschlag = flows.alsFormularwerte(antwort.vorschlag);
  const bisher = werte();
  const norm = (k, v) => (k === 'termin' ? toInputDatetime(v) : String(v ?? '').trim());
  const zeigen = (k, v) => (k === 'termin' ? fmtTermin(v) : v);

  const zeilen = FELDER
    .filter(k => norm(k, vorschlag[k]))
    .map(k => {
      const alt = norm(k, bisher[k]), neu = norm(k, vorschlag[k]);
      if (alt === neu) return null;
      return { k, alt, neu, art: alt ? 'anders' : 'neu' };
    })
    .filter(Boolean);

  const wahlKnopf = (k, wert, text, an) => `
    <label class="f-check"><input type="radio" name="erg-${k}" value="${wert}" ${an ? 'checked' : ''}>
      <span>${text}</span></label>`;

  const zeile = (z) => z.art === 'neu' ? `
    <div class="erg-zeile" data-erg="${z.k}">
      <div class="erg-feld">${esc(FELD_NAME[z.k])} <span class="erg-l erg-inline">bisher leer</span></div>
      <span class="erg-w">${esc(zeigen(z.k, z.neu))}</span>
      <label class="f-check"><input type="checkbox" data-erg-an="${z.k}" checked><span>Eintragen</span></label>
    </div>` : `
    <div class="erg-zeile" data-erg="${z.k}">
      <div class="erg-feld">${esc(FELD_NAME[z.k])}</div>
      <div class="erg-vergleich">
        <div><span class="erg-l">Bisher</span><span class="erg-w alt">${esc(zeigen(z.k, z.alt))}</span></div>
        <div><span class="erg-l">Vorschlag</span><span class="erg-w">${esc(zeigen(z.k, z.neu))}</span></div>
      </div>
      <div class="erg-wahl">
        ${wahlKnopf(z.k, 'behalten', 'Bisheriges behalten', z.k !== 'aufgabe')}
        ${z.k === 'aufgabe' ? wahlKnopf(z.k, 'anhaengen', 'Anhängen', true) : ''}
        ${wahlKnopf(z.k, 'ersetzen', 'Ersetzen', false)}
      </div>
    </div>`;

  sheetOeffnen({
    titel: 'Spracheingabe prüfen',
    body: () => `
      ${echt
        ? hinweisBox('<strong>Aus Ihrer Aufnahme erkannt.</strong> Erst „Übernehmen" ändert das Formular; '
          + 'gespeichert wird danach wie gewohnt.', 'Vorschlag')
        : hinweisBox('<strong>Beispiel.</strong> Es wurde nichts aufgenommen und nichts erkannt — '
          + 'die Angaben sind im Demo-Code hinterlegt.')}
      ${zeilen.length ? zeilen.map(zeile).join('')
        : `<div class="state-box">Nichts Neues erkannt.
             <div class="state-hint">Das Formular bleibt unverändert.</div></div>`}
      ${antwort.transkript ? `
        <details class="sprach-original"><summary>Erkannte Worte ansehen</summary>
          <div class="zitat">${esc(antwort.transkript)}</div></details>` : ''}`,
    foot: () => `
      <button class="btn" data-erg-nein type="button">Verwerfen</button>
      ${zeilen.length ? '<button class="btn btn-primaer" data-erg-ja type="button">Übernehmen</button>' : ''}`,
    bind: (el) => {
      el.querySelector('[data-erg-nein]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-erg-ja]')?.addEventListener('click', () => {
        const neueWerte = {}, felder = [];
        for (const z of zeilen) {
          if (z.art === 'neu') {
            if (!el.querySelector(`[data-erg-an="${z.k}"]`).checked) continue;
            neueWerte[z.k] = z.neu;
          } else {
            const wahl = el.querySelector(`input[name="erg-${z.k}"]:checked`)?.value;
            if (wahl === 'ersetzen') neueWerte[z.k] = z.neu;
            else if (wahl === 'anhaengen') neueWerte[z.k] = `${z.alt}\n${z.neu}`;
            else continue;
          }
          felder.push(z.k);
        }
        uebernehmen(neueWerte, felder);
        sheetSchliessen();   // zeichnet das Formular mit den neuen Werten
        toast(felder.length
          ? `${felder.length} ${felder.length === 1 ? 'Angabe' : 'Angaben'} übernommen — bitte prüfen und speichern.`
          : 'Nichts übernommen.');
      });
    },
  });
}
