import RadialOrbitalTimeline from "@/components/ui/radial-orbital-timeline";
import { ClipboardList, Search, Wrench, Rocket, Star, ArrowRight } from "lucide-react";
import type { ComponentType } from "react";

// TimelineItem interface requires: id, title, date, content, category, icon (React.ElementType), relatedIds, status, energy
const steps = [
  {
    id: 1,
    title: "Formular ausfüllen",
    date: "Schritt 1",
    content: "Du gibst uns Einblick in deinen Betrieb — dauert ca. 5 Minuten.",
    category: "Start",
    icon: ClipboardList as ComponentType,
    relatedIds: [2],
    status: "completed" as const,
    energy: 80,
  },
  {
    id: 2,
    title: "Analyse & Planung",
    date: "Schritt 2",
    content: "Wir analysieren deine größten Zeitfresser und planen die maßgeschneiderte Lösung.",
    category: "Analyse",
    icon: Search as ComponentType,
    relatedIds: [1, 3],
    status: "completed" as const,
    energy: 90,
  },
  {
    id: 3,
    title: "Umsetzung",
    date: "Schritt 3",
    content: "Wir bauen und testen die Automatisierung — du musst nichts tun, außer erreichbar sein.",
    category: "Entwicklung",
    icon: Wrench as ComponentType,
    relatedIds: [2, 4],
    status: "in-progress" as const,
    energy: 95,
  },
  {
    id: 4,
    title: "Live nach 14 Tagen",
    date: "Schritt 4",
    content: "Dein System läuft. Du siehst die ersten Ergebnisse direkt in der Praxis.",
    category: "Launch",
    icon: Rocket as ComponentType,
    relatedIds: [3, 5],
    status: "pending" as const,
    energy: 100,
  },
  {
    id: 5,
    title: "Deine Bewertung",
    date: "Schritt 5",
    content: "Wir fragen, wie es läuft — und passen an, wenn nötig. Dein Feedback ist die Gegenleistung.",
    category: "Feedback",
    icon: Star as ComponentType,
    relatedIds: [4, 6],
    status: "pending" as const,
    energy: 70,
  },
  {
    id: 6,
    title: "Wie geht's weiter?",
    date: "Schritt 6",
    content: "Falls du zufrieden bist, sprechen wir über eine langfristige Zusammenarbeit — ohne Druck.",
    category: "Ausblick",
    icon: ArrowRight as ComponentType,
    relatedIds: [5],
    status: "pending" as const,
    energy: 60,
  },
];

export function ProcessSection() {
  return (
    <section id="prozess" className="py-24 border-t" style={{ background: '#f9f8f5', borderColor: '#ebebeb' }}>
      <div className="text-center mb-4 px-6">
        <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#9a7f3c' }}>Wie es funktioniert</div>
        <h2 className="text-4xl md:text-5xl font-light leading-tight" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          Transparent.{" "}
          <em style={{ color: '#9a7f3c' }}>Ohne Überraschungen.</em>
        </h2>
      </div>
      <RadialOrbitalTimeline timelineData={steps} />
    </section>
  );
}
