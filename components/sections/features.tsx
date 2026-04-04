import { BentoGrid } from "@/components/ui/bento-grid";
import type { BentoItem } from "@/components/ui/bento-grid";
import { Clock, Shield, Zap, Target } from "lucide-react";

const items: BentoItem[] = [
  {
    title: "Stunden zurückgewinnen",
    description: "Routineaufgaben erledigen sich von selbst. Durchschnittlich 8 Stunden pro Woche zurückgewonnen — Zeit die dir wieder gehört.",
    icon: <Clock className="w-5 h-5" style={{ color: '#9a7f3c' }} />,
    status: "8h/Woche gespart",
    colSpan: 2,
  },
  {
    title: "Weniger Fehler",
    description: "Automatisierte Prozesse machen dieselbe Aufgabe jedes Mal gleich — und richtig. Keine Flüchtigkeitsfehler mehr.",
    icon: <Shield className="w-5 h-5" style={{ color: '#9a7f3c' }} />,
    status: "Zuverlässig",
  },
  {
    title: "Schneller als die Konkurrenz",
    description: "Neue Anfragen werden in Sekunden bearbeitet, nicht Stunden. Kein Lead geht mehr verloren.",
    icon: <Zap className="w-5 h-5" style={{ color: '#9a7f3c' }} />,
    status: "< 60 Sekunden",
  },
  {
    title: "Mehr Fokus auf Wesentliches",
    description: "Dein Kopf gehört dem Wachstum — nicht der Verwaltung. Konzentriere dich auf das, was wirklich zählt.",
    icon: <Target className="w-5 h-5" style={{ color: '#9a7f3c' }} />,
    status: "Mehr Freiheit",
    colSpan: 2,
  },
];

export function FeaturesSection() {
  return (
    <section id="leistungen" className="max-w-4xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#9a7f3c' }}>Was du davon hast</div>
        <h2 className="text-4xl md:text-5xl font-light leading-tight" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          Deine Aufgaben.{" "}
          <em style={{ color: '#9a7f3c' }}>Erledigt. Automatisch.</em>
        </h2>
        <p className="mt-4 text-gray-500 text-sm max-w-md mx-auto">Kein Technik-Gerede. Konkrete Probleme, konkrete Ergebnisse — messbar, nicht versprochen.</p>
      </div>
      <BentoGrid items={items} />
    </section>
  );
}
