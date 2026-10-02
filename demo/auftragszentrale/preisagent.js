/* ============================================
   preisagent.js — Preise aus Edins Preisliste vorschlagen

   Ablauf (Wunsch Matthias, 02.10.2026): Beim Erstellen der Rechnung sucht ein
   kleiner Agent für jede Position den passenden Artikel aus Edins Preisliste;
   Edin bestätigt am Ende mit einem Tipp.

   Damit dabei keine Fehler entstehen, liegt die Sicherheit im Code, nicht im Prompt:
   1. Erst Edins eigene Zuordnungen von früher (ohne KI).
   2. Die App wählt pro Position bis zu fünf Kandidaten vor — gleiche Einheit,
      echter Wort- oder Synonymtreffer (preisliste.js). Ohne Kandidat wird die KI
      für diese Position gar nicht gefragt; der Preis bleibt offen.
   3. Die KI wählt nur eine Nummer AUS DIESEN Kandidaten oder keine. Einen Preis
      nennt sie nie — den setzt die App aus der Liste.
   4. Die App prüft die Antwort noch einmal: Kandidat? Einheit? „sicher" nur mit
      echtem Worttreffer, sonst höchstens „wahrscheinlich".
   5. Eingesetzt wird nur „sicher" und „gelernt" — als unbestätigter Vorschlag.
      Ohne Bestätigung kein Gesamtbetrag und kein Versand (state.js).
   ============================================ */

import { esc, icon, zahlZuFeld } from './util.js';
import * as state from './state.js';
import * as flows from './flows.js';
import { sheetOeffnen, sheetSchliessen, toast } from './ui.js';
import { kandidatenFuer, artikelSchluessel } from './preisliste.js';
import { artikelWaehlen, preisText } from './preisliste-ui.js';

/** Rechnungen, für die der Agent gerade sucht. */
export const laeuft = new Set();

const STUFE = {
  gelernt: 'von dir gelernt',
  hoch: 'sicher',
  mittel: 'wahrscheinlich — bitte prüfen',
  niedrig: 'unsicher',
  manuell: 'von dir gewählt',
};

/**
 * Sucht Preise für eine Rechnung und setzt sie als Vorschlag ein.
 * @param {string} rechnungId
 * @param {{ mitKi: boolean }} o  ohne Zugang zur KI nur gelernte Zuordnungen
 * @returns {Promise<{ok:boolean, eingesetzt?:number, angeboten?:number, gefragt?:number, fehler?:string}>}
 */
