/* ============================================
   page-aufgaben.js — Aufgaben

   Was noch zu tun ist, aber keine Arbeit vor Ort und keine Rechnungsposition:
   „Zaunpfosten nachbestellen", „Silikon kaufen". Abhaken genügt; Abgehaktes
   bleibt einen Tag sichtbar (zum Rückgängigmachen) und verschwindet dann.

   Aufgaben entstehen hier, per Sprache, oder aus der Dokumentation heraus
   („Als Aufgabe" an einer Notiz oder einem offenen Punkt). Ob etwas eine
   Aufgabe ist, entscheidet Edin mit einem Tipp — die App rät das nicht.

   Die Seite zeichnet sich bei jeder Datenänderung neu (state.subscribe).
   Angefangener Text und Diktat liegen deshalb auf Modulebene.
   ============================================ */

import { esc, icon, fmtVerlaufZeit, fmtTermin } from './util.js';
import * as state from './state.js';
import { bestaetigen, toast, leerZustand } from './ui.js';
import { akteOeffnen } from './akte.js';
import { voicing } from './voicing.js';

let entwurfText = '';
let entwurfAuftrag = '';
let wurzel = null;
let stimme = null;

/** Was das Diktat ohne Backend liefert. Fest hinterlegt, nicht erkannt. */
const DIKTAT_BEISPIEL = () => ({ ok: true, transkript: 'Zaunpfosten für die Talstraße nachbestellen.', vorschlag: {} });

function stimmeHolen() {
  if (stimme) return stimme;
  stimme = voicing({
    kontext: 'doku',
    label: 'Per Sprache',
    beispiel: DIKTAT_BEISPIEL,
    freischalten: false,
    demoText: '<strong>Diktat ist simuliert.</strong> Es wird nichts aufgenommen; der Knopf füllt ein hinterlegtes Beispiel ein.',
    // Das Ziel ist eindeutig: das Eingabefeld. Übernommen wird erst mit „Hinzufügen".
    onErgebnis: (antwort) => {
      const text = String(antwort.transkript || antwort.vorschlag?.notiz || '').trim();
      if (!text) return toast('Es wurde nichts erkannt.');
      entwurfText = [entwurfText.trim(), text].filter(Boolean).join(' ');
      if (wurzel) renderAufgaben(wurzel);
      toast('Erkannt — bitte prüfen und „Hinzufügen" tippen.');
    },
  });
  return stimme;
}

/** Beim Verlassen der Seite: Mikrofon schließen, falls noch aufgenommen wird. */
export function aufgabenVerlassen() {
  if (stimme) { stimme.abbrechen(); stimme = null; }
}

