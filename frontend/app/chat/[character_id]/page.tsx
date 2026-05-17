'use client';

import { use, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
  role: 'user' | 'character';
  content: string;
}

interface PlutchikState {
  joy: number;
  trust: number;
  fear: number;
  surprise: number;
  sadness: number;
  disgust: number;
  anger: number;
  anticipation: number;
}

interface PADState {
  pleasure: number;
  arousal: number;
  dominance: number;
}

interface EmotionBefore {
  plutchik: PlutchikState;
  desire_intensity: number;
  derived_state: string;
  pad: PADState;
}

interface EmotionAfter {
  plutchik: PlutchikState;
  desire_intensity: number;
  desire_target: string;
  derived_state: string;
  dominant_primary: string;
  momentum: string;
  pad: PADState;
}

interface AppraisalData {
  relevance: number;
  valence: number;
  coping: number;
  norm_violation: number;
  emotional_delta: PlutchikState & { desire_intensity: number };
  appraisal_summary: string;
}

interface GoalState {
  desire: string;
  desire_strength: string;
  objective: string;
  reasoning_depth: string;
  force_deep_triggered: boolean;
}

interface ReasoningData {
  user_read: string;
  emotional_state_summary: string;
  intended_move: string;
  forbidden_moves: string[];
}

interface RelationshipState {
  trust: number;
  familiarity: number;
  resentment: number;
  intimacy: number;
  trust_source: string;
}

interface SessionInfo {
  was_new_session: boolean;
  hours_since_last: number;
  session_decay_applied: number;
}

interface NarrativeThread {
  id: string;
  type: string;
  content: string;
  emotional_weight: number;
}

interface NarrativeEvent {
  type: string;
  content: string;
  emotional_weight: number;
}

interface RelationshipDelta {
  trust: number;
  resentment: number;
  intimacy: number;
  reason: string;
}

interface NarrativeData {
  new_threads: NarrativeEvent[];
  resolved_threads: string[];
  relationship_deltas: RelationshipDelta[];
}

interface TurnDebug {
  appraisal: AppraisalData;
  emotion_before: EmotionBefore;
  emotion_after: EmotionAfter;
  goal_state: GoalState;
  reasoning: ReasoningData;
  relationship_state: RelationshipState;
  session: SessionInfo;
  open_threads: NarrativeThread[];
  narrative: NarrativeData;
}

