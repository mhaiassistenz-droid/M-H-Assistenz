/* ============================================
   rechnung.js — Rechnungsentwurf, Vorschau, simulierter Versand

   Der Entwurf entsteht aus dem, was dokumentiert wurde — nicht aus der
   vereinbarten Aufgabe. Angefragte Arbeit ist nicht automatisch
   ausgeführte Arbeit; die Anfrage steht deshalb nur als Referenz daneben.

   Ein Auftrag hat höchstens einen Entwurf. "Rechnung erstellen" öffnet
   beim zweiten Mal denselben und generiert nichts neu.
   ============================================ */

import { esc, icon, fmtEuro, fmtDatum, parseZahl, zahlZuFeld, parseTermin,
         mengePruefen, preisPruefen, istEmail } from './util.js';
import * as state from './state.js';
import { sheetOeffnen, sheetSchliessen, sheetErsetzen, bestaetigen, toast, badge, hinweisBox } from './ui.js';

/* Fiktive Absenderdaten für die Belegvorschau. */
const ABSENDER = {
  firma: 'PT Hausmeisterservice',
  inhaber: 'Edin Petrovac',
  adresse: 'Musterweg 5, 53111 Bonn',
  kontakt: 'info@pt-hausmeisterservice.example · 0228 5550100',
  steuernr: 'St.-Nr. 000/0000/0000 (Beispiel)',
};

/**
 * Entwurf öffnen. Einziger Einstieg — aus der Akte und aus der Rechnungsliste.
 * @param {string} auftragId
 * @param {Function} [danach]  Rückmeldung an die Akte, damit ihr Status-Badge stimmt
 */
export function rechnungOeffnen(auftragId, danach) {
  const a = state.auftrag(auftragId);
  if (!a) return;

  if (a.status !== 'erledigt') {
    toast('Eine Rechnung entsteht erst, wenn die Arbeit abgeschlossen ist.');
    return;
  }

  const { rechnung: r, neu } = state.rechnungOeffnenOderErstellen(auftragId);
  if (!r) return;

  toast(neu
    ? 'Entwurf aus der Dokumentation erstellt.'
    : 'Vorhandener Entwurf geöffnet — es wurde keine zweite Rechnung angelegt.');

  entwurfOeffnen(r.id, danach);
}

/** Direkteinstieg aus der Rechnungsliste. */
export function entwurfOeffnen(rechnungId, danach) {
  const holen = () => state.rechnung(rechnungId);
  if (!holen()) return;

  if (holen().status === 'versendet') return belegOeffnen(rechnungId, { ersetzen: false, danach });

  sheetOeffnen({
    titel: 'Rechnungsentwurf',
    body: () => editorKoerper(holen()),
    foot: () => {
      const s = state.summen(holen());
      return `
        <div class="foot-summe">
          <span>${s.vollstaendig
            ? `Gesamt inkl. ${holen().ustSatz} % USt.`
            : 'Gesamtbetrag steht noch nicht fest'}</span>
          <span class="foot-summe-wert ${s.vollstaendig ? '' : 'offen'}">
            ${s.vollstaendig ? fmtEuro(s.brutto) : `${s.luecken} ${s.luecken === 1 ? 'Angabe fehlt' : 'Angaben fehlen'}`}
          </span>
        </div>
        <button class="btn" data-vorschau type="button">${icon('rechnung')} Vorschau</button>
        <button class="btn btn-primaer" data-versand type="button">${icon('senden')} Versand simulieren</button>`;
    },
    bind: (el, api) => editorBinden(el, api, rechnungId, danach),
    onClose: () => danach?.(),
  });
}

/* ── Editor ──────────────────────────────── */

