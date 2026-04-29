import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, Timer, ArrowLeft, Flag } from 'lucide-react';

interface Droid {
  id: number;
  name: string;
  aruco_id: number;
  color_hex: string;
}

interface Lap {
  id: number;
  droid_id: number;
  lap_number: number;
  lap_time_ms: number;
  timestamp: string;
}

interface RaceData {
  race: any;
  droids: Droid[];
  laps: Lap[];
}

export default function RaceResults() {
  const { id } = useParams();
  const [data, setData] = useState<RaceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRace = async () => {
      try {
        const res = await fetch(`/api/races/${id}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRace();
  }, [id]);

  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = ms % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0').substring(0,2)}`;
  };

  if (loading) {
    return <div className="text-center text-slate-500 py-12">Loading Race Results...</div>;
  }

  if (!data || !data.race) {
    return (
      <div className="text-center py-12">
        <Flag className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">Race Not Found</h2>
        <Link to="/races" className="text-blue-500 mt-4 inline-block hover:underline">Back to Race Control</Link>
      </div>
    );
  }

  // Calculate Leaderboard
  const leaderboardData = data.droids.map(droid => {
    const droidLaps = data.laps.filter(l => l.droid_id === droid.id);
    const totalTime = droidLaps.reduce((sum, l) => sum + l.lap_time_ms, 0);
    const bestLap = droidLaps.length > 0 ? Math.min(...droidLaps.map(l => l.lap_time_ms)) : 0;
    
    return {
      droid,
      lapCount: droidLaps.length,
      totalTime,
      bestLap
    };
  });

  // Sort: Most laps first, then lowest total time
  leaderboardData.sort((a, b) => {
    if (b.lapCount !== a.lapCount) return b.lapCount - a.lapCount;
    return a.totalTime - b.totalTime;
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/races" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <h1 className="text-3xl font-bold tracking-tight text-white">Race Results</h1>
          </div>
          <p className="text-slate-400 mt-1">{data.race.name}</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
          <div className="flex gap-4">
            <span className="flex items-center gap-1 text-sm text-slate-400">
              <Timer className="w-4 h-4" />
              {data.race.race_type === 'time' ? `${data.race.duration_seconds}s Heat` : `${data.race.max_laps} Laps`}
            </span>
            <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 uppercase">
              {data.race.status}
            </span>
          </div>
          <div className="text-sm text-slate-500">
            {data.race.start_time ? new Date(data.race.start_time + 'Z').toLocaleString() : ''}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 text-slate-400 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Pos</th>
                <th className="px-6 py-4 font-medium">Driver</th>
                <th className="px-6 py-4 font-medium text-center">Laps</th>
                <th className="px-6 py-4 font-medium text-right">Total Time</th>
                <th className="px-6 py-4 font-medium text-right">Best Lap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {leaderboardData.map((row, idx) => (
                <tr key={row.droid.id} className="hover:bg-slate-800/20 transition-colors group">
                  <td className="px-6 py-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      idx === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 
                      idx === 1 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/50' :
                      idx === 2 ? 'bg-amber-700/20 text-amber-600 border border-amber-700/50' :
                      'bg-slate-800 text-slate-500 font-medium'
                    }`}>
                      {idx + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-10 rounded-full" style={{ backgroundColor: row.droid.color_hex }} />
                      <span className="font-bold text-lg text-slate-200">{row.droid.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xl font-bold font-mono text-white">{row.lapCount}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-medium text-slate-300">
                    {formatTime(row.totalTime)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-medium text-emerald-400">
                    {row.bestLap ? formatTime(row.bestLap) : '--:--.--'}
                  </td>
                </tr>
              ))}
              {leaderboardData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No competitors found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