export function renderAufgaben(el) {
  wurzel = el;
  const { offen, kuerzlich } = state.sichtbareAufgaben();
  const auftraege = state.alleAuftraege().filter(a => a.status !== 'erledigt')
    .sort(state.nachTermin);
  const s = stimmeHolen();

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title" id="t-aufgaben">Aufgaben</h1>
        <div class="page-sub">${offen.length} offen${kuerzlich.length ? ` · ${kuerzlich.length} heute erledigt` : ''}</div>
      </div>
    </div>

    <form class="card aufgabe-neu" data-aufgabe-form>
      <div class="card-body stapel">
        <div class="f">
          <label class="f-label" for="ag-text">Neue Aufgabe</label>
          <input class="inp" id="ag-text" value="${esc(entwurfText)}" placeholder="z. B. Zaunpfosten nachbestellen" autocomplete="off">
        </div>
        <div class="f">
          <label class="f-label" for="ag-auftrag">Zu welchem Auftrag <span class="opt">(optional)</span></label>
          <select class="inp" id="ag-auftrag">
            <option value="">Ohne Auftrag</option>
            ${auftraege.map(a => `<option value="${esc(a.id)}" ${a.id === entwurfAuftrag ? 'selected' : ''}>${esc(a.kunde || 'Ohne Kunde')} — ${esc(fmtTermin(a.termin))}</option>`).join('')}
          </select>
        </div>
        <div class="aufgabe-neu-akt">
          ${s.html()}
          <button class="btn btn-primaer" type="submit">${icon('plus')} Hinzufügen</button>
        </div>
      </div>
    </form>

    <div class="section-head">
      <div class="section-title">Offen</div>
      <span class="section-hint">${offen.length}</span>
    </div>
    <div class="card">${offen.length
      ? offen.map(zeile).join('')
      : leerZustand('Keine offenen Aufgaben.', 'Neue Aufgaben oben eintragen oder in der Akte bei einer Notiz „Als Aufgabe" tippen.')}</div>

    ${kuerzlich.length ? `
      <div class="section-head">
        <div class="section-title">Heute erledigt</div>
        <span class="section-hint">verschwindet nach einem Tag</span>
      </div>
      <div class="card">${kuerzlich.map(zeile).join('')}</div>` : ''}`;

  binden(el, s);
}

function zeile(x) {
  const a = x.auftragId ? state.auftrag(x.auftragId) : null;
  const fertig = !!x.erledigtAm;
  return `
    <div class="aufgabe ${fertig ? 'erledigt' : ''}" data-aufgabe="${esc(x.id)}">
      <label class="aufgabe-haken">
        <input type="checkbox" data-aufgabe-haken="${esc(x.id)}" ${fertig ? 'checked' : ''}
          aria-label="${fertig ? 'Wieder öffnen' : 'Erledigt'}: ${esc(x.text)}">
      </label>
      <div class="aufgabe-mitte">
        <div class="aufgabe-text">${esc(x.text)}</div>
        <div class="aufgabe-meta">${a
          ? `<button class="aufgabe-link" data-aufgabe-akte="${esc(a.id)}" type="button">${esc(a.kunde || 'Auftrag')}</button> · `
          : ''}${esc(fmtVerlaufZeit(fertig ? x.erledigtAm : x.angelegtAm))}${fertig ? ' erledigt' : ''}</div>
      </div>
      <button class="icon-btn" data-aufgabe-weg="${esc(x.id)}" type="button" aria-label="Aufgabe löschen">${icon('papierkorb')}</button>
    </div>`;
}

function binden(el, s) {
  s.binden(el);
  const text = el.querySelector('#ag-text');
  const wahl = el.querySelector('#ag-auftrag');
  text.addEventListener('input', () => { entwurfText = text.value; });
  wahl.addEventListener('change', () => { entwurfAuftrag = wahl.value; });

  el.querySelector('[data-aufgabe-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!text.value.trim()) { toast('Bitte eintragen, was zu tun ist.'); text.focus(); return; }
    const neu = state.aufgabeAnlegen({ text: text.value, auftragId: wahl.value || null });
    if (!neu) return;
    entwurfText = ''; entwurfAuftrag = '';
    toast('Aufgabe angelegt.');
    // state.commit() hat die Seite schon neu gezeichnet; der leere Entwurf gilt ab jetzt.
    renderAufgaben(el);
  });

  el.querySelectorAll('[data-aufgabe-haken]').forEach(b => b.addEventListener('change', () => {
    state.aufgabeErledigt(b.dataset.aufgabeHaken, b.checked);
    toast(b.checked ? 'Erledigt — bleibt bis morgen hier sichtbar.' : 'Wieder offen.');
  }));

  el.querySelectorAll('[data-aufgabe-weg]').forEach(b => b.addEventListener('click', async () => {
    const x = state.sichtbareAufgaben();
    const t = [...x.offen, ...x.kuerzlich].find(a => a.id === b.dataset.aufgabeWeg);
    const ja = await bestaetigen({
      titel: 'Aufgabe löschen', text: `„${(t?.text || '').slice(0, 90)}" wird gelöscht.`,
      jaText: 'Löschen', warnend: true,
    });
    if (!ja) return;
    state.aufgabeEntfernen(b.dataset.aufgabeWeg);
    toast('Aufgabe gelöscht.');
  }));

  el.querySelectorAll('[data-aufgabe-akte]').forEach(b =>
    b.addEventListener('click', () => akteOeffnen(b.dataset.aufgabeAkte)));
}
