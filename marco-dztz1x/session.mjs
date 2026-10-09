export const SESSION_KEY = 'marco-hausverwaltung-fragebogen-v1';
export const QUESTIONS = [
  'Bei welchem Anbieter liegt die Hausverwaltungsnummer?',
  'Welche Anliegen treten bei euch grundsätzlich am häufigsten auf?',
  'Welche Informationen müssen bei jedem Anruf im Dashboard stehen?',
  'Welche Fälle sind dringend und wie sollen sie markiert oder behandelt werden?',
  'Was darf der Assistent niemals zusagen, beantworten oder eigenständig auslösen?',
];
export const INTRO = 'Hier kannst du den Telefonassistenten für die 2Hands Hausverwaltung in einer Sandbox ausprobieren.\nEr nimmt nicht angenommene Anrufe auf, erfasst Rückrufnummer, Name, Adresse und Anliegen und legt den Vorgang im Dashboard für dich ab.\nEr kann zum Beispiel Schadensmeldungen, Rückrufbitten sowie Terminwünsche oder Änderungswünsche für Termine aufnehmen.\nIm Dashboard entscheidest du, was weiter bearbeitet, freigegeben oder als Termin übernommen wird; der Assistent macht selbst keine verbindlichen Zusagen.\nSpäter kann die Lösung – sofern Nummer und Anbieter es zulassen – um einen WhatsApp-Agenten ergänzt werden, der auf derselben Wissensbasis definierte Fragen beantwortet und Nachrichten strukturiert aufnimmt.';
export const FIRST_QUESTION = 'Beschreibe mir bitte den ersten typischen Anruf.';
export const IMPROVEMENT_QUESTION = 'Welche weiteren Verbesserungen wünschst du dir für den Telefonassistenten und das Dashboard?';
const PHASES = ['case', 'confirm', 'requirement', 'improvements', 'complete'];
const STRING_FIELDS = ['category', 'description', 'urgency'];
const LIST_FIELDS = ['follow_up_questions', 'required_fields', 'forbidden_promises', 'open_points'];
export function newSession(id = globalThis.crypto.randomUUID()) {
  return { version: 1, id, answers: {}, extra: '', chat: [{ role: 'assistant', content: FIRST_QUESTION }],
    confirmedCases: [], draft: null, phase: 'case', requirements: [], improvements: [],
    pausedPhase: null, followUpCount: 0, chatInput: '', pendingMessage: null, updatedAt: new Date().toISOString() };
}
export function restoreSession(raw) {
  if (!raw) return newSession();
  const value = JSON.parse(raw);
  if (value.version !== 1 || typeof value.id !== 'string' || !PHASES.includes(value.phase)
      || !Array.isArray(value.chat) || !Array.isArray(value.confirmedCases)
      || value.confirmedCases.length > 7 || !Array.isArray(value.requirements)
      || !Array.isArray(value.improvements) || !value.answers || typeof value.answers !== 'object') {
    throw new Error('Der gespeicherte Fragebogen kann nicht gelesen werden. Bitte den Fehler vor dem Weitermachen klären; die gespeicherten Daten bleiben erhalten.');
  }
  return { ...newSession(value.id), ...value };
}
export function appendChat(session, role, content) {
  session.chat.push({ role, content: String(content) });
  session.updatedAt = new Date().toISOString();
}
export function isStop(text) {
  return /^(?:bitte\s+)?(?:stopp?|reicht(?:\s+(?:mir|jetzt|erstmal|für heute))?|das reicht(?:\s+(?:mir|jetzt|erstmal|erst mal|für heute))?|genug(?:\s+für heute)?|fertig(?:\s+mit\s+(?:den\s+)?fällen)?|keine weiteren (?:test)?fälle|wir hören auf|lass uns aufhören|beenden|abbrechen)[.!\s]*$/i.test(text.trim());
}
export function isResume(text) {
  return /^(?:weiter|zurück|zurück zum (?:fall|fallablauf)|weiter mit (?:dem )?fall|zurück zum vorherigen fall)[.!\s]*$/i.test(text.trim());
}
export function isConfirmation(text) {
  return /^(?:ja|ja,?\s*(?:passt|genau|bestätigt)|passt|genau|bestätigt|bestätigen|so stimmt(?: es)?|das stimmt|richtig|ok(?:ay)?)[.!\s]*$/i.test(text.trim());
}
export function stopCases(session) {
  if (session.phase === 'complete' || session.phase === 'improvements') return false;
  session.phase = 'improvements'; session.pausedPhase = null; session.pendingMessage = null;
  appendChat(session, 'assistant', 'Die Fallaufnahme ist beendet. Unbestätigte Angaben bleiben als offener Entwurf erhalten.\n\n' + IMPROVEMENT_QUESTION);
  return true;
}
export function resumeCase(session) {
  if (session.phase !== 'requirement' || !session.pausedPhase) return false;
  session.phase = session.pausedPhase; session.pausedPhase = null;
  appendChat(session, 'assistant', session.phase === 'confirm'
    ? 'Wir kehren zum bisherigen Fall zurück. Bitte prüfe die Zusammenfassung und bestätige diesen Fall ausdrücklich.'
    : 'Wir kehren zum bisherigen Fall zurück. Ergänze bitte die noch fehlenden Angaben für diesen Testfall.');
  return true;
}
export function caseText(draft, number, confirmed = false) {
  return `Fall ${number}${confirmed ? ' – bestätigt' : ' – bitte bestätigen'}\nKategorie / Anliegen: ${draft.category || 'Offen'}\nBeispielbeschreibung: ${draft.description || 'Offen'}\nZusätzlich nötige Rückfragen: ${(draft.follow_up_questions || []).join('; ') || 'Keine'}\nPflichtangaben: ${(draft.required_fields || []).join('; ') || 'Keine zusätzlichen Angaben'}\nDringlichkeit und Eskalation: ${draft.urgency || 'Offen'}\nTerminwunsch: ${draft.appointment}\nVerbotene Zusagen: ${(draft.forbidden_promises || []).join('; ') || 'Keine verbindlichen Aussagen, Beauftragungen oder Zusagen'}\nOffene Regel oder Verbesserungsidee: ${(draft.open_points || []).join('; ') || 'Keine'}`;
}
export function confirmCase(session) {
  if (session.phase !== 'confirm' || !session.draft || session.confirmedCases.length >= 7) return false;
  session.confirmedCases.push({ ...structuredClone(session.draft), number: session.confirmedCases.length + 1, confirmed: true });
  session.draft = null; session.pausedPhase = null; session.followUpCount = 0;
  if (session.confirmedCases.length === 7) {
    session.phase = 'improvements';
    appendChat(session, 'assistant', 'Alle sieben Testfälle sind bestätigt.\n\n' + IMPROVEMENT_QUESTION);
  } else {
    session.phase = 'case';
    appendChat(session, 'assistant', `Fall ${session.confirmedCases.length} ist bestätigt. Beschreibe mir bitte den nächsten typischen Anruf (Fall ${session.confirmedCases.length + 1} von 7).`);
  }
  return true;
}
function mergeDraft(previous, incoming) {
  if (!incoming || typeof incoming !== 'object') throw new Error('Die Antwort enthält keinen strukturierten Testfall.');
  const draft = previous ? structuredClone(previous) : { appointment: 'nein' };
  for (const field of STRING_FIELDS) {
    if (typeof incoming[field] === 'string') draft[field] = incoming[field].trim();
    else if (!draft[field]) draft[field] = '';
  }
  for (const field of LIST_FIELDS) {
    if (Array.isArray(incoming[field]) && incoming[field].every(item => typeof item === 'string')) draft[field] = incoming[field];
    else if (!draft[field]) draft[field] = [];
  }
  if (incoming.appointment !== undefined) {
    if (!['nein', 'aufnehmen und Freigabe erforderlich'].includes(incoming.appointment)) throw new Error('Ungültiger Terminstatus in der Antwort.');
    draft.appointment = incoming.appointment;
  }
  if (!draft.urgency) draft.urgency = 'Offen – Dringlichkeit und Eskalation mit Marco klären';
  return draft;
}
export function applyModelResult(session, result, userText) {
  if (!result || !['case', 'requirement', 'improvement'].includes(result.type)) throw new Error('Die Antwort des Assistenten ist unvollständig.');
  if (result.type === 'requirement' || session.phase === 'requirement') {
    const requirement = typeof result.requirement === 'string' && result.requirement.trim() ? result.requirement.trim() : userText;
    session.requirements.push(requirement);
    if (session.phase !== 'requirement') session.pausedPhase = session.phase;
    session.phase = 'requirement';
    appendChat(session, 'assistant', `Ich halte das als eigene Anforderung fest: ${requirement}\n\nMit „Zurück zum Fall“ kannst du den bisherigen Fallablauf fortsetzen.`);
    return;
  }
  if (session.phase === 'improvements' || session.phase === 'complete' || result.type === 'improvement') {
    session.improvements.push(result.requirement || userText); session.phase = 'improvements';
    appendChat(session, 'assistant', 'Ich halte das als Verbesserungswunsch fest. Ergänze weitere Wünsche oder schließe die Sammlung ab.');
    return;
  }
  if (session.confirmedCases.length >= 7) throw new Error('Es können höchstens sieben Fälle aufgenommen werden.');
  const draft = mergeDraft(session.draft, result.draft);
  if (result.question !== null && (typeof result.question !== 'string' || !result.question.trim())) throw new Error('Die Rückfrage des Assistenten fehlt.');
  if (result.question === null && (!draft.category || !draft.description || !draft.urgency)) throw new Error('Der Testfall ist noch unvollständig.');
  session.draft = draft;
  if (result.question && (session.followUpCount || 0) >= 3) {
    draft.open_points.push('Offene Rückfrage: ' + result.question);
    result = { ...result, question: null };
  }
  if (result.question) {
    session.followUpCount = (session.followUpCount || 0) + 1;
    session.phase = 'case'; appendChat(session, 'assistant', result.question);
  } else {
    session.phase = 'confirm';
    appendChat(session, 'assistant', caseText(draft, session.confirmedCases.length + 1) + '\n\nStimmt das so? Bestätige den Fall oder ergänze eine Korrektur.');
  }
}
export function collectImprovement(session, text) {
  if (session.phase !== 'improvements' && session.phase !== 'complete') return false;
  if (/^(?:nein|keine weiteren (?:verbesserungen|wünsche)|fertig|abschließen|das war alles|mehr nicht)[.!\s]*$/i.test(text.trim())) {
    session.phase = 'complete'; appendChat(session, 'assistant', 'Die Sammlung ist abgeschlossen. Du kannst jetzt alle Antworten, bestätigten Fälle, offenen Punkte und den vollständigen Chat an Matthias abschicken.');
  } else {
    session.improvements.push(text); session.phase = 'improvements';
    appendChat(session, 'assistant', 'Ich halte das als Verbesserungswunsch fest. Hast du noch weitere Wünsche? Mit „Sammlung abschließen“ kannst du anschließend alles absenden.');
  }
  return true;
}
export function mailPayload(session) {
  if (!['improvements', 'complete'].includes(session.phase)) throw new Error('Bitte den aktuellen Fall bestätigen oder die Fallaufnahme mit „Stopp“ beenden.');
  if (session.pendingMessage) throw new Error('Bitte zuerst die ausstehende Chatnachricht erneut senden oder die Fallaufnahme beenden.');
  return { name: 'Marco', fragen: QUESTIONS.map((frage, index) => ({ nr: index + 1, titel: frage, frage,
    antwort: session.answers[index + 1] || '', dateien: [] })), zusatz: session.extra || '',
    chat: structuredClone(session.chat), session: structuredClone(session) };
}
