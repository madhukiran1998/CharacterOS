'use client';

import { use, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ─── types ───────────────────────────────────────────────────
interface Message { role: 'user' | 'character'; content: string; }

interface PlutchikState {
  joy: number; trust: number; fear: number; surprise: number;
  sadness: number; disgust: number; anger: number; anticipation: number;
}
interface PADState { pleasure: number; arousal: number; dominance: number; }
interface EmotionBefore { plutchik: PlutchikState; desire_intensity: number; derived_state: string; pad: PADState; }
interface EmotionAfter { plutchik: PlutchikState; desire_intensity: number; desire_target: string; derived_state: string; dominant_primary: string; momentum: string; pad: PADState; }
interface AppraisalData { relevance: number; valence: number; coping: number; norm_violation: number; emotional_delta: PlutchikState & { desire_intensity: number }; appraisal_summary: string; }
interface GoalState { desire: string; desire_strength: string; objective: string; reasoning_depth: string; force_deep_triggered: boolean; }
interface ReasoningData { user_read: string; emotional_state_summary: string; intended_move: string; forbidden_moves: string[]; }
interface RelationshipState { trust: number; familiarity: number; resentment: number; intimacy: number; trust_source: string; }
interface SessionInfo { was_new_session: boolean; hours_since_last: number; session_decay_applied: number; }
interface NarrativeThread { id: string; type: string; content: string; emotional_weight: number; }
interface NarrativeEvent { type: string; content: string; emotional_weight: number; }
interface RelationshipDelta { trust: number; resentment: number; intimacy: number; reason: string; }
interface NarrativeData { new_threads: NarrativeEvent[]; resolved_threads: string[]; relationship_deltas: RelationshipDelta[]; }

interface TurnDebug {
  appraisal: AppraisalData; emotion_before: EmotionBefore; emotion_after: EmotionAfter;
  goal_state: GoalState; reasoning: ReasoningData; relationship_state: RelationshipState;
  session: SessionInfo; open_threads: NarrativeThread[]; narrative: NarrativeData;
}

interface PipelineStep {
  stepNum: number;
  key: string;
  label: string;
  desc: string;
  badge: string;
  badgeColor: string;
  status: 'pending' | 'active' | 'done';
  startedAt: number | null;
  duration: number | null;
  details: { label: string; value: string }[];
}

// ─── constants ────────────────────────────────────────────────
const EMOTIONS: { key: keyof PlutchikState; label: string; hex: string }[] = [
  { key: 'joy',          label: 'JOY',   hex: '#facc15' },
  { key: 'trust',        label: 'TRUST', hex: '#34d399' },
  { key: 'fear',         label: 'FEAR',  hex: '#a78bfa' },
  { key: 'surprise',     label: 'SURP',  hex: '#fb923c' },
  { key: 'sadness',      label: 'SAD',   hex: '#60a5fa' },
  { key: 'disgust',      label: 'DISG',  hex: '#84cc16' },
  { key: 'anger',        label: 'ANG',   hex: '#f87171' },
  { key: 'anticipation', label: 'ANT',   hex: '#22d3ee' },
];

const STEP_DEFS: Omit<PipelineStep, 'status' | 'startedAt' | 'duration' | 'details'>[] = [
  { stepNum: 1, key: 'context',  label: 'Load Context',       desc: 'Embeds your message → vector search across all memories, scored by similarity (45%) + importance (30%) + recency (25%). Relationship state + emotion state + baselines fetched in parallel.', badge: 'PARALLEL', badgeColor: '#60a5fa' },
  { stepNum: 2, key: 'appraise', label: 'Appraise + Desire',  desc: 'One LLM call — evaluates emotional impact (relevance, valence, coping, norm violations, 8-emotion delta) and decides what the character wants right now.', badge: 'LLM', badgeColor: '#c084fc' },
  { stepNum: 3, key: 'emotions', label: 'Emotion Math',       desc: 'Pure code — applies appraisal deltas + natural decay + baseline pull. Computes PAD (mood/energy/control), picks reasoning depth (shallow/moderate/deep), builds reasoning plan.', badge: 'CODE', badgeColor: '#34d399' },
  { stepNum: 4, key: 'respond',  label: 'Generate Response',  desc: 'LLM streams the reply token by token. Deep/moderate turns include a private reasoning block so the character thinks through its objective before writing.', badge: 'STREAM', badgeColor: '#fb923c' },
  { stepNum: 5, key: 'save',     label: 'Write Back',         desc: '3 parallel calls: importance-score LLM + embed user msg + embed character reply. Then: insert episodes, thread detection LLM (promise/conflict/secret/question), relationship consequences from resolved threads.', badge: '2× LLM', badgeColor: '#f59e0b' },
];

function freshPipeline(): PipelineStep[] {
  return STEP_DEFS.map(d => ({ ...d, status: 'pending', startedAt: null, duration: null, details: [] }));
}

// ─── main page ────────────────────────────────────────────────
export default function ChatPage({ params }: { params: Promise<{ character_id: string }> }) {
  const { character_id } = use(params);
  const router = useRouter();

  const [userId, setUserId]       = useState('');
  const [userIdSet, setUserIdSet] = useState(false);
  const [characterName, setCharacterName] = useState<string>('');
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState<'mind' | 'pipeline'>('mind');
  const [turnHistory, setTurnHistory]       = useState<TurnDebug[]>([]);
  const [currentTurn, setCurrentTurn]       = useState<TurnDebug | null>(null);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number>(-1);
  const [pipeline, setPipeline]   = useState<PipelineStep[]>(freshPipeline());
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(340);
  const isDragging = useRef(false);
  const dragStart  = useRef(0);
  const widthStart = useRef(0);
  const bottomRef  = useRef<HTMLDivElement>(null);

  function onDividerMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    dragStart.current  = e.clientX;
    widthStart.current = leftWidth;
    e.preventDefault();
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const delta = e.clientX - dragStart.current;
      setLeftWidth(Math.max(260, Math.min(window.innerWidth - 300, widthStart.current + delta)));
    }
    function onMouseUp() { isDragging.current = false; }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  useEffect(() => {
    fetch(`http://localhost:3001/api/characters/${character_id}`)
      .then(r => r.json())
      .then(d => d.identity?.name && setCharacterName(d.identity.name))
      .catch(() => {});
  }, [character_id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streaming]);

  function markStepActive(stepNum: number) {
    setPipeline(prev => prev.map(s => {
      if (s.status === 'active') {
        return { ...s, status: 'done', duration: s.startedAt ? Date.now() - s.startedAt : null };
      }
      if (s.stepNum === stepNum) return { ...s, status: 'active', startedAt: Date.now() };
      return s;
    }));
  }

  function finalizePipeline(turn: TurnDebug) {
    setPipeline(prev => prev.map(s => {
      const base = s.status === 'active'
        ? { ...s, status: 'done' as const, duration: s.startedAt ? Date.now() - s.startedAt : null }
        : s;

      const d = (...pairs: [string, string][]) => pairs.map(([label, value]) => ({ label, value }));

      switch (base.key) {
        case 'context': return { ...base, details: d(
          ['emotion state', turn.emotion_before.derived_state],
          ['trust', `${turn.relationship_state.trust.toFixed(2)} (${turn.relationship_state.trust_source})`],
          ['familiarity', turn.relationship_state.familiarity.toFixed(2)],
          ['session', turn.session.was_new_session ? `new · ${turn.session.hours_since_last.toFixed(1)}h gap` : 'same session'],
        )};
        case 'appraise': return { ...base, details: d(
          ['summary', turn.appraisal.appraisal_summary],
          ['impact', `${Math.round(turn.appraisal.relevance * 100)}%`],
          ['felt', `${turn.appraisal.valence >= 0 ? '+' : ''}${Math.round(turn.appraisal.valence * 100)}%`],
          ['coping', `${Math.round(turn.appraisal.coping * 100)}%`],
          ['desire', `${turn.goal_state.desire} (${turn.goal_state.desire_strength})`],
        )};
        case 'emotions': return { ...base, details: d(
          ['state', `${turn.emotion_before.derived_state} → ${turn.emotion_after.derived_state}`],
          ['dominant', turn.emotion_after.dominant_primary],
          ['momentum', turn.emotion_after.momentum],
          ['depth', turn.goal_state.reasoning_depth + (turn.goal_state.force_deep_triggered ? ' (forced deep)' : '')],
          ['pad', `P ${turn.emotion_after.pad.pleasure >= 0 ? '+' : ''}${turn.emotion_after.pad.pleasure.toFixed(2)} A ${turn.emotion_after.pad.arousal.toFixed(2)} D ${turn.emotion_after.pad.dominance.toFixed(2)}`],
        )};
        case 'respond': return { ...base, details: d(
          ['depth', turn.goal_state.reasoning_depth],
          ['objective', turn.goal_state.objective],
          ['user read', turn.reasoning.user_read],
          ['intended move', turn.reasoning.intended_move],
        )};
        case 'save': return { ...base, details: d(
          ['new threads', turn.narrative.new_threads.length > 0 ? turn.narrative.new_threads.map(t => `[${t.type}]`).join(' ') : 'none'],
          ['resolved', `${turn.narrative.resolved_threads.length}`],
          ['rel. deltas', turn.narrative.relationship_deltas.length > 0 ? turn.narrative.relationship_deltas.map(d => d.reason.slice(0, 30)).join('; ') : 'none'],
          ['trust after', `${turn.relationship_state.trust.toFixed(3)} (${turn.relationship_state.trust_source})`],
        )};
        default: return base;
      }
    }));
  }

  async function sendMessage() {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(p => [...p, { role: 'user', content: userMsg }]);
    setStreaming(true);
    setPipeline(freshPipeline());
    setActiveTab('pipeline');
    setMessages(p => [...p, { role: 'character', content: '' }]);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_id, user_id: userId, message: userMsg }),
      });
      if (!response.body) throw new Error('No stream body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'step') {
              markStepActive(event.step);
            } else if (event.type === 'token') {
              setMessages(p => { const u = [...p]; u[u.length - 1] = { role: 'character', content: u[u.length - 1].content + event.token }; return u; });
            } else if (event.type === 'done') {
              const turn: TurnDebug = {
                appraisal: event.appraisal, emotion_before: event.emotion_before,
                emotion_after: event.emotion_after, goal_state: event.goal_state,
                reasoning: event.reasoning, relationship_state: event.relationship_state,
                session: event.session, open_threads: event.open_threads,
                narrative: event.narrative || { new_threads: [], resolved_threads: [], relationship_deltas: [] },
              };
              setCurrentTurn(turn);
              setTurnHistory(p => [...p, turn]);
              setSelectedTurnIndex(-1);
              finalizePipeline(turn);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setMessages(p => { const u = [...p]; u[u.length - 1] = { role: 'character', content: 'Something has distracted me. Speak again.' }; return u; });
      console.error('Stream error:', err);
    } finally { setStreaming(false); }
  }

  const displayTurn = selectedTurnIndex >= 0 ? turnHistory[selectedTurnIndex] : currentTurn;

  if (!userIdSet) {
    return (
      <main className="max-w-lg mx-auto px-4 py-24 flex flex-col gap-4 bg-black min-h-screen">
        <h1 className="text-2xl font-bold text-white font-mono tracking-tight">CharacterOS</h1>
        <p className="text-gray-500 text-xs font-mono">CHARACTER / <span className="text-gray-300">{character_id}</span></p>
        <p className="text-gray-500 text-sm mt-6">Enter a user ID:</p>
        <input className="bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-gray-500" placeholder="user-001" value={userId} onChange={e => setUserId(e.target.value)} onKeyDown={e => e.key === 'Enter' && userId.trim() && setUserIdSet(true)} />
        <button onClick={() => setUserIdSet(true)} disabled={!userId.trim()} className="px-6 py-3 bg-white text-black rounded-lg font-mono text-sm disabled:opacity-30 hover:bg-gray-100 transition-colors">ENTER</button>
      </main>
    );
  }

  return (
    <div className="flex h-screen bg-black overflow-hidden text-white">

      {/* ── LEFT: INSPECTOR PANEL ────────────────────────────── */}
      {inspectorOpen && <aside style={{ width: leftWidth }} className="shrink-0 border-r border-gray-800/50 flex flex-col bg-gray-950/40">

        {/* Tab bar */}
        <div className="flex border-b border-gray-800/50 shrink-0">
          {(['mind', 'pipeline'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-mono font-bold tracking-widest uppercase transition-colors relative ${activeTab === tab ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`}>
              {tab}
              {tab === 'pipeline' && streaming && (
                <span className="absolute top-2 right-4 w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              )}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-px bg-white" />}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── MIND TAB ── */}
          {activeTab === 'mind' && (
            <div className="p-4">
              {displayTurn ? (
                <div className="space-y-6">

                  {/* Turn selector */}
                  {turnHistory.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-700 font-mono">turn</span>
                      <select className="flex-1 bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-400 font-mono" value={selectedTurnIndex} onChange={e => setSelectedTurnIndex(Number(e.target.value))}>
                        <option value={-1}>latest ({turnHistory.length})</option>
                        {turnHistory.map((_, i) => <option key={i} value={i}>{i + 1} / {turnHistory.length}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Emotional state */}
                  <div>
                    <Micro>EMOTIONAL STATE</Micro>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className={`text-2xl font-black font-mono uppercase tracking-tight ${momentumColor(displayTurn.emotion_after.momentum)}`}>
                        {displayTurn.emotion_after.derived_state}
                      </p>
                      <MomentumPill momentum={displayTurn.emotion_after.momentum} />
                    </div>
                    <p className="text-xs text-gray-600 font-mono">dominant: {displayTurn.emotion_after.dominant_primary}</p>
                  </div>

                  {/* Emotions — always all 8 visible */}
                  <div>
                    <Micro>EMOTIONS</Micro>
                    <EmotionBars before={displayTurn.emotion_before.plutchik} after={displayTurn.emotion_after.plutchik} />
                  </div>

                  {/* Mood / Energy / Control */}
                  <div>
                    <Micro>MOOD · ENERGY · CONTROL</Micro>
                    <div className="mt-2 space-y-2">
                      <PADBar label="MOOD" desc={displayTurn.emotion_after.pad.pleasure >= 0 ? 'feeling good' : 'feeling bad'} value={(displayTurn.emotion_after.pad.pleasure + 1) / 2} color="#34d399" display={`${displayTurn.emotion_after.pad.pleasure >= 0 ? '+' : ''}${Math.round(displayTurn.emotion_after.pad.pleasure * 100)}%`} />
                      <PADBar label="ENERGY" desc="activated or calm" value={displayTurn.emotion_after.pad.arousal} color="#fb923c" display={`${Math.round(displayTurn.emotion_after.pad.arousal * 100)}%`} />
                      <PADBar label="CONTROL" desc="agency and dominance" value={displayTurn.emotion_after.pad.dominance} color="#818cf8" display={`${Math.round(displayTurn.emotion_after.pad.dominance * 100)}%`} />
                    </div>
                  </div>

                  {/* Desire */}
                  <div>
                    <Micro>DESIRE</Micro>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-900 rounded-full overflow-hidden">
                        <div className="h-full bg-pink-500 rounded-full transition-all duration-700" style={{ width: `${displayTurn.emotion_after.desire_intensity * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-pink-400 tabular-nums w-8 text-right">{displayTurn.emotion_after.desire_intensity.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{displayTurn.goal_state.desire}</p>
                    <p className="text-xs text-gray-600 font-mono">strength: {displayTurn.goal_state.desire_strength}</p>
                  </div>

                  <div className="border-t border-gray-800/50" />

                  {/* How it landed */}
                  <div>
                    <Micro>HOW IT LANDED</Micro>
                    <p className="mt-1.5 text-xs text-gray-400 leading-snug italic mb-3">"{displayTurn.appraisal.appraisal_summary}"</p>
                    <div className="space-y-2.5">
                      <AnnotatedBar label="MATTERS TO THEM" desc="how much this message affects the character" value={displayTurn.appraisal.relevance} color="#60a5fa" display={`${Math.round(displayTurn.appraisal.relevance * 100)}%`} />
                      <AnnotatedBar label="FELT GOOD OR BAD" desc={displayTurn.appraisal.valence >= 0 ? 'felt positive' : 'felt negative'} value={(displayTurn.appraisal.valence + 1) / 2} color={displayTurn.appraisal.valence >= 0 ? '#34d399' : '#f87171'} display={`${displayTurn.appraisal.valence >= 0 ? '+' : ''}${Math.round(displayTurn.appraisal.valence * 100)}%`} />
                      <AnnotatedBar label="CAN HANDLE IT" desc="how composed the character is — low means struggling" value={displayTurn.appraisal.coping} color="#a78bfa" display={`${Math.round(displayTurn.appraisal.coping * 100)}%`} />
                      <AnnotatedBar label="LINE CROSSED" desc="did this violate the character's values or rules" value={displayTurn.appraisal.norm_violation} color="#f87171" display={displayTurn.appraisal.norm_violation > 0.35 ? '⚠ yes' : 'no'} highlight={displayTurn.appraisal.norm_violation > 0.35} />
                    </div>
                  </div>

                  <div className="border-t border-gray-800/50" />

                  {/* Relationship */}
                  <div>
                    <Micro>RELATIONSHIP</Micro>
                    <div className="mt-2 space-y-2">
                      <AnnotatedBar label="TRUST" desc="how much the character trusts this user" value={displayTurn.relationship_state.trust} color="#34d399" display={displayTurn.relationship_state.trust.toFixed(2)} />
                      <AnnotatedBar label="FAMILIARITY" desc="how well the character knows this user" value={displayTurn.relationship_state.familiarity} color="#60a5fa" display={displayTurn.relationship_state.familiarity.toFixed(2)} />
                      <AnnotatedBar label="RESENTMENT" desc="built-up negative feeling from past exchanges" value={displayTurn.relationship_state.resentment} color="#f87171" display={displayTurn.relationship_state.resentment.toFixed(2)} />
                      <AnnotatedBar label="INTIMACY" desc="emotional closeness and vulnerability shared" value={displayTurn.relationship_state.intimacy} color="#f472b6" display={displayTurn.relationship_state.intimacy.toFixed(2)} />
                    </div>
                    <div className="mt-1.5 flex gap-1.5 items-center">
                      <span className="text-xs text-gray-700 font-mono">source:</span>
                      <span className={`text-xs font-mono ${displayTurn.relationship_state.trust_source === 'earned' ? 'text-emerald-400' : displayTurn.relationship_state.trust_source === 'damaged' ? 'text-red-400' : 'text-gray-600'}`}>{displayTurn.relationship_state.trust_source}</span>
                    </div>
                    {displayTurn.narrative.relationship_deltas.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {displayTurn.narrative.relationship_deltas.map((d, i) => (
                          <div key={i} className="flex gap-2 text-xs font-mono flex-wrap">
                            {d.trust !== 0 && <span className={d.trust > 0 ? 'text-emerald-400' : 'text-red-400'}>trust {d.trust > 0 ? '+' : ''}{d.trust.toFixed(3)}</span>}
                            {d.resentment !== 0 && <span className={d.resentment > 0 ? 'text-red-400' : 'text-emerald-400'}>resentment {d.resentment > 0 ? '+' : ''}{d.resentment.toFixed(3)}</span>}
                            {d.intimacy !== 0 && <span className="text-pink-400">intimacy +{d.intimacy.toFixed(3)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Threads */}
                  <div>
                    <Micro>OPEN THREADS {displayTurn.open_threads.length > 0 && <span className="text-gray-700 normal-case">({displayTurn.open_threads.length})</span>}</Micro>
                    {displayTurn.open_threads.length === 0
                      ? <p className="mt-1 text-xs text-gray-700 italic">none</p>
                      : <div className="mt-1.5 space-y-1.5">{displayTurn.open_threads.map(t => <ThreadCard key={t.id} thread={t} />)}</div>
                    }
                    {displayTurn.narrative.new_threads.length > 0 && (
                      <div className="mt-2">
                        <Micro>OPENED THIS TURN</Micro>
                        <div className="mt-1 space-y-1.5">{displayTurn.narrative.new_threads.map((t, i) => <ThreadCard key={i} thread={t} />)}</div>
                      </div>
                    )}
                  </div>

                  {/* Session */}
                  <div>
                    <Micro>SESSION</Micro>
                    <p className="mt-1 text-xs text-gray-600 font-mono">
                      {displayTurn.session.was_new_session ? `new · ${displayTurn.session.hours_since_last.toFixed(1)}h gap · decay ${displayTurn.session.session_decay_applied.toFixed(2)}` : 'same session'}
                    </p>
                  </div>

                </div>
              ) : (
                <p className="text-xs text-gray-800 font-mono text-center mt-20">send a message to begin</p>
              )}
            </div>
          )}

          {/* ── PIPELINE TAB ── */}
          {activeTab === 'pipeline' && (
            <div className="p-4">
              <PipelineFlow steps={pipeline} />
            </div>
          )}

        </div>
      </aside>}

      {/* ── DRAG HANDLE (only when inspector open) ───────────── */}
      {inspectorOpen && (
        <div
          onMouseDown={onDividerMouseDown}
          className="w-1 shrink-0 cursor-col-resize hover:bg-gray-600 active:bg-gray-500 transition-colors"
          style={{ background: 'transparent' }}
        />
      )}

      {/* ── RIGHT: CHAT ──────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-800/50 shrink-0" style={{ fontFamily: "'Geist Mono', monospace" }}>
          <button onClick={() => router.push('/characters')} className="text-gray-600 hover:text-gray-300 text-sm">←</button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-200 truncate" style={{ fontFamily: "'Geist', sans-serif" }}>
              {characterName || character_id.slice(0, 12) + '…'}
            </p>
            <p className="text-xs text-gray-600 font-mono">
              {userId && <>user: <span className="text-gray-500">{userId}</span> · </>}
              turn {turnHistory.length}
              {streaming && <span className="text-orange-400 animate-pulse"> · thinking…</span>}
            </p>
          </div>
          {displayTurn && <DepthBadge depth={displayTurn.goal_state.reasoning_depth} forced={displayTurn.goal_state.force_deep_triggered} />}
          <button
            onClick={() => setInspectorOpen(v => !v)}
            className="text-xs font-mono px-2 py-1 rounded border transition-colors"
            style={{
              borderColor: inspectorOpen ? 'rgba(143,214,168,0.3)' : '#1f2937',
              color: inspectorOpen ? '#8fd6a8' : '#4b5563',
              background: inspectorOpen ? 'rgba(143,214,168,0.06)' : 'transparent',
            }}
          >
            {inspectorOpen ? 'inspector ✕' : 'inspector'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 && <p className="text-gray-700 text-sm text-center mt-20 font-mono">say something.</p>}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2.5 text-sm rounded-2xl ${msg.role === 'user' ? 'bg-white text-black rounded-br-sm' : 'bg-gray-900 text-gray-100 rounded-bl-sm border border-gray-800/50'}`}>
                {msg.content || <span className="animate-pulse text-gray-600">▍</span>}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="px-5 py-4 border-t border-gray-800/50 shrink-0">
          <div className="flex gap-2">
            <input className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-gray-600 placeholder-gray-700" placeholder="type a message…" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} disabled={streaming} />
            <button onClick={sendMessage} disabled={streaming || !input.trim()} className="px-4 py-2.5 bg-white text-black rounded-xl text-sm font-mono disabled:opacity-30 hover:bg-gray-100 transition-colors">
              {streaming ? '...' : 'SEND'}
            </button>
          </div>
        </div>
      </main>

    </div>
  );
}

// ─── pipeline flow component ──────────────────────────────────

function PipelineFlow({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={step.key} className="flex gap-3">
          {/* Left spine */}
          <div className="flex flex-col items-center w-6 shrink-0">
            {/* Node dot */}
            <div className={`w-3 h-3 rounded-full border-2 mt-3 shrink-0 transition-all duration-300 ${
              step.status === 'done'    ? 'bg-emerald-400 border-emerald-400' :
              step.status === 'active' ? 'bg-orange-400 border-orange-400 animate-pulse' :
              'bg-transparent border-gray-700'
            }`} />
            {/* Connecting line */}
            {i < steps.length - 1 && (
              <div className={`w-px flex-1 min-h-4 mt-1 transition-colors duration-500 ${step.status === 'done' ? 'bg-emerald-900/60' : 'bg-gray-800'}`} />
            )}
          </div>

          {/* Step content */}
          <div className={`pb-5 flex-1 transition-opacity duration-300 ${step.status === 'pending' ? 'opacity-30' : 'opacity-100'}`}>
            {/* Header row */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm font-bold font-mono text-white">{step.label}</span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ color: step.badgeColor, backgroundColor: `${step.badgeColor}18`, border: `1px solid ${step.badgeColor}30` }}>
                {step.badge}
              </span>
              {step.status === 'done' && step.duration !== null && (
                <span className="ml-auto text-xs font-mono text-gray-600 tabular-nums">
                  {step.duration >= 1000 ? `${(step.duration / 1000).toFixed(1)}s` : `${step.duration}ms`}
                </span>
              )}
              {step.status === 'active' && (
                <span className="ml-auto text-xs font-mono text-orange-400 animate-pulse">running…</span>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-gray-600 mt-0.5 leading-snug">{step.desc}</p>

            {/* Details (appear when done) */}
            {step.status === 'done' && step.details.length > 0 && (
              <div className="mt-2 rounded-lg border border-gray-800/60 bg-gray-900/40 p-2 space-y-1">
                {step.details.map(({ label, value }) => (
                  <div key={label} className="flex items-baseline gap-2">
                    <span className="text-xs text-gray-600 font-mono w-24 shrink-0">{label}</span>
                    <span className="text-xs text-gray-300 font-mono truncate">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── visualization components ─────────────────────────────────

function RadarChart({ before, after }: { before: PlutchikState; after: PlutchikState }) {
  const SIZE = 180; const cx = SIZE / 2; const cy = SIZE / 2; const R = 68;
  const n = EMOTIONS.length;
  function pt(i: number, v: number) { const a = (i / n) * 2 * Math.PI - Math.PI / 2; return { x: cx + R * v * Math.cos(a), y: cy + R * v * Math.sin(a) }; }
  function lbl(i: number) { const a = (i / n) * 2 * Math.PI - Math.PI / 2; return { x: cx + (R + 18) * Math.cos(a), y: cy + (R + 18) * Math.sin(a) }; }
  function toPoints(s: PlutchikState) { return EMOTIONS.map((e, i) => { const p = pt(i, s[e.key]); return `${p.x},${p.y}`; }).join(' '); }
  return (
    <svg width={SIZE} height={SIZE} className="overflow-visible">
      {[0.25, 0.5, 0.75, 1].map(l => <polygon key={l} points={EMOTIONS.map((_, i) => { const p = pt(i, l); return `${p.x},${p.y}`; }).join(' ')} fill="none" stroke="#1f2937" strokeWidth={l === 1 ? 1 : 0.5} />)}
      {EMOTIONS.map((_, i) => { const p = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#1f2937" strokeWidth={0.5} />; })}
      <polygon points={toPoints(before)} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      <polygon points={toPoints(after)} fill="rgba(99,102,241,0.12)" stroke="#818cf8" strokeWidth={1.5} strokeLinejoin="round" />
      {EMOTIONS.map((e, i) => { const p = pt(i, after[e.key]); return <circle key={e.key} cx={p.x} cy={p.y} r={3.5} fill={e.hex} />; })}
      {EMOTIONS.map((e, i) => { const l = lbl(i); return <text key={e.key} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fill={e.hex} fontSize={7.5} fontFamily="monospace" opacity={0.7}>{e.label}</text>; })}
      <circle cx={cx} cy={cy} r={2} fill="#4b5563" />
    </svg>
  );
}

function EmotionBars({ before, after }: { before: PlutchikState; after: PlutchikState }) {
  return (
    <div className="mt-2 space-y-2">
      {EMOTIONS.map(e => {
        const val = after[e.key];
        const delta = after[e.key] - before[e.key];
        const hasDelta = Math.abs(delta) > 0.005;
        return (
          <div key={e.key}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono w-12 shrink-0" style={{ color: e.hex }}>{e.label}</span>
              <div className="flex-1 h-2 bg-gray-900 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${val * 100}%`, backgroundColor: e.hex }}
                />
              </div>
              <span className="text-xs font-mono tabular-nums text-gray-500 w-8 text-right shrink-0">{val.toFixed(2)}</span>
              <span className={`text-xs font-mono tabular-nums w-10 text-right shrink-0 font-bold transition-colors ${hasDelta ? (delta > 0 ? 'text-emerald-400' : 'text-red-400') : 'text-gray-800'}`}>
                {hasDelta ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}` : '—'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PADBar({ label, desc, value, color, display }: { label: string; desc: string; value: number; color: string; display: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 shrink-0">
        <p className="text-xs font-mono font-bold text-gray-300">{label}</p>
        <p className="text-xs text-gray-700 leading-none">{desc}</p>
      </div>
      <div className="flex-1 h-2 bg-gray-900 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono tabular-nums w-10 text-right shrink-0" style={{ color }}>{display}</span>
    </div>
  );
}

function AnnotatedBar({ label, desc, value, color, display, highlight }: {
  label: string; desc: string; value: number; color: string; display: string; highlight?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-0.5">
        <span className={`text-xs font-mono font-bold ${highlight ? 'text-red-400' : 'text-gray-300'}`}>{label}</span>
        <span className="text-xs font-mono tabular-nums" style={{ color }}>{display}</span>
      </div>
      <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden mb-0.5">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }} />
      </div>
      <p className="text-xs text-gray-700">{desc}</p>
    </div>
  );
}

function ThreadCard({ thread }: { thread: { type: string; content: string; emotional_weight: number } }) {
  const cfg: Record<string, { color: string; bg: string; short: string }> = {
    promise:  { color: '#facc15', bg: 'rgba(250,204,21,0.06)',  short: 'PRO' },
    conflict: { color: '#f87171', bg: 'rgba(248,113,113,0.06)', short: 'CON' },
    secret:   { color: '#c084fc', bg: 'rgba(192,132,252,0.06)', short: 'SEC' },
    question: { color: '#60a5fa', bg: 'rgba(96,165,250,0.06)',  short: 'QUE' },
  };
  const c = cfg[thread.type] ?? { color: '#6b7280', bg: 'rgba(107,114,128,0.06)', short: '???' };
  return (
    <div className="rounded-lg p-2 border" style={{ borderColor: `${c.color}22`, backgroundColor: c.bg }}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-mono font-bold" style={{ color: c.color }}>[{c.short}]</span>
        <div className="flex-1 h-px" style={{ backgroundColor: `${c.color}33` }} />
        <span className="text-xs font-mono text-gray-700">{thread.emotional_weight.toFixed(1)}</span>
      </div>
      <p className="text-xs text-gray-400 leading-snug">{thread.content}</p>
    </div>
  );
}

// ─── primitives ───────────────────────────────────────────────
function Micro({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-mono tracking-widest text-gray-600 uppercase">{children}</p>;
}
function MomentumPill({ momentum }: { momentum: string }) {
  const cfg = momentum === 'rising' ? { label: '↑ rising', cls: 'text-emerald-400 border-emerald-900 bg-emerald-950/50' }
    : momentum === 'falling' ? { label: '↓ falling', cls: 'text-red-400 border-red-900 bg-red-950/50' }
    : { label: '→ stable', cls: 'text-gray-600 border-gray-800 bg-gray-900/50' };
  return <span className={`text-xs font-mono px-2 py-0.5 rounded border ${cfg.cls}`}>{cfg.label}</span>;
}
function momentumColor(m: string) { return m === 'rising' ? 'text-emerald-400' : m === 'falling' ? 'text-red-400' : 'text-gray-200'; }
function DepthBadge({ depth, forced }: { depth: string; forced: boolean }) {
  const cls = depth === 'deep' ? 'bg-red-950/60 text-red-400 border-red-900/50' : depth === 'moderate' ? 'bg-yellow-950/60 text-yellow-400 border-yellow-900/50' : 'bg-gray-900/60 text-gray-600 border-gray-800';
  return <span className={`ml-auto px-2 py-0.5 rounded text-xs font-mono border ${cls}`}>{depth.toUpperCase()}{forced ? ' !' : ''}</span>;
}
