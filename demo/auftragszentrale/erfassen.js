/* ============================================
   erfassen.js — Auftrag erfassen

   Drei Einstiege (Foto, manuell, einsprechen) führen bewusst auf
   DASSELBE Formular. Foto- und Spracherkennung sind simuliert und
   überall als solche gekennzeichnet; manuell eingeben geht immer.

   Ein angefangenes Formular bleibt im Modul liegen: schließt Edin die
   Erfassung versehentlich oder wechselt die Ansicht, ist beim nächsten
   Öffnen alles noch da.
   ============================================ */

import { esc, icon, uid, toInputDatetime } from './util.js';
import * as fotos from './fotos.js';
import * as state from './state.js';
import { sheetOeffnen, sheetSchliessen, sheetErsetzen, bestaetigen, toast, hinweisBox } from './ui.js';
import { akteOeffnen } from './akte.js';

const LEER = {
  kunde: '', ansprechpartner: '', email: '', telefon: '',
  adresse: '', aufgabe: '', termin: '', erfasstUeber: 'manuell',
};

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
  const angefangen = entwurf && Object.values(entwurf).some(v => v && v !== 'manuell');

  sheetOeffnen({
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

      ${hinweisBox('Foto-Auswertung und Spracherkennung sind in dieser Demo simuliert. '
        + 'Beide füllen das gleiche Formular mit einem gekennzeichneten Beispiel, das Sie danach '
        + 'korrigieren können.')}`,
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

      el.querySelectorAll('[data-weg]').forEach(b => b.addEventListener('click', () => {
        const weg = b.dataset.weg;
        if (weg === 'manuell') return sheetErsetzenMitFormular({ ...LEER, ...(entwurf || {}) }, o);
        if (weg === 'foto')    return fotoWeg(o);
        if (weg === 'sprache') return sprachWeg(o);
      }));
    },
  });
}

function sheetErsetzenMitFormular(daten, o) {
  sheetErsetzen(formularKonfig(daten, o));
}

/* ── Weg 1: Foto ─────────────────────────── */

function fotoWeg(o) {
  let vorschau = null;     // {name, fotoId}
  let phase = 'waehlen';   // waehlen → gewaehlt → ausgewertet
  let problem = null;      // verständlicher Grund, wenn das Bild nicht abgelegt werden konnte

  const sheet = sheetErsetzen({
    titel: 'Auftrag per Foto erfassen',
    body: () => {
      if (phase === 'ausgewertet') {
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
        ${hinweisBox('Das Bild bleibt auf dem Gerät. Es wird nichts hochgeladen und nichts '
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
    foot: () => phase === 'ausgewertet'
      ? `<button class="btn" data-zurueck type="button">Anderes Bild</button>
         <button class="btn btn-primaer" data-uebernehmen type="button">Angaben übernehmen</button>`
      : `<button class="btn btn-primaer btn-block" data-auswerten type="button" ${phase === 'waehlen' ? 'disabled' : ''}>
           ${icon('funke')} Beispielauswertung anzeigen
         </button>`,
    bind: (el) => {
      const waehlen = (sel) => el.querySelector(sel).click();
      el.querySelector('[data-kamera]')?.addEventListener('click', () => waehlen('[data-f-kamera]'));
      el.querySelector('[data-galerie]')?.addEventListener('click', () => waehlen('[data-f-galerie]'));

      ['[data-f-kamera]', '[data-f-galerie]'].forEach(sel =>
        el.querySelector(sel)?.addEventListener('change', async (e) => {
          const datei = e.target.files?.[0];
          e.target.value = '';
          if (!datei) return;

          const fotoId = uid('foto');
          const erg = await fotos.speichern(fotoId, datei);
          if (!erg.ok) {
            problem = erg.grund;
            sheet.render();
            return;
          }
          problem = null;
          vorschau = { name: datei.name, fotoId };
          phase = 'gewaehlt';
          sheet.render();
        }));

      el.querySelector('[data-auswerten]')?.addEventListener('click', () => {
        phase = 'ausgewertet';
        sheet.render();
      });
      el.querySelector('[data-zurueck]')?.addEventListener('click', () => {
        phase = vorschau ? 'gewaehlt' : 'waehlen';
        sheet.render();
      });
      el.querySelector('[data-uebernehmen]')?.addEventListener('click', () => {
        if (vorschau) bilder = [vorschau];
        sheetErsetzenMitFormular({ ...LEER, ...FOTO_BEISPIEL, erfasstUeber: 'foto' }, o);
      });
    },
  });
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
  let phase = 'bereit';
  let sekunden = 0, ticker = null;

  const uhrzeit = () =>
    `${String(Math.floor(sekunden / 60)).padStart(2, '0')}:${String(sekunden % 60).padStart(2, '0')}`;

  const sheet = sheetErsetzen({
    titel: 'Auftrag einsprechen',
    body: () => {
      if (phase === 'pruefen') {
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
        ${hinweisBox('<strong>Aufnahme ist simuliert.</strong> Die Demo greift nicht auf das Mikrofon zu.')}
        <div class="rec-box ${phase === 'laeuft' ? 'laeuft' : ''}">
          <div class="rec-dot">${icon('mikro')}</div>
          <div class="rec-timer">${uhrzeit()}</div>
          <div class="rec-status">${phase === 'laeuft' ? 'Aufnahme läuft (simuliert)' : 'Bereit'}</div>
        </div>`;
    },
    foot: () => {
      if (phase === 'bereit') return `<button class="btn btn-primaer btn-block" data-start type="button">${icon('mikro')} Aufnahme starten</button>`;
      if (phase === 'laeuft') return `<button class="btn btn-primaer btn-block" data-stop type="button">Aufnahme stoppen</button>`;
      return `<button class="btn" data-nochmal type="button">Nochmal</button>
              <button class="btn btn-primaer" data-ok type="button">Angaben übernehmen</button>`;
    },
    bind: (el) => {
      el.querySelector('[data-start]')?.addEventListener('click', () => {
        phase = 'laeuft'; sekunden = 0;
        ticker = setInterval(() => { sekunden++; sheet.render(); }, 1000);
        sheet.render();
      });
      el.querySelector('[data-stop]')?.addEventListener('click', () => {
        clearInterval(ticker); ticker = null; phase = 'pruefen'; sheet.render();
      });
      el.querySelector('[data-nochmal]')?.addEventListener('click', () => {
        phase = 'bereit'; sekunden = 0; sheet.render();
      });
      el.querySelector('[data-ok]')?.addEventListener('click', () => {
        // Termin bewusst offen lassen: "Freitag um zehn" ist kein Datum.
        sheetErsetzenMitFormular({ ...LEER, ...FOTO_BEISPIEL, termin: '', erfasstUeber: 'sprache' }, o);
      });
    },
    onClose: () => { if (ticker) clearInterval(ticker); },
  });
}

