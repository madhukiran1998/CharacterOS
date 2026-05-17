'use client';

import React, { useState } from 'react';

interface CharacterSpec {
  identity: { name: string; role: string; public_self: string; private_self: string };
  behavioral_genome: Record<string, number>;
  values: string[];
  fears: string[];
  motivations: string[];
  conversation_tactics: { when_threatened: string[]; when_trusted: string[]; when_challenged: string[] };
  speech: { register: string; forbidden: string[]; signature_moves: string[] };
  memory_schema: string[];
  safety_profile: string;
  test_prompts: string[];
}

interface CompileResult {
  character_id: string;
  spec: CharacterSpec;
}

export default function CreatePage() {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCompile() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('http://localhost:3001/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, created_by: 'creator' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">CharacterOS</h1>
      <p className="text-gray-300 mb-8">Describe a character in plain text. We'll compile them into a persistent AI persona.</p>

      <textarea
        className="w-full h-48 border border-gray-600 rounded-lg p-4 text-sm font-mono bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white resize-none"
        placeholder="Describe your character... (personality, backstory, speech patterns, quirks, motivations, fears)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={loading}
      />

      <button
        onClick={handleCompile}
        disabled={loading || !description.trim()}
        className="mt-4 px-6 py-3 bg-black text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
      >
        {loading ? 'Compiling character...' : 'Compile Character'}
      </button>

      {loading && (
        <p className="mt-4 text-sm text-gray-500 animate-pulse">
          Running 3-step LLM pipeline — this takes ~15 seconds...
        </p>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-1">Character ID</p>
            <p className="font-mono text-lg font-bold text-green-900">{result.character_id}</p>
            <p className="text-xs text-green-600 mt-1">Save this — you'll need it in Phase 2</p>
          </div>

          <SpecSection title="Identity">
            <Field label="Name" value={result.spec.identity.name} />
            <Field label="Role" value={result.spec.identity.role} />
            <Field label="Public self" value={result.spec.identity.public_self} />
            <Field label="Private self" value={result.spec.identity.private_self} />
          </SpecSection>

          <SpecSection title="Behavioral Genome">
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(result.spec.behavioral_genome).map(([key, val]) => (
                <div key={key} className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-300 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-mono font-bold text-white">{(val as number).toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full">
                    <div
                      className="h-1.5 bg-black rounded-full"
                      style={{ width: `${(val as number) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SpecSection>

          <SpecSection title="Values / Fears / Motivations">
            <StringList label="Values" items={result.spec.values} />
            <StringList label="Fears" items={result.spec.fears} />
            <StringList label="Motivations" items={result.spec.motivations} />
          </SpecSection>

          <SpecSection title="Speech">
            <Field label="Register" value={result.spec.speech.register} />
            <StringList label="Forbidden phrases" items={result.spec.speech.forbidden} />
            <StringList label="Signature moves" items={result.spec.speech.signature_moves} />
          </SpecSection>

          <SpecSection title="Conversation Tactics">
            <StringList label="When threatened" items={result.spec.conversation_tactics.when_threatened} />
            <StringList label="When trusted" items={result.spec.conversation_tactics.when_trusted} />
            <StringList label="When challenged" items={result.spec.conversation_tactics.when_challenged} />
          </SpecSection>

          <SpecSection title="Memory Schema">
            <StringList label="Remembers" items={result.spec.memory_schema} />
          </SpecSection>

          <SpecSection title="Safety Profile">
            <p className="text-sm text-gray-100">{result.spec.safety_profile}</p>
          </SpecSection>

          <SpecSection title="Test Prompts (Phase 4 Evaluation)">
            <ol className="list-decimal list-inside space-y-2">
              {result.spec.test_prompts.map((p, i) => (
                <li key={i} className="text-sm text-gray-100">{p}</li>
              ))}
            </ol>
          </SpecSection>
        </div>
      )}
    </main>
  );
}

function SpecSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-300">{title}</h2>
      </div>
      <div className="p-4 space-y-3 bg-gray-900">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-white">{value}</p>
    </div>
  );
}

function StringList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-100 flex gap-2">
            <span className="text-gray-500 select-none">—</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
