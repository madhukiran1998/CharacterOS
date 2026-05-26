'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '../app-nav';

interface EmotionalState {
  derived_state: string | null;
  dominant_primary: string | null;
  momentum: string | null;
  joy: number; trust: number; fear: number; surprise: number;
  sadness: number; disgust: number; anger: number; anticipation: number;
  last_updated: string | null;
}

interface Relationship {
  session_count: number | null;
  last_interaction: string | null;
  trust: number | null;
  familiarity: number | null;
}

interface Character {
  id: string;
  created_at: string;
  identity: { name: string; role: string; public_self: string };
  emotional_state: EmotionalState | null;
  relationship: Relationship | null;
  episodes: number;
}

// top emotion by value
function dominantEmotion(es: EmotionalState): { label: string; val: number; color: string } {
  const map: { key: keyof EmotionalState; label: string; color: string }[] = [
    { key: 'joy',          label: 'JOY',   color: '#e8c97a' },
    { key: 'trust',        label: 'TRUST', color: '#8fd6a8' },
    { key: 'fear',         label: 'FEAR',  color: '#b8a3dc' },
    { key: 'surprise',     label: 'SURP',  color: '#e8a067' },
    { key: 'sadness',      label: 'SAD',   color: '#8fb4dc' },
    { key: 'disgust',      label: 'DISG',  color: '#a8c98a' },
    { key: 'anger',        label: 'ANG',   color: '#e8896b' },
    { key: 'anticipation', label: 'ANTIC', color: '#88c4d0' },
  ];
  let best = map[0];
  let bestVal = es[map[0].key] as number;
  for (const e of map) {
    const v = es[e.key] as number;
    if (v > bestVal) { best = e; bestVal = v; }
  }
  return { label: best.label, val: bestVal, color: best.color };
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// Animated ring for the dominant-emotion value
function EmotionRing({ val, color }: { val: number; color: string }) {
  const r = 18, cx = 22, cy = 22;
  const circ = 2 * Math.PI * r;
  const [dash, setDash] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDash(val * circ), 80);
    return () => clearTimeout(t);
  }, [val, circ]);
  return (
    <svg width={44} height={44} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a1a" strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={2.5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

function CharacterCard({ char, onClick }: { char: Character; onClick: () => void }) {
  const es = char.emotional_state;
  const rel = char.relationship;
  const dom = es ? dominantEmotion(es) : null;
  const lastSeen = timeAgo(rel?.last_interaction ?? null);
  const sessions = rel?.session_count ?? 0;

  // subtle live pulse if recently active (last 24h)
  const recentlyActive = rel?.last_interaction
    ? Date.now() - new Date(rel.last_interaction).getTime() < 86400000
    : false;

  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      padding: 0, width: '100%',
    }}>
      <div style={{
        background: '#060606', border: '1px solid #1a1a1a', borderRadius: 4,
        padding: '20px 20px 18px',
        transition: 'border-color 0.15s, background 0.15s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#2e2e2e'; (e.currentTarget as HTMLDivElement).style.background = '#0a0a0a'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#1a1a1a'; (e.currentTarget as HTMLDivElement).style.background = '#060606'; }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8e8', letterSpacing: '-0.01em', fontFamily: "'Geist', sans-serif" }}>
              {char.identity.name}
            </div>
            {recentlyActive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', background: '#8fd6a8',
                  display: 'inline-block', animation: 'pulse 1.6s ease-in-out infinite',
                  boxShadow: '0 0 0 0 rgba(143,214,168,0.5)',
                }} />
                <span style={{ fontSize: 9, color: '#5a5a5a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>active</span>
              </div>
            )}
          </div>
          {dom && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmotionRing val={dom.val} color={dom.color} />
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: dom.color, fontFamily: 'monospace', letterSpacing: '0.05em', lineHeight: 1.1 }}>{dom.label}</div>
                <div style={{ fontSize: 9, color: dom.color, fontFamily: 'monospace', fontWeight: 700 }}>{dom.val.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Emotional state */}
        <div style={{ marginBottom: 12 }}>
          {es?.derived_state ? (
            <p style={{ fontSize: 12, color: '#9a9a9a', fontStyle: 'italic', margin: 0 }}>
              {es.derived_state}
            </p>
          ) : (
            <p style={{ fontSize: 11, color: '#2e2e2e', fontFamily: 'monospace', margin: 0 }}>
              no sessions yet
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1a1a1a', paddingTop: 10 }}>
          <span style={{ fontSize: 10, color: '#5a5a5a', fontFamily: 'monospace' }}>
            sess {sessions} · {lastSeen}
          </span>
          <span style={{ fontSize: 11, color: '#2e2e2e' }}>→</span>
        </div>
      </div>
    </button>
  );
}

export default function CharactersPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/characters')
      .then(r => r.json())
      .then(d => setCharacters(d.characters ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#e8e8e8', fontFamily: "'Geist Mono', monospace" }}>
      <style>{`@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(143,214,168,0.5) } 50% { box-shadow: 0 0 0 4px rgba(143,214,168,0) } }`}</style>
      <AppNav active="characters" />

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '72px 24px 64px' }} ref={containerRef}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40, paddingTop: 16 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#5a5a5a', marginBottom: 8, textTransform: 'uppercase' }}>// 02</div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: '#e8e8e8' }}>
              characters{!loading && <span style={{ color: '#5a5a5a' }}> · {characters.length} living</span>}
            </h1>
          </div>
          <button
            onClick={() => router.push('/create')}
            style={{
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              padding: '7px 14px', border: '1px solid #1a1a1a', borderRadius: 3,
              color: '#5a5a5a', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9a9a9a'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2e2e'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#5a5a5a'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a1a1a'; }}
          >
            + new character
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: 140, background: '#060606', border: '1px solid #1a1a1a', borderRadius: 4, opacity: 0.5 }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && characters.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontSize: 12, color: '#2e2e2e', marginBottom: 20 }}>no characters yet.</p>
            <button
              onClick={() => router.push('/create')}
              style={{
                fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                padding: '10px 20px', border: '1px solid #2e2e2e', borderRadius: 3,
                color: '#9a9a9a', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              compile your first character →
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && characters.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {characters.map(char => (
              <CharacterCard
                key={char.id}
                char={char}
                onClick={() => router.push(`/chat/${char.id}`)}
              />
            ))}
          </div>
        )}

        {/* Footer hint */}
        {!loading && characters.length > 0 && (
          <p style={{ marginTop: 40, fontSize: 10, color: '#2e2e2e', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {characters.reduce((a, c) => a + c.episodes, 0).toLocaleString()} episodes total across all characters
          </p>
        )}
      </main>
    </div>
  );
}