export async function preiseVorschlagen(rechnungId, { mitKi }) {
  const r = state.rechnung(rechnungId);
  const liste = state.alleArtikel();
  if (!r || !liste.length) return { ok: false, fehler: 'Keine Preisliste eingelesen.' };
  if (laeuft.has(rechnungId)) return { ok: false, fehler: 'Läuft schon.' };
  laeuft.add(rechnungId);
  try {
    const gelernt = [], fragen = [];
    for (const p of state.agentPositionen(r)) {
      const g = state.gelernterArtikel(p.text);
      if (g && state.passtEinheit(g, p)) {
        if (p.artikelNr !== artikelSchluessel(g)) {
          gelernt.push({ positionId: p.id, artikelNr: artikelSchluessel(g), sicherheit: 'gelernt',
            grund: 'So hast du es schon einmal zugeordnet.' });
        }
        continue;
      }
      let kandidaten = kandidatenFuer(p, liste, 5);
      // Arbeitszeit mit Standard-Stundensatz: nur fragen, wenn ein ANDERER Stundenartikel passt.
      if (p.preisQuelle === 'standard') kandidaten = kandidaten.filter(k => artikelSchluessel(k.a) !== p.artikelNr);
      if (kandidaten.length) fragen.push({ p, kandidaten });
    }

    const ki = [];
    let fehler = null;
    if (fragen.length && mitKi) {
      const antwort = await flows.preisVorschlag({
        positionen: fragen.map(({ p, kandidaten }) => ({
          id: p.id, text: p.text, menge: p.menge, einheit: p.einheit,
          art: p.einheit === 'Std.' ? 'zeit' : 'leistung',
          standard: p.preisQuelle === 'standard',
          kandidaten: kandidaten.map(({ a }) => ({
            nr: artikelSchluessel(a), name: a.name, einheit: a.einheit,
            kategorie: a.kategorie || '', beschreibung: (a.beschreibung || '').slice(0, 160),
          })),
        })),
      });
      if (!antwort.ok) fehler = antwort.fehler || 'Die Preissuche hat nicht geantwortet.';
      // Zweite Schranke — der Flow prüft schon, die App verlässt sich nicht darauf.
      for (const v of (antwort.vorschlaege || [])) {
        const f = fragen.find(x => x.p.id === v.id);
        if (!f || !v.nr) continue;
        const k = f.kandidaten.find(x => artikelSchluessel(x.a) === v.nr);
        if (!k) continue;
        let sicherheit = ['hoch', 'mittel', 'niedrig'].includes(v.sicherheit) ? v.sicherheit : 'niedrig';
        if (sicherheit === 'hoch' && !k.direkt) sicherheit = 'mittel';
        ki.push({ positionId: v.id, artikelNr: v.nr, sicherheit, grund: String(v.grund || '') });
      }
    }

    const erg = state.kiVorschlaegeAnwenden(rechnungId, [...gelernt, ...ki]) || { eingesetzt: 0, angeboten: 0 };
    return { ok: !fehler, fehler, ...erg, gefragt: fragen.length, ohneKi: !mitKi && fragen.length > 0 };
  } finally {
    laeuft.delete(rechnungId);
  }
}

/** Kurztext für einen Toast nach dem Lauf. */
export function ergebnisText(e) {
  if (!e) return '';
  if (e.fehler && !e.eingesetzt && !e.angeboten) return `${e.fehler} Preise kannst du wie gewohnt selbst eintragen.`;
  const teile = [];
  if (e.eingesetzt) teile.push(`${e.eingesetzt} ${e.eingesetzt === 1 ? 'Preis' : 'Preise'} aus deiner Preisliste eingesetzt`);
  if (e.angeboten) teile.push(`${e.angeboten} weitere ${e.angeboten === 1 ? 'Vorschlag' : 'Vorschläge'}`);
  if (!teile.length) {
    return e.ohneKi
      ? 'Ohne freigeschaltete KI-Funktionen nur deine gelernten Zuordnungen — keine gefunden.'
      : 'Für keine Position einen passenden Artikel gefunden. Preise bitte selbst eintragen.';
  }
  return teile.join(', ') + ' — bitte prüfen.';
}

/* ── Prüfliste ───────────────────────────── */

/**
 * Alle Vorschläge auf einen Blick. Angehakt = so übernehmen. „Sicher" und „gelernt"
 * sind vorab angehakt, „wahrscheinlich" und „unsicher" nicht.
 */
