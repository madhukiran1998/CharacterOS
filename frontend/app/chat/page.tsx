'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Character {
  id: string;
  created_at: string;
  identity: {
    name: string;
    role: string;
    public_self: string;
  };
}

export default function ChatIndexPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/characters')
      .then((r) => r.json())
      .then((data) => setCharacters(data.characters))
      .catch(() => setError('Could not load characters — is the backend running?'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Select a Character</h1>
          <p className="text-gray-400 text-sm mt-1">Choose who you want to talk to</p>
        </div>
        <button
          onClick={() => router.push('/create')}
          className="px-4 py-2 border border-gray-700 text-gray-300 rounded-lg text-sm hover:border-white hover:text-white transition-colors"
        >
          + New Character
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950 border border-red-800 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && characters.length === 0 && (
        <div className="text-center py-24">
          <p className="text-gray-500 text-sm mb-4">No characters yet.</p>
          <button
            onClick={() => router.push('/create')}
            className="px-6 py-3 bg-white text-black rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Compile your first character
          </button>
        </div>
      )}

      <div className="space-y-3">
        {characters.map((char) => (
          <button
            key={char.id}
            onClick={() => router.push(`/chat/${char.id}`)}
            className="w-full text-left p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-600 hover:bg-gray-800 transition-all group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white text-lg">{char.identity.name}</span>
                  <span className="text-xs text-gray-600 font-mono hidden sm:block">
                    {char.id.slice(0, 8)}...
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-2">{char.identity.role}</p>
                <p className="text-xs text-gray-600 line-clamp-2">{char.identity.public_self}</p>
              </div>
              <span className="text-gray-600 group-hover:text-white transition-colors text-xl mt-1">→</span>
            </div>
            <p className="text-xs text-gray-700 mt-3">
              Created {new Date(char.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </button>
        ))}
      </div>
    </main>
  );
}
