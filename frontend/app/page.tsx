'use client';

import { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Float, Stars, Trail, Points, PointMaterial } from '@react-three/drei';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import Link from 'next/link';

// ─── 3D SCENE ────────────────────────────────────────────────────────────────

function EmotionOrb() {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x = state.clock.elapsedTime * 0.12;
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.18;
    const s = hovered ? 1.08 : 1.0;
    meshRef.current.scale.lerp(new THREE.Vector3(s, s, s), 0.05);
  });

  return (
    <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.6}>
      <mesh
        ref={meshRef}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <Sphere args={[1.8, 128, 128]}>
          <MeshDistortMaterial
            color="#1a1a2e"
            attach="material"
            distort={hovered ? 0.55 : 0.38}
            speed={hovered ? 3 : 1.8}
            roughness={0.05}
            metalness={0.9}
            envMapIntensity={1.2}
          />
        </Sphere>
      </mesh>
      <EmotionRings />
    </Float>
  );
}

function EmotionRings() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.x = state.clock.elapsedTime * 0.22;
    groupRef.current.rotation.z = state.clock.elapsedTime * 0.14;
  });

  const rings = [
    { radius: 2.3, tube: 0.012, color: '#facc15', tilt: [0.4, 0, 0] },
    { radius: 2.6, tube: 0.010, color: '#34d399', tilt: [0, 0.6, 0] },
    { radius: 2.9, tube: 0.008, color: '#f87171', tilt: [0.8, 0.3, 0] },
    { radius: 3.2, tube: 0.007, color: '#818cf8', tilt: [0.2, 0.9, 0] },
  ];

  return (
    <group ref={groupRef}>
      {rings.map((r, i) => (
        <mesh key={i} rotation={r.tilt as [number, number, number]}>
          <torusGeometry args={[r.radius, r.tube, 16, 100]} />
          <meshStandardMaterial color={r.color} emissive={r.color} emissiveIntensity={1.8} />
        </mesh>
      ))}
    </group>
  );
}

function ParticleField() {
  const count = 1800;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
  }
  const pointsRef = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.018;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.022} color="#ffffff" transparent opacity={0.25} sizeAttenuation />
    </points>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#818cf8" />
      <pointLight position={[-10, -5, -10]} intensity={1.0} color="#34d399" />
      <pointLight position={[0, -10, 5]} intensity={0.8} color="#f87171" />
      <ParticleField />
      <EmotionOrb />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.4} />
    </>
  );
}

// ─── EMOTION BARS ─────────────────────────────────────────────────────────────

const EMOTIONS = [
  { label: 'joy',          color: '#facc15', value: 0.72 },
  { label: 'trust',        color: '#34d399', value: 0.41 },
  { label: 'fear',         color: '#a78bfa', value: 0.18 },
  { label: 'surprise',     color: '#fb923c', value: 0.55 },
  { label: 'sadness',      color: '#60a5fa', value: 0.24 },
  { label: 'disgust',      color: '#84cc16', value: 0.09 },
  { label: 'anger',        color: '#f87171', value: 0.33 },
  { label: 'anticipation', color: '#22d3ee', value: 0.61 },
];

// ─── SECTIONS ─────────────────────────────────────────────────────────────────

const FEATURES = [
  { title: 'Emotional State Machine', body: '8 Plutchik emotions run continuously. Every message shifts them. Natural decay pulls back to baseline over time. Characters feel different on day 1 than day 100.', color: '#facc15' },
  { title: 'Composite Memory',        body: 'Memories scored by semantic similarity (45%), importance (30%), recency (25%). Old meaningful moments stay relevant. Trivial ones fade.', color: '#60a5fa' },
  { title: 'Living Relationships',    body: 'Trust, familiarity, resentment, intimacy — all evolve. Promises kept raise trust. Secrets shared deepen intimacy. Session decay restores balance.', color: '#34d399' },
  { title: 'Narrative Threads',       body: 'Open promises, conflicts, secrets, and questions tracked across sessions. Break a promise from three weeks ago — they remember.', color: '#f87171' },
  { title: 'Adaptive Reasoning',      body: 'Trivial inputs take a fast path. Emotionally significant turns trigger full reasoning — the character thinks privately before speaking.', color: '#c084fc' },
  { title: 'PAD Model',               body: 'Pleasure, Arousal, Dominance — three continuous axes derived from emotion. They shape tone and energy in every response.', color: '#fb923c' },
];

const PIPELINE = [
  { label: 'Load Context',      badge: 'PARALLEL', color: '#60a5fa' },
  { label: 'Appraise + Desire', badge: 'LLM',      color: '#c084fc' },
  { label: 'Emotion Math',      badge: 'CODE',      color: '#34d399' },
  { label: 'Generate Response', badge: 'STREAM',    color: '#fb923c' },
  { label: 'Write Back',        badge: '2× LLM',   color: '#f59e0b' },
];

