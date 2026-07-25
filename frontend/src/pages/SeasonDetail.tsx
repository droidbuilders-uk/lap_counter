import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Medal, Flag, Timer, ChevronRight, Play, Trophy } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface Season {
  id: number;
  name: string;
  created_at: string;
}

interface Droid {
  id: number;
  name: string;
  aruco_id: number;
  color_hex: string;
}

interface LeaderboardEntry {
  droid: Droid;
  fastest_lap_ms: number | null;
  most_laps: number;
  heats_entered: number;
}

interface Race {
  id: number;
  name: string;
  status: string;
  race_class: string;
  duration_seconds: number;
  droid_ids: number[];
}

export default function SeasonDetail() {
  const { id } = useParams();
  const { labels } = useTheme();
  const [season, setSeason] = useState<Season | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingRaceId, setEditingRaceId] = useState<number | null>(null);
  const [raceClass, setRaceClass] = useState<'heat'|'final'>('heat');
  const [raceName, setRaceName] = useState('');
  const [droids, setDroids] = useState<Droid[]>([]);
  const [selectedDroids, setSelectedDroids] = useState<number[]>([]);
  const [duration, setDuration] = useState(240);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/seasons/${id}`);
    const data = await res.json();
    setSeason(data.season);
    setRaces(data.races);

    const lbRes = await fetch(`/api/seasons/${id}/leaderboard`);
    setLeaderboard(await lbRes.json());
    
    const droidsRes = await fetch('/api/droids');
    setDroids(await droidsRes.json());
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openModal = (type: 'heat' | 'final', editRace?: Race) => {
    setRaceClass(type);
    
    if (editRace) {
      setEditingRaceId(editRace.id);
      setRaceName(editRace.name);
      setDuration(editRace.duration_seconds || 240);
      setSelectedDroids(editRace.droid_ids || []);
    } else {
      setEditingRaceId(null);
      setRaceName(type === 'heat' ? `Heat ${races.filter(r => r.race_class === 'heat').length + 1}` : 'The Grand Final');
      setDuration(240);
      if (type === 'final') {
        setSelectedDroids(leaderboard.slice(0, 4).map(l => l.droid.id));
      } else {
        setSelectedDroids([]);
      }
    }
    
    setShowModal(true);
  };

  const handleCreateRace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDroids.length === 0) return alert(`Select at least one ${labels.competitor.toLowerCase()}!`);
    
    if (editingRaceId) {
      await fetch(`/api/races/${editingRaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: raceName,
          duration_seconds: duration,
          max_laps: 999,
          droid_ids: selectedDroids
        })
      });
    } else {
      await fetch('/api/races', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: raceName,
          race_type: 'time',
          duration_seconds: duration,
          max_laps: 999, // Essentially infinite for time-based heats
          season_id: parseInt(id!),
          race_class: raceClass,
          droid_ids: selectedDroids
        })
      });
    }
    
    setShowModal(false);
    fetchData();
  };

  const startRace = async (raceId: number) => {
    await fetch(`/api/races/${raceId}/start`, { method: 'POST' });
    fetchData();
  };

  const formatTime = (ms: number | null) => {
    if (!ms) return '--:--.---';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const m = Math.floor(ms % 1000);
    if (mins > 0) return `${mins}:${secs.toString().padStart(2, '0')}.${m.toString().padStart(3, '0')}`;
    return `${secs}.${m.toString().padStart(3, '0')}`;
  };

  if (!season) return <div className="p-8 text-center text-slate-400">Loading...</div>;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/seasons" className="text-emerald-500 hover:text-emerald-400 text-sm mb-2 inline-block">&larr; Back to Championships</Link>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Medal className="w-8 h-8 text-yellow-500" />
          {season.name}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEADERBOARD */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-emerald-400" />
                Season Leaderboard
              </h2>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Pos</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">{labels.competitor}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Heats</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300 text-center">Most Laps</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Fastest Lap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {leaderboard.map((entry, index) => (
                  <tr key={entry.droid.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-slate-400 font-medium">#{index + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.droid.color_hex }} />
                        <span className="font-medium text-white">{entry.droid.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{entry.heats_entered}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-800 text-emerald-400 font-bold text-sm">
                        {entry.most_laps}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-300 font-mono">
                      {formatTime(entry.fastest_lap_ms)}
                    </td>
                  </tr>
                ))}
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No heats have been completed yet. Run a heat to populate the leaderboard!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RACE LIST */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex gap-4">
            <button 
              onClick={() => openModal('heat')}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-4 rounded-xl transition-colors border border-slate-700 hover:border-slate-600 flex justify-center items-center gap-2"
            >
              <Flag className="w-5 h-5 text-emerald-400" />
              Add Heat
            </button>
            <button 
              onClick={() => openModal('final')}
              className="flex-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 font-medium py-3 px-4 rounded-xl transition-colors border border-yellow-500/20 hover:border-yellow-500/50 flex justify-center items-center gap-2"
            >
              <Trophy className="w-5 h-5" />
              Add Final
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">Season Races</h2>
            </div>
            <div className="divide-y divide-slate-800">
              {races.map(race => (
                <div key={race.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30">
                  <div>
                    <h3 className="font-medium text-white flex items-center gap-2">
                      {race.race_class === 'final' ? <Trophy className="w-4 h-4 text-yellow-500" /> : <Flag className="w-4 h-4 text-slate-500" />}
                      {race.name}
                    </h3>
                    <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{race.status}</div>
                  </div>
                  
                  {race.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openModal(race.race_class as 'heat'|'final', race)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => startRace(race.id)}
                        className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="Start Race"
                      >
                        <Play className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <Link
                      to={`/races/${race.id}`}
                      className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
                      title="View Results"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  )}
                </div>
              ))}
              {races.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No races created. Click "Add Heat" to begin.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              {raceClass === 'final' ? <Trophy className="w-6 h-6 text-yellow-500" /> : <Flag className="w-6 h-6 text-emerald-400" />}
              {editingRaceId ? 'Edit' : 'Create'} {raceClass === 'final' ? 'Final' : 'Heat'}
            </h2>
            
            <form onSubmit={handleCreateRace} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Race Name</label>
                <input
                  type="text"
                  required
                  value={raceName}
                  onChange={e => setRaceName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2">
                  <Timer className="w-4 h-4" /> Duration (seconds)
                </label>
                <input
                  type="number"
                  required
                  min="10"
                  value={duration}
                  onChange={e => setDuration(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">Select Competitors</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {droids.map(droid => (
                    <label 
                      key={droid.id} 
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedDroids.includes(droid.id) 
                          ? 'bg-slate-800 border-emerald-500/50' 
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDroids.includes(droid.id)}
                        onChange={() => {
                          setSelectedDroids(prev => 
                            prev.includes(droid.id) ? prev.filter(d => d !== droid.id) : [...prev, droid.id]
                          );
                        }}
                        className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900"
                      />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: droid.color_hex }} />
                      <span className="text-white font-medium">{droid.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium"
                >
                  {editingRaceId ? 'Save Changes' : `Create ${raceClass === 'final' ? 'Final' : 'Heat'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
