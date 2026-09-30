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
import * as flows from './flows.js';
import { freischaltenKnopf } from './freischalten.js';
import * as state from './state.js';
import { sheetOeffnen, sheetSchliessen, sheetErsetzen, bestaetigen, toast, badge, hinweisBox } from './ui.js';

/* Zwei getrennte Fragen. `echterDienst`: laeuft die Auswertung echt (Sprache, Foto,
   Aenderung per KI)? `versandEcht`: geht eine Rechnung wirklich an sevDesk? Das
   ist nur ueber den lokalen Proxy so — in der oeffentlichen Demo mit Zugangscode
   ist die KI echt, der Versand bleibt simuliert. Beides wird beim Laden einmal
   ermittelt; bis dahin gilt die vorsichtigere Annahme „Demo". Davon haengt nur die
   Beschriftung ab — was tatsaechlich passiert, entscheidet die Weiche in
   versandOeffnen(). */
let echterDienst = false;
let versandEcht = false;
flows.verfuegbar().then(ja => { echterDienst = ja; });
flows.versandEcht().then(ja => { versandEcht = ja; });

const VERSAND_LABEL = () => versandEcht ? 'Rechnung stellen' : 'Versand simulieren';

/* Fiktive Absenderdaten für die Belegvorschau. */
export const ABSENDER = {
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

  if (state.istVersendet(holen())) return belegOeffnen(rechnungId, { ersetzen: false, danach });

  const sheet = sheetOeffnen({
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
        <button class="btn btn-primaer" data-versand type="button">${icon('senden')} ${VERSAND_LABEL()}</button>`;
    },
    bind: (el, api) => editorBinden(el, api, rechnungId, danach),
    onClose: () => danach?.(),
  });

  beschriftungNachziehen(sheet);
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

    <ol class="workflow-path workflow-rechnung" aria-label="Ablauf für diesen Rechnungsentwurf">
      <li class="workflow-step is-done"><span class="workflow-dot"></span><span>Dokumentation</span></li>
      <li class="workflow-step is-active"><span class="workflow-dot"></span><span>Entwurf prüfen</span></li>
      <li class="workflow-step is-next"><span class="workflow-dot"></span><span>Versand bestätigen</span></li>
    </ol>

    <!-- Abgleich: was angefragt war vs. was dokumentiert wurde -->
    <div class="abgleich">
      <div class="abgleich-sp vereinbart">
        <div class="abgleich-l">Ursprünglich vereinbart</div>
        <div class="abgleich-t">${esc(a?.aufgabe) || '—'}</div>
      </div>
      <div class="abgleich-sp dokumentiert">
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
  const { nachgetragen, entfernt, kostenstelle } = state.entwurfAbgleich(r);
  if (!nachgetragen.length && !entfernt.length && !kostenstelle.length) return '';

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
      ${kostenstelle.length ? `
        <div class="abgleich-teil">
          <div class="abgleich-l">Kostenstelle in der Dokumentation geändert</div>
          <ul class="liste-offen">
            ${kostenstelle.map(k => `<li>${esc(k.text || 'Position')}: ${esc(k.alt || 'noch zuordnen')} → ${esc(k.neu || 'noch zuordnen')}</li>`).join('')}
          </ul>
          <button class="btn btn-sm" data-kst-abgleich type="button">Kostenstellen übernehmen</button>
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
        <button class="icon-btn pos-anweisung" data-pos-anweisung="${p.id}" type="button"
                aria-label="Preis per Anweisung ändern">${icon('funke')}</button>
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

      <div class="f pos-kst">
        <label class="f-label" for="p-k-${p.id}">Kostenstelle <span class="opt">(leer = noch zuordnen)</span></label>
        <input class="inp" id="p-k-${p.id}" data-feld="kostenstelle" placeholder="noch zuordnen" value="${esc(p.kostenstelle || '')}">
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
        } else if (feld === 'kostenstelle') {
          wert = state.kostenstelleNormal(i.value);
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

    box.querySelector('[data-pos-anweisung]').addEventListener('click', () => {
      const p = r().positionen.find(x => x.id === posId);
      if (p) anweisungDialog(rechnungId, p.id, () => {
        zeileAktualisieren(box, state.rechnung(rechnungId).positionen.find(x => x.id === posId));
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

  el.querySelector('[data-kst-abgleich]')?.addEventListener('click', () => {
    const n = state.kostenstellenAbgleichen(rechnungId);
    api.render();
    toast(n === 1 ? 'Kostenstelle übernommen.' : `${n} Kostenstellen übernommen.`);
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
 * Die Verfügbarkeitsprüfung ist asynchron und liegt beim ersten Rendern noch
 * nicht vor. Steht ein echter Dienst bereit, muss der Knopf aber sagen, dass
 * er wirklich versendet — sonst verspricht die Oberfläche eine Demo und
 * verschickt eine Rechnung.
 */
function beschriftungNachziehen(sheet) {
  Promise.all([flows.verfuegbar(), flows.versandEcht()]).then(([ki, versand]) => {
    if (!ki && !versand) return;
    echterDienst = ki;
    versandEcht = versand;
    sheet.render();
  });
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

/* ── Preiskorrektur per Anweisung ────────── */

/**
 * Edin gibt eine kurze Anweisung zu genau EINER Position ("die Dichtung war
 * teurer, mach 16 Euro rein"). Antwortet die Auswertung mit einer Zahl, ist
 * das ein Vorschlag, den Edin bestätigen muss — genau wie jede andere
 * Preisansage (Rang 5 der Preis-Rangfolge, `09-rechnung-sevdesk.md`).
 * Fehlt eine Zahl, fragt die KI aktiv danach, statt zu raten oder zu
 * blockieren (Fachregel 5).
 */
function anweisungDialog(rechnungId, positionId, aktualisieren) {
  let phase = 'eingabe';      // eingabe → wertetAus → vorschlag | frage
  let text = '';
  let frage = null;
  let vorschlag = null;
  let fehler = null;

  const position = () => state.rechnung(rechnungId)?.positionen.find(p => p.id === positionId);

  const sheet = sheetOeffnen({
    titel: 'Preis per Anweisung ändern',
    body: () => {
      const p = position();
      if (!p) return '';

      if (phase === 'wertetAus') {
        return `<div class="state-box">Wird ausgewertet …</div>`;
      }

      if (phase === 'vorschlag') {
        return `
          ${hinweisBox('<strong>Vorschlag aus Ihrer Anweisung.</strong> Noch nicht übernommen — bitte prüfen.', 'Vorschlag')}
          <div class="card">
            <div class="card-head"><div class="card-title">${esc(p.text) || 'Position'}</div></div>
            <div class="card-body stapel">
              <div class="sum-zeile"><span>Bisheriger Preis</span>
                <span class="sum-wert">${vorschlag.alterPreis !== null ? fmtEuro(vorschlag.alterPreis) : 'offen'}</span></div>
              <div class="sum-zeile gesamt"><span>Neuer Preis</span><span class="sum-wert">${fmtEuro(vorschlag.neuerPreis)}</span></div>
              ${vorschlag.begruendung ? `<div class="hint-note">${esc(vorschlag.begruendung)}</div>` : ''}
            </div>
          </div>`;
      }

      return `
        ${echterDienst
          ? hinweisBox('Der Text geht an die Auswertung. Nennen Sie eine konkrete Zahl oder einen Betrag — '
            + 'ohne Zahl fragt die KI nach, statt selbst einen Preis zu erfinden.', '')
          : hinweisBox('<strong>Simuliert.</strong> Ohne echten Dienst wird die Anweisung nur lokal nachgebildet.' + freischaltenKnopf())}
        ${frage ? `<div class="card"><div class="card-body zitat">„${esc(frage)}"</div></div>` : ''}
        ${fehler ? `<div class="state-box error">${esc(fehler)}</div>` : ''}
        <div class="f">
          <label class="f-label" for="pa-text">${frage ? 'Ihre Antwort' : 'Anweisung'}</label>
          <textarea class="inp" id="pa-text" rows="3"
            placeholder="z. B. „Die Dichtung war teurer, mach 16 Euro rein."">${esc(text)}</textarea>
        </div>`;
    },
    foot: () => {
      if (phase === 'wertetAus') return `<button class="btn btn-block" disabled type="button">Wird ausgewertet …</button>`;
      if (phase === 'vorschlag') return `
        <button class="btn" data-verwerfen type="button">Verwerfen</button>
        <button class="btn btn-primaer" data-uebernehmen type="button">Übernehmen</button>`;
      return `<button class="btn" data-abbrechen type="button">Abbrechen</button>
              <button class="btn btn-primaer" data-senden type="button">${icon('funke')} Senden</button>`;
    },
    bind: (el) => {
      el.querySelector('#pa-text')?.addEventListener('input', (e) => { text = e.target.value; });

      el.querySelector('[data-abbrechen]')?.addEventListener('click', sheetSchliessen);
      el.querySelector('[data-verwerfen]')?.addEventListener('click', () => {
        phase = 'eingabe'; vorschlag = null; frage = null; text = '';
        sheet.render();
      });

      el.querySelector('[data-uebernehmen]')?.addEventListener('click', () => {
        state.positionUpdate(rechnungId, positionId, {
          preis: vorschlag.neuerPreis,
          preisIstBeispiel: false,
        });
        sheetSchliessen();
        aktualisieren();
        toast('Preis übernommen.');
      });

      el.querySelector('[data-senden]')?.addEventListener('click', async () => {
        const anweisung = text.trim();
        if (!anweisung) return toast('Bitte eine Anweisung eingeben.');
        fehler = null;
        phase = 'wertetAus';
        sheet.render();

        const p = position();
        let antwort;
        if (echterDienst) {
          antwort = await flows.preisAnweisung({ anweisung, position: p });
        } else {
          // Demo ohne Dienst: einfache lokale Nachbildung, klar gekennzeichnet.
          const gefunden = anweisung.match(/(\d+(?:[.,]\d+)?)/);
          antwort = gefunden
            ? { ok: true, ergebnis: 'vorschlag', alterPreis: p.preis,
                neuerPreis: Number(gefunden[1].replace(',', '.')),
                begruendung: 'Simuliert: erste Zahl aus dem Text übernommen.' }
            : { ok: true, ergebnis: 'frage',
                frage: `(Simuliert) Um wie viel soll der Preis für „${p.text || 'diese Position'}" geändert werden?` };
        }

        if (!antwort.ok) {
          fehler = antwort.fehler || 'Die Auswertung ist fehlgeschlagen.';
          phase = 'eingabe'; text = anweisung;
          sheet.render();
          return;
        }
        if (antwort.ergebnis === 'frage') {
          frage = antwort.frage;
          phase = 'eingabe'; text = '';
          sheet.render();
          return;
        }
        vorschlag = antwort;
        phase = 'vorschlag';
        sheet.render();
      });
    },
  });
}

/* ── Belegvorschau ───────────────────────── */

export function belegOeffnen(rechnungId, { ersetzen = false, danach } = {}) {
  const holen = () => state.rechnung(rechnungId);
  const r = holen();
  if (!r) return;

  // Zustand des "Noch etwas ändern?"-Chats in der Vorschau — nur relevant,
  // solange nichts versendet ist. Lebt hier, nicht in belegKoerper(), weil
  // die Vorschau bei jedem render() neu gebaut wird und den Zustand sonst
  // verlöre.
  let korrPhase = 'eingabe';   // eingabe → wertetAus → vorschlag
  let korrText = '';
  let korrFrage = null;
  let korrVorschlag = null;
  let korrFehler = null;

  const konfig = {
    titel: state.istVersendet(r)
      ? (r.status === 'gestellt' ? 'Rechnung (versendet)' : 'Rechnung (Demo-Versand)')
      : 'Rechnungsvorschau',
    body: () => belegKoerper(holen(), state.istVersendet(holen()) ? null : {
      phase: korrPhase, text: korrText, frage: korrFrage, vorschlag: korrVorschlag, fehler: korrFehler,
    }),
    foot: () => {
      const akt = holen();
      if (!state.istVersendet(akt)) {
        return `<button class="btn" data-zu type="button">Zurück zum Entwurf</button>
         <button class="btn btn-primaer" data-versand type="button">${icon('senden')} ${VERSAND_LABEL()}</button>`;
      }
      // Der Beleg bleibt eingefroren — der Zahlungsvermerk steht daneben,
      // nicht darin, und ändert am herausgegebenen Beleg nichts.
      return `<button class="btn" data-zu type="button">Schließen</button>
         ${state.istBezahlt(akt)
           ? `<button class="btn" data-zahlung-weg type="button">Zahlung zurücknehmen</button>`
           : `<button class="btn btn-primaer" data-zahlung type="button">${icon('check')} Zahlung vermerken</button>`}`;
    },
    bind: (el, api) => {
      el.querySelector('[data-zu]').addEventListener('click', sheetSchliessen);
      el.querySelector('[data-versand]')?.addEventListener('click', () => versandOeffnen(rechnungId, danach));

      el.querySelector('#korr-text')?.addEventListener('input', (e) => { korrText = e.target.value; });

      el.querySelector('[data-korr-verwerfen]')?.addEventListener('click', () => {
        korrPhase = 'eingabe'; korrVorschlag = null; korrFrage = null; korrText = '';
        api.render();
      });

      el.querySelector('[data-korr-uebernehmen]')?.addEventListener('click', () => {
        const v = korrVorschlag;
        if (v.ziel === 'position') {
          const rechnung = holen();
          const pos = rechnung.positionen[v.positionIndex];
          if (pos) state.positionUpdate(rechnungId, pos.id, { [v.feld]: v.neuerWert, preisIstBeispiel: false });
        } else if (v.ziel === 'empfaenger') {
          state.rechnungUpdate(rechnungId, { empfaenger: { ...holen().empfaenger, [v.feld]: v.neuerWert } });
        }
        korrPhase = 'eingabe'; korrVorschlag = null; korrFrage = null; korrText = '';
        toast('Änderung übernommen.');
        api.render();
      });

      el.querySelector('[data-korr-senden]')?.addEventListener('click', async () => {
        const anweisung = korrText.trim();
        if (!anweisung) return toast('Bitte eine Anweisung eingeben.');
        korrFehler = null;
        korrPhase = 'wertetAus';
        api.render();

        const rechnung = holen();
        let antwort;
        if (echterDienst) {
          antwort = await flows.rechnungKorrektur({ anweisung, rechnung });
        } else {
          // Demo ohne Dienst: einfache lokale Nachbildung, klar gekennzeichnet.
          const treffer = rechnung.positionen
            .map((p, i) => ({ p, i, ueberlappt: anweisung.toLowerCase().includes((p.text || '').toLowerCase().slice(0, 6)) }))
            .find(x => x.ueberlappt) || (rechnung.positionen.length === 1 ? { p: rechnung.positionen[0], i: 0 } : null);
          const zahl = anweisung.match(/(\d+(?:[.,]\d+)?)/);
          antwort = (treffer && zahl)
            ? { ok: true, ergebnis: 'vorschlag', ziel: 'position', positionIndex: treffer.i, positionText: treffer.p.text,
                feld: 'preis', alterWert: treffer.p.preis, neuerWert: Number(zahl[1].replace(',', '.')),
                begruendung: 'Simuliert: erste Zahl aus dem Text übernommen.' }
            : { ok: true, ergebnis: 'frage',
                frage: '(Simuliert) Welche Position oder welcher Wert genau ist gemeint?' };
        }

        if (!antwort.ok) {
          korrFehler = antwort.fehler || 'Die Auswertung ist fehlgeschlagen.';
          korrPhase = 'eingabe'; korrText = anweisung;
          api.render();
          return;
        }
        if (antwort.ergebnis === 'frage') {
          korrFrage = antwort.frage;
          korrPhase = 'eingabe'; korrText = '';
          api.render();
          return;
        }
        korrVorschlag = antwort;
        korrPhase = 'vorschlag';
        api.render();
      });
      el.querySelector('[data-zahlung]')?.addEventListener('click', () => {
        const antwort = state.zahlungVermerken(rechnungId);
        if (!antwort.ok) return toast(antwort.grund);
        toast('Zahlungseingang vermerkt.');
        belegOeffnen(rechnungId, { ersetzen: true, danach });
      });
      el.querySelector('[data-zahlung-weg]')?.addEventListener('click', () => {
        state.zahlungZuruecknehmen(rechnungId);
        toast('Zahlungsvermerk entfernt.');
        belegOeffnen(rechnungId, { ersetzen: true, danach });
      });
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

function belegKoerper(r, korr) {
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
                ${p.kostenstelle ? `<br><span class="beleg-kst">Kostenstelle ${esc(p.kostenstelle)}</span>` : ''}
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

      ${state.istBezahlt(r) ? `<div class="beleg-zahlung">${icon('check')}
        Bezahlt am ${esc(fmtDatum(parseTermin(r.zahlung.am)))} · ${esc(fmtEuro(r.zahlung.betrag))}</div>` : ''}

      <div class="beleg-fuss">
        ${esc(ABSENDER.steuernr)}<br>
        Zahlbar innerhalb von 14 Tagen ohne Abzug.${vollstaendig ? '' : ' Entwurf — noch nicht vollständig.'}<br>
        <em>Beispielbeleg aus einer Demo. Keine gültige Rechnung.</em>
      </div>
    </div>

    ${korr ? korrekturBlock(korr) : ''}`;
}

/**
 * "Noch etwas ändern?" — freier Chat direkt in der Vorschau, nur solange
 * nichts versendet ist. Bezieht sich auf die ganze Rechnung (jede Position,
 * Empfängerdaten), nicht nur eine — anders als der Anweisungs-Knopf an der
 * einzelnen Position im Entwurf, der bewusst enger bleibt.
 */
function korrekturBlock(korr) {
  if (korr.phase === 'wertetAus') {
    return `<div class="card korr-block"><div class="state-box">Wird ausgewertet …</div></div>`;
  }

  if (korr.phase === 'vorschlag') {
    const v = korr.vorschlag;
    const ziel = v.ziel === 'position' ? esc(v.positionText) : 'Empfänger · ' + esc(FELD_LABEL[v.feld] || v.feld);
    const fmt = (x) => (v.feld === 'preis' || v.feld === 'menge') && typeof x === 'number' ? zahlZuFeld(x) : esc(x);
    return `
      <div class="card korr-block">
        <div class="card-head"><div class="card-title">${icon('funke')} Vorschlag: ${ziel}</div></div>
        <div class="card-body stapel">
          <div class="sum-zeile"><span>Bisher</span><span class="sum-wert">${v.alterWert !== null && v.alterWert !== undefined ? fmt(v.alterWert) : '—'}</span></div>
          <div class="sum-zeile gesamt"><span>Neu</span><span class="sum-wert">${fmt(v.neuerWert)}</span></div>
          ${v.begruendung ? `<div class="hint-note">${esc(v.begruendung)}</div>` : ''}
          <div class="korr-aktionen">
            <button class="btn" data-korr-verwerfen type="button">Verwerfen</button>
            <button class="btn btn-primaer" data-korr-uebernehmen type="button">Übernehmen</button>
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="card korr-block">
      <div class="card-head"><div class="card-title">Noch etwas ändern?</div></div>
      <div class="card-body stapel">
        ${korr.frage ? `<div class="hinweis"><span>${esc(korr.frage)}</span></div>` : ''}
        ${korr.fehler ? `<div class="state-box error">${esc(korr.fehler)}</div>` : ''}
        <div class="korr-eingabe">
          <input class="inp" id="korr-text" placeholder="z. B. „Der Dichtungssatz war teurer, mach 16 Euro rein."" value="${esc(korr.text)}">
          <button class="btn btn-primaer" data-korr-senden type="button">${icon('funke')} Senden</button>
        </div>
      </div>
    </div>`;
}

const FELD_LABEL = { preis: 'Preis', menge: 'Menge', einheit: 'Einheit', text: 'Text',
  name: 'Name', adresse: 'Adresse', email: 'E-Mail', ansprechpartner: 'Ansprechpartner' };

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
        ${versandEcht ? 'Versand' : 'Demo-Versand'} gesperrt. Eine Rechnung mit negativer
        Menge oder ungültiger Adresse würde in der Praxis niemand herausgeben.</div>`,
    foot: () => `<button class="btn btn-primaer btn-block" data-zu type="button">Zurück zum Entwurf</button>`,
    bind: (el) => el.querySelector('[data-zu]').addEventListener('click', sheetSchliessen),
  });
}


/**
 * Rechnung wirklich stellen: in sevDesk anlegen und per E-Mail versenden.
 *
 * Drei Zustände sind möglich, und alle drei werden unterschieden:
 *   versendet   — Rechnung liegt im Dienst und ist beim Empfänger
 *   erstellt    — Rechnung liegt im Dienst, Versand ist gescheitert
 *   gar nichts  — Übergabe abgelehnt, nichts wurde angelegt
 *
 * Der mittlere Fall ist der wichtige: die Rechnung existiert dann wirklich.
 * Ein zweiter Versuch darf keine zweite erzeugen, sondern muss den Versand
 * nachholen — dafür sorgt die Referenz im Dienst.
 */
function rechnungStellenOeffnen(rechnungId, danach) {
  const r = state.rechnung(rechnungId);
  if (!r) return;

  const hindernisse = state.versandHindernisse(r);
  if (hindernisse.length) { hindernisseZeigen(hindernisse); return; }

  const a = state.auftrag(r.auftragId);
  const s = state.summen(r);

  // Beispieladressen enden auf .example. Die darf niemand anschreiben, also
  // wird das Feld in dem Fall leer gelassen statt stillschweigend gefüllt.
  const kundenMail = (r.empfaenger.email || '').trim();
  const istBeispiel = /\.example$/i.test(kundenMail);

  let empfaenger = istBeispiel ? '' : kundenMail;
  let phase = 'bereit';        // bereit → laeuft → fehler
  let ergebnis = null;

  const betreff = `Rechnung ${ABSENDER.firma} — ${a?.aufgabe ? a.aufgabe.slice(0, 60) : 'Arbeiten'}`;
  const nachricht =
    `Guten Tag${r.empfaenger.ansprechpartner ? ' ' + r.empfaenger.ansprechpartner : ''},\n\n`
    + `anbei die Rechnung über ${fmtEuro(s.brutto)} für die ausgeführten Arbeiten.\n\n`
    + `Mit freundlichen Grüßen\n${ABSENDER.inhaber}\n${ABSENDER.firma}`;

  const sheet = sheetOeffnen({
    titel: 'Rechnung stellen',
    body: () => {
      if (phase === 'laeuft') {
        return `<div class="state-box">Rechnung wird gestellt …
          <div class="state-hint">Kunde anlegen oder finden, Rechnung erzeugen, versenden.
            Das dauert ein paar Sekunden.</div>
        </div>`;
      }

      if (phase === 'fehler' && ergebnis) {
        const erstellt = ergebnis.zustand === 'erstellt';
        return `
          <div class="state-box error">
            <strong>${esc(ergebnis.fehler || 'Die Rechnung konnte nicht gestellt werden.')}</strong>
            ${ergebnis.punkte?.length
              ? `<ul class="liste-offen">${ergebnis.punkte.map(pt => `<li>${esc(pt)}</li>`).join('')}</ul>`
              : ''}
            ${ergebnis.hinweis ? `<div class="state-hint">${esc(ergebnis.hinweis)}</div>` : ''}
          </div>
          ${erstellt ? `<div class="hint-note"><strong>Wichtig:</strong> Die Rechnung liegt bereits
            im Rechnungsdienst. Ein erneuter Versuch versendet sie nur — es entsteht
            keine zweite Rechnung.</div>` : ''}`;
      }

      return `
        ${hinweisBox('Die Rechnung wird wirklich im Rechnungsdienst angelegt und per E-Mail '
          + 'versendet. Danach ist der Beleg festgeschrieben und nicht mehr änderbar.', '')}
        ${istBeispiel ? `<div class="state-box">Die hinterlegte Adresse „${esc(kundenMail)}" ist
          eine Beispieladresse und wird nicht angeschrieben.
          <div class="state-hint">Bitte eine echte Empfängeradresse eintragen.</div></div>` : ''}
        <div class="f">
          <label class="f-label" for="vm">Rechnung senden an</label>
          <input class="inp" id="vm" type="email" inputmode="email"
                 value="${esc(empfaenger)}" placeholder="name@firma.de">
        </div>
        <div class="mail">
          <div class="mail-kopf">
            <div class="mail-z"><span class="mail-k">Betreff</span><span class="mail-v">${esc(betreff)}</span></div>
          </div>
          <div class="mail-body">${esc(nachricht)}</div>
        </div>
        <div class="summen">${summenKoerper(r)}</div>`;
    },
    foot: () => {
      if (phase === 'laeuft') return `<button class="btn btn-block" disabled type="button">Wird gestellt …</button>`;
      if (phase === 'fehler') return `
        <button class="btn" data-zu type="button">Schließen</button>
        <button class="btn btn-primaer" data-nochmal type="button">Nochmal versuchen</button>`;
      return `
        <button class="btn" data-ab type="button">Abbrechen</button>
        <button class="btn btn-primaer" data-ok type="button">${icon('check')} Rechnung stellen</button>`;
    },
    bind: (el) => {
      el.querySelector('[data-ab]')?.addEventListener('click', sheetSchliessen);
      el.querySelector('[data-zu]')?.addEventListener('click', sheetSchliessen);

      const stellen = async () => {
        const feld = el.querySelector('#vm');
        if (feld) empfaenger = feld.value.trim();

        if (!istEmail(empfaenger)) {
          toast('Bitte eine gültige Empfängeradresse eintragen.');
          return;
        }

        phase = 'laeuft';
        sheet.render();

        const antwort = await flows.rechnungUebergeben({
          rechnung: state.rechnung(rechnungId),
          auftrag: state.auftrag(r.auftragId),
          versandAn: empfaenger,
          betreff,
          nachricht,
        });

        // Die Rechnung liegt im Dienst, der Versand ging schief: das wird
        // festgehalten, damit ein zweiter Versuch nichts doppelt anlegt.
        if (!antwort.ok && antwort.zustand === 'erstellt') {
          state.rechnungErstelltVermerken(rechnungId, antwort);
        }

        if (!antwort.ok) {
          ergebnis = antwort;
          phase = 'fehler';
          sheet.render();
          return;
        }

        const erg = state.rechnungGestellt(rechnungId, antwort);
        if (!erg.ok) {
          ergebnis = { fehler: erg.grund };
          phase = 'fehler';
          sheet.render();
          return;
        }

        sheetSchliessen();
        belegOeffnen(rechnungId, { ersetzen: true, danach });
        toast(antwort.nummer
          ? `Rechnung ${antwort.nummer} versendet. Der Auftrag bleibt „Erledigt".`
          : 'Rechnung versendet. Der Auftrag bleibt „Erledigt".');
      };

      el.querySelector('[data-ok]')?.addEventListener('click', stellen);
      el.querySelector('[data-nochmal]')?.addEventListener('click', () => {
        phase = 'bereit';
        ergebnis = null;
        sheet.render();
      });
    },
  });
}

/**
 * Weiche zwischen Demo-Versand und echtem Rechnungsversand.
 *
 * Ohne Rechnungsdienst bleibt alles wie bisher — die öffentliche Demo darf
 * sich nicht ändern. Steht einer bereit, geht die Rechnung wirklich hinaus.
 */
async function versandOeffnen(rechnungId, danach) {
  if (await flows.versandEcht()) return rechnungStellenOeffnen(rechnungId, danach);
  return demoVersandOeffnen(rechnungId, danach);
}

function demoVersandOeffnen(rechnungId, danach) {
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
