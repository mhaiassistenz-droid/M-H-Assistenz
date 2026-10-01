/* ============================================
   preisliste-ui.js — Preisliste ansehen, importieren, Artikel wählen

   Drei Ebenen:
   - preislisteOeffnen()  Liste mit Suche, Standard-Stundensatz, Import
   - Import-Vorschau      zeigt VOR dem Übernehmen, was neu ist und was sich ändert
   - artikelWaehlen()     Auswahl beim Dokumentieren und im Rechnungsentwurf

   Die App ordnet nie selbst zu: Ein Preis aus der Liste landet nur dort, wo Edin
   einen Artikel gewählt oder einen Standard-Stundensatz festgelegt hat.
   ============================================ */

import { esc, icon, fmtEuro, fmtDatum, parseTermin } from './util.js';
import * as state from './state.js';
import { sheetOeffnen, sheetSchliessen, sheetErsetzen, bestaetigen, toast } from './ui.js';
import { preislisteLesen, preislisteVergleich, istZuschlag, istStundenArtikel, artikelSchluessel } from './preisliste.js';

const MAX_DATEI = 2 * 1024 * 1024;

export const preisText = (a) => (a?.preis === null || a?.preis === undefined)
  ? 'Preis fehlt' : `${fmtEuro(a.preis)} / ${a.einheit}`;

const suchText = (a) => `${a.nr || ''} ${a.name} ${a.kategorie || ''} ${a.beschreibung || ''}`.toLowerCase();

/** Artikel nach Kategorie gruppiert, Kategorien alphabetisch, innerhalb in Dateireihenfolge. */
function gruppiert(liste) {
  const g = new Map();
  for (const a of liste) {
    const k = a.kategorie || 'Ohne Kategorie';
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(a);
  }
  return [...g.entries()].sort((x, y) => x[0].localeCompare(y[0], 'de'));
}

/** Suche filtert nur das DOM — kein Neuzeichnen, das Eingabefeld behält den Fokus. */
function sucheBinden(el) {
  const feld = el.querySelector('[data-pl-suche]');
  if (!feld) return;
  feld.addEventListener('input', () => {
    const q = feld.value.trim().toLowerCase();
    let treffer = 0;
    el.querySelectorAll('[data-pl-gruppe]').forEach(gr => {
      let sichtbar = 0;
      gr.querySelectorAll('[data-such]').forEach(z => {
        const an = !q || z.dataset.such.includes(q);
        z.hidden = !an;
        if (an) sichtbar++;
      });
      gr.hidden = !sichtbar;
      if (q && sichtbar) gr.open = true;
      treffer += sichtbar;
    });
    const leer = el.querySelector('[data-pl-nichts]');
    if (leer) leer.hidden = treffer > 0;
  });
}

/* ── Liste ───────────────────────────────── */

export function preislisteOeffnen() {
  sheetOeffnen({
    titel: 'Preisliste',
    body: listeKoerper,
    foot: () => state.alleArtikel().length
      ? `<button class="btn btn-warn" data-pl-leeren type="button">Liste löschen</button>
         <button class="btn btn-primaer" data-pl-fertig type="button">Fertig</button>`
      : `<button class="btn btn-primaer" data-pl-fertig type="button">Schließen</button>`,
    bind: (el, api) => {
      importBinden(el);
      sucheBinden(el);
      el.querySelector('[data-pl-fertig]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-pl-stundensatz]')?.addEventListener('change', (e) => {
        const s = state.stundensatzSetzen(e.target.value || null);
        api.render();
        toast(s ? `Standard-Stundensatz: ${fmtEuro(s.preis)} (${s.nr || s.name}).` : 'Kein Standard-Stundensatz — der Beispielpreis bleibt markiert.');
      });
      el.querySelector('[data-pl-leeren]')?.addEventListener('click', async () => {
        const ja = await bestaetigen({
          titel: 'Preisliste löschen',
          text: 'Alle Artikel werden aus der App entfernt. Rechnungen behalten ihre Preise. In sevDesk ändert sich nichts.',
          jaText: 'Liste löschen', warnend: true,
        });
        if (!ja) return;
        state.preislisteLeeren();
        api.render();   // die Bestätigung hat die Liste schon vor dem Löschen neu gezeichnet
        toast('Preisliste gelöscht.');
      });
    },
  });
}

