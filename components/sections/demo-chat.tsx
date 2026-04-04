"use client";

import { AnimatedAIChat } from "@/components/ui/animated-ai-chat";

export function DemoChatSection() {
  return (
    <section className="py-24 max-w-4xl mx-auto px-6">
      <div className="text-center mb-16">
        <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#9a7f3c' }}>Live Demo</div>
        <h2 className="text-4xl md:text-5xl font-light leading-tight" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          Frag unseren{" "}
          <em style={{ color: '#9a7f3c' }}>KI-Assistenten.</em>
        </h2>
        <p className="mt-4 text-gray-500 text-sm max-w-md mx-auto">
          Stell eine Frage zu unseren Leistungen — direkt hier, live, ohne Anmeldung.
        </p>
      </div>
      <AnimatedAIChat />
    </section>
  );
}
