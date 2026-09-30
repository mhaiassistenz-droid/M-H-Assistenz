/* ============================================
   voicing.js — Diktierknopf zum Einbetten

   Ein kleiner Knopf, der dort sitzt, wo Diktieren etwas spart: erster Klick
   startet die Aufnahme und zeigt eine längliche Aussteuerungsanzeige neben
   dem Knopf, zweiter Klick (Knopf ist dann rot) stoppt, die Aufnahme wird
   ausgewertet und das Ergebnis an `onErgebnis` gegeben. Wohin es gehört,
   entscheidet der Aufrufer — bei Unklarheit fragt er nach, statt zu raten
   (Fachregel 5).

   Derselbe Zustandsablauf wie im großen „Einsprechen"-Sheet (bereit →
   läuft → wird ausgewertet), nur ohne eigenes Sheet. Deshalb gilt auch
   hier: während der Aufnahme wird nichts neu gezeichnet. Knopf, Balken und
   Status werden direkt am Element nachgezogen (siehe pegel.js).

   Ohne Backend ist die Aufnahme simuliert und so gekennzeichnet (Fachregel 7):
   es wird nichts aufgenommen, `beispiel()` liefert eine hinterlegte Antwort.

   Verwendung:
     const v = voicing({ kontext: 'erfassen', beispiel, onErgebnis });
     body:  `${v.html()}`
     bind:  v.binden(el)
     onClose: v.abbrechen()
   ============================================ */

import { esc, icon } from './util.js';
import * as flows from './flows.js';
import * as pegel from './pegel.js';
import { hinweisBox } from './ui.js';
import { freischaltenKnopf } from './freischalten.js';

/**
 * @param {object} o
 * @param {'erfassen'|'doku'} o.kontext        Sprachflow-Kontext
 * @param {() => object} o.beispiel             Antwort im simulierten Betrieb
 * @param {(antwort: object, echt: boolean) => void} o.onErgebnis
 * @param {string} [o.label]                    Beschriftung im Ruhezustand
 * @param {string} [o.demoText]                 Hinweis im simulierten Betrieb
 * @param {boolean} [o.freischalten=true]       Freischalt-Knopf im Demo-Hinweis zeigen
 */