function listeKoerper() {
  const liste = state.alleArtikel();
  const info = state.preislisteInfo();
  if (!liste.length) {
    return `
      <div class="hint-note">Hier liegt deine <strong>Preisliste aus sevDesk</strong>: Stundensätze,
        Pauschalen, Preise pro m². Wählst du beim Dokumentieren oder in der Rechnung einen Artikel,
        setzt die App seinen Preis ein — tippen musst du ihn dann nicht mehr.</div>
      ${importKarte()}`;
  }

  const stunden = liste.filter(a => istStundenArtikel(a) && a.preis !== null);
  const standard = state.standardStundensatz();
  const ohnePreis = liste.filter(a => a.preis === null && !istZuschlag(a)).length;
  const kategorien = new Set(liste.map(a => a.kategorie || 'Ohne Kategorie')).size;

  return `
    <div class="pl-info">
      <strong>${liste.length} Artikel in ${kategorien} ${kategorien === 1 ? 'Kategorie' : 'Kategorien'}</strong>
      ${info.importiertAm ? `<span>Stand ${esc(fmtDatum(parseTermin(info.importiertAm)))}${info.quelle ? ` · ${esc(info.quelle)}` : ''}</span>` : ''}
      ${ohnePreis ? `<span class="pl-warn">${ohnePreis} ohne Preis</span>` : ''}
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title">Stundensatz für Arbeitszeit</div></div>
      <div class="card-body stapel">
        <div class="f">
          <label class="f-label" for="pl-std">Standard</label>
          <select class="inp" id="pl-std" data-pl-stundensatz>
            <option value="">Kein Standard</option>
            ${stunden.map(a => `<option value="${esc(artikelSchluessel(a))}" ${standard && artikelSchluessel(standard) === artikelSchluessel(a) ? 'selected' : ''}>
              ${esc(fmtEuro(a.preis))} · ${esc(a.name)}${a.nr ? ` (${esc(a.nr)})` : ''}</option>`).join('')}
          </select>
        </div>
        <div class="f-hilfe">Ohne Standard steht bei Arbeitszeit der markierte Beispielpreis ${esc(fmtEuro(state.BEISPIEL_STUNDENSATZ))}.
          Der Standard gilt für jede dokumentierte Arbeitszeit in <strong>neuen</strong> Rechnungsentwürfen.
          Hast du beim Erfassen der Zeit einen eigenen Artikel gewählt (z. B. Heckenschnitt), zählt der.</div>
      </div>
    </div>

    <div class="f">
      <label class="f-label" for="pl-suche">Suchen</label>
      <input class="inp" id="pl-suche" data-pl-suche type="search" placeholder="z. B. Fenster, Anfahrt oder Artikelnummer" autocomplete="off">
    </div>

    <div class="pl-gruppen">
      ${gruppiert(liste).map(([kat, artikel], i) => `
        <details class="pl-gruppe" data-pl-gruppe ${i === 0 ? 'open' : ''}>
          <summary><span>${esc(kat)}</span><span class="chip-count">${artikel.length}</span></summary>
          ${artikel.map(a => `
            <div class="pl-zeile" data-such="${esc(suchText(a))}">
              <div class="pl-mitte">
                <div class="pl-name">${esc(a.name)}</div>
                <div class="pl-meta">${a.nr ? `<span class="mono">${esc(a.nr)}</span> · ` : ''}${esc(a.einheit)}${a.ust !== null && a.ust !== undefined && a.ust !== 19 ? ` · ${esc(String(a.ust))} % USt.` : ''}</div>
                ${a.beschreibung ? `<div class="pl-text">${esc(a.beschreibung)}</div>` : ''}
                ${istZuschlag(a) ? '<div class="pl-hinweis">Zuschlag in Prozent — rechnet die App noch nicht automatisch.</div>' : ''}
              </div>
              <div class="pl-preis ${a.preis === null ? 'offen' : ''}">${istZuschlag(a) && a.preis !== null ? `+${esc(String(a.preis).replace('.', ','))} %` : esc(preisText(a).split(' / ')[0])}</div>
            </div>`).join('')}
        </details>`).join('')}
      <div class="state-box" data-pl-nichts hidden>Nichts gefunden.</div>
    </div>

    ${importKarte(true)}`;
}

function importKarte(vorhanden = false) {
  return `
    <div class="card pl-import">
      <div class="card-head"><div class="card-title">${vorhanden ? 'Neue Fassung einlesen' : 'Preisliste einlesen'}</div></div>
      <div class="card-body stapel">
        <div class="pl-import-knoepfe">
          <button class="btn btn-primaer" data-pl-datei type="button">${icon('rechnung')} CSV-Datei wählen</button>
          <button class="btn" data-pl-einfuegen type="button">Aus Tabelle einfügen</button>
        </div>
        <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" data-pl-datei-input hidden>
        <div class="f-hilfe">Aus sevDesk: Artikel exportieren (CSV). Aus Excel oder Numbers: Zellen samt
          Überschriftszeile kopieren und über „Aus Tabelle einfügen" einsetzen. Du siehst vor dem
          Übernehmen, was neu ist und welche Preise sich ändern.</div>
      </div>
    </div>`;
}

