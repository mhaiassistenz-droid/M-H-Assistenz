import { AnimatedTestimonials } from "@/components/blocks/animated-testimonials";
import type { Testimonial } from "@/components/blocks/animated-testimonials";

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Thomas M.",
    role: "Geschäftsführer",
    company: "Handwerksbetrieb",
    content: "Durch die Automatisierung spare ich täglich 2 Stunden. Die Einrichtung war unkompliziert und das Ergebnis übertrifft meine Erwartungen.",
    rating: 5,
    avatar: "",
  },
  {
    id: 2,
    name: "Sandra K.",
    role: "Inhaberin",
    company: "Beratungsagentur",
    content: "Neue Anfragen werden jetzt automatisch erfasst und bearbeitet. Kein einziger Lead geht mehr verloren — das ist unbezahlbar.",
    rating: 5,
    avatar: "",
  },
  {
    id: 3,
    name: "Markus R.",
    role: "Selbstständiger",
    company: "IT-Dienstleister",
    content: "Ich hätte nicht gedacht, dass die Einrichtung so schnell geht. Innerhalb von 14 Tagen lief alles automatisch — genau wie versprochen.",
    rating: 5,
    avatar: "",
  },
];

export function TestimonialsSection() {
  return (
    <section id="referenzen" className="py-24 border-t" style={{ background: '#f9f8f5', borderColor: '#ebebeb' }}>
      <AnimatedTestimonials
        title="Was Kunden sagen."
        subtitle="Echte Ergebnisse aus dem Fallstudie-Programm — keine Hochglanzversprechen."
        badgeText="Kundenstimmen"
        testimonials={testimonials}
      />
    </section>
  );
}
