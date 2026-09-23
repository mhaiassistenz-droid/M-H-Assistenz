/* ============================================
   seed.js — fiktive Startdaten für die Demo

   Alle Kunden, Adressen, Kontakte und Preise sind frei erfunden.
   E-Mail-Domains bewusst auf .example, damit nichts versehentlich
   an eine echte Adresse gehen kann. Keine Angaben zu betreuten
   Personen — nur Objekte, Technik und Außenanlagen.

   Termine werden relativ zu "heute" erzeugt, damit die Demo an
   jedem Tag sinnvoll aussieht.
   ============================================ */

import { uid, tagKey } from './util.js';

/** Tagesversatz + Uhrzeit → '2026-09-22T14:00' */
function tag(versatz, uhr) {
  const d = new Date();
  d.setDate(d.getDate() + versatz);
  return `${tagKey(d)}T${uhr}`;
}

/** Zeitstempel für Verlaufseinträge (Tagesversatz + Uhrzeit). */
function ts(versatz, uhr) { return tag(versatz, uhr); }

export function seedAuftraege() {
  return [
    {
      id: 'a-lindner',
      kunde: 'Hausverwaltung Lindner GmbH',
      ansprechpartner: 'Frau Brandt',
      email: 'brandt@lindner-hv.example',
      telefon: '0228 5550188',
      adresse: 'Rheinallee 14, 53173 Bonn',
      aufgabe: 'Tropfender Wasserhahn in der Waschküche im Keller abdichten. Zugang über Hausmeisterschlüssel.',
      termin: tag(0, '14:00'),
      status: 'geplant',
      erfasstUeber: 'manuell',
      anhaenge: [],
      verlauf: [],
      abschluss: null,
      rechnungId: null,
      angelegtAm: ts(-3, '18:20'),
    },
    {
      id: 'a-sonnenhang',
      kunde: 'Wohnpark Sonnenhang GbR',
      ansprechpartner: 'Herr Özdemir',
      email: 'verwaltung@sonnenhang-gbr.example',
      telefon: '0228 5550942',
      adresse: 'Am Sonnenhang 3–9, 53119 Bonn',
      aufgabe: 'Laub auf Gehwegen und Tiefgaragenzufahrt beseitigen, Regenrinnen der Carports prüfen.',
      termin: tag(1, '08:30'),
      status: 'geplant',
      erfasstUeber: 'foto',
      anhaenge: [],
      verlauf: [],
      abschluss: null,
      rechnungId: null,
      angelegtAm: ts(-2, '09:05'),
    },
    {
      id: 'a-kastanien',
      kunde: 'Bürohaus Kastanienallee 7 KG',
      ansprechpartner: 'Herr Vogt',
      email: 'objekt@kastanienallee7.example',
      telefon: '0228 5550377',
      adresse: 'Kastanienallee 7, 53175 Bonn',
      aufgabe: 'Heizungsverteiler im Technikraum prüfen, Druck kontrollieren und bei Bedarf entlüften.',
      termin: tag(0, '09:00'),
      status: 'inarbeit',
      erfasstUeber: 'manuell',
      anhaenge: [],
      verlauf: [
        {
          id: uid('v'), typ: 'notiz', ts: ts(0, '09:12'), simuliert: false,
          text: 'Druck stand bei 0,9 bar. Anlage nachgefüllt auf 1,6 bar.',
        },
        {
          // Mitgeliefertes Beispielbild (leere weiße Fläche). Selbst aufgenommene
          // Fotos landen in IndexedDB und überstehen Reload und Browser-Neustart.
          id: uid('v'), typ: 'foto', ts: ts(0, '09:14'), simuliert: false,
          text: 'Manometer nach dem Nachfüllen',
          fotoName: 'manometer.jpg', fotoUrl: 'bilder/beispiel-foto.png',
        },
        {
          id: uid('v'), typ: 'zeit', ts: ts(0, '09:40'), simuliert: false,
          text: 'Prüfen und Nachfüllen', stunden: 0.75,
        },
        {
          id: uid('v'), typ: 'offen', ts: ts(0, '09:42'), simuliert: false,
          text: 'Entlüftungsventil im 2. OG sitzt fest — Spezialschlüssel nötig, beim nächsten Termin.',
        },
      ],
      abschluss: null,
      rechnungId: null,
      angelegtAm: ts(-5, '16:40'),
    },
    {
      id: 'a-bergstrasse',
      kunde: 'Praxisgemeinschaft Bergstraße',
      ansprechpartner: 'Frau Keller',
      email: 'buero@praxis-bergstrasse.example',
      telefon: '0228 5550214',
      adresse: 'Bergstraße 42, 53225 Bonn',
      aufgabe: 'Undichtes Waschbecken im Personalraum reparieren, Dichtung erneuern.',
      termin: tag(-2, '10:00'),
      status: 'erledigt',
      erfasstUeber: 'sprache',
      anhaenge: [],
      verlauf: [
        {
          id: uid('v'), typ: 'sprache', ts: ts(-2, '11:35'), simuliert: true,
          text: 'Dichtung getauscht, eineinhalb Stunden gearbeitet. Eine weitere Stelle ist noch offen.',
          transkript: 'Dichtung getauscht, eineinhalb Stunden gearbeitet. Eine weitere Stelle ist noch offen.',
        },
        {
          id: uid('v'), typ: 'notiz', ts: ts(-2, '11:36'), simuliert: true,
          text: 'Dichtung am Waschbecken im Personalraum getauscht.',
        },
        {
          id: 'v-berg-zeit', typ: 'zeit', ts: ts(-2, '11:36'), simuliert: true,
          text: 'Dichtung tauschen', stunden: 1.5,
        },
        {
          id: 'v-berg-material', typ: 'material', ts: ts(-2, '11:36'), simuliert: false,
          text: 'Dichtungssatz Standard', menge: 1, einheit: 'Stück', lieferant: '',
        },
        {
          id: uid('v'), typ: 'offen', ts: ts(-2, '11:37'), simuliert: true,
          text: 'Eine weitere undichte Stelle am Eckventil ist noch offen.',
        },
      ],
      abschluss: {
        am: ts(-2, '11:40'),
        ergebnis: 'Dichtung am Waschbecken erneuert, Anschluss dicht.',
        offenePunkte: ['Eine weitere undichte Stelle am Eckventil ist noch offen.'],
      },
      rechnungId: 'r-bergstrasse',
      angelegtAm: ts(-6, '19:10'),
    },
  ];
}

export function seedRechnungen() {
  return [
    {
      id: 'r-bergstrasse',
      auftragId: 'a-bergstrasse',
      nummer: 'E-2026-0041',
      datum: tag(-1, '09:00'),
      status: 'entwurf',
      empfaenger: {
        name: 'Praxisgemeinschaft Bergstraße',
        ansprechpartner: 'Frau Keller',
        email: 'buero@praxis-bergstrasse.example',
        adresse: 'Bergstraße 42, 53225 Bonn',
      },
      positionen: [
        {
          id: uid('p'), text: 'Dichtung tauschen (Arbeitszeit)',
          menge: 1.5, einheit: 'Std.', preis: 58,
          herkunft: 'dokumentiert', quelleEintragId: 'v-berg-zeit', zusatz: false,
        },
        {
          // Bewusst ohne Preis: zeigt, wie fehlende Werte markiert werden.
          id: uid('p'), text: 'Dichtungssatz Standard',
          menge: 1, einheit: 'Stück', preis: null,
          herkunft: 'dokumentiert', quelleEintragId: 'v-berg-material', zusatz: false,
        },
      ],
      ustSatz: 19,
      versand: null,
      erstelltAm: tag(-1, '09:00'),
    },
  ];
}
