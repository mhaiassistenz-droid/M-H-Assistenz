const problems = [
  "Du beantwortest täglich dieselben Fragen — per E-Mail, Telefon, Chat.",
  "Neue Anfragen müssen manuell ins System eingetragen werden.",
  "Wichtige Aufgaben bleiben liegen, weil Routinearbeit die Zeit frisst.",
  "Dein Team erledigt Dinge per Hand, die sich von selbst erledigen könnten.",
  "Du verlierst potenzielle Kunden, weil die Nachverfolgung nicht schnell genug passiert.",
  "Anrufe außerhalb deiner Öffnungszeiten gehen ins Leere — und der Interessent ruft kein zweites Mal an.",
];

export function ProblemsSection() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#9a7f3c' }}>Kennst du das?</div>
        <h2 className="text-4xl md:text-5xl font-light leading-tight" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          Diese Probleme kosten dich{" "}
          <em style={{ color: '#9a7f3c' }}>täglich Zeit.</em>
        </h2>
        <p className="mt-4 text-gray-500 text-sm max-w-md mx-auto">Du bist nicht allein damit. Die meisten Unternehmer kämpfen mit denselben Engpässen.</p>
      </div>
      <ul className="space-y-3">
        {problems.map((p, i) => (
          <li key={i} className="flex items-start gap-4 p-4 rounded-xl border"
            style={{ background: '#fff5f5', borderColor: '#fecaca' }}>
            <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b83a2c" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="text-sm text-gray-700">{p}</span>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-center text-sm font-medium" style={{ color: '#5c5649' }}>
        Das ist kein Organisationsproblem. Das ist ein System-Problem — und es hat eine Lösung.
      </p>
    </section>
  );
}