function editorKoerper(r) {
  const a = state.auftrag(r.auftragId);
  const s = state.summen(r);
  const offen = a ? state.offenePunkte(a) : [];

  return `
    ${hinweisBox('Beispiel-Rechnung: Preise und Rechnungsnummer sind erfunden, '
      + 'das Layout ist ein eigener Entwurf. Es besteht keine Verbindung zu sevDesk oder einer '
      + 'vorhandenen Vorlage.')}

    <div class="beleg-kopfzeile">
      ${badge('Entwurf', 'geplant')}
      <span class="section-hint mono">${esc(r.nummer)}</span>
      <span class="section-hint">vom ${esc(fmtDatum(parseTermin(r.datum)))}</span>
    </div>

    <!-- Abgleich: was angefragt war vs. was dokumentiert wurde -->
    <div class="abgleich">
      <div class="abgleich-sp">
        <div class="abgleich-l">Ursprünglich vereinbart</div>
        <div class="abgleich-t">${esc(a?.aufgabe) || '—'}</div>
      </div>
      <div class="abgleich-sp">
        <div class="abgleich-l">Tatsächlich dokumentiert</div>
        <div class="abgleich-t">${esc(a?.abschluss?.ergebnis) || '—'}</div>
      </div>
    </div>
    ${offen.length ? `
      <div class="hint-note">
        <strong>Nicht berechnet:</strong>
        <ul class="liste-offen">
          ${offen.map(o => `<li>${esc(o.text)}</li>`).join('')}
        </ul>
      </div>` : ''}

    ${abgleichHinweis(r)}

    <!-- Empfänger -->
    <div class="card">
      <div class="card-head"><div class="card-title">Rechnungsempfänger</div></div>
      <div class="card-body stapel">
        <div class="f">
          <label class="f-label" for="e-name">Kunde / Organisation</label>
          <input class="inp ${r.empfaenger.name ? '' : 'luecke'}" id="e-name" data-emp="name"
                 value="${esc(r.empfaenger.name)}">
        </div>
        <div class="fields">
          <div class="f">
            <label class="f-label" for="e-ap">Ansprechpartner <span class="opt">(optional)</span></label>
            <input class="inp" id="e-ap" data-emp="ansprechpartner" value="${esc(r.empfaenger.ansprechpartner)}">
          </div>
          <div class="f">
            <label class="f-label" for="e-mail">E-Mail</label>
            <input class="inp ${r.empfaenger.email ? '' : 'luecke'}" id="e-mail" type="email"
                   data-emp="email" value="${esc(r.empfaenger.email)}">
          </div>
        </div>
        <div class="f">
          <label class="f-label" for="e-ad">Adresse</label>
          <input class="inp" id="e-ad" data-emp="adresse" value="${esc(r.empfaenger.adresse)}">
        </div>
      </div>
    </div>

    <!-- Positionen -->
    <div>
      <div class="section-head erste">
        <div class="section-title">Positionen</div>
        <span class="section-hint">${s.luecken
          ? `${s.luecken} ${s.luecken === 1 ? 'Angabe fehlt' : 'Angaben fehlen'}`
          : 'vollständig'}</span>
      </div>
      <div class="pos-list">${r.positionen.map((p, i) => positionZeile(p, i)).join('')
        || '<div class="state-box">Keine Positionen. Die Dokumentation enthielt weder Zeit noch Material.</div>'}</div>
      <button class="btn btn-block pos-neu" data-pos-neu type="button">
        ${icon('plus')} Position hinzufügen
      </button>
    </div>

    <div class="summen" data-summen>${summenKoerper(r)}</div>`;
}

/**
 * Wurde nach dem Erstellen des Entwurfs noch dokumentiert?
 *
 * Der Entwurf wird bewusst nicht automatisch neu erzeugt — von Hand korrigierte
 * Positionen dürfen nicht überschrieben werden. Stattdessen wird der Unterschied
 * gezeigt und das Nachtragen angeboten.
 */
