import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ─────────────────────────────────────────────────────────────
   DATA
───────────────────────────────────────────────────────────── */
const PRODUCTS_FALLBACK = [
  // Chemical Cleaners
  { id:1,  name:'Floor Cleaner',           base_price:35,  gst_percent:18, unit:'L',    category:'Chemical Cleaners', emoji:'🧹', color:'#2563eb' },
  { id:2,  name:'Toilet Cleaner',          base_price:40,  gst_percent:18, unit:'L',    category:'Chemical Cleaners', emoji:'🚽', color:'#7c3aed' },
  { id:3,  name:'Phenyl Black',            base_price:30,  gst_percent:18, unit:'L',    category:'Chemical Cleaners', emoji:'🪣', color:'#1e293b' },
  { id:4,  name:'Phenyl White',            base_price:35,  gst_percent:18, unit:'L',    category:'Chemical Cleaners', emoji:'🪣', color:'#64748b' },
  { id:5,  name:'Disinfectant / Sanitizer',base_price:80,  gst_percent:18, unit:'L',    category:'Chemical Cleaners', emoji:'🧴', color:'#dc2626' },
  { id:6,  name:'Dish Wash Liquid',        base_price:38,  gst_percent:18, unit:'L',    category:'Chemical Cleaners', emoji:'🍽️', color:'#0ea5e9' },
  { id:7,  name:'Dish Wash Bar',           base_price:8,   gst_percent:18, unit:'g',    category:'Chemical Cleaners', emoji:'🫧', color:'#06b6d4' },
  { id:8,  name:'Glass & Surface Cleaner', base_price:95,  gst_percent:18, unit:'L',    category:'Chemical Cleaners', emoji:'🪟', color:'#0891b2' },
  { id:9,  name:'Bathroom & Tile Cleaner', base_price:42,  gst_percent:18, unit:'L',    category:'Chemical Cleaners', emoji:'🚿', color:'#6366f1' },
  { id:10, name:'Kitchen Degreaser',       base_price:115, gst_percent:18, unit:'L',    category:'Chemical Cleaners', emoji:'🍳', color:'#f59e0b' },
  { id:11, name:'Urinal Cube / Blocks',    base_price:12,  gst_percent:18, unit:'pc',   category:'Chemical Cleaners', emoji:'🧊', color:'#22d3ee' },
  // Cleaning Tools
  { id:22, name:'String Mop',              base_price:120, gst_percent:18, unit:'pc',   category:'Cleaning Tools', emoji:'🧹', color:'#16a34a' },
  { id:23, name:'Flat Mop with Frame',     base_price:220, gst_percent:18, unit:'pc',   category:'Cleaning Tools', emoji:'🧹', color:'#15803d' },
  { id:24, name:'Spin Mop Set',            base_price:380, gst_percent:18, unit:'set',  category:'Cleaning Tools', emoji:'🌀', color:'#059669' },
  { id:25, name:'Floor Wiper / Squeegee',  base_price:85,  gst_percent:18, unit:'pc',   category:'Cleaning Tools', emoji:'🫧', color:'#10b981' },
  { id:26, name:'Window Squeegee',         base_price:65,  gst_percent:18, unit:'pc',   category:'Cleaning Tools', emoji:'🪟', color:'#34d399' },
  { id:27, name:'Indoor Broom',            base_price:65,  gst_percent:18, unit:'pc',   category:'Cleaning Tools', emoji:'🧹', color:'#22c55e' },
  { id:28, name:'Toilet Brush Set',        base_price:55,  gst_percent:18, unit:'set',  category:'Cleaning Tools', emoji:'🪥', color:'#4ade80' },
  { id:29, name:'Hard Bristle Scrub Brush',base_price:45,  gst_percent:18, unit:'pc',   category:'Cleaning Tools', emoji:'🪥', color:'#84cc16' },
  { id:30, name:'Mop Bucket Single',       base_price:280, gst_percent:18, unit:'pc',   category:'Cleaning Tools', emoji:'🪣', color:'#65a30d' },
  { id:31, name:'Mop Bucket Double Wringer',base_price:480,gst_percent:18, unit:'pc',   category:'Cleaning Tools', emoji:'🪣', color:'#4d7c0f' },
  { id:32, name:'Microfiber Cloth Set',    base_price:95,  gst_percent:18, unit:'pc',   category:'Cleaning Tools', emoji:'🧻', color:'#166534' },
  // Consumables
  { id:12, name:'Garbage Bags Small 30L',  base_price:45,  gst_percent:12, unit:'pc',   category:'Consumables', emoji:'🛍️', color:'#ea580c' },
  { id:13, name:'Garbage Bags Medium 60L', base_price:65,  gst_percent:12, unit:'pc',   category:'Consumables', emoji:'🛍️', color:'#f97316' },
  { id:14, name:'Garbage Bags Large 120L', base_price:95,  gst_percent:12, unit:'pc',   category:'Consumables', emoji:'🛍️', color:'#fb923c' },
  { id:15, name:'Toilet Paper Rolls',      base_price:18,  gst_percent:12, unit:'roll', category:'Consumables', emoji:'🧻', color:'#fbbf24' },
  { id:16, name:'Kitchen Tissue Rolls',    base_price:22,  gst_percent:12, unit:'roll', category:'Consumables', emoji:'🧻', color:'#f59e0b' },
  { id:17, name:'Hand Towel Rolls Jumbo',  base_price:85,  gst_percent:12, unit:'roll', category:'Consumables', emoji:'🧻', color:'#d97706' },
  { id:18, name:'Facial Tissue / Napkins', base_price:45,  gst_percent:12, unit:'pc',   category:'Consumables', emoji:'🤧', color:'#b45309' },
  { id:19, name:'Rubber Gloves',           base_price:35,  gst_percent:12, unit:'pair', category:'Consumables', emoji:'🧤', color:'#92400e' },
  { id:20, name:'Disposable Nitrile Gloves',base_price:280,gst_percent:12, unit:'pc',   category:'Consumables', emoji:'🧤', color:'#78350f' },
  { id:21, name:'Scrubbing Pads',          base_price:12,  gst_percent:12, unit:'pc',   category:'Consumables', emoji:'🧽', color:'#7c2d12' },
];