export function preisePruefen(rechnungId, danach) {
  const r0 = state.rechnung(rechnungId);
  const { eingesetzt, angeboten } = state.kiPruefung(r0);
  if (!eingesetzt.length && !angeboten.length) return toast('Keine offenen Preisvorschläge.');

  // Lokale Wahl je Position: welcher Artikel, angehakt ja/nein, woher.
  const wahl = new Map();
  for (const p of eingesetzt) wahl.set(p.id, { nr: p.artikelNr, an: true, stufe: p.kiSicherheit, grund: p.kiGrund });
  for (const x of angeboten) wahl.set(x.positionId, { nr: x.artikelNr, an: false, stufe: x.sicherheit, grund: x.grund });

  sheetOeffnen({
    titel: 'Preise prüfen',
    body: () => {
      const r = state.rechnung(rechnungId);
      const zeilen = [...wahl.entries()].map(([pid, w]) => {
        const p = r.positionen.find(x => x.id === pid);
        const a = state.artikel(w.nr);
        if (!p || !a) return '';
        const vorher = p.kiOffen ? p.kiVorher : { preis: p.preis, preisIstBeispiel: p.preisIstBeispiel };
        const bisher = vorher?.preis === null || vorher?.preis === undefined ? 'offen'
          : `${zahlZuFeld(vorher.preis)} €${vorher.preisIstBeispiel ? ' (Beispiel)' : ''}`;
        return `
          <div class="ki-zeile ${w.an ? 'an' : ''}" data-ki-zeile="${esc(pid)}">
            <label class="ki-haken">
              <input type="checkbox" data-ki-an="${esc(pid)}" ${w.an ? 'checked' : ''}
                aria-label="Übernehmen: ${esc(p.text)}">
            </label>
            <div class="ki-mitte">
              <div class="ki-pos">${esc(p.text)}<span class="ki-menge">${p.menge !== null && p.menge !== undefined ? ` · ${esc(zahlZuFeld(p.menge))} ${esc(p.einheit || '')}` : ''}</span></div>
              <div class="ki-artikel">${icon('vor')} <strong>${esc(a.name)}</strong></div>
              <div class="ki-preise"><span class="ki-bisher">bisher ${esc(bisher)}</span> → <strong>${esc(preisText(a))}</strong></div>
              <div class="ki-grund"><span class="ki-stufe stufe-${esc(w.stufe)}">${esc(STUFE[w.stufe] || w.stufe)}</span>${w.grund ? ` ${esc(w.grund)}` : ''}</div>
              <button class="btn btn-sm btn-still" data-ki-anders="${esc(pid)}" type="button">${icon('liste')} Anderer Artikel</button>
            </div>
          </div>`;
      }).join('');
      const an = [...wahl.values()].filter(w => w.an).length;
      return `
        <div class="hint-note">Die KI hat deine Positionen mit deiner Preisliste abgeglichen.
          <strong>Die Preise kommen aus deiner Liste</strong> — die KI sucht nur den passenden Artikel aus.
          Angehakt wird übernommen.</div>
        <div class="ki-liste">${zeilen}</div>
        <div class="f-hilfe">${an} von ${wahl.size} angehakt. Was du hier bestätigst, merkt sich die App für die nächste Rechnung.</div>`;
    },
    foot: () => `
      <button class="btn" data-ki-spaeter type="button">Später</button>
      <button class="btn btn-primaer" data-ki-ok type="button">Übernehmen</button>`,
    bind: (el, api) => {
      el.querySelectorAll('[data-ki-an]').forEach(c => c.addEventListener('change', () => {
        wahl.get(c.dataset.kiAn).an = c.checked;
        api.render();
      }));
      el.querySelectorAll('[data-ki-anders]').forEach(b => b.addEventListener('click', () => {
        const pid = b.dataset.kiAnders;
        const p = state.rechnung(rechnungId).positionen.find(x => x.id === pid);
        artikelWaehlen({
          titel: 'Anderer Artikel',
          nurStunden: p?.einheit === 'Std.',
          hinweis: p ? `Für: <strong>${esc(p.text)}</strong>` : '',
          onWahl: (a) => wahl.set(pid, { nr: artikelSchluessel(a), an: true, stufe: 'manuell', grund: '' }),
        });
      }));
      el.querySelector('[data-ki-spaeter]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-ki-ok]').addEventListener('click', () => {
        const n = state.kiEntscheiden(rechnungId, [...wahl.entries()].map(([positionId, w]) => ({
          positionId, artikelNr: w.an ? w.nr : null,
        })));
        sheetSchliessen();
        danach?.();
        toast(n ? `${n} ${n === 1 ? 'Preis' : 'Preise'} aus deiner Preisliste übernommen.` : 'Nichts übernommen.');
      });
    },
  });
}