export function voicing(o) {
  const label = o.label || 'Per Sprache ergänzen';
  let phase = 'bereit';        // bereit → laeuft → wertetAus → bereit
  let echt = null;             // null = noch nicht bekannt
  let aufnahme = null, messer = null, anzeige = null;
  let problem = null;
  let geschlossen = false;
  let wurzel = null;           // aktuelles [data-voicing]-Element

  const bereit = flows.verfuegbar().then((ja) => {
    echt = ja;
    hinweisZeichnen();
    return ja;
  });

  const knopfInhalt = () => {
    if (phase === 'laeuft') return `<span class="rec-stop-icon" aria-hidden="true"></span> Aufnahme stoppen`;
    if (phase === 'wertetAus') return 'Wird ausgewertet …';
    return `${icon('mikro')} ${esc(label)}`;
  };

  const statusText = () => {
    if (problem) return problem;
    if (phase === 'laeuft') return echt ? 'Aufnahme läuft — sprechen Sie.' : 'Aufnahme läuft (simuliert).';
    if (phase === 'wertetAus') return 'Erst wird der Text erkannt, dann zugeordnet.';
    return '';
  };

  const hinweisHtml = () => (echt === false
    ? hinweisBox(o.demoText || '<strong>Aufnahme ist simuliert.</strong> Es wird nichts aufgenommen; '
      + 'der Knopf liefert ein hinterlegtes Beispiel.' + (o.freischalten === false ? '' : freischaltenKnopf()))
    : '');

  function html() {
    return `
      <div class="voicing ${phase === 'laeuft' ? 'laeuft' : ''}" data-voicing>
        <div class="voicing-zeile">
          <button class="btn voicing-knopf ${phase === 'laeuft' ? 'laeuft' : ''}" data-voicing-knopf type="button"
            ${phase === 'wertetAus' ? 'disabled' : ''} aria-pressed="${phase === 'laeuft'}">${knopfInhalt()}</button>
          ${pegel.pegelFeld('voicing-pegel').replace('class="pegel"', `class="pegel voicing-pegel" ${phase === 'laeuft' ? '' : 'hidden'}`)}
        </div>
        <div class="voicing-status ${problem ? 'fehler' : ''}" data-voicing-status aria-live="polite">${esc(statusText())}</div>
        <div data-voicing-hinweis>${hinweisHtml()}</div>
      </div>`;
  }

  /** Zustand direkt ins DOM übertragen — kein Neuzeichnen des Sheets. */
  function zeigen() {
    if (!wurzel || !wurzel.isConnected) return;
    const knopf = wurzel.querySelector('[data-voicing-knopf]');
    const feld = wurzel.querySelector('[data-voicing-pegel]');
    const status = wurzel.querySelector('[data-voicing-status]');
    wurzel.classList.toggle('laeuft', phase === 'laeuft');
    knopf.classList.toggle('laeuft', phase === 'laeuft');
    knopf.disabled = phase === 'wertetAus';
    knopf.setAttribute('aria-pressed', String(phase === 'laeuft'));
    knopf.innerHTML = knopfInhalt();
    feld.hidden = phase !== 'laeuft';
    status.textContent = statusText();
    status.classList.toggle('fehler', !!problem);
  }

  function hinweisZeichnen() {
    const h = wurzel?.isConnected && wurzel.querySelector('[data-voicing-hinweis]');
    if (h) h.innerHTML = hinweisHtml();
  }

  function anzeigeAnbinden() {
    const feld = wurzel?.querySelector('[data-voicing-pegel]');
    if (anzeige) { anzeige.stoppen(); anzeige = null; }
    if (!feld) return;
    if (messer) {
      feld.classList.add('aktiv');
      anzeige = pegel.anzeigeStarten(feld, messer);
    } else {
      // Simuliert: stehende, ruhige Linie statt vorgetäuschter Stimme.
      pegel.standbildZeichnen(feld, pegel.standbild([]));
    }
  }

  function pegelBeenden() {
    if (anzeige) { anzeige.stoppen(); anzeige = null; }
    if (messer) { messer.schliessen(); messer = null; }
  }

  async function starten() {
    problem = null;
    const ja = echt ?? await bereit;
    if (geschlossen) return;
    if (ja) {
      try {
        aufnahme = await flows.aufnahmeStarten();
        if (geschlossen) { aufnahme.abbrechen(); aufnahme = null; return; }
        messer = pegel.messerStarten(aufnahme.stream);
      } catch (e) {
        problem = e.message;
        zeigen();
        return;
      }
    }
    phase = 'laeuft';
    zeigen();
    anzeigeAnbinden();
  }

  async function stoppen() {
    pegelBeenden();
    if (!echt) {
      phase = 'bereit';
      zeigen();
      o.onErgebnis(o.beispiel(), false);
      return;
    }
    phase = 'wertetAus';
    zeigen();
    let antwort;
    try {
      const blob = await aufnahme.stoppen();
      aufnahme = null;
      if (geschlossen) return;
      antwort = await flows.spracheAuswerten(blob, o.kontext);
    } catch (e) {
      antwort = { ok: false, fehler: e.message || 'Die Aufnahme konnte nicht ausgewertet werden.' };
    }
    if (geschlossen) return;
    phase = 'bereit';
    if (!antwort.ok) {
      // Ein Fehlschlag darf nie wie ein Ergebnis aussehen.
      problem = antwort.fehler || 'Die Auswertung ist fehlgeschlagen.';
      zeigen();
      return;
    }
    zeigen();
    o.onErgebnis(antwort, true);
  }

  return {
    html,
    /** Nach jedem Rendern des umgebenden Sheets aufrufen. */
    binden(root) {
      wurzel = root.querySelector('[data-voicing]');
      if (!wurzel) return;
      wurzel.querySelector('[data-voicing-knopf]').addEventListener('click', () => {
        if (phase === 'bereit') starten();
        else if (phase === 'laeuft') stoppen();
      });
      // Wurde das Sheet während einer Aufnahme neu gezeichnet, läuft die Anzeige am neuen Feld weiter.
      if (phase === 'laeuft') anzeigeAnbinden();
    },
    /** Beim Schließen des Sheets: Mikrofon zu, späte Antworten verwerfen. */
    abbrechen() {
      geschlossen = true;
      pegelBeenden();
      if (aufnahme) { aufnahme.abbrechen(); aufnahme = null; }
    },
    get phase() { return phase; },
  };
}
