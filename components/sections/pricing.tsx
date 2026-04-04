"use client";

import { motion } from "framer-motion";

// Visually inspired by squishy-pricing, adapted for M&H Assistenz
const BGGold = () => (
  <motion.svg
    width="320" height="384" viewBox="0 0 320 384" fill="none"
    variants={{ hover: { scale: 1.5 } }}
    transition={{ duration: 1, ease: "backInOut" }}
    className="absolute inset-0 z-0"
  >
    <motion.circle
      variants={{ hover: { scaleY: 0.5, y: -25 } }}
      transition={{ duration: 1, ease: "backInOut", delay: 0.2 }}
      cx="160.5" cy="114.5" r="101.5"
      fill="rgba(255,255,255,0.12)"
    />
    <motion.ellipse
      variants={{ hover: { scaleY: 2.25, y: -25 } }}
      transition={{ duration: 1, ease: "backInOut", delay: 0.2 }}
      cx="160.5" cy="265.5" rx="101.5" ry="43.5"
      fill="rgba(255,255,255,0.10)"
    />
  </motion.svg>
);

const BGNeutral = () => (
  <motion.svg
    width="320" height="384" viewBox="0 0 320 384" fill="none"
    variants={{ hover: { scale: 1.05 } }}
    transition={{ duration: 1, ease: "backInOut" }}
    className="absolute inset-0 z-0"
  >
    <motion.rect x="14" width="153" height="153" rx="15" fill="rgba(0,0,0,0.06)"
      variants={{ hover: { y: 219, rotate: "90deg", scaleX: 2 } }}
      style={{ y: 12 }}
      transition={{ delay: 0.2, duration: 1, ease: "backInOut" }}
    />
    <motion.rect x="155" width="153" height="153" rx="15" fill="rgba(0,0,0,0.06)"
      variants={{ hover: { y: 12, rotate: "90deg", scaleX: 2 } }}
      style={{ y: 219 }}
      transition={{ delay: 0.2, duration: 1, ease: "backInOut" }}
    />
  </motion.svg>
);

interface PricingCardProps {
  label: string;
  price: string;
  priceNote: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  background: string;
  BGComponent: React.ComponentType;
}

function PricingCard({ label, price, priceNote, description, features, cta, ctaHref, background, BGComponent }: PricingCardProps) {
  return (
    <motion.div
      whileHover="hover"
      transition={{ duration: 1, ease: "backInOut" }}
      variants={{ hover: { scale: 1.04 } }}
      className="relative w-80 shrink-0 overflow-hidden rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow"
      style={{ minHeight: '420px', background }}
    >
      <div className="relative z-10 text-white h-full flex flex-col">
        <span className="mb-3 block w-fit rounded-full bg-white/20 backdrop-blur-sm px-3 py-0.5 text-sm font-medium border border-white/20">
          {label}
        </span>
        <motion.div
          initial={{ scale: 0.9 }}
          variants={{ hover: { scale: 1 } }}
          transition={{ duration: 1, ease: "backInOut" }}
          className="my-2 origin-top-left"
        >
          <span className="font-mono text-6xl font-black leading-none">{price}</span>
          <span className="block text-sm text-white/70 mt-1">{priceNote}</span>
        </motion.div>
        <p className="text-base text-white/90 mb-4 leading-relaxed">{description}</p>
        <ul className="space-y-2 mb-6 flex-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-white/85">
              <span className="text-white/60">✓</span> {f}
            </li>
          ))}
        </ul>
      </div>
      <a href={ctaHref}>
        <button className="absolute bottom-4 left-4 right-4 z-20 rounded-lg border-2 border-white bg-white py-2 text-center font-mono font-black uppercase text-neutral-800 transition-all duration-200 hover:bg-white/10 hover:text-white hover:border-white/80">
          {cta}
        </button>
      </a>
      <BGComponent />
    </motion.div>
  );
}

export function PricingSection() {
  return (
    <section id="preise" className="py-24 max-w-4xl mx-auto px-6">
      <div className="text-center mb-16">
        <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#9a7f3c' }}>Transparente Kosten</div>
        <h2 className="text-4xl md:text-5xl font-light leading-tight" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          Einrichtung kostenlos — du zahlst nur,{" "}
          <em style={{ color: '#9a7f3c' }}>wenn die KI arbeitet.</em>
        </h2>
        <p className="mt-4 text-gray-500 text-sm max-w-md mx-auto">
          Wir verdienen an Umsetzungs- und Wartungsleistungen, nicht an der KI selbst.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-6">
        <PricingCard
          label="Fallstudie"
          price="0 €"
          priceNote="Einrichtung · komplett kostenlos"
          description="Vollständige KI-Automatisierung für dein Unternehmen — ohne Kosten, ohne Verpflichtung."
          features={[
            "Persönliche Analyse deiner Prozesse",
            "Maßgeschneiderte Automatisierung",
            "14 Tage Live-Test",
            "Persönliche Begleitung",
            "Nur 7 Plätze verfügbar",
          ]}
          cta="Jetzt bewerben"
          ctaHref="#formular"
          background="linear-gradient(135deg, #9a7f3c, #7d6530)"
          BGComponent={BGGold}
        />
        <PricingCard
          label="Danach"
          price="API"
          priceNote="typisch 3–15 € / Monat"
          description="Nach dem Test zahlst du nur die tatsächlichen KI-Kosten — transparent, keine Überraschungen."
          features={[
            "0,001–0,01 € pro Nachricht",
            "Keine monatliche Grundgebühr",
            "Du kontrollierst die Nutzung",
            "Wartung auf Anfrage",
            "Keine Bindung",
          ]}
          cta="Mehr erfahren"
          ctaHref="#formular"
          background="linear-gradient(135deg, #4b5563, #374151)"
          BGComponent={BGNeutral}
        />
      </div>
    </section>
  );
}
