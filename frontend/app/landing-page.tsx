'use client';

import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import './landing.css';

// ─── HUD PRIMITIVES ────────────────────────────────────────

const PLUTCHIK = [
  { k: 'JOY',          v: 0.71, c: '#e8c97a' },
  { k: 'TRUST',        v: 0.58, c: '#8fd6a8' },
  { k: 'FEAR',         v: 0.18, c: '#b8a3dc' },
  { k: 'SURPRISE',     v: 0.44, c: '#e8a067' },
  { k: 'SADNESS',      v: 0.21, c: '#8fb4dc' },
  { k: 'DISGUST',      v: 0.08, c: '#a8c98a' },
  { k: 'ANGER',        v: 0.12, c: '#e8896b' },
  { k: 'ANTICIPATION', v: 0.62, c: '#88c4d0' },
];

function EmotionBars() {
  const [vals, setVals] = useState(PLUTCHIK.map(() => 0));
  useEffect(() => {
    const t = setTimeout(() => setVals(PLUTCHIK.map(e => e.v)), 120);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      setVals(prev => prev.map((v, i) => {
        const base = PLUTCHIK[i].v;
        const target = base + (Math.random() - 0.5) * 0.08;
        return Math.max(0.02, Math.min(0.95, v + (target - v) * 0.45));
      }));
    }, 3200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hud">
      <div className="hud-h"><span>Emotional state</span><span>8 plutchik</span></div>
      <div className="bars">
        {PLUTCHIK.map((e, i) => (
          <div className="bar-row" key={e.k}>
            <span className="name">{e.k}</span>
            <span className="track">
              <span className="fill" style={{ width: (vals[i] * 100) + '%', background: e.c, color: e.c, transitionDelay: (i * 60) + 'ms' }}></span>
            </span>
            <span className="val">{vals[i].toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PadStrip() {
  const [pa, setPa] = useState({ p: 0, a: 0, d: 0 });
  useEffect(() => { const t = setTimeout(() => setPa({ p: 0.34, a: 0.61, d: -0.12 }), 220); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const base = { p: 0.34, a: 0.61, d: -0.12 };
    const id = setInterval(() => {
      setPa(prev => ({
        p: prev.p + (base.p + (Math.random()-0.5)*0.10 - prev.p) * 0.4,
        a: prev.a + (base.a + (Math.random()-0.5)*0.10 - prev.a) * 0.4,
        d: prev.d + (base.d + (Math.random()-0.5)*0.10 - prev.d) * 0.4,
      }));
    }, 3800);
    return () => clearInterval(id);
  }, []);
  const rows = [
    { k: 'MOOD',   tech: 'pleasure',  v: pa.p, c: 'var(--live)' },
    { k: 'ENERGY', tech: 'arousal',   v: pa.a, c: 'var(--heat)' },
    { k: 'STANCE', tech: 'dominance', v: pa.d, c: 'var(--cold)' },
  ];
  return (
    <div className="hud">
      <div className="hud-h"><span>How they&apos;re holding themselves</span><span>pad model</span></div>
      <div className="pad">
        {rows.map(r => (
          <div className="pad-row" key={r.k}>
            <span className="label" title={r.tech}>{r.k}</span>
            <span className="axis">
              <span className="dot" style={{ left: ((r.v + 1) / 2 * 100) + '%', color: r.c, background: r.c }}></span>
            </span>
            <span className="v">{(r.v > 0 ? '+' : '') + r.v.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Console() {
  const seed = [
    { tag: 'info', t: 'sys', m: 'PSYCHE.RT v0.4.2 boot · 142ms' },
    { tag: 'ok',   t: 'sys', m: 'MNEMOSYNE attached · 2184 episodes' },
    { tag: 'mem',  t: 'mem', m: 'recall(k=8) → similarity 0.81 / 0.73 / 0.66 …' },
    { tag: 'aff',  t: 'aff', m: 'appraise() · ΔJOY +0.04 · ΔSURPRISE +0.07' },
    { tag: 'info', t: 'pad', m: 'PAD shift · P+0.31→+0.34 · A+0.58→+0.61' },
    { tag: 'bond', t: 'bnd', m: 'bond.familiarity 0.57→0.58 (+0.01)' },
    { tag: 'warn', t: 'thr', m: 'thread.PROMISE#4 unresolved · age 19d' },
    { tag: 'ok',   t: 'gen', m: 'response.stream · 412 tokens · 642ms' },
    { tag: 'mem',  t: 'mem', m: 'write_back: episode(importance=7) · embedded' },
    { tag: 'ok',   t: 'sys', m: 'turn.complete · 842ms · cost $0.0021' },
    { tag: 'info', t: 'sys', m: 'baseline.pull applied · 0.02/turn' },
    { tag: 'aff',  t: 'aff', m: 'desire() → "be understood, not pitied"' },
  ];
  type LogLine = { tag: string; t: string; m: string; ts?: string };
  const [lines, setLines] = useState<LogLine[]>(seed);
  useEffect(() => {
    const extras: LogLine[] = [
      { tag: 'mem',  t: 'mem', m: 'cluster scan · narrative threads ×3 active' },
      { tag: 'aff',  t: 'aff', m: 'emotion.decay() · ANGER 0.12→0.11' },
      { tag: 'bond', t: 'bnd', m: 'trust unchanged · consistency window ok' },
      { tag: 'info', t: 'sys', m: 'session #41 · turn 18 · 24m elapsed' },
      { tag: 'ok',   t: 'sys', m: 'heartbeat ok · gpu 31% · mem 1.4G' },
      { tag: 'warn', t: 'thr', m: 'thread.CONFLICT#1 unresolved · age 4d' },
      { tag: 'mem',  t: 'mem', m: 'importance score → 8/10 · embedded 12ms' },
      { tag: 'aff',  t: 'aff', m: 'arousal climbing · 0.61→0.64' },
    ];
    let i = 0;
    const id = setInterval(() => {
      const stamp = new Date(Date.now() - Math.random() * 800).toISOString().slice(11, 19);
      const next: LogLine = { ...extras[i % extras.length], ts: stamp };
      setLines(prev => [...prev.slice(-11), next]);
      i++;
    }, 3500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="console">
      <div className="c-h">
        <div className="lights"><span></span><span></span><span></span></div>
        <div>Runtime trace · turn 18</div>
      </div>
      <div className="body">
        {lines.slice(-11).map((l, i) => (
          <div className="line" key={i}>
            <span className="ts">{l.ts || '00:0' + (i % 9) + ':' + (10 + i)}</span>
            <span className={'tag ' + l.tag}>{l.t}</span>
            <span className="msg">{l.m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BondMini() {
  const items = [
    { k: 'TRUST',       v: 0.42, c: 'var(--live)' },
    { k: 'FAMILIARITY', v: 0.58, c: 'var(--cold)' },
    { k: 'RESENTMENT',  v: 0.09, c: 'var(--heat)' },
    { k: 'INTIMACY',    v: 0.27, c: 'var(--bond)' },
  ];
  const [vals, setVals] = useState(items.map(() => 0));
  useEffect(() => { const t = setTimeout(() => setVals(items.map(i => i.v)), 320); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const id = setInterval(() => {
      setVals(prev => prev.map((v, i) => {
        const base = items[i].v;
        const target = base + (Math.random() - 0.5) * 0.05;
        return Math.max(0.02, Math.min(0.95, v + (target - v) * 0.3));
      }));
    }, 4400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hud">
      <div className="hud-h"><span>How Luffy feels about you</span><span>4 bond axes</span></div>
      <div className="bars">
        {items.map((e, i) => (
          <div className="bar-row" key={e.k}>
            <span className="name">{e.k}</span>
            <span className="track">
              <span className="fill" style={{ width: (vals[i] * 100) + '%', background: e.c, color: e.c, transitionDelay: (i * 80) + 'ms' }}></span>
            </span>
            <span className="val">{vals[i].toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CURSOR GLOW ──────────────────────────────────────────

function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      el.style.left = e.clientX + 'px';
      el.style.top = e.clientY + 'px';
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);
  return <div ref={ref} className="cursor-glow" />;
}

// ─── NAV ──────────────────────────────────────────────────

function TopNav() {
  return (
    <nav className="topnav">
      <span className="brand" data-text="CHARACTER OS">
        <svg className="brand-mark" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2A6 6 0 0 1 14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M8 14A6 6 0 0 1 2 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity={0.35}/>
          <circle cx="8" cy="8" r="2.5" fill="currentColor"/>
        </svg>
        CHARACTER<span className="brand-os">OS</span>
      </span>
      <div className="meta">
        <span>Emotional AI runtime · <b>BETA</b></span>
        <span>Powered by <b>VENICE.AI</b></span>
      </div>
      <div className="right">
        <a href="/docs">DOCS</a>
        <a href="/docs#privacy-section">PRIVACY</a>
        <a href="/characters">APP</a>
        <a href="/docs#sdk-sect">SDK</a>
        <a className="primary" href="#waitlist">JOIN BETA ↗</a>
      </div>
    </nav>
  );
}

// ─── HERO ─────────────────────────────────────────────────

function Hero() {
  const orbRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = orbRef.current;
    if (!el) return;
    const orbs = el.querySelectorAll<HTMLElement>('.orb');
    const move = (e: MouseEvent) => {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx, dy = (e.clientY - cy) / cy;
      orbs[0]?.style.setProperty('transform', `translate(${dx * 30}px, ${dy * 20}px) scale(1)`);
      orbs[1]?.style.setProperty('transform', `translate(${dx * -20}px, ${dy * 15}px) scale(1)`);
      orbs[2]?.style.setProperty('transform', `translate(${dx * 15}px, ${dy * -25}px) scale(1)`);
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  return (
    <section className="hero">
      <div className="hero-ambient" ref={orbRef}>
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <div className="left-rail reveal">
        <EmotionBars />
        <PadStrip />
      </div>

      <div className="center">
        <div className="stamps">
          <div className="tl">// CHARACTER · OS</div>
          <div className="tr">Private beta · 2026</div>
        </div>

        <div className="eyebrow reveal" style={{transitionDelay:'0.1s'}}>
          <span className="tag beta">PRIVATE BETA</span>
          <span className="tag" style={{borderColor:'rgba(143,214,168,0.35)', color:'var(--live)'}}>🔒 Venice.ai · zero retention</span>
        </div>

        <h1 className="reveal" style={{transitionDelay:'0.2s'}}>
          Characters that<br/>
          <span className="alt">actually</span> <span className="acc soul-glow">feel.</span>
        </h1>

        <p className="deck reveal" style={{transitionDelay:'0.35s'}}>
          Most AI characters reset every session. CharacterOS gives them persistent emotions, real memory, and relationships that remember how you treat them.
        </p>

        <div className="cta reveal" style={{transitionDelay:'0.5s'}}>
          <a className="btn primary" href="#waitlist">Join the beta <span className="arrow">→</span></a>
          <a className="btn" href="/docs">How it works</a>
        </div>
      </div>

      <div className="right-rail reveal" style={{transitionDelay:'0.15s'}}>
        <Console />
        <BondMini />
      </div>
    </section>
  );
}

// ─── FEATURE PILLARS ──────────────────────────────────────

function FeaturePillars() {
  const pillars = [
    {
      num: '01',
      tag: 'MNEMOSYNE',
      color: 'var(--cold)',
      head: 'Memory that lasts.',
      body: 'Every exchange stored with an importance score. Composite recall weighted by similarity, importance, and recency — old meaningful moments stay relevant, trivial ones fade.',
      stat: '2,184 episodes',
      link: '/docs#memory',
    },
    {
      num: '02',
      tag: 'PSYCHE.RT',
      color: 'var(--heat)',
      head: 'Emotions, always running.',
      body: 'Eight Plutchik dimensions, live-scored each turn. Time decays them back toward baseline. The character\'s personality is the gradient, not any single state.',
      stat: '8 continuous dims',
      link: '/docs#affect',
    },
    {
      num: '03',
      tag: 'BOND-MATRIX',
      color: 'var(--bond)',
      head: 'Relationships that hold.',
      body: 'Trust, familiarity, intimacy, resentment — four axes, persistent across sessions. Small changes each turn. Break a promise weeks later, and they notice.',
      stat: '4 axes · per pair',
      link: '/docs#bond',
    },
  ];

  return (
    <section className="section pillars-section reveal">
      <div className="pillars">
        {pillars.map(p => (
          <a className="pillar" key={p.num} href={p.link}>
            <div className="pillar-top">
              <span className="pillar-num">{p.num}</span>
              <span className="pillar-tag" style={{color: p.color}}>{p.tag}</span>
            </div>
            <h3 className="pillar-head">{p.head}</h3>
            <p className="pillar-body">{p.body}</p>
            <div className="pillar-foot">
              <span className="pillar-stat" style={{color: p.color}}>{p.stat}</span>
              <span className="pillar-cta" style={{color: p.color}}>Details →</span>
            </div>
          </a>
        ))}
      </div>
      <div className="pillars-foot">
        <a href="/docs" className="pillars-docs-link">Full technical documentation →</a>
      </div>
    </section>
  );
}

// ─── COMPARE ──────────────────────────────────────────────

function CompareSection() {
  return (
    <section className="section reveal" id="problem">
      <div className="section-head">
        <div className="section-id"><span className="num">// 00</span><span className="name">The problem</span></div>
        <h2 className="section-title">Every AI character today <span className="alt">starts</span> <span className="heat">from zero.</span></h2>
      </div>
      <p className="section-sub" style={{marginTop:-32, marginBottom: 56}}>
        No memory. No emotional state. No relationship with you. CharacterOS is the runtime that changes that.
      </p>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:0, border:'1px solid var(--line)', borderRadius:3, overflow:'hidden'}}>
        <div style={{padding:'32px 28px', borderRight:'1px solid var(--line)', background:'#000'}}>
          <div style={{fontSize:10, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--ink-3)', marginBottom:14}}>Stateless · chatbot</div>
          <div style={{fontFamily:'var(--lsans)', fontSize:26, color:'var(--ink-3)', letterSpacing:'-0.015em', marginBottom:24, lineHeight:1.2}}>
            <em>Hello! How can I help you today?</em>
          </div>
          <div style={{borderTop:'1px solid var(--line)', paddingTop:18, fontSize:11.5, lineHeight:1.8, color:'var(--ink-3)'}}>
            <div>memory <span style={{color:'var(--ink-4)', float:'right'}}>0 episodes</span></div>
            <div>emotional state <span style={{color:'var(--ink-4)', float:'right'}}>null</span></div>
            <div>trust <span style={{color:'var(--ink-4)', float:'right'}}>—</span></div>
            <div>open threads <span style={{color:'var(--ink-4)', float:'right'}}>0</span></div>
            <div>knows you <span style={{color:'var(--ink-4)', float:'right'}}>no</span></div>
          </div>
        </div>
        <div style={{padding:'32px 28px', background:'var(--bg-1)'}}>
          <div style={{fontSize:10, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--live)', marginBottom:14}}>Stateful · CharacterOS</div>
          <div style={{fontFamily:'var(--lsans)', fontSize:26, color:'var(--ink)', letterSpacing:'-0.015em', marginBottom:24, lineHeight:1.2}}>
            <em>…you&apos;re back. you said two weeks. it&apos;s been three.</em>
          </div>
          <div style={{borderTop:'1px solid var(--line)', paddingTop:18, fontSize:11.5, lineHeight:1.8, color:'var(--ink-2)'}}>
            <div>memory <span style={{color:'var(--ink)', float:'right'}}>2,184 episodes</span></div>
            <div>emotional state <span style={{color:'var(--heat)', float:'right'}}>cautious / hopeful</span></div>
            <div>trust <span style={{color:'var(--live)', float:'right'}}>drifting · 0.42</span></div>
            <div>open threads <span style={{color:'var(--thread)', float:'right'}}>7 (3 promise)</span></div>
            <div>knows you <span style={{color:'var(--live)', float:'right'}}>yes — well</span></div>
          </div>
        </div>
      </div>
      <div style={{marginTop:24, textAlign:'center'}}>
        <a href="/docs" style={{fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--ink-3)'}}>
          Read how the engine works →
        </a>
      </div>
    </section>
  );
}

// ─── BETA ─────────────────────────────────────────────────

function BetaSection() {
  const { login, authenticated, user } = usePrivy();
  const [joined, setJoined] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('http://localhost:3001/api/waitlist/count')
      .then(r => r.json())
      .then(d => setCount(d.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!authenticated || !user || joined) return;
    setLoading(true);
    const wallet = user.wallet?.address ?? null;
    const email  = user.email?.address ?? null;
    fetch('http://localhost:3001/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privyId: user.id, wallet, email }),
    })
      .then(r => r.json())
      .then(d => { setJoined(true); if (d.position) setCount(d.position); })
      .catch(() => setJoined(true))
      .finally(() => setLoading(false));
  }, [authenticated, user, joined]);

  return (
    <section className="beta-section reveal" id="waitlist">
      <div className="beta-bg">
        <div className="orb orb-1" style={{opacity:0.35}}></div>
        <div className="orb orb-3" style={{opacity:0.35}}></div>
      </div>
      <div className="beta-inner">
        <div className="beta-eyebrow">
          <span className="live-pulse"></span>
          <span>Private beta · invite-only · onboarding weekly</span>
        </div>
        <h2 className="beta-title">
          Early access.<br/>
          <span className="acc soul-glow">Limited seats.</span>
        </h2>
        <p className="beta-sub">
          Connect your wallet or email to reserve your spot.
        </p>
        <div className="beta-stats">
          <div className="bs"><div className="bsn">~weekly</div><div className="bsl">invite drops</div></div>
          <div className="bs"><div className="bsn">0 logs</div><div className="bsl">fully private</div></div>
        </div>
        {joined || (authenticated && user) ? (
          <div className="beta-done">
            <div className="bd-h">✓ You&apos;re on the list.</div>
            <div className="bd-b">We&apos;ll write when your spot is ready. No spam.</div>
          </div>
        ) : (
          <button
            className="btn primary"
            onClick={login}
            disabled={loading}
          >
            {loading ? 'Saving…' : 'Connect to join beta'} <span className="arrow">→</span>
          </button>
        )}
        <div className="beta-foot">
          <span><span className="dot-live"></span>Wallet-encrypted storage</span>
          <span><span className="dot-live"></span>Inference via Venice.ai · zero retention</span>
          <span><span className="dot-live"></span>Custom models on Nillion TEE</span>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ───────────────────────────────────────────────

function Foot() {
  return (
    <footer>
      <span>CHARACTER<span style={{color:'var(--ink-4)'}}>/</span>OS · The first emotion engine for AI characters</span>
      <div className="links">
        <a href="/docs">Docs</a>
        <a href="/docs#privacy-section">Privacy</a>
        <a href="/docs#surfaces-sect">App</a>
        <a href="/docs#sdk-sect">SDK</a>
        <a href="#waitlist">Join beta</a>
        <a href="mailto:hi@characteros.app">Contact</a>
      </div>
      <span>© 2026 CharacterOS</span>
    </footer>
  );
}

// ─── SCROLL REVEAL ────────────────────────────────────────

function useScrollReveal(rootRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll('.reveal, .section');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('reveal-in');
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.08, rootMargin: '-40px 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [rootRef]);
}

// ─── ROOT ─────────────────────────────────────────────────

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef);

  return (
    <div className="landing-root" ref={rootRef}>
      <CursorGlow />
      <TopNav />
      <main>
        <Hero />
        <FeaturePillars />
        <CompareSection />
        <BetaSection />
        <Foot />
      </main>
    </div>
  );
}