function abgleichHinweis(r) {
  const { nachgetragen, entfernt } = state.entwurfAbgleich(r);
  if (!nachgetragen.length && !entfernt.length) return '';

  return `
    <div class="abgleich-box" data-abgleich>
      <div class="abgleich-kopf">Dokumentation seit dem Entwurf geändert</div>
      ${nachgetragen.length ? `
        <div class="abgleich-teil">
          <div class="abgleich-l">Noch nicht in der Rechnung</div>
          <ul class="liste-offen">
            ${nachgetragen.map(v => `<li>${esc(beschreibeEintrag(v))}</li>`).join('')}
          </ul>
          <button class="btn btn-sm" data-nachtragen type="button">
            ${nachgetragen.length === 1 ? 'Position nachtragen' : `${nachgetragen.length} Positionen nachtragen`}
          </button>
        </div>` : ''}
      ${entfernt.length ? `
        <div class="abgleich-teil">
          <div class="abgleich-l">Grundlage entfällt</div>
          <div class="abgleich-t">${entfernt.length === 1 ? 'Eine Position beruht' : `${entfernt.length} Positionen beruhen`}
            auf Dokumentation, die inzwischen gelöscht wurde. Bitte prüfen.</div>
        </div>` : ''}
    </div>`;
}

const beschreibeEintrag = (v) =>
  v.typ === 'zeit'
    ? `${zahlZuFeld(v.stunden)} Std. — ${v.text || 'Arbeitszeit'}`
    : `${zahlZuFeld(v.menge) || '?'} ${v.einheit || ''} ${v.text || 'Material'}`.trim();

function positionZeile(p, i) {
  const fehlt = parseZahl(p.menge) === null || parseZahl(p.preis) === null || !p.text?.trim();
  const zeilensumme = (parseZahl(p.menge) !== null && parseZahl(p.preis) !== null)
    ? fmtEuro(parseZahl(p.menge) * parseZahl(p.preis))
    : null;

  return `
    <div class="pos ${fehlt ? 'hat-luecke' : ''}" data-pos="${p.id}">
      <div class="pos-top">
        <span class="pos-nr">${i + 1}</span>
        ${p.herkunft === 'dokumentiert' ? '<span class="pos-marke">Aus Dokumentation</span>' : ''}
        ${p.herkunft === 'manuell'      ? '<span class="pos-marke">Manuell ergänzt</span>' : ''}
        ${p.zusatz                       ? '<span class="pos-marke">Zusätzlich zur Anfrage</span>' : ''}
        ${p.preisIstBeispiel             ? '<span class="pos-marke">Beispielpreis</span>' : ''}
        <button class="icon-btn pos-del" data-pos-del="${p.id}" type="button"
                aria-label="Position entfernen">${icon('papierkorb')}</button>
      </div>

      <div class="f f-leistung">
        <label class="f-label" for="p-t-${p.id}">Leistung</label>
        <input class="inp ${p.text?.trim() ? '' : 'luecke'}" id="p-t-${p.id}"
               data-feld="text" placeholder="Was wurde geleistet?" value="${esc(p.text)}">
      </div>

      <div class="pos-grid">
        <div class="f">
          <label class="f-label" for="p-m-${p.id}">Menge</label>
          <input class="inp ${parseZahl(p.menge) === null ? 'luecke' : ''}" id="p-m-${p.id}"
                 data-feld="menge" inputmode="decimal" value="${esc(zahlZuFeld(p.menge))}">
        </div>
        <div class="f">
          <label class="f-label" for="p-e-${p.id}">Einheit</label>
          <input class="inp" id="p-e-${p.id}" data-feld="einheit" value="${esc(p.einheit)}">
        </div>
        <div class="f">
          <label class="f-label" for="p-p-${p.id}">Einzelpreis</label>
          <input class="inp ${parseZahl(p.preis) === null ? 'luecke' : ''}" id="p-p-${p.id}"
                 data-feld="preis" inputmode="decimal" placeholder="offen" value="${esc(zahlZuFeld(p.preis))}">
        </div>
        <div class="pos-sum ${zeilensumme ? '' : 'offen'}" data-zeilensumme>
          ${zeilensumme || 'Preis offen'}
        </div>
      </div>

      <label class="pos-zusatz">
        <input type="checkbox" data-feld="zusatz" ${p.zusatz ? 'checked' : ''}>
        Ging über die ursprüngliche Anfrage hinaus
      </label>
    </div>`;
}