/* ── Import ──────────────────────────────── */

function importBinden(el) {
  const input = el.querySelector('[data-pl-datei-input]');
  el.querySelector('[data-pl-datei]')?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', async () => {
    const datei = input.files?.[0];
    input.value = '';
    if (!datei) return;
    if (datei.size > MAX_DATEI) return fehlerZeigen('Die Datei ist größer als 2 MB. Eine Preisliste ist normalerweise viel kleiner — ist es die richtige Datei?');
    if (/\.(xlsx|xls|numbers|ods)$/i.test(datei.name)) {
      return fehlerZeigen('Excel- und Numbers-Dateien kann die App nicht direkt lesen. Bitte als CSV exportieren — oder die Zellen kopieren und „Aus Tabelle einfügen" nehmen.');
    }
    const text = await dateiText(datei);
    vorschauAusText(text, datei.name, false);
  });
  el.querySelector('[data-pl-einfuegen]')?.addEventListener('click', einfuegenOeffnen);
}

/** UTF-8 zuerst; scheitert das, ist es meist eine ältere Windows-Datei (Umlaute). */
async function dateiText(datei) {
  const puffer = await datei.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(puffer); }
  catch { return new TextDecoder('windows-1252').decode(puffer); }
}

function fehlerZeigen(text) {
  sheetOeffnen({
    titel: 'Preisliste nicht gelesen',
    body: () => `<div class="hint-note">${esc(text)}</div>`,
    foot: () => '<button class="btn btn-primaer" data-ok type="button">Verstanden</button>',
    bind: (el) => el.querySelector('[data-ok]').addEventListener('click', sheetSchliessen),
  });
}

function einfuegenOeffnen() {
  let text = '';
  sheetOeffnen({
    titel: 'Aus Tabelle einfügen',
    body: () => `
      <div class="f">
        <label class="f-label" for="pl-text">Zellen mit Überschriftszeile</label>
        <textarea class="inp" id="pl-text" rows="10" placeholder="Artikelnummer&#9;Name&#9;Einheit&#9;Preis …">${esc(text)}</textarea>
      </div>
      <div class="f-hilfe">In Excel oder Numbers die ganze Tabelle markieren (mit der Zeile „Artikelnummer, Name, …"),
        kopieren und hier einfügen.</div>`,
    foot: () => `
      <button class="btn" data-ab type="button">Abbrechen</button>
      <button class="btn btn-primaer" data-ok type="button">Prüfen</button>`,
    bind: (el) => {
      const ta = el.querySelector('#pl-text');
      ta.addEventListener('input', () => { text = ta.value; });
      el.querySelector('[data-ab]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-ok]').addEventListener('click', () => {
        if (!ta.value.trim()) return toast('Bitte zuerst die Tabelle einfügen.');
        vorschauAusText(ta.value, 'eingefügte Tabelle', true);
      });
    },
  });
}