export default function ChatPage({ params }: { params: Promise<{ character_id: string }> }) {
  const { character_id } = use(params);
  const router = useRouter();

  const [userId, setUserId] = useState('');
  const [userIdSet, setUserIdSet] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [debugOpen, setDebugOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'emotions' | 'appraisal' | 'reasoning' | 'narrative' | 'state'>('emotions');
  const [turnHistory, setTurnHistory] = useState<TurnDebug[]>([]);
  const [currentTurn, setCurrentTurn] = useState<TurnDebug | null>(null);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number>(-1);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  async function sendMessage() {
    if (!input.trim() || streaming) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setStreaming(true);
    setCurrentStep('Starting...');
    setMessages((prev) => [...prev, { role: 'character', content: '' }]);
    setCurrentTurn(null);

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
            if (event.type === 'step' || event.type === 'substep') {
              setCurrentStep(event.label);
            } else if (event.type === 'token') {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'character',
                  content: updated[updated.length - 1].content + event.token,
                };
                return updated;
              });
            } else if (event.type === 'done') {
              setCurrentStep('');
              const turn: TurnDebug = {
                appraisal: event.appraisal,
                emotion_before: event.emotion_before,
                emotion_after: event.emotion_after,
                goal_state: event.goal_state,
                reasoning: event.reasoning,
                relationship_state: event.relationship_state,
                session: event.session,
                open_threads: event.open_threads,
                narrative: event.narrative || {
                  new_threads: [],
                  resolved_threads: [],
                  relationship_deltas: [],
                },
              };
              setCurrentTurn(turn);
              setTurnHistory((prev) => [...prev, turn]);
              setSelectedTurnIndex(-1);
            }
          } catch {
            // skip malformed event
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'character',
          content: 'Something has distracted me. Speak again.',
        };
        return updated;
      });
      console.error('Stream error:', err);
    } finally {
      setStreaming(false);
      setCurrentStep('');
    }
  }

  const displayTurn = selectedTurnIndex >= 0 ? turnHistory[selectedTurnIndex] : currentTurn;

  if (!userIdSet) {
    return (
      <main className="max-w-lg mx-auto px-4 py-24 flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-white">CharacterOS Chat</h1>
        <p className="text-gray-400 text-sm">Character ID: <span className="font-mono text-gray-300">{character_id}</span></p>
        <p className="text-gray-400 text-sm mt-4">Enter a user ID to start:</p>
        <input
          className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:ring-2 focus:ring-white"
          placeholder="e.g. user-001"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && userId.trim() && setUserIdSet(true)}
        />
        <button
          onClick={() => setUserIdSet(true)}
          disabled={!userId.trim()}
          className="px-6 py-3 bg-white text-black rounded-lg font-medium disabled:opacity-40 hover:bg-gray-200 transition-colors"
        >
          Start Conversation
        </button>
      </main>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col px-4 py-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/chat')} className="text-gray-600 hover:text-white transition-colors text-lg">←</button>
            <div>
              <p className="text-xs text-gray-500 font-mono">{character_id.slice(0, 8)}...</p>
              <p className="text-xs text-gray-500">user: <span className="text-gray-300">{userId}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {displayTurn && (
              <div className="text-xs text-gray-500 text-right">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  displayTurn.goal_state.reasoning_depth === 'deep' ? 'bg-red-900 text-red-300' :
                  displayTurn.goal_state.reasoning_depth === 'moderate' ? 'bg-yellow-900 text-yellow-300' :
                  'bg-gray-800 text-gray-400'
                }`}>
                  {displayTurn.goal_state.reasoning_depth}
                </span>
                <div className="flex gap-2 mt-1">
                  <EmotionBar label="V" value={(displayTurn.emotion_after.pad.pleasure + 1) / 2} color="blue" />
                  <EmotionBar label="A" value={displayTurn.emotion_after.pad.arousal} color="orange" />
                  <EmotionBar label="D" value={displayTurn.emotion_after.pad.dominance} color="pink" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.length === 0 && (
            <p className="text-gray-600 text-sm text-center mt-16">Say something to begin.</p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-white text-black rounded-br-sm'
                  : 'bg-gray-800 text-gray-100 rounded-bl-sm'
              }`}>
                {msg.content || <span className="animate-pulse text-gray-500">▍</span>}
              </div>
            </div>
          ))}
          {streaming && currentStep && (
            <p className="text-xs text-gray-600 text-center animate-pulse">{currentStep}</p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={streaming}
          />
          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="px-5 py-3 bg-white text-black rounded-xl font-medium text-sm disabled:opacity-40 hover:bg-gray-200 transition-colors"
          >
            Send
          </button>
        </div>
      </main>

      {/* Debug Toggle — always visible, fixed to right edge */}
      {displayTurn && (
        <button
          onClick={() => setDebugOpen(!debugOpen)}
          className="fixed right-0 top-20 z-50 bg-white text-black px-3 py-2 rounded-l-lg shadow-lg hover:bg-gray-200 transition-colors font-medium text-sm flex items-center gap-1 border border-gray-300 border-r-0"
        >
          <span>🧠</span>
          <span>{debugOpen ? 'Hide' : 'Debug'}</span>
          <span>{debugOpen ? '→' : '←'}</span>
        </button>
      )}

      {/* Debug Drawer */}
      {displayTurn && debugOpen && (
        <aside className="fixed right-0 top-0 h-full w-[480px] bg-gray-950 border-l border-gray-800 overflow-y-auto z-40">
          <div className="p-4 space-y-4 pt-16">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Character Mind Observatory</h2>
                {turnHistory.length > 0 && (
                  <select
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
                    value={selectedTurnIndex}
                    onChange={(e) => setSelectedTurnIndex(Number(e.target.value))}
                  >
                    <option value={-1}>Current turn</option>
                    {turnHistory.map((_, i) => (
                      <option key={i} value={i}>Turn {i + 1}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Derived State Badge */}
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                displayTurn.emotion_after.momentum === 'rising' ? 'bg-green-900 text-green-300' :
                displayTurn.emotion_after.momentum === 'falling' ? 'bg-red-900 text-red-300' :
                'bg-gray-800 text-gray-400'
              }`}>
                {displayTurn.emotion_after.derived_state}
                <span className="text-xs ml-1 opacity-60">({displayTurn.emotion_after.dominant_primary})</span>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-gray-800">
                {(['emotions', 'appraisal', 'reasoning', 'narrative', 'state'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${
                      activeTab === tab
                        ? 'text-white border-b-2 border-white'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="space-y-4">
                {activeTab === 'emotions' && (
                  <EmotionsTab
                    before={displayTurn.emotion_before}
                    after={displayTurn.emotion_after}
                  />
                )}
                {activeTab === 'appraisal' && (
                  <AppraisalTab appraisal={displayTurn.appraisal} />
                )}
                {activeTab === 'reasoning' && (
                  <ReasoningTab
                    reasoning={displayTurn.reasoning}
                    goal={displayTurn.goal_state}
                  />
                )}
                {activeTab === 'narrative' && (
                  <NarrativeTab narrative={displayTurn.narrative} />
                )}
                {activeTab === 'state' && (
                  <StateTab
                    relationship={displayTurn.relationship_state}
                    session={displayTurn.session}
                    threads={displayTurn.open_threads}
                  />
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
  );
}

// Emotion Bars Component
function EmotionBars({ before, after }: { before: PlutchikState; after: PlutchikState }) {
  const emotions: { key: keyof PlutchikState; label: string; color: string }[] = [
    { key: 'joy', label: '😊 Joy', color: 'bg-yellow-400' },
    { key: 'trust', label: '🤝 Trust', color: 'bg-green-400' },
    { key: 'fear', label: '😰 Fear', color: 'bg-purple-400' },
    { key: 'surprise', label: '😲 Surprise', color: 'bg-orange-400' },
    { key: 'sadness', label: '😢 Sadness', color: 'bg-blue-400' },
    { key: 'disgust', label: '🤢 Disgust', color: 'bg-amber-600' },
    { key: 'anger', label: '😠 Anger', color: 'bg-red-400' },
    { key: 'anticipation', label: '🤔 Anticipation', color: 'bg-teal-400' },
  ];

  return (
    <div className="space-y-2">
      {emotions.map((e) => (
        <div key={e.key} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-24">{e.label}</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden relative">
            {/* Before (ghost) */}
            <div
              className="absolute h-full bg-gray-600 opacity-30 rounded-full transition-all duration-500"
              style={{ width: `${before[e.key] * 100}%` }}
            />
            {/* After */}
            <div
              className={`absolute h-full ${e.color} rounded-full transition-all duration-500`}
              style={{ width: `${after[e.key] * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-12 text-right">
            {after[e.key].toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmotionsTab({ before, after }: { before: EmotionBefore; after: EmotionAfter }) {
  return (
    <div className="space-y-4">
      <EmotionBars before={before.plutchik} after={after.plutchik} />

      {/* PAD */}
      <div className="pt-2 border-t border-gray-800">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">PAD State</p>
        <div className="grid grid-cols-3 gap-2">
          <PADBar label="Pleasure" value={(after.pad.pleasure + 1) / 2} color="bg-emerald-400" />
          <PADBar label="Arousal" value={after.pad.arousal} color="bg-rose-400" />
          <PADBar label="Dominance" value={after.pad.dominance} color="bg-indigo-400" />
        </div>
      </div>

      {/* Desire */}
      <div className="pt-2 border-t border-gray-800">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Desire</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Intensity: {after.desire_intensity.toFixed(2)}</span>
          <span className="text-xs text-gray-400">Target: {after.desire_target}</span>
        </div>
        <div className="mt-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-pink-400 rounded-full transition-all duration-500"
            style={{ width: `${after.desire_intensity * 100}%` }}
          />
        </div>
      </div>

      {/* Momentum */}
      <div className="pt-2 border-t border-gray-800">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Momentum</p>
        <span className={`text-xs font-medium ${
          after.momentum === 'rising' ? 'text-green-400' :
          after.momentum === 'falling' ? 'text-red-400' :
          'text-gray-400'
        }`}>
          {after.momentum === 'rising' ? '↑ Rising' : after.momentum === 'falling' ? '↓ Falling' : '→ Stable'}
        </span>
      </div>
    </div>
  );
}

function PADBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${value * 100}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-0.5">{value.toFixed(2)}</p>
    </div>
  );
}

function AppraisalTab({ appraisal }: { appraisal: AppraisalData }) {
  return (
    <div className="space-y-3">
      {/* Scores */}
      <div className="grid grid-cols-2 gap-2">
        <ScoreBar label="Relevance" value={appraisal.relevance} color="bg-blue-400" />
        <ScoreBar label="Valence" value={(appraisal.valence + 1) / 2} color="bg-purple-400" />
        <ScoreBar label="Coping" value={appraisal.coping} color="bg-green-400" />
        <ScoreBar label="Norm Violation" value={appraisal.norm_violation} color="bg-red-400" />
      </div>

      {/* Summary */}
      <div className="pt-2 border-t border-gray-800">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Summary</p>
        <p className="text-sm text-gray-300">{appraisal.appraisal_summary}</p>
      </div>

      {/* Emotional Deltas */}
      <div className="pt-2 border-t border-gray-800">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Emotional Impact</p>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(appraisal.emotional_delta).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="text-xs text-gray-400 capitalize">{key.replace('_', ' ')}</span>
              <span className={`text-xs font-mono ${val > 0 ? 'text-green-400' : val < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                {val > 0 ? '+' : ''}{val.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs text-gray-300 font-mono">{value.toFixed(2)}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function ReasoningTab({ reasoning, goal }: { reasoning: ReasoningData; goal: GoalState }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          goal.reasoning_depth === 'deep' ? 'bg-red-900 text-red-300' :
          goal.reasoning_depth === 'moderate' ? 'bg-yellow-900 text-yellow-300' :
          'bg-gray-800 text-gray-400'
        }`}>
          {goal.reasoning_depth.toUpperCase()}
        </span>
        {goal.force_deep_triggered && (
          <span className="text-xs text-red-400">(forced by emotion shift)</span>
        )}
      </div>

      <DebugField label="Desire" value={`${goal.desire} (${goal.desire_strength})`} />
      <DebugField label="Objective" value={goal.objective} />
      <DebugField label="Intended Move" value={reasoning.intended_move} />
      <DebugField label="User Read" value={reasoning.user_read} />
      <DebugField label="Emotional State" value={reasoning.emotional_state_summary} />
      <DebugField label="Forbidden" value={reasoning.forbidden_moves.join(' / ') || '—'} />
    </div>
  );
}

function StateTab({ relationship, session, threads }: {
  relationship: RelationshipState;
  session: SessionInfo;
  threads: NarrativeThread[];
}) {
  return (
    <div className="space-y-3">
      {/* Relationship */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Relationship</p>
        <div className="grid grid-cols-2 gap-2">
          <ScoreBar label="Trust" value={relationship.trust} color="bg-green-400" />
          <ScoreBar label="Familiarity" value={relationship.familiarity} color="bg-blue-400" />
          <ScoreBar label="Resentment" value={relationship.resentment} color="bg-red-400" />
          <ScoreBar label="Intimacy" value={relationship.intimacy} color="bg-pink-400" />
        </div>
        <p className="text-xs text-gray-500 mt-1">Source: {relationship.trust_source}</p>
      </div>

      {/* Session */}
      <div className="pt-2 border-t border-gray-800">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Session</p>
        <p className="text-xs text-gray-400">
          {session.was_new_session
            ? `New session (${session.hours_since_last.toFixed(1)}h gap, decay: ${session.session_decay_applied.toFixed(2)})`
            : 'Same session (no decay)'}
        </p>
      </div>

      {/* Threads */}
      {threads.length > 0 && (
        <div className="pt-2 border-t border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Open Threads</p>
          {threads.map((t) => (
            <div key={t.id} className="mb-1 flex gap-2 text-xs">
              <span className="text-gray-600 uppercase">[{t.type}]</span>
              <span className="text-gray-300">{t.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NarrativeTab({ narrative }: { narrative: NarrativeData }) {
  const hasEvents =
    narrative.new_threads.length > 0 ||
    narrative.resolved_threads.length > 0 ||
    narrative.relationship_deltas.length > 0;

  if (!hasEvents) {
    return (
      <div className="text-xs text-gray-500 italic">
        No narrative events this turn.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* New Threads */}
      {narrative.new_threads.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">New Threads</p>
          {narrative.new_threads.map((t, i) => (
            <div key={i} className="mb-2 p-2 bg-gray-900 rounded border border-gray-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase text-yellow-400">[{t.type}]</span>
                <span className="text-xs text-gray-500">weight: {t.emotional_weight.toFixed(2)}</span>
              </div>
              <p className="text-sm text-gray-300">{t.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Resolved Threads */}
      {narrative.resolved_threads.length > 0 && (
        <div className="pt-2 border-t border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Resolved</p>
          {narrative.resolved_threads.map((id, i) => (
            <div key={i} className="text-xs text-green-400 mb-1">
              Thread {id.slice(0, 8)}... marked resolved
            </div>
          ))}
        </div>
      )}

      {/* Relationship Deltas */}
      {narrative.relationship_deltas.length > 0 && (
        <div className="pt-2 border-t border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Relationship Impact</p>
          {narrative.relationship_deltas.map((d, i) => (
            <div key={i} className="mb-2">
              <p className="text-xs text-gray-400 mb-1">{d.reason}</p>
              <div className="flex gap-3 text-xs">
                {d.trust !== 0 && (
                  <span className={d.trust > 0 ? 'text-green-400' : 'text-red-400'}>
                    Trust {d.trust > 0 ? '+' : ''}{d.trust.toFixed(3)}
                  </span>
                )}
                {d.resentment !== 0 && (
                  <span className={d.resentment > 0 ? 'text-red-400' : 'text-green-400'}>
                    Resentment {d.resentment > 0 ? '+' : ''}{d.resentment.toFixed(3)}
                  </span>
                )}
                {d.intimacy !== 0 && (
                  <span className="text-pink-400">
                    Intimacy {d.intimacy > 0 ? '+' : ''}{d.intimacy.toFixed(3)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmotionBar({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-400',
    orange: 'bg-orange-400',
    pink: 'bg-pink-400',
  };
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-600">{label}</span>
      <div className="w-10 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]} rounded-full`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
      </div>
    </div>
  );
}

function DebugField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-300 mt-0.5">{value}</p>
    </div>
  );
}
