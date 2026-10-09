import { SESSION_KEY, QUESTIONS, INTRO, newSession, restoreSession, appendChat, isStop,
  isResume, isConfirmation, stopCases, resumeCase, confirmCase, applyModelResult,
  collectImprovement, mailPayload } from './session.mjs';

const N8N = 'https://n8n.mhassistenz.de/webhook';
const $ = selector => document.querySelector(selector);
let session;
let storageBroken = false;
let busy = false;
let sending = false;
let networkController = null;
let requestGeneration = 0;
let activeDictation = null;
let completed = false;
function report(text, type = '') { $('#status').textContent = text; $('#status').className = 'status ' + type; }
function storageError(text) {
  storageBroken = true;
  $('#storageError').textContent = text + ' Die Eingaben bleiben in dieser geöffneten Seite. Bitte nicht neu laden, bevor du sie abgesendet hast.';
  $('#storageError').classList.remove('hidden');
}
try { session = restoreSession(localStorage.getItem(SESSION_KEY)); }
catch (error) { session = newSession(); storageError(error.message || 'Der lokale Speicher ist nicht verfügbar.'); }
function save() {
  session.updatedAt = new Date().toISOString();
  if (storageBroken) return;
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  catch { storageError('Das Speichern auf diesem Gerät klappt gerade nicht.'); }
}