/* ── Das gemeinsame Formular ─────────────── */

function formularOeffnen(daten, o) { sheetOeffnen(formularKonfig(daten, o)); }

function formularKonfig(daten, o = {}) {
  const bearbeiten = o.bearbeiten || null;
  let werte = { ...LEER, ...daten };

  /** Aktuelle Feldwerte einsammeln — auch beim Zwischenspeichern des Entwurfs. */
  const lesen = (el) => ({
    kunde:           el.querySelector('#k').value.trim(),
    ansprechpartner: el.querySelector('#ap').value.trim(),
    email:           el.querySelector('#em').value.trim(),
    telefon:         el.querySelector('#tel').value.trim(),
    adresse:         el.querySelector('#ad').value.trim(),
    aufgabe:         el.querySelector('#af').value.trim(),
    termin:          el.querySelector('#tm').value,
    erfasstUeber:    werte.erfasstUeber,
  });

  return {
    titel: bearbeiten ? 'Auftragsdaten korrigieren' : 'Auftrag erfassen',
    body: () => `
      ${werte.erfasstUeber !== 'manuell' && !bearbeiten
        ? hinweisBox('Die vorausgefüllten Angaben stammen aus einer <strong>Beispielauswertung</strong>, '
          + 'nicht aus Ihrem Bild oder Ihrer Stimme. Bitte vor dem Speichern prüfen.')
        : ''}

      <div class="f">
        <label class="f-label" for="k">Kunde / Organisation</label>
        <input class="inp" id="k" value="${esc(werte.kunde)}" placeholder="z. B. Hausverwaltung Nordpark eG">
      </div>

      <div class="fields">
        <div class="f">
          <label class="f-label" for="ap">Ansprechpartner <span class="opt">(optional)</span></label>
          <input class="inp" id="ap" value="${esc(werte.ansprechpartner)}" placeholder="z. B. Frau Sommer">
        </div>
        <div class="f">
          <label class="f-label" for="tel">Telefon <span class="opt">(optional)</span></label>
          <input class="inp" id="tel" type="tel" value="${esc(werte.telefon)}" placeholder="0228 …">
        </div>
      </div>

      <div class="f">
        <label class="f-label" for="em">E-Mail <span class="opt">(für die Rechnung)</span></label>
        <input class="inp" id="em" type="email" value="${esc(werte.email)}" placeholder="rechnung@…">
      </div>

      <div class="f">
        <label class="f-label" for="ad">Objektadresse</label>
        <input class="inp" id="ad" value="${esc(werte.adresse)}" placeholder="Straße, PLZ, Ort">
      </div>

      <div class="f">
        <label class="f-label" for="af">Vereinbarte Aufgabe</label>
        <textarea class="inp" id="af" rows="4"
          placeholder="Was wurde mit dem Kunden besprochen?">${esc(werte.aufgabe)}</textarea>
      </div>

      <div class="f">
        <label class="f-label" for="tm">Termin</label>
        <input class="inp" id="tm" type="datetime-local" value="${esc(toInputDatetime(werte.termin))}">
        <div class="f-hilfe">Ein Termin je Auftrag. Er erscheint sofort im Kalender.</div>
      </div>

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

    bind: (el) => {
      // Live mitschreiben, damit "Später weiter" wirklich nichts verliert.
      if (!bearbeiten) {
        el.querySelectorAll('.inp').forEach(i =>
          i.addEventListener('input', () => { entwurf = lesen(el); entwurfSichern(); }));
      }

      el.querySelector('[data-ab]').addEventListener('click', () => {
        if (!bearbeiten) {
          entwurf = lesen(el);
          entwurfSichern();
          const etwasDrin = Object.entries(entwurf).some(([k, v]) => k !== 'erfasstUeber' && v);
          sheetSchliessen();
          if (etwasDrin) toast('Entwurf gesichert — über „Auftrag erfassen" geht es weiter.');
          return;
        }
        sheetSchliessen();
      });

      el.querySelector('[data-ok]').addEventListener('click', () => {
        const neu = lesen(el);

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
  };
}