// ─── ANIMATION VARIANTS ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.7, ease: 'easeOut' as const } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.08 } },
};

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroY       = useTransform(scrollY, [0, 500], [0, -80]);
  const [barWidths, setBarWidths] = useState(EMOTIONS.map(() => 0));

  useEffect(() => {
    const t = setTimeout(() => setBarWidths(EMOTIONS.map(e => e.value)), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bg-black text-white font-mono overflow-x-hidden">

      {/* ── NAV ── */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 border-b border-white/5 backdrop-blur-sm bg-black/60"
      >
        <span className="text-sm font-black tracking-widest">CHARACTER<span className="text-white/30">OS</span></span>
        <div className="flex gap-6 items-center">
          <Link href="/create" className="text-xs text-white/40 hover:text-white transition-colors tracking-widest uppercase">Create</Link>
          <Link href="/chat" className="text-xs bg-white text-black px-4 py-2 rounded-lg font-bold hover:bg-white/90 transition-colors tracking-wide">Launch →</Link>
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="relative h-screen flex items-center">
        {/* 3D Canvas — full bleed background */}
        <div className="absolute inset-0">
          <Canvas camera={{ position: [0, 0, 8], fov: 50 }} gl={{ antialias: true, alpha: true }}>
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </Canvas>
        </div>

        {/* Hero text — left side */}
        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative z-10 max-w-5xl mx-auto px-8 w-full"
        >
          <motion.div
            initial="hidden" animate="show" variants={stagger}
            className="max-w-lg"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 border border-white/10 rounded-full px-3 py-1 mb-8 bg-white/5 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-white/50 tracking-widest uppercase">Emotional AI Runtime</span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-6xl sm:text-8xl font-black tracking-tight leading-none mb-6">
              Characters<br />
              that <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400">feel.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-white/50 text-base leading-relaxed mb-10 max-w-sm">
              A runtime engine for AI characters with persistent emotional states, composite memory, and relationships that evolve — turn by turn, session by session.
            </motion.p>

            <motion.div variants={fadeUp} className="flex gap-3">
              <Link href="/chat" className="px-6 py-3 bg-white text-black text-sm font-bold rounded-xl hover:bg-white/90 transition-all hover:scale-105 active:scale-95">
                Start talking →
              </Link>
              <Link href="/create" className="px-6 py-3 border border-white/15 text-white/60 text-sm rounded-xl hover:border-white/30 hover:text-white transition-all">
                Build a character
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-xs text-white/20 tracking-widest uppercase">scroll</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent" />
        </motion.div>
      </section>

      {/* ── THE PROBLEM ── */}
      <section className="relative py-32 px-8 max-w-5xl mx-auto">
        <motion.div
          initial="hidden" whileInView="show" viewport={{ once: true, margin: '-100px' }} variants={stagger}
          className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
        >
          <div>
            <motion.p variants={fadeUp} className="text-xs text-white/30 tracking-widest uppercase mb-4">The Problem</motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl font-black mb-6 leading-tight">Most AI characters are stateless.</motion.h2>
            <motion.p variants={fadeUp} className="text-white/40 leading-relaxed mb-4 text-sm">
              They start fresh every conversation. They don't remember what you said last week, or last turn. They don't hold grudges. They don't grow closer to you over time.
            </motion.p>
            <motion.p variants={fadeUp} className="text-white/40 leading-relaxed text-sm">
              They're good at <em className="text-white not-italic">impersonating</em> a character. They're not capable of <em className="text-white not-italic">being</em> one.
            </motion.p>
          </div>

          {/* Live emotion card */}
          <motion.div variants={fadeUp} className="border border-white/8 rounded-2xl bg-white/3 backdrop-blur-sm p-6 hover:border-white/15 transition-colors">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs text-white/30 tracking-widest uppercase mb-1">Emotional State</p>
                <p className="text-xl font-black text-emerald-400">CURIOUS</p>
              </div>
              <span className="text-xs border border-white/10 rounded px-2 py-1 text-white/30">→ stable</span>
            </div>
            <div className="space-y-2.5">
              {EMOTIONS.map((e, i) => (
                <div key={e.label} className="flex items-center gap-3">
                  <span className="text-xs w-20 shrink-0 uppercase" style={{ color: e.color }}>{e.label}</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${barWidths[i] * 100}%`, backgroundColor: e.color, transitionDelay: `${i * 80}ms` }}
                    />
                  </div>
                  <span className="text-xs text-white/20 w-8 text-right tabular-nums">{e.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── PIPELINE ── */}
      <section className="py-32 px-8 max-w-5xl mx-auto">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-100px' }} variants={stagger}>
          <motion.p variants={fadeUp} className="text-xs text-white/30 tracking-widest uppercase mb-2">Architecture</motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl font-black mb-14">A runtime, not a prompt.</motion.h2>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[9px] top-4 bottom-4 w-px bg-gradient-to-b from-blue-500/40 via-purple-500/20 to-transparent" />

            <div className="space-y-0">
              {PIPELINE.map((step, i) => (
                <motion.div key={step.label} variants={fadeUp} className="flex gap-5 group">
                  <div className="flex flex-col items-center w-5 shrink-0 mt-1">
                    <motion.div
                      whileInView={{ scale: [0, 1.3, 1] }}
                      transition={{ delay: i * 0.1, duration: 0.4 }}
                      viewport={{ once: true }}
                      className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: step.color, backgroundColor: `${step.color}20` }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: step.color }} />
                    </motion.div>
                  </div>
                  <div className="pb-10 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white group-hover:text-white/80 transition-colors">{step.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ color: step.color, backgroundColor: `${step.color}12`, border: `1px solid ${step.color}25` }}>
                        {step.badge}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-32 px-8 max-w-5xl mx-auto">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger}>
          <motion.p variants={fadeUp} className="text-xs text-white/30 tracking-widest uppercase mb-2">Under the Hood</motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl font-black mb-14">Everything that makes a character real.</motion.h2>

          <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                whileHover={{ y: -4, borderColor: `${f.color}40` }}
                className="border border-white/8 rounded-2xl p-6 bg-white/[0.02] backdrop-blur-sm transition-colors cursor-default"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${f.color}15`, border: `1px solid ${f.color}25` }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{f.title}</h3>
                <p className="text-xs text-white/35 leading-relaxed">{f.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── RELATIONSHIP SYSTEM ── */}
      <section className="py-32 px-8 max-w-5xl mx-auto">
        <motion.div
          initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger}
          className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
        >
          <div>
            <motion.p variants={fadeUp} className="text-xs text-white/30 tracking-widest uppercase mb-4">Relationships</motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl font-black mb-4 leading-tight">They remember how you treated them.</motion.h2>
            <motion.p variants={fadeUp} className="text-white/40 text-sm leading-relaxed mb-6">
              Four axes tracked continuously. Small moves each turn. Large consequences over time. Come back after a week and the character has drifted — familiarity faded, resentment cooled, trust somewhere in between.
            </motion.p>
            <motion.div variants={fadeUp} className="space-y-2">
              {[
                { event: 'Promise kept',    effect: 'trust +0.05',       color: '#34d399' },
                { event: 'Secret shared',   effect: 'intimacy +0.06',    color: '#f472b6' },
                { event: 'Conflict opens',  effect: 'resentment +0.03',  color: '#f87171' },
                { event: 'Session gap',     effect: 'decay applied',     color: '#818cf8' },
              ].map(e => (
                <div key={e.event} className="flex items-center justify-between text-xs border border-white/6 rounded-lg px-3 py-2">
                  <span className="text-white/40">{e.event}</span>
                  <span className="font-mono font-bold" style={{ color: e.color }}>{e.effect}</span>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div variants={fadeUp} className="border border-white/8 rounded-2xl bg-white/[0.02] p-6 space-y-5">
            {[
              { label: 'TRUST',       value: 0.31, color: '#34d399', desc: 'earned through consistency' },
              { label: 'FAMILIARITY', value: 0.52, color: '#60a5fa', desc: 'grows with every exchange' },
              { label: 'RESENTMENT',  value: 0.18, color: '#f87171', desc: 'built from broken promises' },
              { label: 'INTIMACY',    value: 0.24, color: '#f472b6', desc: 'deepened by vulnerability' },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs font-bold text-white/70">{r.label}</span>
                  <span className="text-xs tabular-nums" style={{ color: r.color }}>{r.value.toFixed(2)}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${r.value * 100}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                    viewport={{ once: true }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                </div>
                <p className="text-xs text-white/20 mt-1">{r.desc}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── CTA ── */}
      <section className="py-40 px-8 text-center relative overflow-hidden">
        {/* Glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[300px] rounded-full bg-purple-600/10 blur-[100px]" />
        </div>

        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="relative z-10">
          <motion.h2 variants={fadeUp} className="text-5xl sm:text-7xl font-black mb-6 leading-none">
            Ready to meet<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">someone real?</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/40 text-sm mb-12 max-w-sm mx-auto leading-relaxed">
            Pick a character. Start talking. Watch what happens to their emotions, memory, and opinion of you — turn by turn.
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black text-sm font-bold rounded-xl hover:bg-white/90 transition-all hover:scale-105 active:scale-95"
            >
              Start a conversation
              <span>→</span>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 px-8 py-8 flex items-center justify-between">
        <span className="text-xs text-white/20 tracking-widest font-black">CHARACTER<span className="text-white/10">OS</span></span>
        <span className="text-xs text-white/15">Built different.</span>
      </footer>

    </div>
  );
}
