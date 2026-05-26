'use client';

import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';

const S = {
  nav: {
    position: 'fixed' as const, top: 0, left: 0, right: 0,
    height: 44, zIndex: 60,
    background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)',
    borderBottom: '1px solid #1a1a1a',
    display: 'flex', alignItems: 'center',
    padding: '0 20px', gap: 24,
    fontFamily: "'Geist Mono', monospace", fontSize: 11,
  },
  brand: {
    fontWeight: 700, letterSpacing: '0.1em',
    display: 'inline-flex', alignItems: 'center', gap: 8,
    color: '#e8e8e8', textDecoration: 'none',
  },
  links: { display: 'flex', gap: 20, marginLeft: 8 },
  link: (active: boolean) => ({
    color: active ? '#e8e8e8' : '#5a5a5a',
    textDecoration: 'none', letterSpacing: '0.12em', textTransform: 'uppercase' as const,
    fontSize: 10, transition: 'color 0.15s',
    borderBottom: active ? '1px solid #8fd6a8' : '1px solid transparent',
    paddingBottom: 2,
  }),
  right: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 },
  wallet: (connected: boolean) => ({
    fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    padding: '4px 10px', borderRadius: 3, cursor: 'pointer', border: 'none',
    fontFamily: "'Geist Mono', monospace",
    background: connected ? 'rgba(143,214,168,0.1)' : 'rgba(143,214,168,0.15)',
    color: connected ? '#8fd6a8' : '#8fd6a8',
    borderWidth: 1, borderStyle: 'solid',
    borderColor: connected ? 'rgba(143,214,168,0.3)' : 'rgba(143,214,168,0.5)',
  }),
};

export default function AppNav({ active }: { active?: 'characters' | 'dashboard' | 'chat' }) {
  const { login, logout, authenticated, user } = usePrivy();
  const addr = user?.wallet?.address;

  return (
    <nav style={S.nav}>
      <style>{`
        @keyframes nav-brand-color {
          0%,  76%  { color:#8fd6a8; filter:drop-shadow(0 0 4px rgba(143,214,168,0.6)); }
          78%        { color:#e8896b; filter:drop-shadow(0 0 6px rgba(232,137,107,1));   }
          80%        { color:#e8c97a; filter:drop-shadow(0 0 6px rgba(232,201,122,1));   }
          82%        { color:#b8a3dc; filter:drop-shadow(0 0 6px rgba(184,163,220,1));   }
          84%        { color:#8fb4dc; filter:drop-shadow(0 0 6px rgba(143,180,220,1));   }
          86%, 100%  { color:#8fd6a8; filter:drop-shadow(0 0 4px rgba(143,214,168,0.6)); }
        }
        @keyframes nav-brand-spin {
          from { transform:rotate(0deg); } to { transform:rotate(360deg); }
        }
        .nav-brand-mark { animation: nav-brand-spin 8s linear infinite, nav-brand-color 12s ease-in-out infinite; }
      `}</style>
      <Link href="/" style={S.brand}>
        <svg width="26" height="26" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="nav-brand-mark">
          <path d="M8 2A6 6 0 0 1 14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M8 14A6 6 0 0 1 2 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity={0.35}/>
          <circle cx="8" cy="8" r="2.5" fill="currentColor"/>
        </svg>
        CHARACTER<span style={{ color: '#5a5a5a' }}>OS</span>
      </Link>

      <div style={S.links}>
        <Link href="/characters" style={S.link(active === 'characters')}>Characters</Link>
        <Link href="/dashboard" style={S.link(active === 'dashboard')}>Dashboard</Link>
        <Link href="/create" style={S.link(false)}>New</Link>
      </div>

      <div style={S.right}>
        {authenticated && addr ? (
          <button onClick={logout} style={S.wallet(true)}>
            {addr.slice(0, 6)}…{addr.slice(-4)}
          </button>
        ) : (
          <button onClick={login} style={S.wallet(false)}>
            Connect wallet
          </button>
        )}
      </div>
    </nav>
  );
}
