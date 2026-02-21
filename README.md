<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>M&H Assistenz — KI-Automatisierung</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
  <style>
  :root {
    --gold:#9a7f3c;--gold-l:#c4a355;--gold-ll:#e8d49a;--gold-bg:#faf8f2;--gold-border:#e2d5b0;
    --white:#ffffff;--bg:#f9f8f5;--border:#ebebeb;--text:#111110;--text-2:#5c5649;--text-3:#a09a8e;
    --success:#1f7a4a;--error:#b83a2c;
    --font-d:'Cormorant Garamond',Georgia,serif;--font-b:'DM Sans',system-ui,sans-serif;
    --ease:cubic-bezier(.4,0,.2,1);--max:780px;
    --shadow-sm:0 2px 8px rgba(0,0,0,.06);--shadow-md:0 6px 24px rgba(0,0,0,.09);--shadow-lg:0 16px 48px rgba(0,0,0,.13);
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased;}
  body{font-family:var(--font-b);background:var(--white);color:var(--text);font-size:15px;line-height:1.6;padding-top:108px;}

  /* ── HEADER ── */
  .site-header{
  background:var(--white);
  border-bottom:1px solid var(--border);
  padding:20px 24px;
  text-align:center;
  position:fixed;
  top:0;left:0;right:0;
  z-index:999;
  box-shadow:0 1px 12px rgba(0,0,0,.07);
  transform:none!important;
  transition:none!important;
}
  .site-header img{
  width:clamp(140px,18vw,240px);
  height:auto;
  object-fit:contain;
  display:block;
  margin:0 auto;
  border-radius:0!important;
  box-shadow:none;
  filter:none;
}

  /* ── HERO ── */
  .hero{background:var(--white);padding:80px 24px 88px;text-align:center;border-bottom:1px solid var(--border);}
  .hero-badge{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);background:var(--gold-bg);border:1px solid var(--gold-border);border-radius:999px;padding:5px 16px;margin-bottom:24px;}
  .hero-badge-dot{width:5px;height:5px;border-radius:0;background:var(--gold);}
  .hero h1{font-family:var(--font-d);font-size:clamp(30px,5vw,52px);font-weight:400;line-height:1.14;letter-spacing:-.02em;color:var(--text);max-width:640px;margin:0 auto 20px;}
  .hero h1 em{font-style:italic;color:var(--gold);}
  .hero-sub{font-size:16px;color:var(--text-2);max-width:480px;margin:0 auto 20px;line-height:1.65;}
  .hero-proof{display:flex;align-items:center;justify-content:center;gap:28px;flex-wrap:wrap;margin-bottom:52px;}
  .hero-proof-item{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-3);font-weight:500;}
  .hero-proof-item svg{color:var(--gold);opacity:.8;}
  .hero-numbers{display:flex;align-items:stretch;justify-content:center;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:14px;overflow:hidden;max-width:480px;margin:0 auto 52px;}
  .hero-num{flex:1;background:var(--white);padding:18px 12px;text-align:center;}
  .hero-num-val{font-family:var(--font-d);font-size:28px;font-weight:500;color:var(--gold);line-height:1;}
  .hero-num-label{font-size:11px;color:var(--text-3);margin-top:4px;line-height:1.4;}

  /* ── CALENDAR ── */
  .calendar-card{background:var(--white);border:1px solid var(--border);border-radius:20px;box-shadow:var(--shadow-lg);max-width:700px;margin:0 auto;overflow:hidden;}
  .cal-header{background:linear-gradient(135deg,var(--gold),#7d6530);padding:22px 28px;display:flex;align-items:center;justify-content:space-between;color:#fff;}
  .cal-header-title{font-family:var(--font-d);font-size:21px;font-weight:500;}
  .cal-header-sub{font-size:12px;opacity:.75;margin-top:2px;}
  .cal-nav{display:flex;gap:8px;}
  .cal-nav button{width:34px;height:34px;border-radius:8px;background:rgba(255,255,255,.2);border:none;color:#fff;cursor:pointer;font-size:17px;display:flex;align-items:center;justify-content:center;transition:background .2s;}
  .cal-nav button:hover{background:rgba(255,255,255,.35);}
  .cal-body{padding:24px 28px 28px;}
  .cal-weekdays{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:8px;}
  .cal-weekday{text-align:center;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);padding:6px 0;}
  .cal-days{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
  .cal-day{aspect-ratio:1;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;color:var(--text-2);cursor:pointer;transition:all .18s var(--ease);border:1.5px solid transparent;background:none;}
  .cal-day:hover:not(.disabled):not(.empty){background:var(--gold-bg);border-color:var(--gold-border);color:var(--gold);}
  .cal-day.today{background:var(--gold-bg);border-color:var(--gold-border);color:var(--gold);font-weight:700;}
  .cal-day.selected{background:linear-gradient(135deg,var(--gold),#7d6530)!important;color:#fff!important;border-color:transparent!important;box-shadow:0 4px 12px rgba(154,127,60,.4);}
  .cal-day.disabled{color:var(--text-3);cursor:default;opacity:.35;}
  .cal-day.empty{cursor:default;}
  .time-slots-wrap{margin-top:22px;border-top:1px solid var(--border);padding-top:20px;display:none;}
  .time-slots-wrap.visible{display:block;animation:fadeUp .3s var(--ease);}
  .time-slots-label{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:13px;}
  .time-slots{display:flex;flex-wrap:wrap;gap:8px;}
  .time-slot{padding:9px 17px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg);font-size:13px;font-weight:500;color:var(--text-2);cursor:pointer;transition:all .18s var(--ease);}
  .time-slot:hover{border-color:var(--gold-l);background:var(--gold-bg);color:var(--gold);}
  .time-slot.selected{background:linear-gradient(135deg,var(--gold),#7d6530);color:#fff;border-color:transparent;box-shadow:0 2px 8px rgba(154,127,60,.35);}
  .cal-book-btn{display:none;width:100%;margin-top:20px;padding:16px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--gold),#7d6530);color:#fff;font-family:var(--font-b);font-size:14px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;box-shadow:0 4px 16px rgba(154,127,60,.4);transition:all .25s var(--ease);}
  .cal-book-btn.visible{display:block;animation:fadeUp .3s var(--ease);}
  .cal-book-btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(154,127,60,.45);}

  /* ── SECTIONS ── */
  .page-section{max-width:var(--max);margin:0 auto;padding:80px 24px;}
  .section-label{display:flex;align-items:center;gap:10px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:14px;}
  .section-label::before,.section-label::after{content:'';flex:0 0 20px;height:1px;background:var(--gold);}
  h2{font-family:var(--font-d);font-size:clamp(26px,4vw,40px);font-weight:400;line-height:1.18;letter-spacing:-.02em;color:var(--text);margin-bottom:12px;}
  h2 em{font-style:italic;color:var(--gold);}
  .section-sub{font-size:15px;color:var(--text-2);line-height:1.65;max-width:500px;margin-bottom:48px;}
  .section-divider{border:none;border-top:1px solid var(--border);max-width:var(--max);margin:0 auto;}
  .bg-subtle{background:var(--bg);border-top:1px solid var(--border);border-bottom:1px solid var(--border);}

  /* ── SERVICE CARDS ── */
  .services-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
  @media(max-width:600px){.services-grid{grid-template-columns:1fr;}}
  .service-card{border:1px solid var(--border);border-radius:18px;padding:30px;background:var(--white);box-shadow:var(--shadow-sm);transition:all .25s var(--ease);}
  .service-card:hover{box-shadow:var(--shadow-md);transform:translateY(-2px);border-color:var(--gold-border);}
  .service-icon{width:44px;height:44px;border-radius:11px;background:var(--gold-bg);border:1px solid var(--gold-border);display:flex;align-items:center;justify-content:center;color:var(--gold);margin-bottom:18px;}
  .service-tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);background:var(--gold-bg);border:1px solid var(--gold-border);border-radius:999px;padding:3px 10px;margin-bottom:10px;}
  .service-title{font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px;}
  .service-problem{font-size:13px;color:var(--text-3);margin-bottom:10px;padding:10px 14px;background:var(--bg);border-radius:8px;border-left:3px solid var(--gold-border);}
  .service-problem strong{display:block;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:3px;}
  .service-solution{font-size:13.5px;color:var(--text-2);line-height:1.6;margin-bottom:14px;}
  .service-benefit{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;color:var(--success);background:#f0faf4;border:1px solid #b7e4c7;border-radius:8px;padding:10px 14px;}
  .service-benefit svg{flex-shrink:0;}
  .service-price{margin-top:16px;padding-top:14px;border-top:1px solid var(--border);font-family:var(--font-d);font-size:22px;font-weight:500;color:var(--gold);}
  .service-price span{font-size:13px;color:var(--text-3);font-family:var(--font-b);font-weight:400;}

  /* ── PRICING ── */
  .pricing-setup{background:var(--white);border:1px solid var(--border);border-radius:18px;padding:36px;box-shadow:var(--shadow-sm);margin-bottom:20px;}
  .pricing-setup-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:24px;padding-bottom:22px;border-bottom:1px solid var(--border);}
  .pricing-setup-left h3{font-family:var(--font-d);font-size:26px;font-weight:400;color:var(--text);margin-bottom:4px;}
  .pricing-setup-left p{font-size:14px;color:var(--text-2);}
  .pricing-setup-price{font-family:var(--font-d);font-size:42px;font-weight:400;color:var(--gold);line-height:1;white-space:nowrap;}
  .pricing-setup-price span{font-size:15px;font-family:var(--font-b);color:var(--text-3);font-weight:400;}
  .pricing-includes{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  @media(max-width:500px){.pricing-includes{grid-template-columns:1fr;}}
  .pricing-include-item{display:flex;align-items:flex-start;gap:10px;font-size:13.5px;color:var(--text-2);}
  .pricing-include-item svg{color:var(--gold);flex-shrink:0;margin-top:1px;}
  .pricing-include-item strong{display:block;font-size:13px;font-weight:600;color:var(--text);margin-bottom:1px;}
  .pricing-fair{margin-top:18px;padding:14px 18px;background:var(--gold-bg);border:1px solid var(--gold-border);border-radius:10px;font-size:13px;color:var(--text-2);line-height:1.6;}
  .pricing-fair strong{color:var(--gold);}

  .pricing-support-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:36px;}
  @media(max-width:560px){.pricing-support-grid{grid-template-columns:1fr;}}
  .support-card{border:1px solid var(--border);border-radius:14px;padding:24px;background:var(--white);box-shadow:var(--shadow-sm);}
  .support-card.featured{border-color:var(--gold);background:var(--gold-bg);}
  .support-tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;}
  .support-price{font-family:var(--font-d);font-size:32px;font-weight:400;color:var(--text);line-height:1;margin-bottom:4px;}
  .support-price span{font-size:14px;font-family:var(--font-b);color:var(--text-3);font-weight:400;}
  .support-desc{font-size:13px;color:var(--text-2);margin-bottom:16px;}
  .support-list{list-style:none;display:flex;flex-direction:column;gap:7px;}
  .support-list li{font-size:13px;color:var(--text-2);display:flex;align-items:flex-start;gap:8px;}
  .support-list li::before{content:'✓';color:var(--gold);font-weight:700;flex-shrink:0;margin-top:1px;}

  .pricing-cases h3{font-family:var(--font-d);font-size:26px;font-weight:400;color:var(--text);margin-bottom:8px;}
  .pricing-cases p{font-size:14px;color:var(--text-2);margin-bottom:24px;}
  .cases-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  @media(max-width:560px){.cases-grid{grid-template-columns:1fr;}}
  .case-card{border:1px solid var(--border);border-radius:14px;padding:22px;background:var(--white);box-shadow:var(--shadow-sm);transition:all .2s var(--ease);}
  .case-card:hover{box-shadow:var(--shadow-md);border-color:var(--gold-border);}
  .case-name{font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px;}
  .case-benefit{font-size:12.5px;color:var(--text-2);margin-bottom:14px;line-height:1.55;}
  .case-pricing{display:flex;gap:10px;flex-wrap:wrap;}
  .case-price-item{font-size:12px;padding:5px 11px;border-radius:999px;font-weight:600;}
  .case-price-once{background:var(--gold-bg);color:var(--gold);border:1px solid var(--gold-border);}
  .case-price-monthly{background:var(--bg);color:var(--text-2);border:1px solid var(--border);}

  /* ── TESTIMONIALS ── */
  .testi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
  @media(max-width:680px){.testi-grid{grid-template-columns:1fr;}}
  .testi-card{background:var(--white);border:1px solid var(--border);border-radius:16px;padding:28px;box-shadow:var(--shadow-sm);transition:all .25s var(--ease);}
  .testi-card:hover{box-shadow:var(--shadow-md);transform:translateY(-2px);}
  .testi-stars{color:var(--gold);font-size:13px;letter-spacing:2px;margin-bottom:14px;}
  .testi-quote{font-family:var(--font-d);font-size:15.5px;font-weight:400;font-style:italic;color:var(--text);line-height:1.55;margin-bottom:18px;}
  .testi-author{display:flex;align-items:center;gap:12px;}
  .testi-av{width:38px;height:38px;border-radius:0;background:linear-gradient(135deg,var(--gold),#7d6530);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .testi-name{font-size:13px;font-weight:600;color:var(--text);}
  .testi-company{font-size:11px;color:var(--text-3);}
  .testi-saving{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--success);background:#f0faf4;border:1px solid #b7e4c7;border-radius:999px;padding:3px 10px;margin-bottom:12px;}

  /* ── FOOTER ── */
  footer{text-align:center;padding:36px 24px;font-size:12px;color:var(--text-3);border-top:1px solid var(--border);}
  footer img{width:120px;height:auto;display:block;margin:0 auto 14px;}

  /* ── MODAL ── */
  .modal-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;padding:20px;}
  .modal-overlay.visible{display:flex;}
  .modal{background:var(--white);border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.18);width:100%;max-width:700px;max-height:90vh;overflow-y:auto;animation:modalIn .35s var(--ease);}
  @keyframes modalIn{from{opacity:0;transform:translateY(24px) scale(.97);}to{opacity:1;transform:translateY(0) scale(1);}}
  .modal::-webkit-scrollbar{width:4px;}
  .modal::-webkit-scrollbar-thumb{background:var(--gold-border);border-radius:4px;}
  .modal-header{background:linear-gradient(135deg,var(--gold),#7d6530);padding:22px 28px;display:flex;align-items:center;justify-content:space-between;border-radius:20px 20px 0 0;position:sticky;top:0;z-index:10;}
  .modal-header-title{font-family:var(--font-d);font-size:22px;font-weight:500;color:#fff;}
  .modal-header-sub{font-size:12px;color:rgba(255,255,255,.75);margin-top:2px;}
  .modal-close{width:36px;height:36px;border-radius:0;background:rgba(255,255,255,.2);border:none;color:#fff;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;flex-shrink:0;}
  .modal-close:hover{background:rgba(255,255,255,.35);}
  .modal-progress{padding:13px 28px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);background:var(--white);position:sticky;top:75px;z-index:9;}
  .modal-progress-track{flex:1;height:3px;background:var(--gold-border);border-radius:999px;overflow:hidden;}
  .modal-progress-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold-l));border-radius:999px;width:0%;transition:width .5s var(--ease);}
  .modal-progress-label{font-size:11px;font-weight:600;color:var(--gold);min-width:36px;text-align:right;}
  .modal-body{padding:28px;}

  /* form inside modal */
  .form-section{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:26px;margin-bottom:16px;box-shadow:var(--shadow-sm);animation:fadeUp .4s var(--ease) both;}
  .form-section:hover{box-shadow:var(--shadow-md);}
  .form-section:nth-child(1){animation-delay:.04s}.form-section:nth-child(2){animation-delay:.08s}.form-section:nth-child(3){animation-delay:.12s}.form-section:nth-child(4){animation-delay:.16s}.form-section:nth-child(5){animation-delay:.20s}.form-section:nth-child(6){animation-delay:.24s}.form-section:nth-child(7){animation-delay:.28s}
  .section-header{display:flex;align-items:center;gap:11px;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--border);}
  .section-icon{width:32px;height:32px;border-radius:8px;background:var(--gold-bg);border:1px solid var(--gold-border);display:flex;align-items:center;justify-content:center;color:var(--gold);flex-shrink:0;}
  .section-num{display:block;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:1px;}
  .section-title{font-size:14px;font-weight:600;color:var(--text);}
  .field-group{display:flex;flex-direction:column;gap:16px;}
  .field-row-2{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
  @media(max-width:500px){.field-row-2{grid-template-columns:1fr;}.modal-body{padding:20px 16px;}.form-section{padding:20px 16px;}}
  .field{display:flex;flex-direction:column;gap:5px;}
  label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-2);display:flex;align-items:center;gap:5px;}
  .req{color:var(--gold);}.opt{font-size:10px;font-weight:400;color:var(--text-3);text-transform:none;letter-spacing:0;}
  input[type=text],input[type=email],input[type=url],select,textarea{width:100%;padding:11px 13px;font-family:var(--font-b);font-size:13.5px;color:var(--text);background:var(--bg);border:1.5px solid var(--border);border-radius:8px;outline:none;transition:all .2s var(--ease);-webkit-appearance:none;appearance:none;}
  input::placeholder,textarea::placeholder{color:var(--text-3);font-size:13px;}
  input:focus,select:focus,textarea:focus{border-color:var(--gold);background:var(--white);box-shadow:0 0 0 3px rgba(154,127,60,.1);}
  input.error,select.error,textarea.error{border-color:var(--error);box-shadow:0 0 0 3px rgba(184,58,44,.08);}
  textarea{min-height:96px;resize:vertical;line-height:1.6;}
  select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239a7f3c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 11px center;padding-right:36px;cursor:pointer;}
  .field-error{font-size:11px;color:var(--error);font-weight:600;display:none;align-items:center;gap:4px;}
  .field-error.visible{display:flex;}
  .choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  @media(max-width:400px){.choice-grid{grid-template-columns:1fr;}}
  .choice-item{position:relative;}
  .choice-item input[type=checkbox],.choice-item input[type=radio]{position:absolute;opacity:0;width:0;height:0;}
  .choice-label{display:flex;align-items:center;gap:8px;padding:9px 13px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;color:var(--text-2);background:var(--bg);transition:all .18s var(--ease);user-select:none;text-transform:none;letter-spacing:0;}
  .choice-label:hover{border-color:var(--gold-l);background:var(--gold-bg);color:var(--text);}
  .choice-item input:checked+.choice-label{border-color:var(--gold);background:var(--gold-bg);color:var(--gold);box-shadow:0 0 0 1px var(--gold);}
  .cdot{width:14px;height:14px;border-radius:0;border:1.5px solid currentColor;flex-shrink:0;position:relative;transition:all .18s;}
  .choice-item input[type=checkbox]+.choice-label .cdot{border-radius:4px;}
  .cdot::after{content:'';position:absolute;inset:3px;border-radius:inherit;background:currentColor;opacity:0;transform:scale(.3);transition:all .18s;}
  .choice-item input:checked+.choice-label .cdot::after{opacity:1;transform:scale(1);}
  .other-field{display:none;margin-top:7px;grid-column:1/-1;}
  .other-field.visible{display:block;}
  .modal-submit-btn{width:100%;padding:16px 32px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--gold),#7d6530);color:#fff;font-family:var(--font-b);font-size:14px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;box-shadow:0 4px 16px rgba(154,127,60,.38);transition:all .25s var(--ease);display:flex;align-items:center;justify-content:center;gap:10px;margin-top:8px;}
  .modal-submit-btn:hover{transform:translateY(-1px);box-shadow:0 8px 28px rgba(154,127,60,.45);}
  .modal-submit-btn:disabled{opacity:.6;cursor:not-allowed;transform:none;}
  .spin{width:17px;height:17px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:0;animation:spin .7s linear infinite;display:none;}
  .loading .spin{display:block;}.loading .btn-text{display:none;}
  @keyframes spin{to{transform:rotate(360deg);}}
  .modal-note{margin-top:12px;text-align:center;font-size:11px;color:var(--text-3);display:flex;align-items:center;justify-content:center;gap:5px;}

  /* success */
  .modal-success{display:none;text-align:center;padding:56px 32px 48px;}
  .modal-success.visible{display:block;animation:fadeUp .5s var(--ease);}
  .success-icon{width:68px;height:68px;border-radius:0;background:#f0faf4;border:1px solid #b7e4c7;display:flex;align-items:center;justify-content:center;margin:0 auto 22px;animation:scaleIn .5s cubic-bezier(.34,1.56,.64,1);}
  @keyframes scaleIn{from{transform:scale(.3);opacity:0;}to{transform:scale(1);opacity:1;}}
  .success-title{font-family:var(--font-d);font-size:30px;font-weight:400;color:var(--text);margin-bottom:10px;}
  .success-msg{font-size:15px;color:var(--text-2);line-height:1.65;max-width:360px;margin:0 auto 24px;}
  .success-redirect-btn{display:inline-flex;align-items:center;gap:8px;padding:15px 28px;border-radius:12px;background:linear-gradient(135deg,var(--gold),#7d6530);color:#fff;font-family:var(--font-b);font-size:14px;font-weight:600;text-decoration:none;letter-spacing:.04em;box-shadow:0 4px 16px rgba(154,127,60,.4);transition:all .25s var(--ease);}
  .success-redirect-btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(154,127,60,.45);}
  .success-note{margin-top:14px;font-size:12px;color:var(--text-3);}

  @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  
@media(max-width:600px){
  .site-header{padding:14px 16px;}
  .site-header img{width:clamp(120px,60vw,180px);}
  body{padding-top:90px;}
}
  </style>
</head>
<body>

<!-- HEADER -->
<header class="site-header">
  <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QC8RXhpZgAATU0AKgAAAAgABQESAAMAAAABAAEAAAEaAAUAAAABAAAASgEbAAUAAAABAAAAUgEoAAMAAAABAAIAAIdpAAQAAAABAAAAWgAAAAAAAABIAAAAAQAAAEgAAAABAAeQAAAHAAAABDAyMjGRAQAHAAAABAECAwCgAAAHAAAABDAxMDCgAQADAAAAAf//AACgAgAEAAAAAQAAAs+gAwAEAAAAAQAAAr6kBgADAAAAAQAAAAAAAAAA/+0AOFBob3Rvc2hvcCAzLjAAOEJJTQQEAAAAAAAAOEJJTQQlAAAAAAAQ1B2M2Y8AsgTpgAmY7PhCfv/iAihJQ0NfUFJPRklMRQABAQAAAhhhcHBsBAAAAG1udHJSR0IgWFlaIAfmAAEAAQAAAAAAAGFjc3BBUFBMAAAAAEFQUEwAAAAAAAAAAAAAAAAAAAAAAAD21gABAAAAANMtYXBwbOz9o444hUfDbbS9T3raGC8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmRlc2MAAAD8AAAAMGNwcnQAAAEsAAAAUHd0cHQAAAF8AAAAFHJYWVoAAAGQAAAAFGdYWVoAAAGkAAAAFGJYWVoAAAG4AAAAFHJUUkMAAAHMAAAAIGNoYWQAAAHsAAAALGJUUkMAAAHMAAAAIGdUUkMAAAHMAAAAIG1sdWMAAAAAAAAAAQAAAAxlblVTAAAAFAAAABwARABpAHMAcABsAGEAeQAgAFAAM21sdWMAAAAAAAAAAQAAAAxlblVTAAAANAAAABwAQwBvAHAAeQByAGkAZwBoAHQAIABBAHAAcABsAGUAIABJAG4AYwAuACwAIAAyADAAMgAyWFlaIAAAAAAAAPbVAAEAAAAA0yxYWVogAAAAAAAAg98AAD2/////u1hZWiAAAAAAAABKvwAAsTcAAAq5WFlaIAAAAAAAACg4AAARCwAAyLlwYXJhAAAAAAADAAAAAmZmAADypwAADVkAABPQAAAKW3NmMzIAAAAAAAEMQgAABd7///MmAAAHkwAA/ZD///ui///9owAAA9wAAMBu/8AAEQgCvgLPAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgMDBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQALf/aAAwDAQACEQMRAD8A/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0P38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9H9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//S/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0/38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9T9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//V/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9f9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//Q/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9L9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//T/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiik4FAC0UUUAFFFFABRSDPegHNAC0UUUAFFFFABRRRQAUUUUAFFFFABRSZ4zSA9jQA6iiigAoopu6gB1FJ2oyKAFooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/U/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKQ9KWigD5G+KEn7Q8HjHUJfAouDoWIvIES2zD/VJvwHBb7+7r+HFeHax8SP2i/D6GTW7jULGMfxzWSKn/fRiC/ka/SnAprKpUgjIx0r5fEZTOpJzhWav06HbCukknFH5Zf8L8+Lv/QwyD/tjB/8bo/4X58Xf+hik/78wf8Axuvpj9oL4N6FceG7vxr4askstQ08ebcJCoVJ4R99ig+UMg+bcMZAOc8Y+B6/PcesXg6ns51H5ans0fZzjdI9g/4X58Xf+hik/wC/MH/xuk/4X58XP+hjk/78wf8AxuvIKK8lY7Efzv7zf2VPsfrN8KfGiePfBGna+zD7Vt8m6UcbZ4vlfgdN3DAehFelV+en7LXjj+xfFU/hC8kxa60u6HPRbiMZH03LkfUKK/QodK/ZMpxf1nDKb3WjPm69P2c2ugtFFFe4cwUUUUAFFFFABRRRQAUUUUAVrmeG0t5Lm4dY4olLOxOFVVGSSewAFfml4k/aF+I99r9/c6FrD2WnPKxtoRFEdsIOE+8pOduCfevqb9pXxt/wjPgU6HbPsvdfYwAA8iBcGU/QjCfRvavzfr824hzCcaio0na29j2sHRTi5SR7B/wvz4u/9DFJ/wB+YP8A43R/wvz4u/8AQxSf9+YP/jdeP0V8P9exH87+89X2cP5T2D/hfnxd7eIpP+/MH/xurFp8cPjPfzrbWGtz3MrdEit4nc/RVjzXNfC7wNJ8Q/Gdl4c3mK2bdLcuvVII/vY92OFHoWFfqN4Z8I+G/CNium+HNPisYVAB2KNz47u33mPuxNfU5ZhcXjE6ntGorQ8+vOnTdlHU+IdP1j9q3U1DWyagoP8Az2toIP8A0Yi1966d9p+w2323/j48tPM6ff2jd046+lX8CgDFfoWDwTw97zbv3PIqVOfokLRRRXrHOFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH/1f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAy9Z06PVdIvdLmAMd5BJCwPTa6lT+hr8YyMcYxjt/Sv2v7V+LF2ALuYdg7fzr834piv3bPbwL+L5FeitC50u9tLKz1CaMi3v1cxN2by3KOPqCOnoR61n1+cSTW6PXv2Lmn313pd/balYSGK5tJFliYdVdCGU/gQK/XbwN4ptPGvhTTfE1ngLewqzKP4JB8rp/wABYEfhX4+19kfso+OPJvb7wHeyfLcg3drn++oAkQfVcMB22mvseHcZ7LEexltL8zzsZSvDmXQ+6KKaD2NOr9ePngooooAKKKKACiiigApDwKO1eTfGnxr/AMIL4A1DUrd9l9cj7La44IllBG4f7igv+FYV60aVOVSWyRUYttJHwd8d/Gn/AAmfxDvZbV99jpn+h2+PussRO9x2+Z8kH+7trxrB2hu36fhRXuHxH8Ef8IV8OvBCXMey/wBTN7d3ORhgZFg2If8AdQKMdjmvwqoqmJdTES6av57H1StTSgvQ8PoooryzoPsT9kLTo5NX8R6oR89vBbwqfaZmY/8AosflX3XgV8W/sfAeR4qP+1ZD9Jq+06/bMhilgYW8/wAz5jFP96wooor6Q4gooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/W/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBD0r8Wbz/AI+5/wDfb+dftMelfi1d/wDH5P8A77/zr864q2pntYH7R9T6Z4H/AOEv/Zrju7WPfqGiXNzdRbR8zIG/ep+K/MPUqBXydX6VfszIr/Ce1RhlTcXAweeC/T6V8RfF/wAFHwF471DRokK2UrfaLU9jBLkqo/3TlP8AgNeHmWDt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0f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAG/dr5q+NFz8bE1m0tvhms39nNbAzGFIT+93sPvSDcPl29MCvpem7RXJiaHtqfs+Zr0NYS5ZXtc/M3WvAf7Q3iMFNetNSv0P8E04ZB9E37R+Armf+FHfFj/AKFu4/76T/Gv1aor5aXDlGTvKbZ3RxrWyR+Uv/Cjfix/0Llx+af/ABVH/Cjfix/0Llx+af8AxVfq1RWX+rGG/mZX16XZH5S/8KO+LH/Qt3H/AH0n+NH/AAo74sf9C3cf99J/jX6tUU1wxh19pi+uz2sj829G8MftLeH0WHSI9UgiQYWP7Qrxrj0R2Kj8q+p/gldfFy4GrL8UkkURiAWZkjhQnO/zP9UBnonX8K98wKAMV6+EypYeakqjaXR7GFSvzqzSFpOgpaK+hOIb96vjv4mT/tGzeLdTtfCK3S6IrILYwLAuV2Luw5Af72ep+lfYuBRgV5+Lwvt4KHM16GtOfI72PzB1j4Z/HrxA4k13TtR1Ajp584kx9NznH4YrE/4Ub8WP+hcuPzT/AOKr9WcClr5qXDdGWsptncsbLokflL/wo34sf9C5cfmn/wAVR/wo34sf9C5cfmn/AMVX6tUVn/qxhv5mV9el2R+Uv/Cjvix/0Ldx/wB9J/jTk+CPxbjYPH4cuVYHIIZAQfb5q/ViimuGMOtpMX12e1kfnRpOkftQ6Koj08aoqKMKskyTIuOwWQsAPbFfZHwnn8d3PhNJPiKrJrHnSA7kjjby+NvyxAL+lenYFGBXuYPLfq0+ZVG12exzVK3OrWSFooor3DkCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//S/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKK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l8pAZZsRrJsYlfmCZ4/YnAo4x+lAHxH8QtW+Pet63Z+H/hP8KdU8LQeK9X00+JPEd9qekRyW+nwvFHcPbwWt/PI0ptk2BlCso+6pbaR9F/GQeIZvhh4n0/wnoVx4i1bUdOu7S2s7aW2gZpJ4XjQs91NDGqBiNx3FgOit0r1HAowKAPAPCnguP4lfAGw+G3xl8Hy6bHc6Vb6Xqel3strNlooURnjks5p02h13ROGDqVDbVYCvmv8AYX/Za8T/ALK3iX4seFNSkN74f1O90640W/JXNzaqk+VdV+7LFuCOMAE/MvykV+ieAKMCgD82/wDgor4K/ae+L3gPTvhD8AvCj6po2rOLjXL4X9jaBkhYGG0CXM8TsrOBJIQuPlRQTlwNf4a2XxT/AGbvgNpvwr+CPwK1vVdY022Ym51LUdAs7a51GUZkupjFqk0rK0nIXaCECxhgACP0NwKAMUAeSfAvQfFXhn4O+DNE8dlz4mttKtTq291lYahIge6BeMsjETM4ypKn+E4r1ykAxS0AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf//V/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9f9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//Q/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9L9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//T/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1P38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9X9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//W/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1/38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9D9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//R/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9k=" alt="M&H Assistenz"/>
</header>

<!-- HERO -->
<div class="hero">
  <div class="hero-badge"><span class="hero-badge-dot"></span>Kostenloses 15-Min Erstgespräch<span class="hero-badge-dot"></span></div>
  <h1>Spare jede Woche mehrere Stunden —<br><em>mit Automatisierung die für dich arbeitet</em></h1>
  <p class="hero-sub">Schluss mit manuellen Aufgaben die dich täglich Zeit kosten. Wir zeigen dir im kostenlosen Gespräch genau, welche Prozesse wir übernehmen — damit du dich auf das konzentrierst, was wirklich zählt.</p>

  <div class="hero-numbers">
    <div class="hero-num">
      <div class="hero-num-val">8 h</div>
      <div class="hero-num-label">Ø Zeitersparnis<br>pro Woche</div>
    </div>
    <div class="hero-num">
      <div class="hero-num-val">24/7</div>
      <div class="hero-num-label">Dein System<br>läuft automatisch</div>
    </div>
    <div class="hero-num">
      <div class="hero-num-val">0 €</div>
      <div class="hero-num-label">Erstgespräch<br>kostenlos & unverbindlich</div>
    </div>
  </div>

  <div class="hero-proof">
    <div class="hero-proof-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Keine Technik-Kenntnisse nötig</div>
    <div class="hero-proof-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Innerhalb weniger Tage einsatzbereit</div>
    <div class="hero-proof-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Läuft auch wenn du schläfst</div>
  </div>

  <div class="calendar-card">
    <div class="cal-header">
      <div>
        <div class="cal-header-title" id="calMonthTitle"></div>
        <div class="cal-header-sub">Wähle einen Tag — dann eine Uhrzeit (15:00–20:00 Uhr)</div>
      </div>
      <div class="cal-nav">
        <button id="calPrev">&#8249;</button>
        <button id="calNext">&#8250;</button>
      </div>
    </div>
    <div class="cal-body">
      <div class="cal-weekdays">
        <div class="cal-weekday">Mo</div><div class="cal-weekday">Di</div><div class="cal-weekday">Mi</div>
        <div class="cal-weekday">Do</div><div class="cal-weekday">Fr</div><div class="cal-weekday">Sa</div><div class="cal-weekday">So</div>
      </div>
      <div class="cal-days" id="calDays"></div>
      <div class="time-slots-wrap" id="timeSlotsWrap">
        <div class="time-slots-label" id="timeSlotsLabel">Verfügbare Zeiten</div>
        <div class="time-slots" id="timeSlots"></div>
      </div>
      <button class="cal-book-btn" id="calBookBtn">Kostenloses Gespräch buchen →</button>
    </div>
  </div>
</div>

<!-- SERVICES -->
<section class="page-section">
  <div class="section-label">Was ich für dich tue</div>
  <h2>Deine Aufgaben.<br><em>Erledigt. Automatisch.</em></h2>
  <p class="section-sub">Kein Technik-Gerede. Konkrete Probleme, konkrete Lösungen, messbare Ergebnisse.</p>

  <div class="services-grid">
    <div class="service-card">
      <div class="service-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
      <div class="service-tag">Einfache Automatisierung</div>
      <div class="service-title">Wiederkehrende Aufgaben</div>
      <div class="service-problem"><strong>Dein Problem</strong>Du beantwortest täglich dieselben Anfragen, pflegst Listen manuell und verlierst dabei Stunden.</div>
      <div class="service-solution">Wir richten einmalig einen automatischen Ablauf ein — Anfragen werden beantwortet, Daten gespeichert, Benachrichtigungen verschickt. Alles ohne dein Zutun.</div>
      <div class="service-benefit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Du sparst 3–5 Stunden pro Woche — sofort.</div>
      <div class="service-price">297 – 497 € <span>einmalig</span></div>
    </div>

    <div class="service-card">
      <div class="service-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg></div>
      <div class="service-tag">KI-Chatbot</div>
      <div class="service-title">Dein digitaler Assistent</div>
      <div class="service-problem"><strong>Dein Problem</strong>Kunden fragen nachts, an Wochenenden, ständig — und du kannst nicht immer sofort antworten.</div>
      <div class="service-solution">Ein KI-Chatbot auf deiner Website oder WhatsApp beantwortet Fragen, bucht Termine und qualifiziert Interessenten — rund um die Uhr, automatisch.</div>
      <div class="service-benefit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>80 % der Anfragen werden automatisch beantwortet.</div>
      <div class="service-price">797 – 1.200 € <span>einmalig</span></div>
    </div>

    <div class="service-card">
      <div class="service-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>
      <div class="service-tag">KI-Agent</div>
      <div class="service-title">E-Mails & Prozesse automatisieren</div>
      <div class="service-problem"><strong>Dein Problem</strong>Dein Postfach ist voll, du verbringst Stunden mit E-Mails sortieren, beantworten und weiterleiten.</div>
      <div class="service-solution">Ein KI-Agent liest deine E-Mails, entscheidet selbst was zu tun ist — beantwortet, kategorisiert, erstellt Aufgaben oder leitet weiter. Du siehst nur das Wichtige.</div>
      <div class="service-benefit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Du sparst 5–10 Stunden E-Mail-Aufwand pro Woche.</div>
      <div class="service-price">797 – 1.500 € <span>einmalig</span></div>
    </div>

    <div class="service-card">
      <div class="service-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></div>
      <div class="service-tag">Wissensdatenbank (RAG)</div>
      <div class="service-title">KI die dein Unternehmen kennt</div>
      <div class="service-problem"><strong>Dein Problem</strong>Mitarbeiter fragen immer wieder dieselben Dinge — Verträge suchen, Regeln nachschlagen, Dokumente durchsuchen.</div>
      <div class="service-solution">Wir bauen eine KI die alle deine Dokumente, Verträge und Infos kennt. Einfach fragen — sofort die richtige Antwort, aus deinen eigenen Unterlagen.</div>
      <div class="service-benefit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Kein stundenlangen Suchen mehr — Antwort in Sekunden.</div>
      <div class="service-price">1.500 – 2.000 € <span>einmalig</span></div>
    </div>
  </div>
</section>

<hr class="section-divider"/>

<!-- PRICING -->
<section class="page-section">
  <div class="section-label">Preise</div>
  <h2>Transparent &<br><em>fair kalkuliert</em></h2>
  <p class="section-sub">Keine versteckten Kosten. Keine Vertragsfallen. Du weißt immer genau was du zahlst — und was du dafür bekommst.</p>

  <!-- Einrichtung -->
  <div class="pricing-setup">
    <div class="pricing-setup-header">
      <div class="pricing-setup-left">
        <h3>Einmalige Einrichtung</h3>
        <p>Einmal bezahlen — läuft für immer.</p>
      </div>
      <div class="pricing-setup-price">250 € <span>einmalig</span></div>
    </div>
    <div class="pricing-includes">
      <div class="pricing-include-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <div><strong>Analyse deines Unternehmens</strong>Wir schauen genau hin: Was kostet dich am meisten Zeit?</div>
      </div>
      <div class="pricing-include-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <div><strong>Individuelle Planung</strong>Kein Standard-Template — alles auf dich zugeschnitten.</div>
      </div>
      <div class="pricing-include-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <div><strong>Technische Umsetzung</strong>Wir richten alles ein — du musst nichts installieren.</div>
      </div>
      <div class="pricing-include-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <div><strong>Tests & Feinschliff</strong>Alles wird getestet bis es zuverlässig läuft.</div>
      </div>
      <div class="pricing-include-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <div><strong>Persönliche Übergabe</strong>Wir erklären dir alles — du weißt genau wie es funktioniert.</div>
      </div>
      <div class="pricing-include-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <div><strong>Kein laufendes Risiko</strong>Einmalig bezahlen — danach nur der monatliche Betrieb.</div>
      </div>
    </div>
    <div class="pricing-fair"><strong>Warum 250 € fair ist:</strong> Die Einrichtung umfasst mehrere Stunden Analyse, Planung, Umsetzung und Einweisung. Du bekommst kein vorgefertigtes System — sondern eins das exakt für dein Unternehmen funktioniert. Das spart dir langfristig hunderte Stunden.</div>
  </div>

  <!-- Support -->
  <div class="pricing-support-grid">
    <div class="support-card featured">
      <div class="support-tag">Empfohlen · KI-Systeme & Chatbots</div>
      <div class="support-price">50 € <span>/ Monat</span></div>
      <div class="support-desc">Für komplexere Systeme mit KI-Agenten, Chatbots und RAG.</div>
      <ul class="support-list">
        <li>Hosting auf dediziertem Server</li>
        <li>Monatliche Wartung & Updates</li>
        <li>Fehlerbehebung innerhalb 24h</li>
        <li>Kleinere Anpassungen inklusive</li>
        <li>Monatliches Check-In</li>
      </ul>
    </div>
    <div class="support-card">
      <div class="support-tag">Einfache Automatisierungen</div>
      <div class="support-price">30 € <span>/ Monat</span></div>
      <div class="support-desc">Für einfachere Workflows ohne KI-Modelle.</div>
      <ul class="support-list">
        <li>Hosting auf geteiltem Server</li>
        <li>Wartung & Monitoring</li>
        <li>Fehlerbehebung</li>
        <li>Updates bei Bedarf</li>
      </ul>
    </div>
  </div>

  <!-- Cases -->
  <div class="pricing-cases">
    <h3>4 typische Beispiele</h3>
    <p>Was andere Unternehmen einsetzen — und was es kostet.</p>
    <div class="cases-grid">
      <div class="case-card">
        <div class="case-name">📧 Automatische Anfragen-Bearbeitung</div>
        <div class="case-benefit">Neue Anfragen werden automatisch beantwortet, ins CRM eingetragen und du bekommst eine Zusammenfassung. Du sparst täglich 1–2 Stunden.</div>
        <div class="case-pricing">
          <span class="case-price-item case-price-once">297 € einmalig</span>
          <span class="case-price-item case-price-monthly">30 €/Monat</span>
        </div>
      </div>
      <div class="case-card">
        <div class="case-name">💬 Website-Chatbot mit Terminbuchung</div>
        <div class="case-benefit">Besucher können rund um die Uhr Fragen stellen und direkt Termine buchen — ohne dass du eingreifen musst.</div>
        <div class="case-pricing">
          <span class="case-price-item case-price-once">797 € einmalig</span>
          <span class="case-price-item case-price-monthly">50 €/Monat</span>
        </div>
      </div>
      <div class="case-card">
        <div class="case-name">🤖 KI-Agent für E-Mails & Leads</div>
        <div class="case-benefit">Dein KI-Assistent liest E-Mails, bewertet Leads, antwortet automatisch auf Standardfragen und erstellt Aufgaben für dich.</div>
        <div class="case-pricing">
          <span class="case-price-item case-price-once">1.200 € einmalig</span>
          <span class="case-price-item case-price-monthly">50 €/Monat</span>
        </div>
      </div>
      <div class="case-card">
        <div class="case-name">📚 Firmen-Wissensdatenbank</div>
        <div class="case-benefit">Mitarbeiter und Kunden fragen die KI — sie kennt all deine Dokumente, Verträge und Prozesse und antwortet in Sekunden.</div>
        <div class="case-pricing">
          <span class="case-price-item case-price-once">1.800 € einmalig</span>
          <span class="case-price-item case-price-monthly">50 €/Monat</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- TESTIMONIALS -->
<div class="bg-subtle">
  <section class="page-section">
    <div class="section-label">Kundenstimmen</div>
    <h2>Was Unternehmen sagen,<br><em>die bereits automatisiert haben</em></h2>
    <p class="section-sub" style="margin-bottom:40px;">Echte Ergebnisse — in Stunden gemessen, nicht in Buzzwords.</p>
    <div class="testi-grid">
      <div class="testi-card">
        <div class="testi-saving"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>8 Stunden/Woche gespart</div>
        <div class="testi-stars">★★★★★</div>
        <div class="testi-quote">„Ich habe nicht gedacht, dass das so einfach geht. Seit dem System läuft mein Prozess automatisch — ich muss nur noch die wirklich wichtigen Dinge selbst machen."</div>
        <div class="testi-author">
          <div class="testi-av">TM</div>
          <div><div class="testi-name">Thomas M.</div><div class="testi-company">Immobilienmakler, Frankfurt</div></div>
        </div>
      </div>
      <div class="testi-card">
        <div class="testi-saving"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>80 % weniger manuelle Anfragen</div>
        <div class="testi-stars">★★★★★</div>
        <div class="testi-quote">„Unser Chatbot beantwortet jetzt die meisten Fragen selbst. Kunden bekommen sofort eine Antwort — auch nachts. Das hat unsere Reaktionszeit von Stunden auf Sekunden gesenkt."</div>
        <div class="testi-author">
          <div class="testi-av">SK</div>
          <div><div class="testi-name">Sarah K.</div><div class="testi-company">Online-Shop Inhaberin, München</div></div>
        </div>
      </div>
      <div class="testi-card">
        <div class="testi-saving"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>3 h täglich zurückgewonnen</div>
        <div class="testi-stars">★★★★★</div>
        <div class="testi-quote">„Leads kommen rein, werden qualifiziert, bekommen eine Antwort — und ich sehe am nächsten Morgen nur noch die, die wirklich interessant sind. Endlich Fokus."</div>
        <div class="testi-author">
          <div class="testi-av">JB</div>
          <div><div class="testi-name">Jonas B.</div><div class="testi-company">Business Coach, Berlin</div></div>
        </div>
      </div>
    </div>
  </section>
</div>

<!-- FOOTER -->
<footer>
  <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QC8RXhpZgAATU0AKgAAAAgABQESAAMAAAABAAEAAAEaAAUAAAABAAAASgEbAAUAAAABAAAAUgEoAAMAAAABAAIAAIdpAAQAAAABAAAAWgAAAAAAAABIAAAAAQAAAEgAAAABAAeQAAAHAAAABDAyMjGRAQAHAAAABAECAwCgAAAHAAAABDAxMDCgAQADAAAAAf//AACgAgAEAAAAAQAAAs+gAwAEAAAAAQAAAr6kBgADAAAAAQAAAAAAAAAA/+0AOFBob3Rvc2hvcCAzLjAAOEJJTQQEAAAAAAAAOEJJTQQlAAAAAAAQ1B2M2Y8AsgTpgAmY7PhCfv/iAihJQ0NfUFJPRklMRQABAQAAAhhhcHBsBAAAAG1udHJSR0IgWFlaIAfmAAEAAQAAAAAAAGFjc3BBUFBMAAAAAEFQUEwAAAAAAAAAAAAAAAAAAAAAAAD21gABAAAAANMtYXBwbOz9o444hUfDbbS9T3raGC8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmRlc2MAAAD8AAAAMGNwcnQAAAEsAAAAUHd0cHQAAAF8AAAAFHJYWVoAAAGQAAAAFGdYWVoAAAGkAAAAFGJYWVoAAAG4AAAAFHJUUkMAAAHMAAAAIGNoYWQAAAHsAAAALGJUUkMAAAHMAAAAIGdUUkMAAAHMAAAAIG1sdWMAAAAAAAAAAQAAAAxlblVTAAAAFAAAABwARABpAHMAcABsAGEAeQAgAFAAM21sdWMAAAAAAAAAAQAAAAxlblVTAAAANAAAABwAQwBvAHAAeQByAGkAZwBoAHQAIABBAHAAcABsAGUAIABJAG4AYwAuACwAIAAyADAAMgAyWFlaIAAAAAAAAPbVAAEAAAAA0yxYWVogAAAAAAAAg98AAD2/////u1hZWiAAAAAAAABKvwAAsTcAAAq5WFlaIAAAAAAAACg4AAARCwAAyLlwYXJhAAAAAAADAAAAAmZmAADypwAADVkAABPQAAAKW3NmMzIAAAAAAAEMQgAABd7///MmAAAHkwAA/ZD///ui///9owAAA9wAAMBu/8AAEQgCvgLPAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgMDBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQALf/aAAwDAQACEQMRAD8A/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0P38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9H9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//S/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0/38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9T9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//V/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9f9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//Q/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9L9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//T/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiik4FAC0UUUAFFFFABRSDPegHNAC0UUUAFFFFABRRRQAUUUUAFFFFABRSZ4zSA9jQA6iiigAoopu6gB1FJ2oyKAFooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/U/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKQ9KWigD5G+KEn7Q8HjHUJfAouDoWIvIES2zD/VJvwHBb7+7r+HFeHax8SP2i/D6GTW7jULGMfxzWSKn/fRiC/ka/SnAprKpUgjIx0r5fEZTOpJzhWav06HbCukknFH5Zf8L8+Lv/QwyD/tjB/8bo/4X58Xf+hik/78wf8Axuvpj9oL4N6FceG7vxr4askstQ08ebcJCoVJ4R99ig+UMg+bcMZAOc8Y+B6/PcesXg6ns51H5ans0fZzjdI9g/4X58Xf+hik/wC/MH/xuk/4X58XP+hjk/78wf8AxuvIKK8lY7Efzv7zf2VPsfrN8KfGiePfBGna+zD7Vt8m6UcbZ4vlfgdN3DAehFelV+en7LXjj+xfFU/hC8kxa60u6HPRbiMZH03LkfUKK/QodK/ZMpxf1nDKb3WjPm69P2c2ugtFFFe4cwUUUUAFFFFABRRRQAUUUUAVrmeG0t5Lm4dY4olLOxOFVVGSSewAFfml4k/aF+I99r9/c6FrD2WnPKxtoRFEdsIOE+8pOduCfevqb9pXxt/wjPgU6HbPsvdfYwAA8iBcGU/QjCfRvavzfr824hzCcaio0na29j2sHRTi5SR7B/wvz4u/9DFJ/wB+YP8A43R/wvz4u/8AQxSf9+YP/jdeP0V8P9exH87+89X2cP5T2D/hfnxd7eIpP+/MH/xurFp8cPjPfzrbWGtz3MrdEit4nc/RVjzXNfC7wNJ8Q/Gdl4c3mK2bdLcuvVII/vY92OFHoWFfqN4Z8I+G/CNium+HNPisYVAB2KNz47u33mPuxNfU5ZhcXjE6ntGorQ8+vOnTdlHU+IdP1j9q3U1DWyagoP8Az2toIP8A0Yi1966d9p+w2323/j48tPM6ff2jd046+lX8CgDFfoWDwTw97zbv3PIqVOfokLRRRXrHOFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH/1f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAy9Z06PVdIvdLmAMd5BJCwPTa6lT+hr8YyMcYxjt/Sv2v7V+LF2ALuYdg7fzr834piv3bPbwL+L5FeitC50u9tLKz1CaMi3v1cxN2by3KOPqCOnoR61n1+cSTW6PXv2Lmn313pd/balYSGK5tJFliYdVdCGU/gQK/XbwN4ptPGvhTTfE1ngLewqzKP4JB8rp/wABYEfhX4+19kfso+OPJvb7wHeyfLcg3drn++oAkQfVcMB22mvseHcZ7LEexltL8zzsZSvDmXQ+6KKaD2NOr9ePngooooAKKKKACiiigApDwKO1eTfGnxr/AMIL4A1DUrd9l9cj7La44IllBG4f7igv+FYV60aVOVSWyRUYttJHwd8d/Gn/AAmfxDvZbV99jpn+h2+PussRO9x2+Z8kH+7trxrB2hu36fhRXuHxH8Ef8IV8OvBCXMey/wBTN7d3ORhgZFg2If8AdQKMdjmvwqoqmJdTES6av57H1StTSgvQ8PoooryzoPsT9kLTo5NX8R6oR89vBbwqfaZmY/8AosflX3XgV8W/sfAeR4qP+1ZD9Jq+06/bMhilgYW8/wAz5jFP96wooor6Q4gooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/W/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBD0r8Wbz/AI+5/wDfb+dftMelfi1d/wDH5P8A77/zr864q2pntYH7R9T6Z4H/AOEv/Zrju7WPfqGiXNzdRbR8zIG/ep+K/MPUqBXydX6VfszIr/Ce1RhlTcXAweeC/T6V8RfF/wAFHwF471DRokK2UrfaLU9jBLkqo/3TlP8AgNeHmWDt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0f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAG/dr5q+NFz8bE1m0tvhms39nNbAzGFIT+93sPvSDcPl29MCvpem7RXJiaHtqfs+Zr0NYS5ZXtc/M3WvAf7Q3iMFNetNSv0P8E04ZB9E37R+Armf+FHfFj/AKFu4/76T/Gv1aor5aXDlGTvKbZ3RxrWyR+Uv/Cjfix/0Llx+af/ABVH/Cjfix/0Llx+af8AxVfq1RWX+rGG/mZX16XZH5S/8KO+LH/Qt3H/AH0n+NH/AAo74sf9C3cf99J/jX6tUU1wxh19pi+uz2sj829G8MftLeH0WHSI9UgiQYWP7Qrxrj0R2Kj8q+p/gldfFy4GrL8UkkURiAWZkjhQnO/zP9UBnonX8K98wKAMV6+EypYeakqjaXR7GFSvzqzSFpOgpaK+hOIb96vjv4mT/tGzeLdTtfCK3S6IrILYwLAuV2Luw5Af72ep+lfYuBRgV5+Lwvt4KHM16GtOfI72PzB1j4Z/HrxA4k13TtR1Ajp584kx9NznH4YrE/4Ub8WP+hcuPzT/AOKr9WcClr5qXDdGWsptncsbLokflL/wo34sf9C5cfmn/wAVR/wo34sf9C5cfmn/AMVX6tUVn/qxhv5mV9el2R+Uv/Cjvix/0Ldx/wB9J/jTk+CPxbjYPH4cuVYHIIZAQfb5q/ViimuGMOtpMX12e1kfnRpOkftQ6Koj08aoqKMKskyTIuOwWQsAPbFfZHwnn8d3PhNJPiKrJrHnSA7kjjby+NvyxAL+lenYFGBXuYPLfq0+ZVG12exzVK3OrWSFooor3DkCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//S/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKK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l8pAZZsRrJsYlfmCZ4/YnAo4x+lAHxH8QtW+Pet63Z+H/hP8KdU8LQeK9X00+JPEd9qekRyW+nwvFHcPbwWt/PI0ptk2BlCso+6pbaR9F/GQeIZvhh4n0/wnoVx4i1bUdOu7S2s7aW2gZpJ4XjQs91NDGqBiNx3FgOit0r1HAowKAPAPCnguP4lfAGw+G3xl8Hy6bHc6Vb6Xqel3strNlooURnjks5p02h13ROGDqVDbVYCvmv8AYX/Za8T/ALK3iX4seFNSkN74f1O90640W/JXNzaqk+VdV+7LFuCOMAE/MvykV+ieAKMCgD82/wDgor4K/ae+L3gPTvhD8AvCj6po2rOLjXL4X9jaBkhYGG0CXM8TsrOBJIQuPlRQTlwNf4a2XxT/AGbvgNpvwr+CPwK1vVdY022Ym51LUdAs7a51GUZkupjFqk0rK0nIXaCECxhgACP0NwKAMUAeSfAvQfFXhn4O+DNE8dlz4mttKtTq291lYahIge6BeMsjETM4ypKn+E4r1ykAxS0AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf//V/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9f9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//Q/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9L9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//T/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1P38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9X9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//W/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1/38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9D9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//R/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9k=" alt="M&H Assistenz"/>
  © 2025 M&amp;H Assistenz · KI-Automatisierung · Alle Rechte vorbehalten
</footer>

<!-- MODAL -->
<div class="modal-overlay" id="modalOverlay">
  <div class="modal" id="modal">
    <div class="modal-header">
      <div>
        <div class="modal-header-title">Vorbereitung für dein Gespräch</div>
        <div class="modal-header-sub" id="modalHeaderSub">Damit wir uns optimal vorbereiten können — ca. 5 Min.</div>
      </div>
      <button class="modal-close" id="modalClose">✕</button>
    </div>
    <div class="modal-progress">
      <div class="modal-progress-track"><div class="modal-progress-fill" id="modalProgressFill"></div></div>
      <span class="modal-progress-label" id="modalProgressLabel">0 %</span>
    </div>
    <div class="modal-body" id="modalBody">
      <form id="mainForm" novalidate>

        <div class="form-section">
          <div class="section-header">
            <div class="section-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
            <div><span class="section-num">01/07</span><span class="section-title">Grunddaten</span></div>
          </div>
          <div class="field-group">
            <div class="field-row-2">
              <div class="field"><label for="fn">Name <span class="req">*</span></label><input type="text" id="fn" name="name" placeholder="Dein vollständiger Name" required/><span class="field-error" id="err_name">Pflichtfeld</span></div>
              <div class="field"><label for="fe">E-Mail <span class="req">*</span></label><input type="email" id="fe" name="email" placeholder="Deine E-Mail-Adresse" required/><span class="field-error" id="err_email">Gültige E-Mail erforderlich</span></div>
            </div>
            <div class="field"><label for="fw">Website <span class="opt">(optional)</span></label><input type="url" id="fw" name="website" placeholder="URL deiner Website"/></div>
            <div class="field-row-2">
              <div class="field"><label for="fc">Firmenname <span class="req">*</span></label><input type="text" id="fc" name="company" placeholder="Name deines Unternehmens" required/><span class="field-error" id="err_company">Pflichtfeld</span></div>
              <div class="field"><label for="fi">Branche <span class="req">*</span></label><input type="text" id="fi" name="industry" placeholder="Deine Branche" required/><span class="field-error" id="err_industry">Pflichtfeld</span></div>
            </div>
            <div class="field"><label for="ft">Teamgröße</label><select id="ft" name="team_size"><option value="" disabled selected>Bitte wählen …</option><option value="1">Nur ich</option><option value="2-5">2–5 Personen</option><option value="6-20">6–20 Personen</option><option value="21-50">21–50 Personen</option><option value="50+">50+ Personen</option></select></div>
          </div>
        </div>

        <div class="form-section">
          <div class="section-header"><div class="section-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div><div><span class="section-num">02/07</span><span class="section-title">Dein Geschäft</span></div></div>
          <div class="field-group">
            <div class="field"><label for="fp">Was bietest du an?</label><textarea id="fp" name="product" placeholder="Beschreibe kurz was du verkaufst."></textarea></div>
            <div class="field"><label for="fcu">Wer ist dein typischer Kunde?</label><textarea id="fcu" name="customer" placeholder="Branche, Größe, typische Situation."></textarea></div>
            <div class="field"><label for="fsp">Von Anfrage bis Kunde — wie läuft das ab?</label><textarea id="fsp" name="sales_process" placeholder="Beschreibe die Schritte kurz."></textarea></div>
          </div>
        </div>

        <div class="form-section">
          <div class="section-header"><div class="section-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div><span class="section-num">03/07</span><span class="section-title">Leadquellen</span></div></div>
          <div class="field-group">
            <div class="field"><label>Wie finden Kunden dich?</label>
              <div class="choice-grid">
                <div class="choice-item"><input type="checkbox" id="ls1" name="lead_sources[]" value="Empfehlungen"/><label class="choice-label" for="ls1"><span class="cdot"></span>Empfehlungen</label></div>
                <div class="choice-item"><input type="checkbox" id="ls2" name="lead_sources[]" value="Google / SEO"/><label class="choice-label" for="ls2"><span class="cdot"></span>Google / SEO</label></div>
                <div class="choice-item"><input type="checkbox" id="ls3" name="lead_sources[]" value="Social Media"/><label class="choice-label" for="ls3"><span class="cdot"></span>Social Media</label></div>
                <div class="choice-item"><input type="checkbox" id="ls4" name="lead_sources[]" value="Bezahlte Werbung"/><label class="choice-label" for="ls4"><span class="cdot"></span>Bezahlte Werbung</label></div>
                <div class="choice-item"><input type="checkbox" id="ls5" name="lead_sources[]" value="Cold Outreach"/><label class="choice-label" for="ls5"><span class="cdot"></span>Cold Outreach</label></div>
                <div class="choice-item"><input type="checkbox" id="ls6" name="lead_sources[]" value="Zugekaufte Leads"/><label class="choice-label" for="ls6"><span class="cdot"></span>Leads</label></div>
                <div class="choice-item"><input type="checkbox" id="ls7" name="lead_sources[]" value="Andere" data-reveal="ls_other"/><label class="choice-label" for="ls7"><span class="cdot"></span>Andere</label></div>
              </div>
              <div class="other-field" id="ls_other"><input type="text" name="lead_source_other" placeholder="Weitere Quellen"/></div>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="section-header"><div class="section-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div><div><span class="section-num">04/07</span><span class="section-title">Zeitfresser & Engpässe</span></div></div>
          <div class="field-group">
            <div class="field"><label for="fll">Wo verlierst du gerade Leads?</label><textarea id="fll" name="lost_leads" placeholder="Wo stockt der Prozess?"></textarea></div>
            <div class="field"><label for="frep">Was machst du täglich manuell, obwohl es sich wiederholt?</label><textarea id="frep" name="repetitive" placeholder="Aufgaben die sich immer gleich anfühlen."></textarea></div>
            <div class="field"><label for="ft3">Deine 3 größten Zeitfresser pro Woche?</label><textarea id="ft3" name="top3" placeholder="Nenne die drei Aufgaben die dich am meisten Zeit kosten."></textarea></div>
            <div class="field"><label for="fma">Was würdest du als erstes automatisieren?</label><textarea id="fma" name="one_auto" placeholder="Dein persönlicher Wunsch."></textarea></div>
          </div>
        </div>

        <div class="form-section">
          <div class="section-header"><div class="section-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div><span class="section-num">05/07</span><span class="section-title">Vertrieb</span></div></div>
          <div class="field-group">
            <div class="field"><label>Wer macht den Verkauf?</label>
              <div class="choice-grid">
                <div class="choice-item"><input type="radio" id="sw1" name="sales_who" value="Nur ich"/><label class="choice-label" for="sw1"><span class="cdot"></span>Nur ich</label></div>
                <div class="choice-item"><input type="radio" id="sw2" name="sales_who" value="Ich + 1–2 Personen"/><label class="choice-label" for="sw2"><span class="cdot"></span>Ich + 1–2 Personen</label></div>
                <div class="choice-item"><input type="radio" id="sw3" name="sales_who" value="Sales Team (3+)"/><label class="choice-label" for="sw3"><span class="cdot"></span>Sales Team (3+)</label></div>
                <div class="choice-item"><input type="radio" id="sw4" name="sales_who" value="Kein aktiver Verkauf"/><label class="choice-label" for="sw4"><span class="cdot"></span>Kein aktiver Verkauf</label></div>
              </div>
            </div>
            <div class="field"><label for="fdp">Was hindert euch aktuell am Abschluss?</label><textarea id="fdp" name="deal_problem" placeholder="Was passiert kurz vor dem Ja?"></textarea></div>
            <div class="field"><label for="fay">Was kostet nach dem Ja die meiste Zeit?</label><textarea id="fay" name="after_yes" placeholder="Was passiert nach dem Vertragsabschluss?"></textarea></div>
          </div>
        </div>

        <div class="form-section">
          <div class="section-header"><div class="section-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div><span class="section-num">06/07</span><span class="section-title">Kommunikation</span></div></div>
          <div class="field-group">
            <div class="field"><label>Wo kommunizierst du mit Kunden?</label>
              <div class="choice-grid">
                <div class="choice-item"><input type="checkbox" id="cc1" name="comm[]" value="E-Mail"/><label class="choice-label" for="cc1"><span class="cdot"></span>E-Mail</label></div>
                <div class="choice-item"><input type="checkbox" id="cc2" name="comm[]" value="WhatsApp"/><label class="choice-label" for="cc2"><span class="cdot"></span>WhatsApp</label></div>
                <div class="choice-item"><input type="checkbox" id="cc3" name="comm[]" value="CRM"/><label class="choice-label" for="cc3"><span class="cdot"></span>CRM</label></div>
                <div class="choice-item"><input type="checkbox" id="cc4" name="comm[]" value="Social Media"/><label class="choice-label" for="cc4"><span class="cdot"></span>Social Media</label></div>
                <div class="choice-item"><input type="checkbox" id="cc5" name="comm[]" value="Telefon"/><label class="choice-label" for="cc5"><span class="cdot"></span>Telefon</label></div>
                <div class="choice-item"><input type="checkbox" id="cc6" name="comm[]" value="Andere" data-reveal="cc_other"/><label class="choice-label" for="cc6"><span class="cdot"></span>Andere</label></div>
              </div>
              <div class="other-field" id="cc_other"><input type="text" name="comm_other" placeholder="Weitere Kanäle"/></div>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="section-header"><div class="section-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div><div><span class="section-num">07/07</span><span class="section-title">Dein Ziel</span></div></div>
          <div class="field-group">
            <div class="field"><label for="fg">Was wäre dein größter Gewinn durch Automatisierung?</label><textarea id="fg" name="goal" style="min-height:100px;" placeholder="Was wäre für dich der wichtigste Gewinn?"></textarea></div>
          </div>
        </div>

        <button type="submit" class="modal-submit-btn" id="submitBtn">
          <span class="spin" id="btnSpin"></span>
          <span class="btn-text">Termin bestätigen & absenden →</span>
        </button>
        <p class="modal-note"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Deine Angaben werden vertraulich behandelt.</p>
      </form>
    </div>

    <div class="modal-success" id="modalSuccess">
      <div class="success-icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1f7a4a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
      <h2 class="success-title">Termin erfolgreich gebucht!</h2>
      <p class="success-msg">Wir bereiten alles für dich vor. Klicke jetzt um deinen Video-Call Termin direkt in deinem Kalender zu bestätigen.</p>
      <a href="https://calendar.google.com/calendar/appointments" target="_blank" class="success-redirect-btn">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Video-Call im Kalender bestätigen →
      </a>
      <p class="success-note" id="successNote">Du erhältst außerdem eine Bestätigung per E-Mail.</p>
    </div>
  </div>
</div>

<script>
const WEBHOOK = 'https://n8nmhassistenz.uk/webhook/customform';
// ⚠️ WICHTIG: Ersetze diese URL mit deinem echten Google Calendar Appointment Link
const CALENDAR_LINK = 'https://calendar.google.com/calendar/appointments';

/* ── CALENDAR ── */
const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
// Uhrzeiten nur 15:00 – 20:00
const TIMES = ['15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00'];

let curYear, curMonth, selDate = null, selTime = null;

function initCal() {
  const n = new Date();
  curYear = n.getFullYear(); curMonth = n.getMonth();
  renderCal();
}

function renderCal() {
  document.getElementById('calMonthTitle').textContent = MONTHS[curMonth] + ' ' + curYear;
  const grid = document.getElementById('calDays');
  grid.innerHTML = '';
  const firstDay = new Date(curYear, curMonth, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const days = new Date(curYear, curMonth + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < offset; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day empty'; grid.appendChild(e);
  }
  for (let d = 1; d <= days; d++) {
    const e = document.createElement('div');
    const date = new Date(curYear, curMonth, d);
    const past = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    e.className = 'cal-day';
    e.textContent = d;
    if (past) {
      e.classList.add('disabled');
    } else {
      const isToday = d === today.getDate() && curMonth === today.getMonth() && curYear === today.getFullYear();
      if (isToday) e.classList.add('today');
      const ds = `${curYear}-${String(curMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (selDate === ds) e.classList.add('selected');
      e.addEventListener('click', () => selectDate(ds, e));
    }
    grid.appendChild(e);
  }
}

function selectDate(ds, el) {
  selDate = ds; selTime = null;
  document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
  const [y,m,d] = ds.split('-');
  document.getElementById('timeSlotsLabel').textContent = 'Verfügbare Zeiten — ' + d + '.' + m + '.' + y + ' (15:00–20:00 Uhr)';
  const slots = document.getElementById('timeSlots');
  slots.innerHTML = '';
  TIMES.forEach(t => {
    const btn = document.createElement('div');
    btn.className = 'time-slot';
    btn.textContent = t + ' Uhr';
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
      btn.classList.add('selected');
      selTime = t;
      document.getElementById('calBookBtn').classList.add('visible');
    });
    slots.appendChild(btn);
  });
  document.getElementById('timeSlotsWrap').classList.add('visible');
  document.getElementById('calBookBtn').classList.remove('visible');
}

document.getElementById('calPrev').addEventListener('click', () => { curMonth--; if(curMonth<0){curMonth=11;curYear--;} renderCal(); });
document.getElementById('calNext').addEventListener('click', () => { curMonth++; if(curMonth>11){curMonth=0;curYear++;} renderCal(); });
document.getElementById('calBookBtn').addEventListener('click', openModal);
initCal();

/* ── MODAL ── */
function openModal() {
  document.getElementById('modalOverlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
  if (selDate && selTime) {
    const [y,m,d] = selDate.split('-');
    document.getElementById('modalHeaderSub').textContent = 'Termin: ' + d + '.' + m + '.' + y + ' um ' + selTime + ' Uhr';
  }
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('visible');
  document.body.style.overflow = '';
}
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if(e.target===e.currentTarget) closeModal(); });

/* ── PROGRESS ── */
function updateProgress() {
  const inputs = document.querySelectorAll('#mainForm input:not([type=submit]):not([type=checkbox]):not([type=radio]), #mainForm select, #mainForm textarea');
  const checked = document.querySelectorAll('#mainForm input[type=checkbox]:checked, #mainForm input[type=radio]:checked');
  let filled = 0;
  inputs.forEach(el => { if(el.value.trim()) filled++; });
  filled += checked.length;
  const pct = Math.min(Math.round((filled/(inputs.length+8))*100),100);
  document.getElementById('modalProgressFill').style.width = pct+'%';
  document.getElementById('modalProgressLabel').textContent = pct+' %';
}
document.getElementById('mainForm').addEventListener('input', updateProgress);
document.getElementById('mainForm').addEventListener('change', updateProgress);

/* ── REVEAL OTHER ── */
document.querySelectorAll('[data-reveal]').forEach(cb => {
  cb.addEventListener('change', () => {
    const t = document.getElementById(cb.dataset.reveal);
    if(t) t.classList.toggle('visible', cb.checked);
  });
});

/* ── VALIDATE ── */
[['fn','err_name'],['fe','err_email'],['fc','err_company'],['fi','err_industry']].forEach(([id,eid]) => {
  document.getElementById(id)?.addEventListener('input', () => {
    document.getElementById(id).classList.remove('error');
    document.getElementById(eid).classList.remove('visible');
  });
});
function validate() {
  let ok = true;
  [['fn','err_name',v=>v.trim().length>0],
   ['fe','err_email',v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())],
   ['fc','err_company',v=>v.trim().length>0],
   ['fi','err_industry',v=>v.trim().length>0]
  ].forEach(([id,eid,fn]) => {
    const el = document.getElementById(id);
    const valid = fn(el.value);
    el.classList.toggle('error',!valid);
    document.getElementById(eid).classList.toggle('visible',!valid);
    if(!valid) ok=false;
  });
  return ok;
}

/* ── COLLECT ── */
function collect() {
  const g = id => document.getElementById(id)?.value.trim()??'';
  const radio = n => document.querySelector(`input[name="${n}"]:checked`)?.value??'';
  const checks = n => [...document.querySelectorAll(`input[name="${n}"]:checked`)].map(e=>e.value);
  return {
    appointment_date: selDate??'', appointment_time: selTime??'',
    name:g('fn'), email:g('fe'), website:g('fw'), company:g('fc'), industry:g('fi'), team_size:g('ft'),
    product:g('fp'), customer:g('fcu'), sales_process:g('fsp'),
    lead_sources:checks('lead_sources[]'), lead_source_other:document.querySelector('[name="lead_source_other"]')?.value.trim()??'',
    lost_leads:g('fll'), repetitive:g('frep'), top3:g('ft3'), one_auto:g('fma'),
    sales_who:radio('sales_who'), deal_problem:g('fdp'), after_yes:g('fay'),
    comm_channels:checks('comm[]'), comm_other:document.querySelector('[name="comm_other"]')?.value.trim()??'',
    goal:g('fg'), submitted_at:new Date().toISOString()
  };
}

/* ── SUBMIT ── */
document.getElementById('mainForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  if(!validate()){
    document.querySelector('.field-error.visible')?.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  const btn = document.getElementById('submitBtn');
  btn.disabled=true; btn.classList.add('loading');

  try {
    await fetch(WEBHOOK, {method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(collect())});
  } catch(err) {}

  // Update success note with booking details
  if(selDate && selTime) {
    const [y,m,d] = selDate.split('-');
    document.getElementById('successNote').textContent = 'Gebuchter Termin: '+d+'.'+m+'.'+y+' um '+selTime+' Uhr';
  }

  document.getElementById('modalProgressFill').style.width='100%';
  document.getElementById('modalProgressLabel').textContent='100 %';
  document.getElementById('modalBody').style.display='none';
  document.getElementById('modalSuccess').classList.add('visible');

  // Auto-open calendar link after 1.5s
  setTimeout(() => {
    window.open(CALENDAR_LINK, '_blank');
  }, 1500);
});
</script>
</body>
</html>