$('#intro').textContent = INTRO;
QUESTIONS.forEach((question, index) => {
  const q = document.createElement('div'); q.className = 'q'; q.dataset.nr = String(index + 1);
  const num = document.createElement('div'); num.className = 'q-num'; num.textContent = 'Frage ' + (index + 1);
  const label = document.createElement('label'); label.className = 'q-label'; label.textContent = question; label.htmlFor = 'frage-' + (index + 1);
  const textarea = document.createElement('textarea'); textarea.id = label.htmlFor;
  textarea.dataset.feld = String(index + 1); textarea.placeholder = 'Schreib oder sprich hier ruhig ausführlich …';
  textarea.value = session.answers[index + 1] || '';
  textarea.addEventListener('input', () => { session.answers[index + 1] = textarea.value; save(); progress(); });
  const tools = document.createElement('div'); tools.className = 'tools';
  q.append(num, label, textarea, tools); $('#fragen').appendChild(q);
});
$('#zusatz').value = session.extra;
$('#zusatz').addEventListener('input', () => { session.extra = $('#zusatz').value; save(); });
$('#chatText').value = session.chatInput;
$('#chatText').addEventListener('input', () => { session.chatInput = $('#chatText').value; save(); });
function progress() {
  const count = QUESTIONS.filter((_, index) => (session.answers[index + 1] || '').trim()).length;
  $('#bar').style.width = Math.max(3, Math.round(count / 5 * 100)) + '%';
  $('#barText').textContent = `${count} von 5 Fragen beantwortet`;
}
function bubble(role, content) {
  const item = document.createElement('div'); item.className = 'msg ' + role; item.textContent = content;
  $('#msgs').appendChild(item); $('#msgs').scrollTop = $('#msgs').scrollHeight;
}
function render() {
  $('#msgs').replaceChildren(); session.chat.forEach(message => bubble(message.role, message.content));
  $('#confirmCase').classList.toggle('hidden', session.phase !== 'confirm');
  $('#resumeCase').classList.toggle('hidden', session.phase !== 'requirement');
  $('#stopCases').classList.toggle('hidden', !['case', 'confirm', 'requirement'].includes(session.phase));
  $('#finishImprovements').classList.toggle('hidden', !['improvements', 'complete'].includes(session.phase));
  $('#retryMessage').classList.toggle('hidden', !session.pendingMessage || busy);
  $('#caseProgress').textContent = `${session.confirmedCases.length} von höchstens 7 Testfällen bestätigt`;
  $('#phaseText').textContent = ({ case: 'Einzelnen Testfall aufnehmen', confirm: 'Zusammenfassung prüfen und bestätigen',
    requirement: 'Eigene Anforderung festgehalten · Fallablauf pausiert', improvements: 'Weitere Verbesserungen sammeln',
    complete: 'Sammlung abgeschlossen · bereit zum Abschicken' })[session.phase];
  lockControls();
}
function lockControls() {
  document.querySelectorAll('textarea, .vorschlag, .mic, #confirmCase, #resumeCase, #finishImprovements, #retryMessage, #chatSenden, #btnSubmit').forEach(element => {
    element.disabled = sending || busy;
  });
  // Stopp bleibt während einer Modellantwort erreichbar und beendet diese lokal.
  $('#stopCases').disabled = sending;
  if (session.pendingMessage && !busy && !sending) {
    $('#chatSenden').disabled = true;
    $('#confirmCase').disabled = true;
    $('#resumeCase').disabled = true;
  }
}
const MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4"/></svg>';
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
function dictate(textarea, button, live) {
  if (sending || busy) return;
  if (activeDictation) { const same = activeDictation.button === button; activeDictation.stop(); if (same) return; }
  const recognition = new SpeechRecognition(); recognition.lang = 'de-DE'; recognition.continuous = true; recognition.interimResults = true;
  let running = true;
  const stop = () => {
    running = false; try { recognition.stop(); } catch { /* bereits beendet */ }
    button.classList.remove('an'); button.innerHTML = MIC + ' Diktieren'; live.textContent = ''; activeDictation = null;
  };
  recognition.onresult = event => {
    if (sending || busy || !running) return;
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        const previous = textarea.value.trimEnd(); textarea.value = (previous ? previous + ' ' : '') + transcript.trim();
        textarea.dispatchEvent(new Event('input'));
      } else interim += transcript;
    }
    live.textContent = interim ? '… ' + interim : '';
  };
  recognition.onerror = event => {
    stop();
    report(['not-allowed', 'service-not-allowed'].includes(event.error)
      ? 'Das Mikrofon ist nicht freigegeben. Bitte in den Browser-Einstellungen erlauben oder die Mikrofon-Taste der Tastatur nutzen.'
      : 'Diktieren ist gerade nicht verfügbar. Deine bisherige Eingabe bleibt erhalten.', 'err');
  };
  recognition.onend = () => { if (running) { try { recognition.start(); } catch { stop(); } } };
  try { recognition.start(); } catch { stop(); report('Diktieren konnte nicht starten.', 'err'); return; }
  button.classList.add('an'); button.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> Stopp';
  activeDictation = { button, stop };
}
document.querySelectorAll('.q, .chat-in').forEach(container => {
  if (!SpeechRecognition) return;
  const textarea = container.querySelector('textarea');
  const button = document.createElement('button'); button.type = 'button'; button.className = 'btn mic'; button.innerHTML = MIC + ' Diktieren';
  button.setAttribute('aria-label', 'Deutsch diktieren: ' + (textarea.id === 'chatText' ? 'Chat' : textarea.id === 'zusatz' ? 'Sonstiges' : 'Frage ' + textarea.dataset.feld));
  const live = document.createElement('div'); live.className = 'diktat-live'; live.setAttribute('aria-live', 'polite');
  button.addEventListener('click', () => dictate(textarea, button, live));
  (container.querySelector('.chat-tools') || container.querySelector('.tools')).appendChild(button);
  container.querySelector('.tools').after(live);
});
if (!SpeechRecognition) $('#speechHint').textContent = 'Dieser Browser bietet kein direktes Diktieren. Die Mikrofon-Taste deiner Tastatur kann weiterhin zur Spracheingabe verwendet werden.';
function haltNetwork() {
  requestGeneration++; networkController?.abort(); networkController = null; busy = false;
}
function stopAction() {
  if (sending) return;
  activeDictation?.stop(); haltNetwork(); appendChat(session, 'user', 'Stopp'); stopCases(session); save(); render();
}
async function modelRequest(text) {
  busy = true; render(); bubble('info', 'Assistent schreibt …');
  const generation = ++requestGeneration;
  const controller = new AbortController(); networkController = controller;
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(N8N + '/marco-fragebogen-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: controller.signal, body: JSON.stringify({ website: $('#website').value, session, message: text }) });
    const data = await response.json().catch(() => ({}));
    if (generation !== requestGeneration) return;
    if (!response.ok || !data.ok) throw new Error(data.fehler || 'Der Assistent antwortet gerade nicht.');
    applyModelResult(session, data.result, text); session.pendingMessage = null; save();
    report('Deine Eingaben werden auf diesem Gerät automatisch gespeichert.');
  } catch (error) {
    if (generation !== requestGeneration) return;
    report((error.name === 'AbortError' ? 'Die Antwort hat zu lange gedauert.' : error.message || 'Keine Verbindung.')
      + ' Deine Nachricht und der bisherige Stand bleiben erhalten. Nutze „Nachricht erneut senden“ oder beende die Fallaufnahme.', 'err');
    save();
  } finally {
    clearTimeout(timeout);
    if (generation === requestGeneration) { busy = false; networkController = null; render(); }
  }
}
async function sendChat(text) {
  text = String(text || '').trim();
  if (!text || busy || sending || session.pendingMessage) return;
  activeDictation?.stop();
  appendChat(session, 'user', text); session.chatInput = ''; $('#chatText').value = '';
  if (/\b(?:akute gefahr|feuer|gasgeruch|lebensgefahr|bewusstlos|schwer verletzt)\b/i.test(text)) {
    appendChat(session, 'assistant', 'Bei akuter Gefahr bitte unverzüglich 112 und gegebenenfalls den zuständigen Notdienst kontaktieren. Der Telefonassistent kann keinen Notruf auslösen oder eine Beauftragung zusagen.');
  }
  if (isStop(text)) {
    if (!stopCases(session)) collectImprovement(session, 'abschließen'); save(); render(); return;
  }
  if (session.phase === 'requirement' && isResume(text)) { resumeCase(session); save(); render(); return; }
  if (session.phase === 'confirm' && isConfirmation(text)) { confirmCase(session); save(); render(); return; }
  if (session.phase === 'requirement' && isConfirmation(text)) {
    appendChat(session, 'assistant', 'Die eigene Anforderung ist festgehalten. „Ja“ bestätigt hier keinen Testfall. Kehre mit „Zurück zum Fall“ zum Fallablauf zurück.'); save(); render(); return;
  }
  if (collectImprovement(session, text)) { save(); render(); return; }
  session.pendingMessage = { text, previousPhase: session.phase }; save(); await modelRequest(text);
}
$('#chatSenden').addEventListener('click', () => sendChat($('#chatText').value));
$('#chatText').addEventListener('keydown', event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); sendChat($('#chatText').value); } });
$('#confirmCase').addEventListener('click', () => {
  if (busy || sending || session.pendingMessage) return; appendChat(session, 'user', 'Diesen Fall bestätigen'); confirmCase(session); save(); render();
});
$('#stopCases').addEventListener('click', stopAction);
$('#resumeCase').addEventListener('click', () => {
  if (busy || sending || session.pendingMessage) return; appendChat(session, 'user', 'Zurück zum Fall'); resumeCase(session); save(); render();
});
$('#finishImprovements').addEventListener('click', () => sendChat('abschließen'));
$('#retryMessage').addEventListener('click', () => { if (!busy && !sending && session.pendingMessage) modelRequest(session.pendingMessage.text); });
document.querySelectorAll('.vorschlag').forEach(button => button.addEventListener('click', () => {
  $('#chatText').value = button.dataset.start; session.chatInput = button.dataset.start; save(); $('#chatText').focus();
}));
$('#btnSubmit').addEventListener('click', async () => {
  if (busy || sending || completed) return;
  activeDictation?.stop();
  if ($('#chatText').value.trim()) { report('Im Chatfeld steht noch eine ungesendete Nachricht. Sende sie bitte zuerst, damit sie vollständig erfasst wird.', 'err'); return; }
  let payload;
  try { payload = mailPayload(session); }
  catch (error) { report(error.message, 'err'); return; }
  sending = true; lockControls(); $('#btnSubmit').textContent = 'Wird geschickt …'; report('Antworten, vollständiger Chat und strukturierte Zusammenfassung werden gesendet.');
  const form = new FormData(); form.append('daten', JSON.stringify(payload)); form.append('website', $('#website').value);
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(N8N + '/marco-fragebogen-absenden', { method: 'POST', body: form, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.fehler || 'Das Abschicken hat nicht geklappt.');
    completed = true;
    try { localStorage.removeItem(SESSION_KEY); }
    catch { $('#resetWarning').textContent = 'Der Versand war erfolgreich, aber der lokale Speicher ließ sich nicht zurücksetzen. Bitte vor dem nächsten Test den Speicher für diesen Fragebogen leeren.'; }
    session = newSession(); $('#viewForm').classList.add('hidden'); $('#viewDone').classList.remove('hidden'); window.scrollTo({ top: 0 });
  } catch (error) {
    report((error.name === 'AbortError' ? 'Der Versand hat zu lange gedauert.' : error.message)
      + ' Alle Eingaben bleiben erhalten. Du kannst den Versand erneut versuchen.', 'err');
  } finally { clearTimeout(timeout); sending = false; $('#btnSubmit').textContent = 'Alles an Matthias abschicken'; if (!completed) lockControls(); }
});
$('#newSession').addEventListener('click', () => window.location.reload());
progress(); render(); save();
if (session.pendingMessage) report('Eine Chatnachricht wartet noch auf ihre Antwort. Dein Stand ist erhalten; du kannst sie erneut senden.', 'err');
