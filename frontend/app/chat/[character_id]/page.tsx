'use client';

import { use, useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'character';
  content: string;
}

interface ReasoningOutput {
  current_goal: string;
  emotional_state: string;
  user_read: string;
  intended_move: string;
  forbidden_moves: string[];
}

interface RelationshipState {
  trust: number;
  familiarity: number;
}

export default function ChatPage({ params }: { params: Promise<{ character_id: string }> }) {
  const { character_id } = use(params);

  const [userId, setUserId] = useState('');
  const [userIdSet, setUserIdSet] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [reasoning, setReasoning] = useState<ReasoningOutput | null>(null);
  const [relationship, setRelationship] = useState<RelationshipState | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

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
              if (event.reasoning) setReasoning(event.reasoning);
              if (event.relationship_state) setRelationship(event.relationship_state);
              setCurrentStep('');
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

  if (!userIdSet) {
    return (
      <main className="max-w-lg mx-auto px-4 py-24 flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-white">CharacterOS Chat</h1>
        <p className="text-gray-400 text-sm">Character ID: <span className="font-mono text-gray-300">{character_id}</span></p>
        <p className="text-gray-400 text-sm mt-4">Enter a user ID to start (any string — use different IDs to simulate different users):</p>
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
    <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col h-screen">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
        <div>
          <p className="text-xs text-gray-500 font-mono">{character_id}</p>
          <p className="text-xs text-gray-500">user: <span className="text-gray-300">{userId}</span></p>
        </div>
        {relationship && (
          <div className="flex gap-4 text-xs text-gray-400">
            <span>trust <span className="text-white font-mono">{relationship.trust.toFixed(2)}</span></span>
            <span>familiarity <span className="text-white font-mono">{relationship.familiarity.toFixed(2)}</span></span>
          </div>
        )}
      </div>

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

      {reasoning && (
        <div className="mt-4 border border-gray-800 rounded-lg overflow-hidden">
          <button
            onClick={() => setDebugOpen((o) => !o)}
            className="w-full px-4 py-2 text-xs text-gray-500 text-left hover:bg-gray-900 flex justify-between"
          >
            <span>Debug — reasoning</span>
            <span>{debugOpen ? '▲' : '▼'}</span>
          </button>
          {debugOpen && (
            <div className="p-4 bg-gray-950 space-y-2">
              <DebugField label="Goal" value={reasoning.current_goal} />
              <DebugField label="Emotional state" value={reasoning.emotional_state} />
              <DebugField label="User read" value={reasoning.user_read} />
              <DebugField label="Intended move" value={reasoning.intended_move} />
              <DebugField label="Forbidden moves" value={reasoning.forbidden_moves.join(' / ')} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function DebugField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-600 uppercase tracking-wide">{label}</p>
      <p className="text-xs text-gray-300 mt-0.5">{value}</p>
    </div>
  );
}
