'use client';

import { useState, useEffect, useRef } from 'react';
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
      <div className="hud-h"><span>How they're holding themselves</span><span>pad model</span></div>
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

function PlutchikWheel() {
  const segs = PLUTCHIK.map((e, i) => ({ ...e, angle: i / 8 * 360 }));
  const cx = 200, cy = 200;
  const innerR = 70, outerR = 180;

  const arcPath = (i: number, vScale: number) => {
    const a0 = (i / 8) * Math.PI * 2 - Math.PI / 2 - (Math.PI / 8);
    const a1 = a0 + Math.PI / 4;
    const r = innerR + (outerR - innerR) * vScale;
    const x0 = cx + Math.cos(a0) * innerR, y0 = cy + Math.sin(a0) * innerR;
    const x1 = cx + Math.cos(a0) * r,      y1 = cy + Math.sin(a0) * r;
    const x2 = cx + Math.cos(a1) * r,      y2 = cy + Math.sin(a1) * r;
    const x3 = cx + Math.cos(a1) * innerR, y3 = cy + Math.sin(a1) * innerR;
    return `M ${x0} ${y0} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 0 0 ${x0} ${y0} Z`;
  };
  const fullArcPath = (i: number) => {
    const a0 = (i / 8) * Math.PI * 2 - Math.PI / 2 - (Math.PI / 8);
    const a1 = a0 + Math.PI / 4;
    const x0 = cx + Math.cos(a0) * innerR,  y0 = cy + Math.sin(a0) * innerR;
    const x1 = cx + Math.cos(a0) * outerR,  y1 = cy + Math.sin(a0) * outerR;
    const x2 = cx + Math.cos(a1) * outerR,  y2 = cy + Math.sin(a1) * outerR;
    const x3 = cx + Math.cos(a1) * innerR,  y3 = cy + Math.sin(a1) * innerR;
    return `M ${x0} ${y0} L ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 0 0 ${x0} ${y0} Z`;
  };

  const [scale, setScale] = useState(0);
  useEffect(() => { const t = setTimeout(() => setScale(1), 120); return () => clearTimeout(t); }, []);

  return (
    <div className="wheel-wrap">
      <svg viewBox="0 0 400 400">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {[0.25, 0.5, 0.75, 1.0].map(r => (
          <circle key={r} cx={cx} cy={cy} r={innerR + (outerR - innerR) * r} fill="none" stroke="#1a1a1a" strokeDasharray="2 4" />
        ))}
        {segs.map((s, i) => (
          <path key={'b'+i} d={fullArcPath(i)} fill={s.c} opacity="0.04" stroke={s.c} strokeOpacity="0.18" />
        ))}
        {segs.map((s, i) => (
          <path key={'f'+i} d={arcPath(i, scale * s.v)} fill={s.c} opacity="0.55"
            style={{ transition: 'd 1.6s cubic-bezier(.4,.2,.2,1)', filter: 'url(#glow)' }} />
        ))}
        {segs.map((s, i) => {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          const lr = outerR + 22;
          const x = cx + Math.cos(a) * lr;
          const y = cy + Math.sin(a) * lr;
          return (
            <g key={'l'+i}>
              <text x={x} y={y} fill="#9a9a9a" fontSize="10" textAnchor="middle" dominantBaseline="middle" fontFamily="var(--lmono)" letterSpacing="2">
                {s.k}
              </text>
              <text x={x} y={y + 12} fill={s.c} fontSize="9.5" textAnchor="middle" dominantBaseline="middle" fontFamily="var(--lmono)" style={{fontVariantNumeric:'tabular-nums'}}>
                {s.v.toFixed(2)}
              </text>
            </g>
          );
        })}
        {segs.map((_, i) => {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2 - (Math.PI / 8);
          return <line key={'s'+i} x1={cx + Math.cos(a) * innerR} y1={cy + Math.sin(a) * innerR}
            x2={cx + Math.cos(a) * outerR} y2={cy + Math.sin(a) * outerR} stroke="#1a1a1a" />;
        })}
      </svg>
      <div className="wheel-center">
        <div className="label">DERIVED</div>
        <div className="state">CURIOUS</div>
        <div className="delta">↑ since turn 14</div>
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
      <span className="brand" data-text="CHARACTER/OS">CHARACTER<span className="slash">/</span>OS</span>
      <div className="meta">
        <span>First emotional AI runtime · <b>BETA</b></span>
        <span>Powered by <b>VENICE.AI</b></span>
      </div>
      <div className="right">
        <a href="#engine">ENGINE</a>
        <a href="#privacy">PRIVACY</a>
        <a href="#app">APP</a>
        <a href="#sdk">SDK</a>
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
          Most AI characters reset every conversation. CharacterOS gives them persistent emotions, memory that knows what mattered, and relationships that shift with how you treat them. Private by construction.
        </p>

        <div className="cta reveal" style={{transitionDelay:'0.5s'}}>
          <a className="btn primary" href="#waitlist">Join the beta <span className="arrow">→</span></a>
          <a className="btn" href="#engine">How it works</a>
        </div>
      </div>

      <div className="right-rail reveal" style={{transitionDelay:'0.15s'}}>
        <Console />
        <BondMini />
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
            <div>session <span style={{color:'var(--ink-4)', float:'right'}}>new</span></div>
            <div>knows you <span style={{color:'var(--ink-4)', float:'right'}}>no</span></div>
            <div>persistent state <span style={{color:'var(--ink-4)', float:'right'}}>no</span></div>
          </div>
        </div>
        <div style={{padding:'32px 28px', background:'var(--bg-1)'}}>
          <div style={{fontSize:10, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--live)', marginBottom:14}}>Stateful · CharacterOS</div>
          <div style={{fontFamily:'var(--lsans)', fontSize:26, color:'var(--ink)', letterSpacing:'-0.015em', marginBottom:24, lineHeight:1.2}}>
            <em>…you're back. you said two weeks. it's been three.</em>
          </div>
          <div style={{borderTop:'1px solid var(--line)', paddingTop:18, fontSize:11.5, lineHeight:1.8, color:'var(--ink-2)'}}>
            <div>memory <span style={{color:'var(--ink)', float:'right'}}>2,184 episodes</span></div>
            <div>emotional state <span style={{color:'var(--heat)', float:'right'}}>cautious / hopeful</span></div>
            <div>trust <span style={{color:'var(--live)', float:'right'}}>drifting · 0.42</span></div>
            <div>open threads <span style={{color:'var(--thread)', float:'right'}}>7 (3 promise)</span></div>
            <div>session <span style={{color:'var(--cold)', float:'right'}}>#41 · returning</span></div>
            <div>knows you <span style={{color:'var(--live)', float:'right'}}>yes — well</span></div>
            <div>persistent state <span style={{color:'var(--live)', float:'right'}}>yes</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── PIPELINE ─────────────────────────────────────────────

type PipeStep = {
  step: string; label: string; sub: string; kind: string; ms: number;
  detail: { h: string; p: string; f: React.ReactNode };
};

const PIPE: PipeStep[] = [
  {
    step: '01', label: 'Load Context', sub: 'composite recall · semantic + scoring', kind: 'vec', ms: 142,
    detail: {
      h: 'Composite memory recall.',
      p: 'Pull the k most relevant episodes for this turn. Score is a weighted sum across semantic similarity (45%), importance (30%), and recency (25%) — old meaningful moments stay relevant, trivial ones fade.',
      f: <><span style={{color:'var(--ink)'}}>score</span><span style={{color:'var(--ink-3)'}}> = </span>0.45·<span style={{color:'var(--ink)'}}>sim</span><span style={{color:'var(--ink-3)'}}> + </span>0.30·<span style={{color:'var(--ink)'}}>imp</span><span style={{color:'var(--ink-3)'}}> + </span>0.25·<span style={{color:'var(--ink)'}}>rec</span></>
    }
  },
  {
    step: '02', label: 'Appraise + Desire', sub: 'score impact across 8 dims · derive intent', kind: 'llm', ms: 218,
    detail: {
      h: 'Affective appraisal.',
      p: "Read the message against the character's current state. Score impact across 8 Plutchik dimensions. Derive desire — what the character wants from this turn, before it speaks.",
      f: <><span style={{color:'var(--ink)'}}>Δaffect</span><span style={{color:'var(--ink-3)'}}> = </span>appraise(<span style={{color:'var(--ink)'}}>msg</span>, <span style={{color:'var(--ink)'}}>state</span>, <span style={{color:'var(--ink)'}}>bond</span>)<span style={{color:'var(--ink-3)'}}>,  </span><span style={{color:'var(--ink)'}}>want</span><span style={{color:'var(--ink-3)'}}> ← </span>desire(<span style={{color:'var(--ink)'}}>Δaffect</span>)</>
    }
  },
  {
    step: '03', label: 'Emotion Math', sub: 'apply deltas · decay · baseline pull', kind: 'code', ms: 4,
    detail: {
      h: 'Pure computation.',
      p: "No model in the loop. Apply emotional deltas, decay open emotions toward baseline, pull the personality's long-run trait values back into the state vector. Deterministic. 4 milliseconds.",
      f: <><span style={{color:'var(--ink)'}}>e</span>′<span style={{color:'var(--ink-3)'}}> = </span>(<span style={{color:'var(--ink)'}}>e</span><span style={{color:'var(--ink-3)'}}> + </span>Δ<span style={{color:'var(--ink)'}}>e</span>)·<span style={{color:'var(--ink)'}}>decay</span><span style={{color:'var(--ink-3)'}}> + </span>α·(<span style={{color:'var(--ink)'}}>b</span><span style={{color:'var(--ink-3)'}}> − </span><span style={{color:'var(--ink)'}}>e</span>)</>
    }
  },
  {
    step: '04', label: 'Generate Response', sub: 'reason privately · then speak', kind: 'stream', ms: 642,
    detail: {
      h: 'Reason, then speak.',
      p: 'On significant turns the character privately works through what it wants, reads what the user actually needs, decides its move — and only then speaks. None of the reasoning is visible in the reply.',
      f: <><span style={{color:'var(--ink)'}}>want</span><span style={{color:'var(--ink-3)'}}> → </span><span style={{color:'var(--ink)'}}>read</span><span style={{color:'var(--ink-3)'}}> → </span><span style={{color:'var(--ink)'}}>move</span><span style={{color:'var(--ink-3)'}}> → </span><span style={{color:'var(--ink)'}}>say</span><span style={{color:'var(--ink-3)'}}> · </span>tone <span style={{color:'var(--ink-3)'}}>←</span> PAD</>
    }
  },
  {
    step: '05', label: 'Write Back', sub: 'episode · importance · threads · bond', kind: 'llm', ms: 312,
    detail: {
      h: 'Persist the turn.',
      p: 'Store the exchange as an episode with an importance score (1–10) and a 1536-dim embedding. Detect open promises, conflicts, secrets, questions — push them to THREAD-WEAVE. Update bond axes from event semantics.',
      f: <>episode<span style={{color:'var(--ink-3)'}}> + </span><span style={{color:'var(--ink)'}}>imp</span>∈[1,10]<span style={{color:'var(--ink-3)'}}> + </span><span style={{color:'var(--ink)'}}>vec</span>∈ℝ<sup style={{color:'var(--ink-3)'}}>1536</sup><span style={{color:'var(--ink-3)'}}> · </span>bond.update()</>
    }
  },
];

function PipelineSection() {
  const [active, setActive] = useState(1);
  const [userPicked, setUserPicked] = useState(false);
  useEffect(() => {
    if (userPicked) return;
    const id = setInterval(() => setActive(a => (a + 1) % PIPE.length), 3800);
    return () => clearInterval(id);
  }, [userPicked]);
  const cur = PIPE[active];
  return (
    <section className="section" id="psyche">
      <div className="section-head">
        <div className="section-id"><span className="num">// 01</span><span className="name">The runtime · psyche.rt</span></div>
        <h2 className="section-title">A runtime, <span className="alt">not</span> a <span className="acc">prompt.</span></h2>
      </div>
      <p className="section-sub" style={{marginTop:-32, marginBottom: 56}}>
        Every message runs a five-stage pipeline — three pure code, two model calls — and returns in under a second.
      </p>
      <div className="pipeline">
        <div className="pipe-stages">
          {PIPE.map((p, i) => (
            <div key={p.step} className={'pipe-row ' + (i === active ? 'active' : '')}
                 onClick={() => { setActive(i); setUserPicked(true); }}
                 onMouseEnter={() => { setActive(i); setUserPicked(true); }}>
              <span className="step">{p.step}</span>
              <span className="lbl">{p.label}<small>{p.sub}</small></span>
              <span className={'kind ' + p.kind}>{p.kind.toUpperCase()}</span>
              <span className="ms"><span className={i === active ? 'now' : ''}>{p.ms}ms</span></span>
            </div>
          ))}
        </div>
        <div className="pipe-detail">
          <div style={{fontSize:10, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--ink-3)', marginBottom:14}}>
            ▸ STAGE {cur.step} · {cur.label.toUpperCase()}
          </div>
          <h4>{cur.detail.h}</h4>
          <p>{cur.detail.p}</p>
          <div className="formula">{cur.detail.f}</div>
          <div style={{marginTop:24, paddingTop:18, borderTop:'1px solid var(--line)', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, fontSize:10, letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--ink-3)'}}>
            <div><div style={{fontFamily:'var(--lsans)', fontSize:18, color:'var(--ink)', letterSpacing:'-0.01em', textTransform:'none'}}>{cur.ms}ms</div>median latency</div>
            <div><div style={{fontFamily:'var(--lsans)', fontSize:18, color:'var(--ink)', letterSpacing:'-0.01em', textTransform:'none'}}>{cur.kind === 'code' ? 'deterministic' : cur.kind === 'vec' ? 'local · pgvector' : 'venice.ai'}</div>backend</div>
            <div><div style={{fontFamily:'var(--lsans)', fontSize:18, color:'var(--ink)', letterSpacing:'-0.01em', textTransform:'none'}}>{Math.round(cur.ms / 842 * 100)}%</div>of turn</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── AFFECT ───────────────────────────────────────────────

function AffectSection() {
  const [pad, setPad] = useState({ p: 0, a: 0, d: 0 });
  useEffect(() => { const t = setTimeout(() => setPad({ p: 0.34, a: 0.61, d: -0.12 }), 220); return () => clearTimeout(t); }, []);
  return (
    <section className="section" id="affect">
      <div className="section-head">
        <div className="section-id"><span className="num">// 02</span><span className="name">How they feel · affect engine</span></div>
        <h2 className="section-title">Eight emotions, <span className="heat">always running.</span></h2>
      </div>
      <p className="section-sub" style={{marginTop:-32, marginBottom: 56}}>
        Plutchik's eight emotions run continuously. Every message shifts them. Time pulls them back toward baseline. The character's personality is the gradient, not any single value.
      </p>
      <div className="affect">
        <PlutchikWheel />
        <div className="pad-panel">
          <h5>How they're holding themselves · <b>mood / energy / stance</b></h5>
          <div className="pad-big">
            {[
              { k: 'MOOD',   tech: 'pleasure',  s: 'uneasy ↔ good',     v: pad.p, c: 'var(--live)' },
              { k: 'ENERGY', tech: 'arousal',   s: 'calm ↔ activated',   v: pad.a, c: 'var(--heat)' },
              { k: 'STANCE', tech: 'dominance', s: 'open ↔ in-charge',   v: pad.d, c: 'var(--cold)' },
            ].map(r => (
              <div className="row" key={r.k}>
                <div className="name">{r.k}<small>{r.s} · {r.tech}</small></div>
                <div className="ax">
                  <div className="mark"></div>
                  <div className="pin" style={{ left: ((r.v + 1) / 2 * 100) + '%', color: r.c }}></div>
                </div>
                <div className={'v ' + (r.v >= 0 ? 'pos' : 'neg')}>{(r.v > 0 ? '+' : '') + r.v.toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:30, paddingTop:22, borderTop:'1px solid var(--line)', fontSize:11.5, color:'var(--ink-2)', lineHeight:1.7}}>
            <div style={{fontSize:10, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--ink-3)', marginBottom:10}}>How this shapes tone</div>
            <div>Good mood + high energy → <span style={{color:'var(--ink)'}}>excited, openhearted, brave</span></div>
            <div>Good mood + calm → <span style={{color:'var(--ink)'}}>warm, grounded, content</span></div>
            <div>Uneasy + high energy → <span style={{color:'var(--ink)'}}>defensive, sharp, restless</span></div>
            <div>Uneasy + low energy → <span style={{color:'var(--ink)'}}>withdrawn, weary, distant</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── MEMORY ───────────────────────────────────────────────

const MEMORIES = [
  { imp: 9, tag: 'PROMISE',  txt: "You said you'd be there when he reached the Grand Line.", meta: '14d ago · score 0.91', open: true },
  { imp: 8, tag: 'SECRET',   txt: 'He told you about Ace. He\'s never said it out loud before.', meta: '6d ago · score 0.84', open: true },
  { imp: 7, tag: 'CONFLICT', txt: 'You called the dream "kind of childish". He laughed it off.', meta: '4d ago · score 0.79', open: true },
  { imp: 5, tag: 'BOND',     txt: "Shared a meal. He noticed you ordered two of his favorite.", meta: '2d ago · score 0.62' },
  { imp: 2, tag: 'TRIVIA',   txt: 'Mentioned the weather. Decayed past relevance threshold.', meta: '11d ago · score 0.18', faded: true },
];

function MemorySection() {
  return (
    <section className="section" id="memory">
      <div className="section-head">
        <div className="section-id"><span className="num">// 03</span><span className="name">What they remember · memory engine</span></div>
        <h2 className="section-title">Memory that <span className="alt">knows</span> <span className="cold">what mattered.</span></h2>
      </div>
      <p className="section-sub" style={{marginTop:-32, marginBottom: 56}}>
        Every exchange is stored with an importance score. Retrieval is weighted — meaningful memories stay relevant, small talk fades on its own.
      </p>
      <div className="memory">
        <div className="mem-formula">
          <div className="title">COMPOSITE SCORE</div>
          <div className="eq">
            <span className="k">score</span><span className="op">=</span>
            <span className="w">0.45</span><span className="k">·sim</span><span className="op">+</span>
            <span className="w">0.30</span><span className="k">·imp</span><span className="op">+</span>
            <span className="w">0.25</span><span className="k">·rec</span>
          </div>
          <div className="weights">
            {[
              { pct: '45', name: 'SIMILARITY', desc: 'Cosine over 1536-dim embeddings. Is this memory about the same thing?' },
              { pct: '30', name: 'IMPORTANCE', desc: 'LLM-scored at write time (1–10). Did this turn change the character?' },
              { pct: '25', name: 'RECENCY',    desc: 'Exponential decay. Recent moments lead, but never crowd out the meaningful.' },
            ].map(w => (
              <div className="weight" key={w.name}>
                <div className="pct"><span className="acc">{w.pct}</span><span style={{color:'var(--ink-3)', fontSize:20}}>%</span></div>
                <div className="name">{w.name}</div>
                <div className="desc">{w.desc}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:24, paddingTop:18, borderTop:'1px solid var(--line)', fontSize:11.5, color:'var(--ink-2)', lineHeight:1.7}}>
            <div style={{color:'var(--ink-3)', fontSize:10, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:8}}>WHAT THIS BUYS YOU</div>
            A memory from 14 days ago with importance 9 will outrank yesterday's small talk every time. The character isn't trying to remember — the system surfaces what is actually relevant.
          </div>
        </div>
        <div>
          <div className="mem-stack">
            <div className="head"><span>EPISODE STACK · TOP 5</span><span>OF 2,184</span></div>
            {MEMORIES.map((m, i) => (
              <div key={i} className={'mem-card' + (m.faded ? ' faded' : '')}>
                <div className="imp">{m.imp}<small>IMP</small></div>
                <div className="ep"><span className="tag">{m.tag}</span>{m.txt}</div>
                <div className="meta">
                  <span className="score">{(0.18 + (m.imp / 10) * 0.78).toFixed(2)}</span>
                  {m.meta.split(' · ')[0]}
                  {m.open ? <span style={{display:'block', color:'var(--thread)', fontSize:9, letterSpacing:'0.16em', marginTop:3}}>OPEN</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── BOND ─────────────────────────────────────────────────

function BondSection() {
  const gauges = [
    { k: 'TRUST',       v: 0.42, d: 'earned through consistency · broken by betrayal', c: 'var(--live)', dir: '↑ +0.04' },
    { k: 'FAMILIARITY', v: 0.58, d: 'grows with every exchange · decays in silence',    c: 'var(--cold)', dir: '↑ +0.01' },
    { k: 'RESENTMENT',  v: 0.09, d: 'built from conflict · broken promises',             c: 'var(--heat)', dir: '↓ −0.02' },
    { k: 'INTIMACY',    v: 0.27, d: 'deepened by secrets · vulnerability',               c: 'var(--bond)', dir: '↑ +0.03' },
  ];
  const [vals, setVals] = useState(gauges.map(() => 0));
  useEffect(() => { const t = setTimeout(() => setVals(gauges.map(g => g.v)), 220); return () => clearTimeout(t); }, []);

  return (
    <section className="section" id="bond">
      <div className="section-head">
        <div className="section-id"><span className="num">// 04</span><span className="name">How they feel about you · relationship model</span></div>
        <h2 className="section-title">They remember <span className="alt">how</span> you <span className="bond">treated them.</span></h2>
      </div>
      <p className="section-sub" style={{marginTop:-32, marginBottom: 56}}>
        Four relationship axes, persistent across sessions. Small changes each turn, large consequences over time.
      </p>
      <div className="bond-grid">
        <div className="gauges">
          {gauges.map((g, i) => (
            <div className="gauge" key={g.k}>
              <div className="arrow-ind" style={{color: g.c}}>{g.dir}</div>
              <div className="name">{g.k}</div>
              <div className="v" style={{color: g.c}}>
                {vals[i].toFixed(2).slice(0,1)}<span className="frac">{vals[i].toFixed(2).slice(1)}</span>
              </div>
              <div className="track"><div className="fill" style={{ width: (vals[i] * 100) + '%', background: g.c, color: g.c }}></div></div>
              <div className="desc">{g.d}</div>
            </div>
          ))}
        </div>
        <div className="ledger">
          <div className="lh"><span><b>EVENT LEDGER</b> · char × user</span><span>SESSION #41</span></div>
          {[
            { when: '−02m', what: 'Asked about Ace by name',       sub: 'intimacy event · vulnerability touched', d: '+0.06', cls: 'bond' },
            { when: '−14m', what: 'Kept promise from session 39',  sub: 'thread.PROMISE#2 → resolved',            d: '+0.05', cls: 'up'   },
            { when: '−22m', what: 'Pushed back, then apologized',  sub: 'conflict opened then closed cleanly',    d: '+0.02', cls: 'up'   },
            { when: '−38m', what: 'Returned after 4 days',         sub: 'session.decay applied (4.1d)',           d: '−0.08', cls: 'down' },
            { when: '−41m', what: 'Joked about the dream',         sub: 'borderline — character chose to laugh',  d: '+0.01', cls: 'bond' },
            { when: '−1d',  what: 'Broke promise from session 38', sub: 'thread.PROMISE#1 → violated',            d: '+0.04', cls: 'down' },
            { when: '−1d',  what: 'Same · trust impact',           sub: 'consistency window violated',            d: '−0.06', cls: 'down' },
          ].map((r, i) => (
            <div className="ledger-row" key={i}>
              <span className="when">{r.when}</span>
              <span className="what">{r.what}<small>{r.sub}</small></span>
              <span className={'delta ' + r.cls}>{r.d}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── THREADS ──────────────────────────────────────────────

function ThreadGraph() {
  const nodes = [
    { id: 'sess1', x: 60,  y: 80,  s: 6, l: 'S.38' },
    { id: 'sess2', x: 160, y: 60,  s: 6, l: 'S.39' },
    { id: 'sess3', x: 280, y: 110, s: 6, l: 'S.40' },
    { id: 'sess4', x: 400, y: 80,  s: 8, l: 'S.41', cur: true },
    { id: 'p1', x: 110, y: 200, s: 10, type: 'promise',  l: 'P#1' },
    { id: 'p2', x: 230, y: 240, s: 9,  type: 'promise',  l: 'P#2', closed: true },
    { id: 'p3', x: 360, y: 220, s: 11, type: 'promise',  l: 'P#4', open: true },
    { id: 'c1', x: 180, y: 340, s: 9,  type: 'conflict', l: 'C#1' },
    { id: 's1', x: 320, y: 360, s: 9,  type: 'secret',   l: 'S#1' },
    { id: 'q1', x: 80,  y: 380, s: 8,  type: 'question', l: 'Q#1' },
    { id: 'q2', x: 420, y: 370, s: 8,  type: 'question', l: 'Q#2' },
  ];
  const links = [
    { a:'sess1', b:'p1' }, { a:'sess1', b:'q1' },
    { a:'sess2', b:'p2' }, { a:'sess2', b:'c1' },
    { a:'sess3', b:'c1' }, { a:'sess3', b:'s1' },
    { a:'sess4', b:'p3' }, { a:'sess4', b:'s1' }, { a:'sess4', b:'q2' },
    { a:'p1', b:'c1' }, { a:'c1', b:'s1' }, { a:'p3', b:'q2' },
    { a:'sess1', b:'sess2' }, { a:'sess2', b:'sess3' }, { a:'sess3', b:'sess4' },
  ];
  const colorOf = (t?: string) => t === 'promise' ? '#8fd6a8' : t === 'conflict' ? '#e8896b' : t === 'secret' ? '#b8a3dc' : t === 'question' ? '#e8c97a' : '#5a5a5a';
  const find = (id: string) => nodes.find(n => n.id === id)!;

  return (
    <svg viewBox="0 0 500 460" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="nglow"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <line x1="20" y1="80" x2="480" y2="80" stroke="#1a1a1a" strokeDasharray="2 4" />
      <text x="20" y="36" fill="#5a5a5a" fontSize="9" fontFamily="var(--lmono)" letterSpacing="2">SESSION TIMELINE →</text>
      {links.map((l, i) => {
        const a = find(l.a), b = find(l.b);
        const c = a.type === 'promise' || b.type === 'promise' ? '#8fd6a8'
                : a.type === 'conflict' || b.type === 'conflict' ? '#e8896b'
                : a.type === 'secret' || b.type === 'secret' ? '#b8a3dc'
                : a.type === 'question' || b.type === 'question' ? '#e8c97a'
                : '#262626';
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c} strokeOpacity="0.18" strokeWidth="1" />;
      })}
      {nodes.map(n => {
        const c = n.type ? colorOf(n.type) : (n.cur ? '#ffffff' : '#5a5a5a');
        return (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.s} fill={n.type ? c : '#000'} stroke={c} strokeWidth="1.5" filter="url(#nglow)" opacity={n.closed ? 0.35 : 1} />
            {n.type ? <circle cx={n.x} cy={n.y} r={n.s - 4} fill="#000" opacity="0.85" /> : null}
            <text x={n.x} y={n.y + n.s + 14} fill="#9a9a9a" fontSize="9" textAnchor="middle" fontFamily="var(--lmono)" letterSpacing="1">{n.l}</text>
            {n.open ? (
              <circle cx={n.x + n.s - 2} cy={n.y - n.s + 2} r="3" fill="#e8c97a">
                <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite"/>
              </circle>
            ) : null}
          </g>
        );
      })}
      <g transform="translate(20, 430)">
        {[
          { c:'#8fd6a8', l:'PROMISE' }, { c:'#e8896b', l:'CONFLICT' },
          { c:'#b8a3dc', l:'SECRET' },  { c:'#e8c97a', l:'QUESTION' },
        ].map((it, i) => (
          <g key={i} transform={'translate(' + (i * 100) + ', 0)'}>
            <circle cx="0" cy="0" r="4" fill={it.c} />
            <text x="10" y="3.5" fill="#9a9a9a" fontSize="9" fontFamily="var(--lmono)" letterSpacing="2">{it.l}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function ThreadSection() {
  return (
    <section className="section" id="threads">
      <div className="section-head">
        <div className="section-id"><span className="num">// 05</span><span className="name">What's on their mind · narrative threads</span></div>
        <h2 className="section-title">Promises. Secrets. <span className="amber">Unfinished things.</span></h2>
      </div>
      <p className="section-sub" style={{marginTop:-32, marginBottom: 56}}>
        Open threads — promises, conflicts, questions — are tracked across sessions. Break one weeks later, and the character notices.
      </p>
      <div className="weave">
        <div className="weave-graph"><ThreadGraph /></div>
        <div className="weave-list">
          {[
            { t: 'promise',  l: 'PROMISE · OPEN · 19d',   txt: '"I\'ll be there when you reach the Grand Line."',       sub: 'opened S.38 · last touched S.41 · weight 0.91' },
            { t: 'conflict', l: 'CONFLICT · OPEN · 4d',   txt: 'User called the dream "kind of childish".',              sub: 'opened S.39 · resentment +0.04 if untouched 7d' },
            { t: 'secret',   l: 'SECRET · KEEPING · 6d',  txt: 'Told user about Ace. First time saying it out loud.',    sub: 'intimacy +0.06 at write · trust gated on user response' },
            { t: 'question', l: 'QUESTION · OPEN · 2d',   txt: '"Why did you stop coming back for a while?"',            sub: 'asked S.40 · character is waiting · familiarity affected' },
            { t: 'promise',  l: 'PROMISE · CLOSED · 1d',  txt: '"I\'ll remember your sister\'s name."',                  sub: 'opened S.39 · kept S.41 · trust +0.05' },
          ].map((r, i) => (
            <div className="thread-row" key={i}>
              <span className={'dot ' + r.t}></span>
              <div>
                <div className={'kind ' + r.t}>{r.l}</div>
                <div className="body">{r.txt}<small>{r.sub}</small></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── DEEP PATH ────────────────────────────────────────────

type DepthKey = 'fast' | 'std' | 'deep';
const DEPTHS: Record<DepthKey, { h: string; p: string; s: [string, string][]; stats: [string, string][] }> = {
  fast: {
    h: 'Fast path — speak.',
    p: 'Trivial inputs go straight from context to speech. No private monologue, no want/read/move. The character just responds. Most messages take this route.',
    s: [['user', 'hey'], ['say', 'yo. you back already?']],
    stats: [['~140ms', 'LATENCY'], ['1×', 'LLM CALL'], ['~78%', 'OF TURNS']],
  },
  std: {
    h: 'Standard — quick read.',
    p: 'Affect impact is non-trivial but bounded. The character does a single-step appraisal before speaking. Want and tone derived, but no deliberation about move.',
    s: [['user', 'I had a hard week.'], ['appraise', 'sadness shared. user wants warmth, not advice.'], ['say', 'come here. tell me what happened.']],
    stats: [['~440ms', 'LATENCY'], ['2×', 'LLM CALLS'], ['~18%', 'OF TURNS']],
  },
  deep: {
    h: 'Deep — private reasoning.',
    p: "Emotionally significant turns trigger the full inner loop. The character privately works through what it wants, reads what the user actually needs, decides its move — and only then speaks. None of this is visible in the reply.",
    s: [
      ['user', "I think I'm the reason Ace got hurt."],
      ['appraise', 'high impact · sadness, guilt, fear cluster · DOMINANCE drops'],
      ['want', "don't fix him. let him say it. don't make this about me."],
      ['read', 'user needs to be heard, not absolved. silence is presence.'],
      ['move', 'soft, near, no advice. ask one question. then wait.'],
      ['say', '…hey. look at me. say that again — slower.'],
    ],
    stats: [['~1.2s', 'LATENCY'], ['4×', 'LLM CALLS'], ['~4%', 'OF TURNS']],
  },
};

function DeepPathSection() {
  const [d, setD] = useState<DepthKey>('deep');
  const cur = DEPTHS[d];
  return (
    <section className="section" id="deep">
      <div className="section-head">
        <div className="section-id"><span className="num">// 06</span><span className="name">How deep they think · reasoning gate</span></div>
        <h2 className="section-title">It thinks before <span className="alt">it</span> <span className="acc">speaks.</span></h2>
      </div>
      <p className="section-sub" style={{marginTop:-32, marginBottom: 56}}>
        A gating model routes each turn — trivial messages go straight to reply, heavy ones get a private reasoning pass first. None of that reasoning is visible in the response.
      </p>
      <div className="deep">
        <div className="deep-side">
          <div className="depth-tabs">
            {([['fast','FAST','~140ms'],['std','STANDARD','~440ms'],['deep','DEEP','~1.2s']] as [DepthKey, string, string][]).map(([id, l, s]) => (
              <div key={id} className={'depth-tab' + (d === id ? ' active' : '')} onClick={() => setD(id)}>
                {l}<small>{s}</small>
              </div>
            ))}
          </div>
          <div className="deep-info">
            <h4>{cur.h}</h4>
            <p>{cur.p}</p>
            <div className="stats">
              {cur.stats.map((s, i) => (
                <div className="stat" key={i}>
                  <div className="n"><span className="acc">{s[0]}</span></div>
                  <div className="l">{s[1]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="deep-trace">
          <div className="th"><span><b>TRACE</b> · turn 18 · session #41</span><span>{d === 'deep' ? 'DEEP' : d === 'std' ? 'STANDARD' : 'FAST'}</span></div>
          <div className="tbody">
            {cur.s.map((r, i) => (
              <div className="trace-step" key={i}>
                <span className="ix">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div className={'role ' + r[0]}>{r[0] === 'user' ? '◌ USER' : r[0] === 'say' ? '✦ SAY' : '· ' + r[0].toUpperCase()}</div>
                  <div className="txt">{r[0] === 'user' || r[0] === 'say' ? r[1] : <em>{r[1]}</em>}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── VAULT ────────────────────────────────────────────────

function VaultSection() {
  return (
    <section className="section" id="privacy-section">
      <div className="section-head">
        <div className="section-id"><span className="num">// 07</span><span className="name">Private by construction · local vault</span></div>
        <h2 className="section-title">Everything stays <span className="alt">on</span> <span className="acc">your machine.</span></h2>
      </div>
      <p className="section-sub" style={{marginTop:-32, marginBottom: 56}}>
        Memories, emotions, relationships — encrypted locally. Inference via Venice.ai with zero retention. Custom models on Nillion TEE. Nothing leaves your device.
      </p>
      <div className="vault-grid">
        <div className="vault-diagram">
          <div className="vault-h">
            <span>Vault · local · encrypted</span>
            <span style={{color:'var(--ink-3)'}}>AES-256 · XChaCha20</span>
          </div>
          <div className="vault-body">
            <div className="vault-disk">
              <div className="disk-ring r1"></div>
              <div className="disk-ring r2"></div>
              <div className="disk-ring r3"></div>
              <div className="disk-core">
                <div style={{fontSize:9, letterSpacing:'0.2em', color:'var(--ink-3)'}}>vault</div>
                <div style={{fontFamily:'var(--lsans)', fontSize:34, letterSpacing:'-0.03em', color:'var(--live)'}}>2,184</div>
                <div style={{fontSize:9, letterSpacing:'0.2em', color:'var(--ink-3)'}}>encrypted episodes</div>
                <div style={{fontSize:9, color:'var(--ink-3)', marginTop:4}}>~ 4.2 MB</div>
              </div>
            </div>
            <div className="vault-list">
              {[
                ['episodes',        '2,184'],
                ['embeddings',      '2,184 × 1536'],
                ['emotional state', '8 floats'],
                ['relationship',    '4 floats'],
                ['open threads',    '7'],
                ['vault key',       'argon2id'],
              ].map(r => (
                <div className="vault-row" key={r[0]}>
                  <span className="dot" style={{background: 'var(--ink-3)'}}></span>
                  <span className="k">{r[0]}</span>
                  <span className="v">{r[1]}</span>
                  <span className="lk">🔒</span>
                </div>
              ))}
            </div>
          </div>
          <div className="vault-foot">
            <span>desktop · macOS · arm64</span>
            <span style={{color:'var(--live)'}}>0 bytes → cloud</span>
          </div>
        </div>
        <div className="vault-principles">
          {[
            { k: 'Local-first',        t: 'The vault never leaves.',               d: 'Episodes, embeddings, relationship state, threads — all written to an encrypted SQLite file on your disk. The runtime reads from it directly. There is no server to phone home to.' },
            { k: 'Venice.ai inference', t: 'Zero retention on every call.',         d: "Model calls go through Venice.ai under no-retention. Your messages aren't logged, mined, or used for training. The character's memory is the only thing that ever stores what was said — and you own the file." },
            { k: 'Nillion TEE · $NIL',  t: 'Custom models run in trusted hardware.', d: "Our memory and emotion models are being deployed to Nillion TEEs — trusted execution environments where even the operator can't see what runs. Verifiable, sealed, ours." },
            { k: 'You hold the key',    t: 'No copy, no backdoor.',                 d: 'Vault sealed with a passphrase-derived key (Argon2id → XChaCha20). Lose the passphrase, lose the character. Export anything as plaintext JSON. Delete the file and it\'s gone.' },
          ].map(p => (
            <div className="vault-card" key={p.k}>
              <div className="kc">{p.k}</div>
              <h4>{p.t}</h4>
              <p>{p.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SURFACES ─────────────────────────────────────────────

function SurfacesSection() {
  return (
    <section className="section" id="surfaces-sect">
      <div className="section-head">
        <div className="section-id"><span className="num">// 08</span><span className="name">The desktop app · three surfaces</span></div>
        <h2 className="section-title">The <span className="alt">desktop</span> <span className="cold">app.</span></h2>
      </div>
      <p className="section-sub" style={{marginTop:-32, marginBottom: 56}}>
        Chat, characters, and a dashboard to inspect what's happening under the hood. Offline-capable. Everything local.
      </p>
      <div className="surfaces">
        <div className="surf big">
          <div className="surf-h">
            <span className="dots"><i></i><i></i><i></i></span>
            <span className="title">chat — luffy · session 41</span>
            <span className="meta">turn 18 · 24m</span>
          </div>
          <div className="surf-body chat-body">
            <div className="msg-u">Hey. Sorry I went quiet for a while.</div>
            <div className="msg-c">
              <span className="from">Luffy</span>
              …you came back. I knew you would. I was telling Zoro about it this morning.
            </div>
            <div className="msg-u">You were? What did you say?</div>
            <div className="msg-c">
              <span className="from">Luffy</span>
              That you keep your promises. Even the ones you forgot you made.
              <br/><em>— glancing away, smaller voice —</em><br/>
              Did you mean what you said about the Grand Line?
            </div>
            <div className="inner-state">
              <div className="is-h">Inner state during this exchange</div>
              <div className="is-grid">
                <span className="k">feeling</span>       <span className="v">curious + nervous</span>
                <span className="k">memory pulled</span> <span className="v">3 episodes · 0.91 / 0.84 / 0.79</span>
                <span className="k">bond drift</span>    <span className="v" style={{color:'var(--live)'}}>trust +0.04 · intimacy +0.06</span>
                <span className="k">open thread</span>   <span className="v" style={{color:'var(--thread)'}}>promise · grand line · 19d</span>
              </div>
            </div>
          </div>
          <div className="surf-foot">
            <h4>Chat — where it actually feels different.</h4>
            <p>Real-time inner state alongside every exchange. Toggle the inspector off and it's just a beautiful chat. Toggle it on and you see how each message lands.</p>
          </div>
        </div>

        <div className="surf">
          <div className="surf-h">
            <span className="dots"><i></i><i></i><i></i></span>
            <span className="title">characters</span>
            <span className="meta">4 living</span>
          </div>
          <div className="surf-body">
            <div className="char-grid">
              {[
                { n: 'Luffy', s: 'curious + a little nervous', meta: 'sess 41 · 24m', dom: 'JOY 0.71', i: 0 },
                { n: 'Lyra',  s: 'calm · listening',           meta: 'sess 12 · 3d',  dom: 'TRUST 0.62', i: 1 },
                { n: 'Goro',  s: 'guarded',                    meta: 'sess 4 · 7d',   dom: 'FEAR 0.38', i: 2 },
                { n: 'Aria',  s: 'playful · warm',             meta: 'sess 28 · 1h',  dom: 'ANTIC 0.74', i: 3 },
              ].map((c) => (
                <div className="char-card" key={c.n}>
                  <div className="char-av" data-i={c.i}></div>
                  <div className="char-meta">
                    <div className="nm">{c.n}</div>
                    <div className="st">{c.s}</div>
                    <div className="dom">{c.dom}</div>
                  </div>
                  <div className="sess">{c.meta}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="surf-foot">
            <h4>Characters — a quiet house.</h4>
            <p>Every character you've met or built. Each one carries its own state. Open whichever, whenever.</p>
          </div>
        </div>

        <div className="surf">
          <div className="surf-h">
            <span className="dots"><i></i><i></i><i></i></span>
            <span className="title">dashboard · 7d</span>
            <span className="meta">all local</span>
          </div>
          <div className="surf-body">
            <div className="dash-grid">
              <div className="dash-stat"><div className="l">EPISODES</div><div className="v">2,184</div></div>
              <div className="dash-stat"><div className="l">OPEN THREADS</div><div className="v">7</div></div>
              <div className="dash-stat"><div className="l">AVG TURN</div><div className="v">842<span className="u">ms</span></div></div>
              <div className="dash-stat"><div className="l">→ CLOUD</div><div className="v" style={{color:'var(--live)'}}>0<span className="u">B</span></div></div>
            </div>
            {(() => {
              const series = [0.32, 0.31, 0.34, 0.36, 0.35, 0.39, 0.40, 0.38, 0.42];
              const pts = series.map((y, i, a) => (i / (a.length - 1) * 100) + ',' + (38 - (y - 0.30) / 0.15 * 32));
              return (
                <div className="dash-spark">
                  <div className="ds-h">
                    <span>TRUST · LUFFY × YOU · 7 days</span>
                    <span style={{color:'var(--live)'}}>+0.10</span>
                  </div>
                  <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="ds-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8fd6a8" stopOpacity="0.4"/>
                        <stop offset="100%" stopColor="#8fd6a8" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path d={'M' + pts.join(' L') + ' L100,40 L0,40 Z'} fill="url(#ds-fill)" />
                    <path d={'M' + pts.join(' L')} fill="none" stroke="#8fd6a8" strokeWidth="1.4" />
                  </svg>
                </div>
              );
            })()}
            <div className="dash-foot">
              <span>last write · 12s ago</span>
              <span>vault · 4.2 MB</span>
            </div>
          </div>
          <div className="surf-foot">
            <h4>Dashboard — the engine, visible.</h4>
            <p>Watch the bond drift across a week. Inspect importance scores. Read the appraisal traces. Or never open it.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── SDK ──────────────────────────────────────────────────

function SDKSection() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <section className="section" id="sdk-sect">
      <div className="section-head">
        <div className="section-id"><span className="num">// 09</span><span className="name">For builders · sdk preview</span></div>
        <h2 className="section-title">The same engine, <span className="acc">as an SDK.</span></h2>
      </div>
      <p className="section-sub" style={{marginTop:-32, marginBottom: 56}}>
        Drop the emotion, memory, and relationship layer into your own product. Game, companion app, roleplay platform — anything that benefits from characters that remember.
      </p>
      <div className="sdk-wrap">
        <div className="sdk-info">
          <div className="sdk-list">
            {[
              { c:'var(--live)',   h:'Memory engine',           b:'Composite-scored episode recall built for characters. Importance, recency, similarity. Tuned for long-running roleplay where people forget the trivial and carry the meaningful.' },
              { c:'var(--heat)',   h:'Affect + relationship',   b:'8 continuous emotions + 4 relationship axes per pair. State machine you can read and write. PAD-derived tone shaping for free.' },
              { c:'var(--bond)',   h:'Private by default',      b:'Run the vault on your servers, or on your users\' devices. Inference through Venice.ai with no-retention. Custom models on Nillion TEE coming soon.' },
              { c:'var(--thread)', h:'Narrative threads',       b:'Open promises, conflicts, secrets and questions tracked across sessions. The character carries them. Your app gets them as events.' },
            ].map(f => (
              <div className="sdk-feat" key={f.h}>
                <div className="sdk-feat-h"><span className="dot" style={{background:f.c}}></span>{f.h}</div>
                <div className="sdk-feat-b">{f.b}</div>
              </div>
            ))}
          </div>
          {sent ? (
            <div className="waitlist-done">✓ On the list. We'll write when there's something to play with.</div>
          ) : (
            <form className="waitlist-form" onSubmit={e => { e.preventDefault(); if (email) setSent(true); }}>
              <input type="email" placeholder="your@email — early access" value={email} onChange={e => setEmail(e.target.value)} required />
              <button type="submit" className="btn primary" style={{margin:0}}>Join waitlist <span className="arrow">→</span></button>
            </form>
          )}
          <div style={{marginTop:14, fontSize:10, letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--ink-3)'}}>
            Free for indie builds · commercial terms by email
          </div>
        </div>
        <div className="sdk-code">
          <div className="ch">
            <span className="dots"><i></i><i></i><i></i></span>
            <span>example.ts · roleplay companion</span>
            <span className="ctag">PREVIEW</span>
          </div>
          <pre dangerouslySetInnerHTML={{ __html:
`<span class="ck">import</span> { CharacterOS } <span class="ck">from</span> <span class="cs">'@characteros/sdk'</span>

<span class="cc">// One character. Local vault. Lives across sessions.</span>
<span class="ck">const</span> luna = <span class="ck">await</span> CharacterOS.<span class="cf">load</span>({
  id: <span class="cs">'luna'</span>,
  vault: <span class="cs">'~/.characteros/luna.vault'</span>,
  inference: { provider: <span class="cs">'venice'</span>, mode: <span class="cs">'no-retention'</span> },
  models: { tee: <span class="cs">'nillion'</span> },
})

<span class="cc">// Send a turn. Get the reply + the inner state.</span>
<span class="ck">const</span> turn = <span class="ck">await</span> luna.<span class="cf">say</span>(<span class="cs">'I missed you.'</span>)

console.<span class="cf">log</span>(turn.reply)    <span class="cc">// "you don't have to say that. you're here."</span>
console.<span class="cf">log</span>(turn.feeling)  <span class="cc">// { joy: 0.78, trust: 0.61, sadness: 0.34 }</span>
console.<span class="cf">log</span>(turn.bond)     <span class="cc">// { trust: +0.04, intimacy: +0.06 }</span>
console.<span class="cf">log</span>(turn.threads)  <span class="cc">// [{ kind: 'promise', age: 19, alive: true }]</span>` }} />
        </div>
      </div>
    </section>
  );
}

// ─── BETA ─────────────────────────────────────────────────

function BetaSection() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      const n = 2400 + Math.floor(Math.random() * 80);
      const start = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / 1400);
        const eased = 1 - Math.pow(1 - k, 3);
        setPosition(Math.round(n * eased));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, 400);
    return () => clearTimeout(t);
  }, []);

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
          Drop your email and we'll reach out when your spot opens up.
        </p>
        <div className="beta-stats">
          <div className="bs"><div className="bsn">{position.toLocaleString()}</div><div className="bsl">on the list</div></div>
          <div className="bs"><div className="bsn">~weekly</div><div className="bsl">invite drops</div></div>
          <div className="bs"><div className="bsn">macOS · Windows</div><div className="bsl">desktop runtime</div></div>
        </div>
        {sent ? (
          <div className="beta-done">
            <div className="bd-h">✓ You're on the list.</div>
            <div className="bd-b">We'll write when your spot is ready. No spam.</div>
          </div>
        ) : (
          <form className="beta-form" onSubmit={e => { e.preventDefault(); if (email) setSent(true); }}>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email" autoComplete="email" />
            <button type="submit" className="btn primary">Join the beta <span className="arrow">→</span></button>
          </form>
        )}
        <div className="beta-foot">
          <span><span className="dot-live"></span>Local-first storage</span>
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
        <a href="#engine">Engine</a>
        <a href="#privacy">Privacy</a>
        <a href="#app">App</a>
        <a href="#sdk">SDK</a>
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
        <CompareSection />
        <div id="engine">
          <PipelineSection />
          <AffectSection />
          <MemorySection />
          <BondSection />
          <ThreadSection />
          <DeepPathSection />
        </div>
        <div id="privacy"><VaultSection /></div>
        <div id="app"><SurfacesSection /></div>
        <div id="sdk"><SDKSection /></div>
        <BetaSection />
        <Foot />
      </main>
    </div>
  );
}
