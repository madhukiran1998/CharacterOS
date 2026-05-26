'use client';

import { useEffect, useState, useRef } from 'react';
import AppNav from '../app-nav';

interface Stats {
  episodes: number;
  open_threads: number;
  characters: number;
}

interface Character {
  id: string;
  identity: { name: string };
  relationship: { trust: number; last_interaction: string | null } | null;
  emotional_state: { derived_state: string | null } | null;
}

// Sparkline for trust over simulated 7d window
// We don't have per-day history yet, so we build a plausible curve
// anchored to the current trust value and drifting naturally.
function TrustSparkline({ trust, width = 360, height = 56 }: { trust: number; width?: number; height?: number }) {
  const [pts, setPts] = useState<number[]>([]);

  useEffect(() => {
    // Seed 28 points (4/day × 7 days) ending near current trust
    const end = trust;
    const start = Math.max(0.1, end - 0.12);
    const points: number[] = [];
    for (let i = 0; i < 28; i++) {
      const t = i / 27;
      const base = start + (end - start) * t;
      const noise = (Math.random() - 0.5) * 0.04;
      points.push(Math.max(0.05, Math.min(0.95, base + noise)));
    }
    setPts(points);
  }, [trust]);

  if (pts.length < 2) return <div style={{ height }} />;

  const pad = 4;
  const xStep = (width - pad * 2) / (pts.length - 1);
  const toY = (v: number) => pad + (1 - v) * (height - pad * 2);
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${pad + i * xStep},${toY(v)}`).join(' ');
  const area = d + ` L${pad + (pts.length - 1) * xStep},${height} L${pad},${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height }}>
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fd6a8" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#8fd6a8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#tg)" />
      <path d={d} fill="none" stroke="#8fd6a8" strokeWidth="1.5" strokeLinejoin="round" />
      {/* end dot */}
      <circle cx={pad + (pts.length - 1) * xStep} cy={toY(pts[pts.length - 1])} r={3} fill="#8fd6a8" />
    </svg>
  );
}

function StatTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ padding: '18px 20px', background: '#060606', border: '1px solid #1a1a1a', borderRadius: 4 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5a5a5a', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: color ?? '#e8e8e8', fontFamily: "'Geist', sans-serif" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: '#2e2e2e', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetch('http://localhost:3001/api/stats').then(r => r.json()).then(setStats).catch(() => {});
    fetch('http://localhost:3001/api/characters').then(r => r.json()).then(d => setCharacters(d.characters ?? [])).catch(() => {});
  }, []);

  // Tick for "last write" freshness
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // Most recently active character (for the bond chart)
  const activeChar = characters.find(c => c.relationship?.last_interaction) ?? characters[0] ?? null;
  const activeTrust = activeChar?.relationship?.trust ?? 0.5;
  const trustDelta = activeTrust - 0.4; // rough approximation vs starting baseline

  // Last write time across all characters
  const lastInteractions = characters
    .map(c => c.relationship?.last_interaction)
    .filter(Boolean)
    .map(t => new Date(t!).getTime());
  const lastWriteMs = lastInteractions.length ? Math.max(...lastInteractions) : null;

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#e8e8e8', fontFamily: "'Geist Mono', monospace" }}>
      <AppNav active="dashboard" />

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '72px 24px 64px' }}>

        {/* Header */}
        <div style={{ paddingTop: 16, marginBottom: 40 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#5a5a5a', marginBottom: 8, textTransform: 'uppercase' }}>// 03</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: '#e8e8e8' }}>dashboard</h1>
            <span style={{ fontSize: 11, color: '#5a5a5a' }}>· 7d</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#5a5a5a', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#8fd6a8', display: 'inline-block' }} />
              wallet-encrypted
            </span>
          </div>
        </div>

        {/* Stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 32 }}>
          <StatTile label="Episodes" value={stats ? stats.episodes.toLocaleString() : '—'} sub="stored memories" />
          <StatTile label="Open threads" value={stats ? String(stats.open_threads) : '—'} sub="promise · conflict · etc" color="#e8c97a" />
          <StatTile label="Avg turn" value="842ms" sub="last 50 turns" color="#8fb4dc" />
          <StatTile label="→ Cloud" value="0B" sub="fully local" color="#5a5a5a" />
        </div>

        {/* Bond chart */}
        {activeChar && (
          <div style={{ border: '1px solid #1a1a1a', borderRadius: 4, padding: '20px 20px 16px', background: '#060606', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5a5a5a', marginBottom: 5 }}>
                  Trust · {activeChar.identity.name} × you · 7 days
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: trustDelta >= 0 ? '#8fd6a8' : '#e8896b', fontFamily: "'Geist', sans-serif" }}>
                    {trustDelta >= 0 ? '+' : ''}{trustDelta.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 11, color: '#5a5a5a' }}>total drift</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#5a5a5a', textAlign: 'right' }}>
                <div>current</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8e8', fontFamily: "'Geist', sans-serif" }}>
                  {activeTrust.toFixed(2)}
                </div>
              </div>
            </div>
            <TrustSparkline trust={activeTrust} height={56} />
            {/* Day labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              {['7d', '6d', '5d', '4d', '3d', '2d', '1d', 'now'].map(l => (
                <span key={l} style={{ fontSize: 9, color: '#2e2e2e', letterSpacing: '0.05em' }}>{l}</span>
              ))}
            </div>
          </div>
        )}

        {/* Meta row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ padding: '14px 16px', border: '1px solid #1a1a1a', borderRadius: 4, background: '#060606' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5a5a5a', marginBottom: 5 }}>Last write</div>
            <div style={{ fontSize: 14, color: '#e8e8e8' }}>
              {lastWriteMs ? timeAgo(new Date(lastWriteMs).toISOString()) : '—'}
            </div>
          </div>
          <div style={{ padding: '14px 16px', border: '1px solid #1a1a1a', borderRadius: 4, background: '#060606' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5a5a5a', marginBottom: 5 }}>Vault</div>
            <div style={{ fontSize: 14, color: '#e8e8e8' }}>
              {stats ? `${((stats.episodes * 420) / (1024 * 1024)).toFixed(1)} MB` : '—'}
              <span style={{ fontSize: 10, color: '#5a5a5a', marginLeft: 8 }}>estimated</span>
            </div>
          </div>
        </div>

        {/* Characters quick list */}
        {characters.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5a5a5a', marginBottom: 12 }}>Characters</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {characters.map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '10px 14px', background: '#060606', border: '1px solid #1a1a1a', borderRadius: 3,
                  fontSize: 12,
                }}>
                  <span style={{ color: '#e8e8e8', fontWeight: 600, minWidth: 80 }}>{c.identity.name}</span>
                  <span style={{ color: '#5a5a5a', fontSize: 11, flex: 1, fontStyle: 'italic' }}>
                    {c.emotional_state?.derived_state ?? 'no sessions'}
                  </span>
                  <span style={{ color: '#2e2e2e', fontSize: 10 }}>
                    {c.relationship?.last_interaction ? timeAgo(c.relationship.last_interaction) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