function vorschauAusText(text, quelle, ersetzeEbene) {
  const erg = preislisteLesen(text);
  if (!erg.ok) {
    const o = { titel: 'Preisliste nicht gelesen', body: () => `<div class="hint-note">${esc(erg.fehler)}</div>
        ${erg.probleme.length ? `<ul class="liste-offen">${erg.probleme.slice(0, 10).map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}`,
      foot: () => '<button class="btn btn-primaer" data-ok type="button">Verstanden</button>',
      bind: (el) => el.querySelector('[data-ok]').addEventListener('click', sheetSchliessen) };
    return ersetzeEbene ? sheetErsetzen(o) : sheetOeffnen(o);
  }
  const o = vorschauEbene(erg, quelle);
  return ersetzeEbene ? sheetErsetzen(o) : sheetOeffnen(o);
}

function vorschauEbene(erg, quelle) {
  const vorhanden = state.alleArtikel().length > 0;
  let modus = 'zusammen';
  const vergleich = () => preislisteVergleich(state.alleArtikel(), erg.artikel, modus, erg.felder);

  return {
    titel: 'Preisliste prüfen',
    body: () => {
      const v = vergleich();
      const preisAenderungen = v.geaendert.filter(g => g.felder.includes('preis'));
      const sonstige = v.geaendert.filter(g => !g.felder.includes('preis'));
      return `
        <div class="pl-info">
          <strong>${erg.artikel.length} Artikel gelesen</strong>
          <span>aus „${esc(quelle)}" · ${esc(erg.format)}</span>
        </div>

        ${erg.probleme.length ? `
          <div class="hint-note">
            <strong>${erg.probleme.length === 1 ? 'Ein Hinweis' : `${erg.probleme.length} Hinweise`}:</strong>
            <ul class="liste-offen">${erg.probleme.slice(0, 12).map(p => `<li>${esc(p)}</li>`).join('')}
              ${erg.probleme.length > 12 ? `<li>… und ${erg.probleme.length - 12} weitere</li>` : ''}</ul>
          </div>` : ''}

        ${vorhanden ? `
          <div class="pl-modus" role="radiogroup" aria-label="Wie übernehmen?">
            <label class="pl-modus-wahl"><input type="radio" name="pl-modus" value="zusammen" ${modus === 'zusammen' ? 'checked' : ''} data-pl-modus>
              <span><strong>Zusammenführen</strong><small>Neue Artikel kommen dazu, gleiche Artikelnummern werden aktualisiert, alle anderen bleiben.</small></span></label>
            <label class="pl-modus-wahl"><input type="radio" name="pl-modus" value="ersetzen" ${modus === 'ersetzen' ? 'checked' : ''} data-pl-modus>
              <span><strong>Liste ersetzen</strong><small>Danach gilt nur diese Datei.</small></span></label>
          </div>` : ''}

        <div class="pl-zahlen">
          <div><strong>${v.neu.length}</strong><span>neu</span></div>
          <div><strong>${v.geaendert.length}</strong><span>ändern sich</span></div>
          <div><strong>${v.gleich}</strong><span>unverändert</span></div>
          ${modus === 'ersetzen' ? `<div><strong>${v.entfaellt.length}</strong><span>fallen weg</span></div>` : ''}
        </div>

        ${preisAenderungen.length ? `
          <div class="card">
            <div class="card-head"><div class="card-title">Preis ändert sich</div></div>
            <div class="card-body">${preisAenderungen.slice(0, 40).map(g => aenderungZeile(g)).join('')}
              ${preisAenderungen.length > 40 ? `<div class="pl-meta">… und ${preisAenderungen.length - 40} weitere</div>` : ''}</div>
          </div>` : ''}

        ${sonstige.length ? `
          <details class="pl-gruppe">
            <summary><span>Text oder Kategorie geändert</span><span class="chip-count">${sonstige.length}</span></summary>
            ${sonstige.slice(0, 60).map(g => aenderungZeile(g)).join('')}
          </details>` : ''}

        ${modus === 'ersetzen' && v.entfaellt.length ? `
          <details class="pl-gruppe">
            <summary><span>Fallen weg</span><span class="chip-count">${v.entfaellt.length}</span></summary>
            ${v.entfaellt.slice(0, 60).map(a => `<div class="pl-zeile"><div class="pl-mitte"><div class="pl-name">${esc(a.name)}</div>
              <div class="pl-meta">${esc(a.nr || '')}</div></div><div class="pl-preis">${esc(preisText(a).split(' / ')[0])}</div></div>`).join('')}
          </details>` : ''}

        ${v.neu.length ? `
          <details class="pl-gruppe">
            <summary><span>Neu</span><span class="chip-count">${v.neu.length}</span></summary>
            ${v.neu.slice(0, 120).map(a => `<div class="pl-zeile"><div class="pl-mitte"><div class="pl-name">${esc(a.name)}</div>
              <div class="pl-meta">${a.nr ? `<span class="mono">${esc(a.nr)}</span> · ` : ''}${esc(a.einheit)}</div></div>
              <div class="pl-preis ${a.preis === null ? 'offen' : ''}">${esc(preisText(a).split(' / ')[0])}</div></div>`).join('')}
          </details>` : ''}

        <div class="f-hilfe">Rechnungen, die schon bestehen, ändern sich dadurch nicht. In sevDesk ändert sich nichts.</div>`;
    },
    foot: () => `
      <button class="btn" data-ab type="button">Abbrechen</button>
      <button class="btn btn-primaer" data-pl-uebernehmen type="button">Übernehmen</button>`,
    bind: (el, api) => {
      el.querySelectorAll('[data-pl-modus]').forEach(r => r.addEventListener('change', () => { modus = r.value; api.render(); }));
      el.querySelector('[data-ab]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-pl-uebernehmen]').addEventListener('click', () => {
        const info = state.preislisteUebernehmen(erg.artikel, { modus, felder: erg.felder, quelle });
        sheetSchliessen();
        toast(info ? `Preisliste übernommen: ${info.anzahl} Artikel.` : 'Nichts übernommen.');
      });
    },
  };
}

function aenderungZeile(g) {
  const teile = [];
  if (g.felder.includes('preis')) teile.push(`<span class="pl-alt">${esc(preisText(g.alt).split(' / ')[0])}</span> → <strong>${esc(preisText(g.neu).split(' / ')[0])}</strong>`);
  if (g.felder.includes('einheit')) teile.push(`Einheit ${esc(g.alt.einheit)} → ${esc(g.neu.einheit)}`);
  return `
    <div class="pl-zeile pl-aenderung">
      <div class="pl-mitte">
        <div class="pl-name">${esc(g.neu.name)}</div>
        <div class="pl-meta">${g.neu.nr ? `<span class="mono">${esc(g.neu.nr)}</span>` : ''}
          ${g.felder.includes('name') ? ` · vorher „${esc(g.alt.name)}"` : ''}
          ${!g.felder.includes('preis') && !g.felder.includes('name') ? ` · ${esc(g.felder.map(f => ({ kategorie: 'Kategorie', beschreibung: 'Beschreibung', ust: 'Steuersatz', einheit: 'Einheit' })[f] || f).join(', '))} geändert` : ''}</div>
      </div>
      <div class="pl-preis">${teile.join('<br>')}</div>
    </div>`;
}

/* ── Auswahl ─────────────────────────────── */

/**
 * Artikel wählen. `onWahl` läuft, bevor die Ebene schließt — so zeichnet sich die
 * Ebene darunter gleich mit dem neuen Stand.
 * @param {{titel?:string, nurStunden?:boolean, hinweis?:string, onWahl:(a)=>void}} o
 */
export function artikelWaehlen({ titel = 'Aus Preisliste wählen', nurStunden = false, hinweis = '', onWahl }) {
  const auswahl = state.alleArtikel().filter(a => !istZuschlag(a) && (!nurStunden || istStundenArtikel(a)));
  sheetOeffnen({
    titel,
    body: () => `
      ${hinweis ? `<div class="f-hilfe">${hinweis}</div>` : ''}
      <div class="f">
        <label class="f-label" for="aw-suche">Suchen</label>
        <input class="inp" id="aw-suche" data-pl-suche type="search" placeholder="z. B. Fenster, Pauschale, Hecke" autocomplete="off">
      </div>
      ${auswahl.length ? `<div class="pl-gruppen">
        ${gruppiert(auswahl).map(([kat, artikel]) => `
          <details class="pl-gruppe" data-pl-gruppe ${gruppiert(auswahl).length <= 3 ? 'open' : ''}>
            <summary><span>${esc(kat)}</span><span class="chip-count">${artikel.length}</span></summary>
            ${artikel.map(a => `
              <button class="pl-zeile pl-wahl" data-such="${esc(suchText(a))}" data-art-wahl="${esc(artikelSchluessel(a))}" type="button">
                <span class="pl-mitte">
                  <span class="pl-name">${esc(a.name)}</span>
                  <span class="pl-meta">${a.nr ? `<span class="mono">${esc(a.nr)}</span> · ` : ''}${esc(a.einheit)}</span>
                </span>
                <span class="pl-preis ${a.preis === null ? 'offen' : ''}">${esc(preisText(a).split(' / ')[0])}</span>
              </button>`).join('')}
          </details>`).join('')}
        <div class="state-box" data-pl-nichts hidden>Nichts gefunden.</div>
      </div>` : `<div class="state-box">${nurStunden ? 'Die Preisliste enthält keine Stundensätze.' : 'Die Preisliste ist leer.'}</div>`}`,
    foot: () => '<button class="btn" data-ab type="button">Abbrechen</button>',
    bind: (el) => {
      sucheBinden(el);
      el.querySelector('[data-ab]').addEventListener('click', sheetSchliessen);
      el.querySelectorAll('[data-art-wahl]').forEach(b => b.addEventListener('click', () => {
        const a = state.artikel(b.dataset.artWahl);
        if (a) onWahl(a);
        sheetSchliessen();
      }));
    },
  });
}

/** Kurzinfo für eine gewählte Verknüpfung, z. B. im Zeit- oder Materialdialog. */
export function verknuepfungHtml(nr, loesenAttr) {
  if (!nr) return '';
  const a = state.artikel(nr);
  return `
    <div class="pl-verknuepft">
      ${icon('liste')}
      <span>${a ? `Aus Preisliste: <strong>${esc(a.name)}</strong> · ${esc(preisText(a))}`
                : `Artikel ${esc(nr)} ist nicht mehr in der Preisliste — der Preis bleibt offen.`}</span>
      <button class="btn btn-sm btn-still" ${loesenAttr} type="button">Lösen</button>
    </div>`;
}
