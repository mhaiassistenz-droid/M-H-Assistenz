"use client";

import { HeroSection } from "@/components/sections/hero";
import { ProblemsSection } from "@/components/sections/problems";
import { FeaturesSection } from "@/components/sections/features";
import { ProcessSection } from "@/components/sections/process";
import { DemoChatSection } from "@/components/sections/demo-chat";
import { TestimonialsSection } from "@/components/sections/testimonials";
import { PricingSection } from "@/components/sections/pricing";
import { ContactFormSection } from "@/components/sections/contact-form";
import { Footer } from "@/components/layout/footer";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <ProblemsSection />
      <FeaturesSection />
      <ProcessSection />
      <DemoChatSection />
      <TestimonialsSection />
      <PricingSection />
      <ContactFormSection />
      <Footer />
    </main>
  );
}