function summenKoerper(r) {
  const s = state.summen(r);
  if (!s.vollstaendig) {
    return `
      <div class="sum-zeile"><span>Zwischensumme</span>
        <span class="sum-wert sum-offen">noch unvollständig</span></div>
      <div class="sum-zeile sum-erklaerung">
        <span>Solange Mengen oder Preise fehlen, wird bewusst kein Gesamtbetrag angezeigt.</span></div>`;
  }
  return `
    <div class="sum-zeile"><span>Netto</span><span class="sum-wert">${fmtEuro(s.netto)}</span></div>
    <div class="sum-zeile"><span>zzgl. ${r.ustSatz} % USt.</span><span class="sum-wert">${fmtEuro(s.ust)}</span></div>
    <div class="sum-zeile gesamt"><span>Gesamt</span><span class="sum-wert">${fmtEuro(s.brutto)}</span></div>`;
}

function editorBinden(el, api, rechnungId, danach) {
  const r = () => state.rechnung(rechnungId);

  /* Empfängerfelder — live in den State, ohne Neuzeichnen (Fokus bleibt). */
  el.querySelectorAll('[data-emp]').forEach(i => i.addEventListener('input', () => {
    const feld = i.dataset.emp;
    const wert = i.value;
    state.rechnungUpdate(rechnungId, { empfaenger: { ...r().empfaenger, [feld]: wert } });

    if (feld === 'email') {
      const leer = !wert.trim();
      feldFehler(i, leer ? '' : (istEmail(wert) ? '' : 'Keine gültige E-Mail-Adresse'));
      i.classList.toggle('luecke', leer);
    } else if (feld === 'name') {
      i.classList.toggle('luecke', !wert.trim());
    }
  }));

  /* Positionsfelder — ebenfalls live, Summen werden gezielt nachgezogen. */
  el.querySelectorAll('[data-pos]').forEach(box => {
    const posId = box.dataset.pos;

    box.querySelectorAll('[data-feld]').forEach(i => {
      const ereignis = i.type === 'checkbox' ? 'change' : 'input';
      i.addEventListener(ereignis, () => {
        const feld = i.dataset.feld;
        let wert;

        if (feld === 'zusatz') {
          wert = i.checked;
        } else if (feld === 'menge' || feld === 'preis') {
          // Ungültiges kommt nicht in den State — sonst stünde es in der Summe.
          // Der Rohtext bleibt im Feld stehen, damit Edin seinen Tippfehler sieht.
          const pruef = feld === 'menge' ? mengePruefen(i.value) : preisPruefen(i.value);
          feldFehler(i, pruef.hinweis);
          wert = pruef.status === 'ok' ? pruef.wert : null;
        } else {
          wert = i.value;
        }

        state.positionUpdate(rechnungId, posId, { [feld]: wert });
        zeileAktualisieren(box, state.rechnung(rechnungId).positionen.find(p => p.id === posId));
        el.querySelector('[data-summen]').innerHTML = summenKoerper(r());
        fussSummeAktualisieren(el, r());
      });
    });

    box.querySelector('[data-pos-del]').addEventListener('click', async () => {
      const ja = await bestaetigen({
        titel: 'Position entfernen',
        text: 'Diese Rechnungsposition wird gelöscht. Die Dokumentation im Auftrag bleibt unverändert.',
        jaText: 'Entfernen', warnend: true,
      });
      if (!ja) return;
      state.positionEntfernen(rechnungId, posId);
      api.render();
    });
  });

  el.querySelector('[data-nachtragen]')?.addEventListener('click', () => {
    const { nachgetragen } = state.entwurfAbgleich(r());
    const n = state.positionenNachtragen(rechnungId, nachgetragen.map(v => v.id));
    api.render();
    toast(n === 1 ? 'Position nachgetragen.' : `${n} Positionen nachgetragen.`);
  });

  el.querySelector('[data-pos-neu]')?.addEventListener('click', () => {
    state.positionHinzufuegen(rechnungId);
    api.render();
    // Direkt ins neue, leere Leistungsfeld springen.
    const felder = el.querySelectorAll('[data-feld="text"]');
    felder[felder.length - 1]?.focus();
  });

  el.querySelector('[data-vorschau]')?.addEventListener('click', () =>
    belegOeffnen(rechnungId, { ersetzen: false, danach }));

  el.querySelector('[data-versand]')?.addEventListener('click', () =>
    versandOeffnen(rechnungId, danach));
}