const CATEGORY_META = {
  'Chemical Cleaners': {
    icon: '⚗️',
    tagline: 'Professional-grade formulas for every surface',
    img: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=600&q=80',
    gradient: 'linear-gradient(135deg,#1e40af,#2563eb)',
  },
  'Cleaning Tools': {
    icon: '🧹',
    tagline: 'Durable equipment built for daily commercial use',
    img: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=600&q=80',
    gradient: 'linear-gradient(135deg,#166534,#16a34a)',
  },
  'Consumables': {
    icon: '📦',
    tagline: 'High-volume consumables delivered on schedule',
    img: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=600&q=80',
    gradient: 'linear-gradient(135deg,#9a3412,#ea580c)',
  },
};

const STATS = [
  { value: 200, suffix: '+', label: 'Business Clients' },
  { value: 31,  suffix: '+', label: 'Product SKUs' },
  { value: 7,   suffix: '',  label: 'Cities Served' },
  { value: 99,  suffix: '%', label: 'On-time Delivery' },
];

const USPS = [
  { icon: '🏭', title: 'Bulk B2B Supply',      desc: 'Minimum order quantities designed for hotels, hospitals, offices and commercial spaces.' },
  { icon: '🚚', title: 'Reliable Delivery',    desc: 'Consistent supply schedules. Never run out of essentials again with our auto-replenishment options.' },
  { icon: '💰', title: 'Competitive Pricing',  desc: 'Direct-from-manufacturer pricing with GST-compliant invoices. Volume discounts available.' },
  { icon: '📋', title: 'Digital Ordering',     desc: 'Your dedicated portal for placing orders, tracking deliveries and managing invoices online.' },
  { icon: '✅', title: 'Quality Assured',      desc: 'All products tested for efficacy. ISO-compliant manufacturing with batch traceability.' },
  { icon: '🤝', title: 'Dedicated Support',    desc: 'Personal account manager for every client. WhatsApp support for urgent requirements.' },
];

const HOW_STEPS = [
  { num: '01', icon: '📞', title: 'Request Account',   desc: 'Fill the form below or WhatsApp us. Our team onboards you within 24 hours.' },
  { num: '02', icon: '🔗', title: 'Get Your Portal',   desc: 'Receive your personalised order portal link. Browse all products with your negotiated prices.' },
  { num: '03', icon: '📦', title: 'Place & Track',     desc: 'Order anytime, track delivery status, download GST invoices — all in one place.' },
];

/* ─────────────────────────────────────────────────────────────
   HOOKS
───────────────────────────────────────────────────────────── */
function useCountUp(target, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(ease * target));
      if (progress < 1) requestAnimationFrame(step);
      else setCount(target);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

function useInView(options = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold: 0.15, ...options });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

