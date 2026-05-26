'use client';

export default function LogoPage() {
  return (
    <div style={{
      background: '#000',
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 28,
      fontFamily: "'Geist Mono', monospace",
    }}>
      <style>{`
        @keyframes logo-color {
          0%,  76%  { color: #8fd6a8; filter: drop-shadow(0 0 8px rgba(143,214,168,0.6)); }
          78%        { color: #e8896b; filter: drop-shadow(0 0 12px rgba(232,137,107,1));  }
          80%        { color: #e8c97a; filter: drop-shadow(0 0 12px rgba(232,201,122,1));  }
          82%        { color: #b8a3dc; filter: drop-shadow(0 0 12px rgba(184,163,220,1));  }
          84%        { color: #8fb4dc; filter: drop-shadow(0 0 12px rgba(143,180,220,1));  }
          86%, 100%  { color: #8fd6a8; filter: drop-shadow(0 0 8px rgba(143,214,168,0.6)); }
        }
        .logo-mark { animation: logo-color 12s ease-in-out infinite; }
      `}</style>

      <svg className="logo-mark" viewBox="0 0 16 16" fill="none" style={{ width: 96, height: 96 }}>
        <path d="M8 2A6 6 0 0 1 14 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 14A6 6 0 0 1 2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={0.35}/>
        <circle cx="8" cy="8" r="2.5" fill="currentColor"/>
      </svg>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.25em', color: '#e8e8e8', textTransform: 'uppercase' }}>
          Character<span style={{ color: '#2e2e2e' }}>OS</span>
        </div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#2e2e2e', textTransform: 'uppercase', marginTop: 8 }}>
          Emotional AI runtime
        </div>
      </div>
    </div>
  );
}
