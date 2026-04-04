"use client";

import { useState } from "react";

const WEBHOOK = "https://n8n.srv1419118.hstgr.cloud/webhook/customform";
const TOTAL_STEPS = 8;

export function ContactFormSection() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, string>>({});

  function update(key: string, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setSubmitted(true);
    } catch {
      alert("Fehler beim Senden. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  const progress = Math.round((step / TOTAL_STEPS) * 100);

  if (submitted) {
    return (
      <section id="formular" className="py-24 max-w-2xl mx-auto px-6 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border-2"
          style={{ background: '#f0faf4', borderColor: '#b7e4c7' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1f7a4a" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 className="text-3xl font-light mb-3" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          Anfrage erfolgreich gesendet!
        </h2>
        <p className="text-gray-500">Wir melden uns innerhalb von 3 Werktagen persönlich bei dir — per E-Mail.</p>
        <p className="text-xs text-gray-400 mt-2">Du erhältst außerdem eine Bestätigung per E-Mail.</p>
      </section>
    );
  }

  const fieldClass = "border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-1 transition-colors"
    + " focus:ring-amber-400 border-gray-200 bg-white";
  const textareaClass = fieldClass + " min-h-[80px] resize-none";

  return (
    <section id="formular" className="py-24 max-w-2xl mx-auto px-6">
      <div className="text-center mb-12">
        <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#9a7f3c' }}>Kostenlos starten</div>
        <h2 className="text-4xl font-light leading-tight" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          Bewirb dich für das{" "}
          <em style={{ color: '#9a7f3c' }}>Fallstudie-Programm.</em>
        </h2>
      </div>

      <div className="border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-6 text-white" style={{ background: 'linear-gradient(135deg, #9a7f3c, #7d6530)' }}>
          <div className="text-lg font-medium" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            Kostenlose Fallstudie beantragen
          </div>
          <div className="text-xs mt-1" style={{ opacity: 0.75 }}>ca. 5 Minuten · vertraulich · kein Risiko · kein Vertrag</div>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#e2d5b0' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: '#9a7f3c' }} />
          </div>
          <span className="text-xs font-semibold" style={{ color: '#9a7f3c' }}>{progress} %</span>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {step === 0 && (
            <>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Schritt 1 von 8 – Grunddaten</h3>
              <div className="grid grid-cols-2 gap-3">
                <input className={fieldClass} placeholder="Vollständiger Name *" onChange={(e) => update("name", e.target.value)} defaultValue={data.name} />
                <input className={fieldClass} placeholder="Telefon *" onChange={(e) => update("phone", e.target.value)} defaultValue={data.phone} />
              </div>
              <input className={fieldClass} placeholder="E-Mail *" type="email" onChange={(e) => update("email", e.target.value)} defaultValue={data.email} />
              <div className="grid grid-cols-2 gap-3">
                <input className={fieldClass} placeholder="Firmenname *" onChange={(e) => update("company", e.target.value)} defaultValue={data.company} />
                <input className={fieldClass} placeholder="Branche *" onChange={(e) => update("industry", e.target.value)} defaultValue={data.industry} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select className={fieldClass + " text-gray-500"} onChange={(e) => update("team_size", e.target.value)} defaultValue={data.team_size || ""}>
                  <option value="" disabled>Teamgröße</option>
                  <option>Nur ich</option><option>2–5</option><option>6–20</option><option>21–50</option><option>50+</option>
                </select>
                <input className={fieldClass} placeholder="Website (optional)" onChange={(e) => update("website", e.target.value)} defaultValue={data.website} />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Schritt 2 von 8 – Dein Geschäft</h3>
              <textarea className={textareaClass} placeholder="Was bietest du an und wer kauft es?" onChange={(e) => update("product", e.target.value)} defaultValue={data.product} />
              <textarea className={textareaClass} placeholder="Von der ersten Anfrage bis zum Abschluss — wie läuft das ab?" onChange={(e) => update("sales_process", e.target.value)} defaultValue={data.sales_process} />
              <textarea className={textareaClass} placeholder="Was passiert direkt nach dem Kauf / Vertragsabschluss?" onChange={(e) => update("customer", e.target.value)} defaultValue={data.customer} />
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Schritt 3 von 8 – Leadquellen</h3>
              <p className="text-sm text-gray-500">Wie finden neue Kunden zu dir? (Mehrfachauswahl)</p>
              <div className="grid grid-cols-2 gap-2">
                {["Empfehlungen","Google / SEO","Social Media","Bezahlte Werbung","Cold Outreach","Zugekaufte Leads"].map((src) => (
                  <label key={src} className="flex items-center gap-2 text-sm cursor-pointer border border-gray-200 rounded-lg px-3 py-2 hover:border-amber-400 transition-colors">
                    <input type="checkbox" className="accent-amber-600" onChange={(e) => {
                      const prev = (data.lead_sources || "").split(",").filter(Boolean);
                      const next = e.target.checked ? [...prev, src] : prev.filter(x => x !== src);
                      update("lead_sources", next.join(","));
                    }} />
                    {src}
                  </label>
                ))}
              </div>
              <textarea className={textareaClass} placeholder="Wo verlierst du heute Interessenten — und warum?" onChange={(e) => update("lost_leads", e.target.value)} defaultValue={data.lost_leads} />
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Schritt 4 von 8 – Zeitfresser & Engpässe</h3>
              <textarea className={textareaClass} placeholder="Was erledigst du täglich manuell, obwohl es sich ständig wiederholt?" onChange={(e) => update("repetitive", e.target.value)} defaultValue={data.repetitive} />
              <textarea className={textareaClass} placeholder="Welche 3 Aufgaben kosten dich pro Woche am meisten Zeit?" onChange={(e) => update("top3", e.target.value)} defaultValue={data.top3} />
            </>
          )}

          {step === 4 && (
            <>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Schritt 5 von 8 – Vertrieb</h3>
              <p className="text-sm text-gray-500">Wer übernimmt den Verkauf?</p>
              <div className="grid grid-cols-2 gap-2">
                {["Nur ich","Ich + 1–2 Personen","Sales Team (3+)","Kein aktiver Verkauf"].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer border border-gray-200 rounded-lg px-3 py-2 hover:border-amber-400 transition-colors">
                    <input type="radio" name="sales_who" className="accent-amber-600" onChange={() => update("sales_who", opt)} />
                    {opt}
                  </label>
                ))}
              </div>
              <textarea className={textareaClass} placeholder="Was verhindert aktuell mehr Abschlüsse?" onChange={(e) => update("deal_problem", e.target.value)} defaultValue={data.deal_problem} />
              <textarea className={textareaClass} placeholder="Was kostet euch nach dem Ja die meiste Zeit?" onChange={(e) => update("after_yes", e.target.value)} defaultValue={data.after_yes} />
            </>
          )}

          {step === 5 && (
            <>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Schritt 6 von 8 – Kundenkommunikation</h3>
              <p className="text-sm text-gray-500">Über welche Kanäle kommunizierst du mit Kunden?</p>
              <div className="grid grid-cols-2 gap-2">
                {["E-Mail","WhatsApp","CRM","Social Media","Telefon"].map((ch) => (
                  <label key={ch} className="flex items-center gap-2 text-sm cursor-pointer border border-gray-200 rounded-lg px-3 py-2 hover:border-amber-400 transition-colors">
                    <input type="checkbox" className="accent-amber-600" onChange={(e) => {
                      const prev = (data.comm || "").split(",").filter(Boolean);
                      const next = e.target.checked ? [...prev, ch] : prev.filter(x => x !== ch);
                      update("comm", next.join(","));
                    }} />
                    {ch}
                  </label>
                ))}
              </div>
              <textarea className={textareaClass} placeholder="Was läuft in der Kundenkommunikation heute noch manuell oder fehleranfällig?" onChange={(e) => update("comm_problem", e.target.value)} defaultValue={data.comm_problem} />
            </>
          )}

          {step === 6 && (
            <>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Schritt 7 von 8 – Automatisierungs-Wünsche</h3>
              <p className="text-sm text-gray-500">Beschreibe 2–3 Dinge, die du dir wünschst, dass sie automatisch ablaufen.</p>
              {[1, 2, 3].map((n) => (
                <div key={n} className="border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wide" style={{ color: '#9a7f3c' }}>
                    Wunsch {n}{n === 3 ? " (optional)" : ""}
                  </div>
                  <textarea className="border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm w-full min-h-[88px] resize-none focus:outline-none focus:ring-1 focus:ring-amber-400" placeholder="Was soll automatisch passieren?" onChange={(e) => update(`wish_${n}`, e.target.value)} defaultValue={data[`wish_${n}`]} />
                </div>
              ))}
            </>
          )}

          {step === 7 && (
            <>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Schritt 8 von 8 – Dein Ziel</h3>
              <textarea className={textareaClass + " min-h-[110px]"} placeholder="Was wäre für dich der größte Gewinn, wenn die Automatisierung funktioniert? Mehr Zeit? Weniger Stress? Schnelleres Wachstum?" onChange={(e) => update("goal", e.target.value)} defaultValue={data.goal} />
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="px-6 pb-6 flex justify-between items-center">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)}
              className="border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:border-amber-300 hover:text-amber-700 transition-colors">
              ← Zurück
            </button>
          ) : <div />}

          {step < TOTAL_STEPS - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="text-white px-7 py-2.5 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #9a7f3c, #7d6530)' }}>
              Weiter →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading}
              className="text-white px-7 py-2.5 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #9a7f3c, #7d6530)' }}>
              {loading ? "Wird gesendet…" : "Anfrage absenden →"}
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center pb-4 flex items-center justify-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Deine Angaben werden vertraulich behandelt — DSGVO-konform.
        </p>
      </div>
    </section>
  );
}