/* ─────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────── */
function StatCard({ value, suffix, label, trigger }) {
  const count = useCountUp(value, 1600, trigger);
  return (
    <div style={{ textAlign: 'center', padding: '0 24px' }}>
      <div style={{ fontSize: 42, fontWeight: 900, color: '#fff', lineHeight: 1, fontFamily: 'system-ui' }}>
        {count}{suffix}
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

function ProductCard({ product, idx }) {
  const [ref, inView] = useInView();
  const [hovered, setHovered] = useState(false);
  return (
    <div ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: hovered ? '0 20px 50px rgba(0,0,0,0.13)' : '0 2px 12px rgba(0,0,0,0.06)',
        transform: inView ? (hovered ? 'translateY(-6px) scale(1.01)' : 'translateY(0) scale(1)') : 'translateY(30px)',
        opacity: inView ? 1 : 0,
        transition: `transform 0.35s cubic-bezier(.34,1.56,.64,1), opacity 0.5s ease ${idx * 0.04}s, box-shadow 0.3s ease`,
        cursor: 'default',
      }}>
      {/* Coloured top band */}
      <div style={{ height: 6, background: product.color || '#2563eb' }} />
      <div style={{ padding: '18px 16px 16px' }}>
        {/* Emoji icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: `${product.color || '#2563eb'}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, marginBottom: 12,
          border: `1.5px solid ${product.color || '#2563eb'}22`,
        }}>
          {product.emoji || '🧴'}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1.35, marginBottom: 6 }}>
          {product.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, background: '#f1f5f9',
                        padding: '3px 8px', borderRadius: 20 }}>
            per {product.unit}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
            GST {product.gst_percent}%
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN
───────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [products, setProducts]     = useState(PRODUCTS_FALLBACK);
  const [activeCategory, setActiveCat] = useState('all');
  const [navScrolled, setNavScrolled]  = useState(false);
  const [statsRef, statsInView]        = useInView();
  const [formOpen, setFormOpen]        = useState(false);
  const [form, setForm]   = useState({ name:'', business_name:'', phone:'', city:'', message:'' });
  const [submitting, setSubmitting]    = useState(false);
  const [submitResult, setSubmitResult]= useState(null);
  const orderRef = useRef(null);

  /* Fetch live products */
  useEffect(() => {
    fetch('/api/public/catalog')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length) {
          const enriched = data.map(p => {
            const fb = PRODUCTS_FALLBACK.find(f => f.id === p.id);
            return { ...p, emoji: fb?.emoji || '🧴', color: fb?.color || '#2563eb' };
          });
          setProducts(enriched);
        }
      }).catch(() => {});
  }, []);

  /* Sticky nav shadow */
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const categories = ['all', ...Object.keys(CATEGORY_META)];
  const filtered   = activeCategory === 'all' ? products : products.filter(p => p.category === activeCategory);

  const scrollToOrder = () => orderRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/public/order-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setSubmitResult(data);
    } catch { setSubmitResult({ type: 'inquiry', message: 'Request received! Our team will contact you within 24 hours.' }); }
    finally { setSubmitting(false); }
  };

  /* ── CSS keyframes injected once ── */
  return (
    <>
      <style>{`
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float1 { 0%,100%{transform:translate(0,0) scale(1);} 33%{transform:translate(30px,-20px) scale(1.05);} 66%{transform:translate(-20px,15px) scale(0.97);} }
        @keyframes float2 { 0%,100%{transform:translate(0,0) scale(1);} 33%{transform:translate(-25px,20px) scale(1.04);} 66%{transform:translate(20px,-15px) scale(0.98);} }
        @keyframes float3 { 0%,100%{transform:translate(0,0);} 50%{transform:translate(15px,-25px);} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(28px);} to{opacity:1;transform:translateY(0);} }
        @keyframes pulse  { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.5);} 50%{box-shadow:0 0 0 12px rgba(34,197,94,0);} }
        @keyframes shimmer { 0%{background-position:-400px 0;} 100%{background-position:400px 0;} }
        .arom-btn-primary { background:linear-gradient(135deg,#2563eb,#1d4ed8); color:#fff; border:none; padding:14px 32px; border-radius:12px; font-size:15px; font-weight:700; cursor:pointer; transition:all 0.25s; }
        .arom-btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(37,99,235,0.5); }
        .arom-btn-outline { background:transparent; color:#fff; border:2px solid rgba(255,255,255,0.6); padding:13px 30px; border-radius:12px; font-size:15px; font-weight:700; cursor:pointer; transition:all 0.25s; }
        .arom-btn-outline:hover { background:rgba(255,255,255,0.1); border-color:#fff; }
        .cat-tab { padding:9px 20px; border-radius:99px; border:2px solid #e2e8f0; background:#fff; font-size:13px; font-weight:700; cursor:pointer; transition:all 0.2s; color:#475569; }
        .cat-tab:hover { border-color:#2563eb; color:#2563eb; }
        .cat-tab.active { background:#2563eb; color:#fff; border-color:#2563eb; box-shadow:0 4px 12px rgba(37,99,235,0.35); }
        .usp-card:hover { transform:translateY(-5px); box-shadow:0 16px 40px rgba(0,0,0,0.1); }
        .step-card:hover { transform:translateY(-4px); }
        ::-webkit-scrollbar{width:6px;} ::-webkit-scrollbar-track{background:#f1f5f9;} ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px;}
      `}</style>

      <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', background: '#f8fafc', color: '#0f172a' }}>

        {/* ── NAVBAR ─────────────────────────────────────── */}
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 5vw', height: 64,
          background: navScrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
          backdropFilter: navScrolled ? 'blur(12px)' : 'none',
          boxShadow: navScrolled ? '0 1px 20px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10,
                          background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18 }}>✨</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: navScrolled ? '#0f172a' : '#fff',
                            letterSpacing: '-0.02em' }}>AROMADELITE</div>
              <div style={{ fontSize: 10, color: navScrolled ? '#64748b' : 'rgba(255,255,255,0.7)',
                            fontWeight: 600, letterSpacing: '0.08em', marginTop: -2 }}>SRI VEMURI SAI ENT.</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="#products" style={{ fontSize: 13, fontWeight: 600, color: navScrolled ? '#475569' : 'rgba(255,255,255,0.85)',
                                          textDecoration: 'none' }}>Products</a>
            <a href="#how" style={{ fontSize: 13, fontWeight: 600, color: navScrolled ? '#475569' : 'rgba(255,255,255,0.85)',
                                     textDecoration: 'none' }}>How It Works</a>
            <button onClick={scrollToOrder}
              style={{ padding: '8px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                       background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', cursor: 'pointer',
                       boxShadow: '0 4px 12px rgba(37,99,235,0.4)' }}>
              Order Now
            </button>
          </div>
        </nav>

        {/* ── HERO ───────────────────────────────────────── */}
        <section style={{
          minHeight: '100vh', position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center',
          background: 'linear-gradient(135deg,#0d1117 0%,#0f2044 40%,#0d1117 100%)',
          backgroundSize: '300% 300%',
          animation: 'gradientShift 12s ease infinite',
        }}>
          {/* Animated blobs */}
          {[
            { w:520, h:520, top:'-10%', left:'-8%',  bg:'radial-gradient(circle,rgba(37,99,235,0.35) 0%,transparent 70%)',  anim:'float1 14s ease-in-out infinite' },
            { w:420, h:420, top:'30%',  right:'-5%', bg:'radial-gradient(circle,rgba(124,58,237,0.3) 0%,transparent 70%)', anim:'float2 18s ease-in-out infinite' },
            { w:300, h:300, bottom:'5%',left:'30%',  bg:'radial-gradient(circle,rgba(34,197,94,0.2) 0%,transparent 70%)',  anim:'float3 10s ease-in-out infinite' },
          ].map((b, i) => (
            <div key={i} style={{ position:'absolute', width:b.w, height:b.h, top:b.top, left:b.left,
                                   right:b.right, bottom:b.bottom, background:b.bg,
                                   animation:b.anim, borderRadius:'50%', filter:'blur(1px)' }} />
          ))}

          {/* Grid overlay */}
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)',
                        backgroundSize:'60px 60px', pointerEvents:'none' }} />

          {/* Hero content */}
          <div style={{ position:'relative', zIndex:2, maxWidth:1200, margin:'0 auto', padding:'100px 5vw 80px',
                        display:'flex', alignItems:'center', gap:'5vw', flexWrap:'wrap' }}>
            <div style={{ flex:'1 1 480px' }}>
              {/* Badge */}
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(34,197,94,0.15)',
                             border:'1px solid rgba(34,197,94,0.3)', borderRadius:99, padding:'6px 16px',
                             marginBottom:24, animation:'fadeUp 0.6s ease both' }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e',
                               display:'inline-block', animation:'pulse 2s infinite' }} />
                <span style={{ fontSize:12, fontWeight:700, color:'#86efac', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                  B2B Cleaning Solutions
                </span>
              </div>

              <h1 style={{ fontSize:'clamp(36px,5vw,62px)', fontWeight:900, color:'#fff', lineHeight:1.1,
                            margin:'0 0 20px', letterSpacing:'-0.03em', animation:'fadeUp 0.7s 0.1s ease both', opacity:0 }}>
                Keep Your Business{' '}
                <span style={{ background:'linear-gradient(135deg,#38bdf8,#818cf8,#86efac)',
                               WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                               backgroundClip:'text' }}>
                  Spotlessly Clean
                </span>
              </h1>

              <p style={{ fontSize:'clamp(15px,2vw,18px)', color:'rgba(255,255,255,0.65)', lineHeight:1.7,
                           maxWidth:520, margin:'0 0 36px', animation:'fadeUp 0.7s 0.2s ease both', opacity:0 }}>
                Professional cleaning supplies for hotels, hospitals, offices, restaurants and facilities.
                Bulk pricing · GST invoices · Dedicated account portal · On-time delivery.
              </p>

              <div style={{ display:'flex', gap:14, flexWrap:'wrap', animation:'fadeUp 0.7s 0.3s ease both', opacity:0 }}>
                <button className="arom-btn-primary" onClick={scrollToOrder}
                  style={{ padding:'14px 32px', background:'linear-gradient(135deg,#2563eb,#7c3aed)',
                           fontSize:15, fontWeight:700, borderRadius:12, border:'none', color:'#fff',
                           cursor:'pointer', boxShadow:'0 8px 30px rgba(37,99,235,0.5)' }}>
                  🛒 Start Ordering
                </button>
                <a href="#products"
                  style={{ padding:'13px 30px', background:'transparent', color:'#fff',
                           border:'2px solid rgba(255,255,255,0.3)', borderRadius:12,
                           fontSize:15, fontWeight:700, cursor:'pointer', textDecoration:'none',
                           display:'inline-flex', alignItems:'center', gap:6 }}>
                  View Catalogue →
                </a>
              </div>

              {/* Trust chips */}
              <div style={{ display:'flex', gap:10, marginTop:28, flexWrap:'wrap',
                             animation:'fadeUp 0.7s 0.4s ease both', opacity:0 }}>
                {['✅ GST Compliant', '🚚 Same-City Delivery', '📋 Digital Invoices', '🔒 Secure Portal'].map(t => (
                  <div key={t} style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.6)',
                                         background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)',
                                         padding:'5px 12px', borderRadius:99 }}>{t}</div>
                ))}
              </div>
            </div>

            {/* Hero visual — floating product cards */}
            <div style={{ flex:'1 1 320px', display:'flex', justifyContent:'center', position:'relative', minHeight:360 }}>
              {[
                { name:'Floor Cleaner',    emoji:'🧹', color:'#2563eb', top:'5%',   left:'15%',  delay:'0s',     rot:'-4deg' },
                { name:'Disinfectant',     emoji:'🧴', color:'#7c3aed', top:'28%',  left:'55%',  delay:'0.4s',   rot:'5deg'  },
                { name:'Spin Mop Set',     emoji:'🌀', color:'#16a34a', top:'55%',  left:'10%',  delay:'0.2s',   rot:'-3deg' },
                { name:'Garbage Bags',     emoji:'🛍️', color:'#ea580c', top:'65%',  left:'55%',  delay:'0.6s',   rot:'6deg'  },
                { name:'Microfiber Cloth', emoji:'🧻', color:'#0891b2', top:'10%',  left:'68%',  delay:'0.15s',  rot:'-6deg' },
              ].map((card, i) => (
                <div key={i} style={{
                  position:'absolute', top:card.top, left:card.left,
                  background:'rgba(255,255,255,0.07)', backdropFilter:'blur(16px)',
                  border:'1px solid rgba(255,255,255,0.15)', borderRadius:16,
                  padding:'14px 18px', minWidth:130,
                  animation:`float${(i%3)+1} ${10+i*2}s ${card.delay} ease-in-out infinite`,
                  transform:`rotate(${card.rot})`,
                }}>
                  <div style={{ fontSize:28, marginBottom:6 }}>{card.emoji}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{card.name}</div>
                  <div style={{ width:'60%', height:3, background:card.color, borderRadius:99, marginTop:6 }} />
                </div>
              ))}
              {/* Centre glow */}
              <div style={{ position:'absolute', top:'40%', left:'40%', width:120, height:120,
                             background:'radial-gradient(circle,rgba(37,99,235,0.5),transparent)',
                             borderRadius:'50%', filter:'blur(20px)' }} />
            </div>
          </div>

          {/* Scroll hint */}
          <div style={{ position:'absolute', bottom:32, left:'50%', transform:'translateX(-50%)', textAlign:'center' }}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', fontWeight:600, marginBottom:8,
                           letterSpacing:'0.1em', textTransform:'uppercase' }}>Scroll to explore</div>
            <div style={{ width:24, height:38, border:'2px solid rgba(255,255,255,0.2)', borderRadius:99,
                           margin:'0 auto', position:'relative' }}>
              <div style={{ position:'absolute', top:6, left:'50%', transform:'translateX(-50%)',
                             width:4, height:4, background:'rgba(255,255,255,0.5)', borderRadius:'50%',
                             animation:'float3 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        </section>

        {/* ── STATS BAR ──────────────────────────────────── */}
        <section ref={statsRef} style={{
          background: 'linear-gradient(135deg,#1e3a5f,#1e40af)',
          padding: '48px 5vw',
        }}>
          <div style={{ maxWidth:900, margin:'0 auto',
                        display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',
                        gap:24, justifyItems:'center' }}>
            {STATS.map(s => <StatCard key={s.label} {...s} trigger={statsInView} />)}
          </div>
        </section>

        {/* ── WHY US ─────────────────────────────────────── */}
        <section style={{ padding:'80px 5vw', background:'#fff' }}>
          <div style={{ maxWidth:1100, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:52 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#2563eb', letterSpacing:'0.1em',
                             textTransform:'uppercase', marginBottom:10 }}>Why Businesses Choose Us</div>
              <h2 style={{ fontSize:'clamp(28px,4vw,42px)', fontWeight:900, color:'#0f172a',
                            margin:0, letterSpacing:'-0.02em' }}>
                Everything Your Facility Needs,<br/>In One Partnership
              </h2>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:20 }}>
              {USPS.map((u, i) => {
                const [ref, inView] = useInView(); // eslint-disable-line
                return (
                  <div key={u.title} ref={ref} className="usp-card"
                    style={{ background:'#f8fafc', borderRadius:16, padding:'24px 22px',
                               border:'1.5px solid #f1f5f9',
                               opacity: inView ? 1 : 0,
                               transform: inView ? 'none' : 'translateY(24px)',
                               transition: `all 0.5s ease ${i * 0.08}s` }}>
                    <div style={{ fontSize:32, marginBottom:14 }}>{u.icon}</div>
                    <div style={{ fontSize:15, fontWeight:800, color:'#0f172a', marginBottom:8 }}>{u.title}</div>
                    <div style={{ fontSize:13, color:'#64748b', lineHeight:1.65 }}>{u.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── CATEGORIES ─────────────────────────────────── */}
        <section style={{ padding:'80px 5vw', background:'#f8fafc' }}>
          <div style={{ maxWidth:1100, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:48 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#2563eb', letterSpacing:'0.1em',
                             textTransform:'uppercase', marginBottom:10 }}>Product Range</div>
              <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:900, color:'#0f172a',
                            margin:0, letterSpacing:'-0.02em' }}>3 Complete Categories</h2>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:24 }}>
              {Object.entries(CATEGORY_META).map(([cat, meta], i) => {
                const [ref, inView] = useInView(); // eslint-disable-line
                const count = products.filter(p => p.category === cat).length;
                return (
                  <div key={cat} ref={ref}
                    style={{ borderRadius:20, overflow:'hidden', position:'relative', cursor:'pointer',
                               minHeight:260, opacity: inView ? 1 : 0,
                               transform: inView ? 'none' : 'translateY(30px) scale(0.97)',
                               transition: `all 0.6s cubic-bezier(.34,1.56,.64,1) ${i*0.12}s`,
                               boxShadow:'0 8px 32px rgba(0,0,0,0.12)' }}
                    onClick={() => { setActiveCat(cat); document.getElementById('products')?.scrollIntoView({ behavior:'smooth' }); }}>
                    <img src={meta.img} alt={cat}
                      style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }}
                      onError={e => { e.target.style.display='none'; }} />
                    <div style={{ position:'absolute', inset:0, background: meta.gradient.replace('135deg','180deg').replace(')',',0.82)').replace('linear-gradient(','linear-gradient(') + ',' + meta.gradient.replace(')',',0.6)') ,
                                   background: `linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 100%), ${meta.gradient}88` }} />
                    <div style={{ position:'absolute', inset:0, padding:'28px 24px',
                                   display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                      <div style={{ fontSize:36, marginBottom:10 }}>{meta.icon}</div>
                      <div style={{ fontSize:20, fontWeight:900, color:'#fff', marginBottom:6 }}>{cat}</div>
                      <div style={{ fontSize:13, color:'rgba(255,255,255,0.75)', lineHeight:1.5, marginBottom:12 }}>{meta.tagline}</div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.9)',
                                       background:'rgba(255,255,255,0.15)', padding:'4px 12px',
                                       borderRadius:99, backdropFilter:'blur(8px)' }}>
                          {count} SKUs
                        </div>
                        <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', fontWeight:600 }}>View all →</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── PRODUCT CATALOG ────────────────────────────── */}
        <section id="products" style={{ padding:'80px 5vw', background:'#fff' }}>
          <div style={{ maxWidth:1200, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:40 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#2563eb', letterSpacing:'0.1em',
                             textTransform:'uppercase', marginBottom:10 }}>Full Catalogue</div>
              <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:900, color:'#0f172a',
                            margin:'0 0 8px', letterSpacing:'-0.02em' }}>
                {products.length} Products Ready to Order
              </h2>
              <p style={{ fontSize:14, color:'#64748b', margin:0 }}>
                All products available for bulk B2B supply. Prices on request.
              </p>
            </div>

            {/* Category filter tabs */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', marginBottom:40 }}>
              {categories.map(c => (
                <button key={c} className={`cat-tab${activeCategory === c ? ' active' : ''}`}
                  onClick={() => setActiveCat(c)}>
                  {c === 'all' ? `🏷️ All (${products.length})` :
                   `${CATEGORY_META[c]?.icon} ${c} (${products.filter(p=>p.category===c).length})`}
                </button>
              ))}
            </div>

            {/* Product grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:14 }}>
              {filtered.map((p, i) => <ProductCard key={p.id} product={p} idx={i} />)}
            </div>

            {/* CTA below catalogue */}
            <div style={{ textAlign:'center', marginTop:48 }}>
              <div style={{ background:'linear-gradient(135deg,#eff6ff,#f0fdf4)', border:'1.5px solid #bfdbfe',
                             borderRadius:20, padding:'32px 24px', maxWidth:560, margin:'0 auto' }}>
                <div style={{ fontSize:24, marginBottom:8 }}>💼</div>
                <div style={{ fontSize:18, fontWeight:800, color:'#0f172a', marginBottom:8 }}>Need bulk pricing?</div>
                <div style={{ fontSize:14, color:'#64748b', marginBottom:20, lineHeight:1.6 }}>
                  Get your personalised catalogue with negotiated rates and a dedicated order portal.
                </div>
                <button onClick={scrollToOrder}
                  style={{ padding:'12px 28px', borderRadius:12, border:'none', fontSize:14, fontWeight:700,
                           background:'linear-gradient(135deg,#2563eb,#7c3aed)', color:'#fff', cursor:'pointer',
                           boxShadow:'0 4px 16px rgba(37,99,235,0.4)' }}>
                  Request My Account →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW TO ORDER ───────────────────────────────── */}
        <section id="how" style={{ padding:'80px 5vw', background:'linear-gradient(135deg,#0d1117,#0f2044)' }}>
          <div style={{ maxWidth:1000, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:52 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#38bdf8', letterSpacing:'0.1em',
                             textTransform:'uppercase', marginBottom:10 }}>Getting Started</div>
              <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:900, color:'#fff',
                            margin:0, letterSpacing:'-0.02em' }}>Order in 3 Simple Steps</h2>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:24 }}>
              {HOW_STEPS.map((step, i) => {
                const [ref, inView] = useInView(); // eslint-disable-line
                return (
                  <div key={step.num} ref={ref} className="step-card"
                    style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                               borderRadius:20, padding:'28px 24px', backdropFilter:'blur(8px)',
                               opacity: inView ? 1 : 0,
                               transform: inView ? 'none' : 'translateY(28px)',
                               transition: `all 0.6s ease ${i*0.15}s`, cursor:'default' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                      <div style={{ fontSize:12, fontWeight:900, color:'#38bdf8', letterSpacing:'0.06em',
                                     background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.2)',
                                     padding:'4px 10px', borderRadius:99 }}>{step.num}</div>
                      <div style={{ fontSize:28 }}>{step.icon}</div>
                    </div>
                    <div style={{ fontSize:17, fontWeight:800, color:'#fff', marginBottom:10 }}>{step.title}</div>
                    <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', lineHeight:1.65 }}>{step.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── ORDER / INQUIRY FORM ───────────────────────── */}
        <section ref={orderRef} id="order" style={{ padding:'80px 5vw', background:'#f8fafc' }}>
          <div style={{ maxWidth:620, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:40 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#2563eb', letterSpacing:'0.1em',
                             textTransform:'uppercase', marginBottom:10 }}>Get Started Today</div>
              <h2 style={{ fontSize:'clamp(26px,4vw,36px)', fontWeight:900, color:'#0f172a',
                            margin:'0 0 12px', letterSpacing:'-0.02em' }}>
                Request Your Business Account
              </h2>
              <p style={{ fontSize:14, color:'#64748b', lineHeight:1.6 }}>
                Already a client? Enter your registered phone — we'll send your portal link instantly.
              </p>
            </div>

            <div style={{ background:'#fff', borderRadius:24, padding:'36px 32px',
                           boxShadow:'0 8px 40px rgba(0,0,0,0.08)', border:'1.5px solid #f1f5f9' }}>
              {submitResult ? (
                <div style={{ textAlign:'center', padding:'20px 0' }}>
                  <div style={{ fontSize:52, marginBottom:16 }}>
                    {submitResult.type === 'portal' ? '🎉' : '✅'}
                  </div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#0f172a', marginBottom:10 }}>
                    {submitResult.type === 'portal' ? 'Welcome Back!' : 'Request Received!'}
                  </div>
                  <div style={{ fontSize:14, color:'#64748b', lineHeight:1.6, marginBottom:20 }}>
                    {submitResult.message}
                  </div>
                  {submitResult.type === 'portal' && submitResult.url && (
                    <a href={submitResult.url}
                      style={{ display:'inline-block', padding:'12px 28px', borderRadius:12,
                               background:'linear-gradient(135deg,#2563eb,#7c3aed)', color:'#fff',
                               fontWeight:700, fontSize:14, textDecoration:'none',
                               boxShadow:'0 4px 16px rgba(37,99,235,0.4)' }}>
                      🛒 Open My Order Portal →
                    </a>
                  )}
                  <button onClick={() => { setSubmitResult(null); setForm({ name:'',business_name:'',phone:'',city:'',message:'' }); }}
                    style={{ display:'block', margin:'16px auto 0', background:'none', border:'none',
                             color:'#64748b', fontSize:13, cursor:'pointer', textDecoration:'underline' }}>
                    Submit another request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                    {[['name','Your Name *','text',true],['business_name','Business Name','text',false]].map(([key,label,type,req]) => (
                      <div key={key}>
                        <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>{label}</label>
                        <input type={type} value={form[key]} required={req}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          style={{ width:'100%', padding:'10px 13px', borderRadius:10, border:'1.5px solid #e2e8f0',
                                   fontSize:13, outline:'none', boxSizing:'border-box',
                                   transition:'border 0.2s' }}
                          onFocus={e => e.target.style.borderColor='#2563eb'}
                          onBlur={e => e.target.style.borderColor='#e2e8f0'} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                    {[['phone','Phone Number *','tel',true],['city','City','text',false]].map(([key,label,type,req]) => (
                      <div key={key}>
                        <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>{label}</label>
                        <input type={type} value={form[key]} required={req}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder={key==='phone' ? '+91 98765 43210' : ''}
                          style={{ width:'100%', padding:'10px 13px', borderRadius:10, border:'1.5px solid #e2e8f0',
                                   fontSize:13, outline:'none', boxSizing:'border-box' }}
                          onFocus={e => e.target.style.borderColor='#2563eb'}
                          onBlur={e => e.target.style.borderColor='#e2e8f0'} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom:22 }}>
                    <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Products Needed (optional)</label>
                    <textarea value={form.message} rows={3}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="e.g. Floor cleaner 50L/month, garbage bags, mops..."
                      style={{ width:'100%', padding:'10px 13px', borderRadius:10, border:'1.5px solid #e2e8f0',
                               fontSize:13, outline:'none', resize:'vertical', boxSizing:'border-box' }}
                      onFocus={e => e.target.style.borderColor='#2563eb'}
                      onBlur={e => e.target.style.borderColor='#e2e8f0'} />
                  </div>
                  <button type="submit" disabled={submitting}
                    style={{ width:'100%', padding:'14px', borderRadius:12, border:'none',
                             background:'linear-gradient(135deg,#2563eb,#7c3aed)', color:'#fff',
                             fontSize:15, fontWeight:800, cursor: submitting ? 'not-allowed':'pointer',
                             opacity: submitting ? 0.7 : 1, boxShadow:'0 6px 20px rgba(37,99,235,0.4)',
                             transition:'all 0.2s' }}>
                    {submitting ? '⏳ Sending…' : '🚀 Request My Account'}
                  </button>
                  <div style={{ textAlign:'center', marginTop:16, fontSize:12, color:'#94a3b8' }}>
                    Existing client? Enter your registered phone for instant portal access.
                  </div>
                </form>
              )}
            </div>

            {/* WhatsApp CTA */}
            <div style={{ textAlign:'center', marginTop:24 }}>
              <div style={{ fontSize:13, color:'#94a3b8', marginBottom:10 }}>Or reach us directly on WhatsApp</div>
              <a href="https://wa.me/919999999999?text=Hi%20Aromadelite%2C%20I%20need%20cleaning%20supplies%20for%20my%20business"
                target="_blank" rel="noopener noreferrer"
                style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 24px',
                         borderRadius:12, background:'#25d366', color:'#fff',
                         fontWeight:700, fontSize:14, textDecoration:'none',
                         boxShadow:'0 4px 16px rgba(37,211,102,0.4)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────── */}
        <footer style={{ background:'#0d1117', padding:'48px 5vw 28px', color:'rgba(255,255,255,0.6)' }}>
          <div style={{ maxWidth:1100, margin:'0 auto' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:32, marginBottom:40 }}>
              {/* Brand */}
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <div style={{ width:36, height:36, borderRadius:10,
                                 background:'linear-gradient(135deg,#2563eb,#7c3aed)',
                                 display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>✨</div>
                  <div>
                    <div style={{ fontSize:15, fontWeight:900, color:'#fff' }}>AROMADELITE</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:600, letterSpacing:'0.06em' }}>SRI VEMURI SAI ENT.</div>
                  </div>
                </div>
                <div style={{ fontSize:13, lineHeight:1.7 }}>
                  Your trusted B2B partner for professional cleaning supplies across Andhra Pradesh & Telangana.
                </div>
              </div>
              {/* Products */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:14, textTransform:'uppercase', letterSpacing:'0.06em' }}>Products</div>
                {Object.keys(CATEGORY_META).map(c => (
                  <div key={c} style={{ fontSize:13, marginBottom:8, cursor:'pointer' }}
                    onClick={() => { setActiveCat(c); document.getElementById('products')?.scrollIntoView({ behavior:'smooth' }); }}>
                    {CATEGORY_META[c].icon} {c}
                  </div>
                ))}
              </div>
              {/* Quick Links */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:14, textTransform:'uppercase', letterSpacing:'0.06em' }}>Quick Links</div>
                {[['View Catalogue','#products'],['How to Order','#how'],['Request Account','#order']].map(([l,h]) => (
                  <a key={l} href={h} style={{ display:'block', fontSize:13, marginBottom:8, color:'rgba(255,255,255,0.6)', textDecoration:'none' }}>{l}</a>
                ))}
                <a href="/login" style={{ display:'block', fontSize:13, marginBottom:8, color:'rgba(255,255,255,0.6)', textDecoration:'none' }}>Partner Login</a>
              </div>
              {/* Contact */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:14, textTransform:'uppercase', letterSpacing:'0.06em' }}>Contact</div>
                <div style={{ fontSize:13, marginBottom:8 }}>📍 Hyderabad, Telangana</div>
                <div style={{ fontSize:13, marginBottom:8 }}>📞 +91 99999 99999</div>
                <div style={{ fontSize:13, marginBottom:8 }}>✉️ info@aromadelite.in</div>
                <div style={{ fontSize:13 }}>🕐 Mon–Sat 9AM–6PM</div>
              </div>
            </div>
            <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:20,
                           display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <div style={{ fontSize:12 }}>© 2026 Aromadelite – Sri Vemuri Sai Enterprises. All rights reserved.</div>
              <div style={{ fontSize:12 }}>GST Compliant · Made in India 🇮🇳</div>
            </div>
          </div>
        </footer>

        {/* ── FLOATING WHATSAPP BUTTON ─────────────────── */}
        <a href="https://wa.me/919999999999?text=Hi%20Aromadelite%2C%20I%20need%20cleaning%20supplies"
          target="_blank" rel="noopener noreferrer"
          style={{ position:'fixed', bottom:24, right:24, zIndex:200,
                   width:56, height:56, borderRadius:'50%', background:'#25d366',
                   display:'flex', alignItems:'center', justifyContent:'center',
                   boxShadow:'0 4px 20px rgba(37,211,102,0.5)', textDecoration:'none',
                   animation:'pulse 2.5s infinite' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </a>
      </div>
    </>
  );
}