/**
 * Setzt oder entfernt eine Fehlermeldung direkt unter dem Eingabefeld.
 * Erklären, was falsch ist — nicht nur den Versandknopf sperren.
 */
function feldFehler(inputEl, text) {
  const huelle = inputEl.closest('.f');
  if (!huelle) return;
  let melder = huelle.querySelector('.f-fehler');

  if (!text) {
    melder?.remove();
    inputEl.classList.remove('ungueltig');
    inputEl.removeAttribute('aria-invalid');
    return;
  }
  if (!melder) {
    melder = document.createElement('div');
    melder.className = 'f-fehler';
    huelle.appendChild(melder);
  }
  melder.textContent = text;
  inputEl.classList.add('ungueltig');
  inputEl.setAttribute('aria-invalid', 'true');
}

/** Hält den Betrag in der Fußleiste aktuell, ohne das Sheet neu zu zeichnen. */
function fussSummeAktualisieren(el, r) {
  const ziel = el.querySelector('.foot-summe-wert');
  const label = el.querySelector('.foot-summe > span:first-child');
  if (!ziel) return;
  const s = state.summen(r);
  ziel.textContent = s.vollstaendig
    ? fmtEuro(s.brutto)
    : `${s.luecken} ${s.luecken === 1 ? 'Angabe fehlt' : 'Angaben fehlen'}`;
  ziel.classList.toggle('offen', !s.vollstaendig);
  if (label) {
    label.textContent = s.vollstaendig
      ? `Gesamt inkl. ${r.ustSatz} % USt.`
      : 'Gesamtbetrag steht noch nicht fest';
  }
}

/** Lücken-Markierung und Zeilensumme einer Position nachziehen, ohne neu zu zeichnen. */
function zeileAktualisieren(box, p) {
  if (!p) return;
  const m = parseZahl(p.menge), pr = parseZahl(p.preis);
  const fehlt = m === null || pr === null || !p.text?.trim();
  box.classList.toggle('hat-luecke', fehlt);

  const sum = box.querySelector('[data-zeilensumme]');
  if (m !== null && pr !== null) {
    sum.textContent = fmtEuro(m * pr);
    sum.classList.remove('offen');
  } else {
    sum.textContent = 'Preis offen';
    sum.classList.add('offen');
  }
}

/* ── Belegvorschau ───────────────────────── */

export function belegOeffnen(rechnungId, { ersetzen = false, danach } = {}) {
  const holen = () => state.rechnung(rechnungId);
  const r = holen();
  if (!r) return;

  const konfig = {
    titel: r.status === 'versendet' ? 'Rechnung (Demo-Versand)' : 'Rechnungsvorschau',
    body: () => belegKoerper(holen()),
    foot: () => holen().status === 'versendet'
      ? `<button class="btn btn-block" data-zu type="button">Schließen</button>`
      : `<button class="btn" data-zu type="button">Zurück zum Entwurf</button>
         <button class="btn btn-primaer" data-versand type="button">${icon('senden')} Versand simulieren</button>`,
    bind: (el) => {
      el.querySelector('[data-zu]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-versand]')?.addEventListener('click', () => versandOeffnen(rechnungId, danach));
    },
    onClose: () => danach?.(),
  };

  ersetzen ? sheetErsetzen(konfig) : sheetOeffnen(konfig);
}

/**
 * Woraus der Beleg gezeichnet wird.
 *
 * Ist die Rechnung versendet, kommt ALLES aus dem eingefrorenen Schnappschuss —
 * auch Aufgabentext und Leistungsdatum. Würde hier weiter live aus dem Auftrag
 * gelesen, änderte eine nachträgliche Auftragskorrektur rückwirkend eine bereits
 * herausgegebene Rechnung.
 */
