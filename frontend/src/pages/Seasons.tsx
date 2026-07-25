import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Medal, Plus, ChevronRight } from 'lucide-react';

interface Season {
  id: number;
  name: string;
  created_at: string;
}

export default function Seasons() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [newSeasonName, setNewSeasonName] = useState('');

  const fetchSeasons = async () => {
    const res = await fetch('/api/seasons');
    setSeasons(await res.json());
  };

  useEffect(() => {
    fetchSeasons();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonName.trim()) return;
    
    await fetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSeasonName })
    });
    
    setNewSeasonName('');
    fetchSeasons();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Medal className="w-8 h-8 text-yellow-500" />
          Championships
        </h1>
        <p className="text-slate-400 mt-2">Manage racing seasons, run heats, and host finals.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
              <Plus className="w-5 h-5 text-emerald-400" />
              New Championship
            </h2>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Season Name</label>
                <input
                  type="text"
                  required
                  value={newSeasonName}
                  onChange={e => setNewSeasonName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="e.g. Summer Cup 2026"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Create Season
              </button>
            </form>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Name</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Date Created</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {seasons.map(season => (
                  <tr key={season.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-white">{season.name}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(season.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/seasons/${season.id}`}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Enter <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {seasons.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                      No championships created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
