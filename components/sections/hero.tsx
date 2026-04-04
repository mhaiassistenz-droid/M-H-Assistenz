"use client";

import { BeamsBackground } from "@/components/ui/beams-background";
import { AnimatedWordCycle } from "@/components/ui/animated-word-cycle";

const rotatingWords = ["Voice Agents", "Automatisierungen", "RAG-Systeme", "KI-Assistenten"];

export function HeroSection() {
  return (
    <BeamsBackground className="min-h-screen flex items-center justify-center" intensity="medium">
      <div className="text-center max-w-3xl mx-auto px-6 py-20">
        <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase mb-8 px-4 py-2 rounded-full border"
          style={{ color: '#9a7f3c', background: '#faf8f2', borderColor: '#e2d5b0' }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#9a7f3c' }} />
          Kostenloses Fallstudie-Programm · 7 Plätze
        </div>

        <h1 className="text-5xl md:text-7xl font-light leading-tight mb-6 text-gray-900"
          style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          Wir bauen dir{" "}
          <span style={{ color: '#9a7f3c' }}>
            <AnimatedWordCycle words={rotatingWords} className="italic" />
          </span>
        </h1>

        <p className="text-lg text-gray-600 max-w-xl mx-auto mb-4 leading-relaxed">
          Du verbringst zu viel Zeit mit Aufgaben, die sich täglich wiederholen?
          Wir lösen das — maßgeschneidert, einsatzbereit in wenigen Tagen.{" "}
          <strong>Komplett kostenlos.</strong>
        </p>

        <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm text-gray-500">
          <span className="flex items-center gap-2">✓ Kostenlos — ohne Haken</span>
          <span className="flex items-center gap-2">✓ Kein Risiko — du entscheidest nach 14 Tagen</span>
          <span className="flex items-center gap-2">✓ Keine Technik-Kenntnisse nötig</span>
        </div>

        <a
          href="#formular"
          className="inline-block text-white font-semibold px-8 py-4 rounded-xl text-sm tracking-wide shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #9a7f3c, #7d6530)' }}
        >
          Kostenlos bewerben →
        </a>

        {/* Social Proof Numbers */}
        <div className="mt-16 flex items-stretch justify-center gap-px rounded-2xl overflow-hidden border max-w-md mx-auto"
          style={{ borderColor: '#e2d5b0', background: '#e2d5b0' }}>
          {[
            { val: "7", label: "Plätze verfügbar" },
            { val: "14", label: "Tage bis Go-Live" },
            { val: "0€", label: "Einrichtungskosten" },
          ].map((item) => (
            <div key={item.val} className="flex-1 text-center py-5 px-3" style={{ background: '#ffffff' }}>
              <div className="text-2xl font-light mb-1" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif', color: '#9a7f3c' }}>
                {item.val}
              </div>
              <div className="text-xs text-gray-400 leading-tight">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </BeamsBackground>
  );
}