function belegDaten(r) {
  if (r.beleg) return { ...r.beleg, eingefroren: true };

  const a = state.auftrag(r.auftragId);
  const s = state.summen(r);
  return {
    eingefroren: false,
    nummer: r.nummer, datum: r.datum, ustSatz: r.ustSatz,
    empfaenger: r.empfaenger,
    positionen: r.positionen,
    summen: { netto: s.netto, ust: s.ust, brutto: s.brutto },
    vollstaendig: s.vollstaendig,
    auftragAufgabe: a?.aufgabe ?? '',
    auftragErgebnis: a?.abschluss?.ergebnis ?? '',
    leistungsdatum: a?.termin ?? null,
    offenePunkte: a ? state.offenePunkte(a).map(o => o.text) : [],
  };
}

function belegKoerper(r) {
  const b = belegDaten(r);
  const versendet = state.istVersendet(r);
  const vollstaendig = b.eingefroren ? true : b.vollstaendig;

  return `
    ${versendet
      ? hinweisBox('Simuliert versendet. Es wurde keine E-Mail geöffnet und nichts verschickt. '
        + 'Dieser Beleg ist festgeschrieben und ändert sich nicht mehr, auch nicht durch spätere '
        + 'Korrekturen am Auftrag.')
      : hinweisBox('Beispielbeleg. Absenderdaten, Rechnungsnummer und Preise sind erfunden. '
        + 'Keine Verbindung zu sevDesk oder einer vorhandenen Vorlage.')}

    <div class="beleg">
      <div class="beleg-kopf">
        <div class="beleg-abs">
          <strong>${esc(ABSENDER.firma)}</strong>
          ${esc(ABSENDER.inhaber)}<br>
          ${esc(ABSENDER.adresse)}<br>
          ${esc(ABSENDER.kontakt)}
        </div>
        <div class="beleg-meta">
          Rechnungsnr. <strong class="mono">${esc(b.nummer)}</strong><br>
          Datum ${esc(fmtDatum(parseTermin(b.datum)))}<br>
          ${b.leistungsdatum ? `Leistungsdatum ${esc(fmtDatum(parseTermin(b.leistungsdatum)))}` : ''}
        </div>
      </div>

      <div class="beleg-an">
        ${esc(b.empfaenger.name) || '<span class="fehlt-hinweis">Kunde fehlt</span>'}<br>
        ${b.empfaenger.ansprechpartner ? esc(b.empfaenger.ansprechpartner) + '<br>' : ''}
        ${esc(b.empfaenger.adresse)}
      </div>

      <div class="beleg-titel">Rechnung</div>

      ${b.auftragAufgabe ? `
        <div class="beleg-auftrag">
          <span class="beleg-auftrag-l">Auftrag:</span> ${esc(b.auftragAufgabe)}
        </div>` : ''}

      <table class="beleg-tab">
        <thead><tr>
          <th>Leistung</th><th class="r">Menge</th><th class="r">Einzel</th><th class="r">Summe</th>
        </tr></thead>
        <tbody>
          ${b.positionen.map(p => {
            const m = mengePruefen(p.menge), pr = preisPruefen(p.preis);
            const ok = m.status === 'ok' && pr.status === 'ok';
            return `<tr>
              <td>${esc(p.text) || '<span class="fehlt-hinweis">ohne Beschreibung</span>'}
                ${p.zusatz ? '<br><span class="beleg-zusatz">zusätzlich zur Anfrage</span>' : ''}</td>
              <td class="r">${m.status === 'ok' ? esc(zahlZuFeld(m.wert)) + ' ' + esc(p.einheit || '') : '—'}</td>
              <td class="r">${pr.status === 'ok' ? esc(fmtEuro(pr.wert)) : '<span class="fehlt-hinweis">offen</span>'}</td>
              <td class="r">${ok ? esc(fmtEuro(m.wert * pr.wert)) : '—'}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="4" class="fehlt-hinweis">Keine Positionen</td></tr>'}
        </tbody>
      </table>

      <div class="beleg-sum summen">
        <div class="sum-zeile"><span>Netto</span><span class="sum-wert">${fmtEuro(b.summen.netto)}</span></div>
        <div class="sum-zeile"><span>zzgl. ${b.ustSatz} % USt.</span><span class="sum-wert">${fmtEuro(b.summen.ust)}</span></div>
        <div class="sum-zeile gesamt"><span>Gesamt</span><span class="sum-wert">${fmtEuro(b.summen.brutto)}</span></div>
      </div>

      <div class="beleg-fuss">
        ${esc(ABSENDER.steuernr)}<br>
        Zahlbar innerhalb von 14 Tagen ohne Abzug.${vollstaendig ? '' : ' Entwurf — noch nicht vollständig.'}<br>
        <em>Beispielbeleg aus einer Demo. Keine gültige Rechnung.</em>
      </div>
    </div>`;
}

/* ── Simulierter Versand ─────────────────── */

/** Sagt genau, was fehlt oder unzulässig ist — statt den Knopf still zu sperren. */
function hindernisseZeigen(hindernisse) {
  sheetOeffnen({
    titel: 'Noch nicht versandbereit',
    body: () => `
      <div class="state-box error">
        <strong>Bitte zuerst korrigieren:</strong>
        <ul class="liste-offen">${hindernisse.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
      </div>
      <div class="hint-note">Solange Angaben fehlen oder unzulässig sind, bleibt der
        Demo-Versand gesperrt. Eine Rechnung mit negativer Menge oder ungültiger
        Adresse würde in der Praxis niemand herausgeben.</div>`,
    foot: () => `<button class="btn btn-primaer btn-block" data-zu type="button">Zurück zum Entwurf</button>`,
    bind: (el) => el.querySelector('[data-zu]').addEventListener('click', sheetSchliessen),
  });
}


function versandOeffnen(rechnungId, danach) {
  const r = state.rechnung(rechnungId);
  if (!r) return;

  const hindernisse = state.versandHindernisse(r);

  if (hindernisse.length) { hindernisseZeigen(hindernisse); return; }

  const s = state.summen(r);
  const betreff = `Rechnung ${r.nummer} — ${ABSENDER.firma}`;
  const nachricht =
    `Guten Tag${r.empfaenger.ansprechpartner ? ' ' + r.empfaenger.ansprechpartner : ''},\n\n`
    + `anbei die Rechnung ${r.nummer} über ${fmtEuro(s.brutto)} für die ausgeführten Arbeiten.\n\n`
    + `Mit freundlichen Grüßen\n${ABSENDER.inhaber}\n${ABSENDER.firma}`;

  sheetOeffnen({
    titel: 'Versand simulieren',
    body: () => `
      ${hinweisBox('Nichts wird verschickt: Es öffnet sich kein E-Mail-Programm, '
        + 'es geht keine Nachricht raus. Die Bestätigung setzt nur den Status in dieser Demo.')}
      <div class="mail">
        <div class="mail-kopf">
          <div class="mail-z"><span class="mail-k">An</span><span class="mail-v">${esc(r.empfaenger.email)}</span></div>
          <div class="mail-z"><span class="mail-k">Betreff</span><span class="mail-v">${esc(betreff)}</span></div>
          <div class="mail-z"><span class="mail-k">Anhang</span><span class="mail-v">${esc(r.nummer)}.pdf (Beispiel)</span></div>
        </div>
        <div class="mail-body">${esc(nachricht)}</div>
      </div>
      <div class="summen">${summenKoerper(r)}</div>`,
    foot: () => `
      <button class="btn" data-ab type="button">Abbrechen</button>
      <button class="btn btn-primaer" data-ok type="button">${icon('check')} Demo-Versand bestätigen</button>`,
    bind: (el) => {
      el.querySelector('[data-ab]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-ok]').addEventListener('click', () => {
        // Zwischen dem Öffnen dieser Vorschau und dem Klick kann sich die
        // Rechnung geändert haben — deshalb prüft state hier noch einmal.
        const erg = state.versandSimulieren(rechnungId, { an: r.empfaenger.email, betreff, nachricht });
        if (!erg.ok) {
          sheetSchliessen();
          hindernisseZeigen(erg.hindernisse);
          return;
        }
        sheetSchliessen();
        // Der darunterliegende Entwurf ist jetzt Historie: durch den Beleg ersetzen.
        belegOeffnen(rechnungId, { ersetzen: true, danach });
        toast('Status: Versendet (Demo). Der Auftrag bleibt „Erledigt".');
      });
    },
  });
}
