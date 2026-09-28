/* ============================================
   freischalten.js — Zugangscode für die KI-Funktionen der öffentlichen Demo

   Die Demo auf mhassistenz.de hat kein eigenes Backend. Mit einem Zugangscode
   ruft sie n8n direkt auf (Sprache, Foto, Änderung per KI). Der Code liegt nur im
   Browser des Nutzers (flows.js), nie im Quelltext. Ohne Code bleibt alles
   Demo. Der Rechnungsversand bleibt in jedem Fall simuliert.
   ============================================ */

import * as flows from './flows.js';
import { sheetOeffnen, sheetSchliessen, toast, hinweisBox } from './ui.js';
import { esc } from './util.js';

const TEXT = {
  proxy: 'Fiktive Kundendaten. Foto-Auswertung, Spracherkennung und Rechnungsversand laufen über echte Dienste.',
  direkt: 'Bitte keine echten Kundendaten eingeben. Foto-Auswertung, Spracherkennung und Änderung per KI laufen '
    + 'über echte Dienste. Der Rechnungsversand ist simuliert.',
  aus: 'Bitte keine echten Kundendaten eingeben. Foto-Auswertung, Spracherkennung und Rechnungsversand sind simuliert.',
};

/** Der Hinweis in der Seitenleiste und auf Home — je nach Betriebsart. */
export function hinweisHtml(modus) {
  const marke = modus === 'proxy' ? '' : '<span class="hinweis-marke">Demo</span> ';
  return `${marke}${esc(TEXT[modus] || TEXT.aus)}`;
}

export function hinweisZeile(modus) {
  const marke = modus === 'proxy' ? '' : '<span class="hinweis-marke">Demo</span>';
  return `<div class="hinweis">${marke}<span>${esc(TEXT[modus] || TEXT.aus)}</span></div>`;
}

/**
 * Beschriftet den Knopf je nach Betriebsart und bindet ihn.
 * proxy: kein Knopf nötig. direkt: Code entfernen. aus: freischalten.
 */
export function zugangKnopf(knopf) {
  if (!knopf) return;
  const modus = flows.zugangsmodus();
  if (modus === 'proxy') { knopf.hidden = true; return; }
  knopf.hidden = false;
  knopf.textContent = modus === 'direkt' ? 'Zugangscode entfernen' : 'KI-Funktionen freischalten';
  knopf.onclick = () => {
    if (modus === 'direkt') {
      flows.zugangscodeLoeschen();
      location.reload();
    } else {
      freischaltenOeffnen();
    }
  };
}

/** Fragt bei n8n an, ob der Code gilt. 403 heißt falsch; alles andere (auch 400) heißt: angenommen. */
async function codePruefen(code) {
  let antwort;
  try {
    antwort = await fetch('https://n8n.mhassistenz.de/webhook/pt-preiskorrektur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-PT-Token': code },
      body: '{}',
    });
  } catch {
    return { ok: false, grund: 'Die Auswertung ist nicht erreichbar. Bitte Verbindung prüfen und noch einmal versuchen.' };
  }
  if (antwort.status === 403) return { ok: false, grund: 'Der Code stimmt nicht. Bitte genau so eingeben, wie er geschickt wurde.' };
  return { ok: true };
}

export function freischaltenOeffnen() {
  let fehler = null;
  let pruefung = false;
  let code = '';

  const sheet = sheetOeffnen({
    titel: 'KI-Funktionen freischalten',
    body: () => `
      ${hinweisBox('Mit dem Zugangscode laufen Sprache, Foto-Auswertung und die Änderung per KI echt. '
        + 'Den Code hat Matthias geschickt. <strong>Bitte nur erfundene Daten und Aufnahmen verwenden.</strong> '
        + 'Der Rechnungsversand bleibt simuliert.', '')}
      ${fehler ? `<div class="state-box error">${esc(fehler)}</div>` : ''}
      <div class="f">
        <label class="f-label" for="fz-code">Zugangscode</label>
        <input class="inp" id="fz-code" type="text" inputmode="text" autocomplete="off" autocapitalize="none"
          spellcheck="false" placeholder="xxxx-xxxx-xxxx-xxxx" value="${esc(code)}" ${pruefung ? 'disabled' : ''}>
      </div>`,
    foot: () => pruefung
      ? `<button class="btn btn-block" disabled type="button">Wird geprüft …</button>`
      : `<button class="btn" data-abbrechen type="button">Abbrechen</button>
         <button class="btn btn-primaer" data-ok type="button">Freischalten</button>`,
    bind: (el) => {
      const feld = el.querySelector('#fz-code');
      feld?.addEventListener('input', (e) => { code = e.target.value; });
      el.querySelector('[data-abbrechen]')?.addEventListener('click', sheetSchliessen);
      const absenden = async () => {
        const eingabe = code.trim();
        if (eingabe.length < 8) { fehler = 'Bitte den Zugangscode eintragen.'; sheet.render(); return; }
        fehler = null; pruefung = true; sheet.render();
        const ergebnis = await codePruefen(eingabe);
        pruefung = false;
        if (!ergebnis.ok) { fehler = ergebnis.grund; sheet.render(); return; }
        flows.zugangscodeSetzen(eingabe);
        toast('KI-Funktionen freigeschaltet.');
        setTimeout(() => location.reload(), 350);
      };
      el.querySelector('[data-ok]')?.addEventListener('click', absenden);
      feld?.addEventListener('keydown', (e) => { if (e.key === 'Enter') absenden(); });
    },
  });
}
