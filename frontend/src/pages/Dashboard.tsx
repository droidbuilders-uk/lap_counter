import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Radio, Timer, Trophy, Activity, AlertCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

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

interface ActiveRaceData {
  race: {
    id: number;
    name: string;
    status: string;
    race_type: string;
    duration_seconds: number;
    max_laps: number;
    start_time: string | null;
  };
  droids: Droid[];
  laps: Lap[];
}

export default function Dashboard() {
  const { labels } = useTheme();
  const [activeData, setActiveData] = useState<ActiveRaceData | null>(null);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

  const fetchActiveRace = async () => {
    try {
      const res = await fetch('/api/races/active');
      const data = await res.json();
      setActiveData(data || null);
    } catch {
      console.error("Failed to fetch active race");
    }
  };

  useEffect(() => {
    fetchActiveRace();

    const connectWs = () => {
      // Determine ws url
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => setWsStatus('connected');
      ws.current.onclose = () => {
        setWsStatus('disconnected');
        setTimeout(connectWs, 3000); // Reconnect
      };
      
      ws.current.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'new_lap') {
          fetchActiveRace();
        } else if (msg.type === 'race_started') {
          fetchActiveRace();
        } else if (msg.type === 'race_stopped') {
          // Immediately redirect to the race results page!
          navigate(`/races/${msg.race_id}`);
        }
      };
    };

    connectWs();

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [navigate]);

  // Timer Effect
  useEffect(() => {
    if (!activeData || activeData.race.status !== 'active') {
      setTimeLeft(null);
      return;
    }

    if (activeData.race.race_type === 'time' && activeData.race.start_time) {
      const interval = setInterval(() => {
        const startStr = activeData.race.start_time!.replace(' ', 'T');
        const start = new Date(startStr + (startStr.endsWith('Z') ? '' : 'Z')).getTime();
        const now = new Date().getTime();
        const elapsedSec = Math.floor((now - start) / 1000);
        const remaining = Math.max(0, activeData.race.duration_seconds - elapsedSec);
        setTimeLeft(remaining);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [activeData]);

  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = ms % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0').substring(0,2)}`;
  };

  if (!activeData) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-slate-500">
        <Radio className="w-16 h-16 mb-6 opacity-20 animate-pulse" />
        <h2 className="text-2xl font-semibold text-slate-300">No Active Race</h2>
        <p className="mt-2">Go to Race Control to start an event.</p>
      </div>
    );
  }

  // Calculate Leaderboard
  const leaderboardData = activeData.droids.map(droid => {
    const droidLaps = activeData.laps.filter(l => l.droid_id === droid.id);
    const totalTime = droidLaps.reduce((sum, l) => sum + l.lap_time_ms, 0);
    const bestLap = droidLaps.length > 0 ? Math.min(...droidLaps.map(l => l.lap_time_ms)) : 0;
    
    return {
      droid,
      lapCount: droidLaps.length,
      totalTime,
      bestLap,
      lastLap: droidLaps.length > 0 ? droidLaps[droidLaps.length - 1] : null
    };
  });

  // Sort: Most laps first, then lowest total time
  leaderboardData.sort((a, b) => {
    if (b.lapCount !== a.lapCount) return b.lapCount - a.lapCount;
    return a.totalTime - b.totalTime;
  });

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-red-500/20 text-red-500 p-3 rounded-lg border border-red-500/30">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight">{activeData.race.name}</h1>
            <div className="flex gap-3 text-sm font-medium text-slate-400 mt-1">
              <span className="flex items-center gap-1">
                <Timer className="w-4 h-4" /> 
                {activeData.race.race_type === 'time' ? `${activeData.race.duration_seconds}s Heat` : `${activeData.race.max_laps} Laps`}
              </span>
              <span className="flex items-center gap-1">
                <Radio className={`w-4 h-4 ${wsStatus === 'connected' ? 'text-emerald-500' : 'text-red-500'}`} /> 
                {wsStatus === 'connected' ? 'Live' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Race Clock */}
        <div className="bg-slate-950 px-6 py-3 rounded-lg border border-slate-800 text-center min-w-[200px]">
          <div className="text-sm font-bold text-slate-500 tracking-widest uppercase mb-1">
            {activeData.race.race_type === 'time' ? 'Time Remaining' : 'Race Status'}
          </div>
          <div className={`text-3xl font-mono font-bold ${activeData.race.status === 'active' ? 'text-emerald-400' : 'text-slate-400'}`}>
            {activeData.race.status !== 'active' ? 'FINISHED' : 
             activeData.race.race_type === 'time' && timeLeft !== null ? 
             `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : 
             'LIVE'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Leaderboard */}
        <div className="col-span-1 lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" /> Leaderboard
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 text-slate-400 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Pos</th>
                  <th className="px-6 py-4 font-medium">{labels.competitor}</th>
                  <th className="px-6 py-4 font-medium text-center">Laps</th>
                  <th className="px-6 py-4 font-medium text-right">Best Lap</th>
                  <th className="px-6 py-4 font-medium text-right">Last Lap</th>
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
                        <span className="font-bold text-lg text-slate-200 group-hover:text-white transition-colors">{row.droid.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xl font-bold font-mono text-white">{row.lapCount}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-emerald-400">
                      {row.bestLap ? formatTime(row.bestLap) : '--:--.--'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-slate-300">
                      {row.lastLap ? formatTime(row.lastLap.lap_time_ms) : '--:--.--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Camera Feed / Recent Activity */}
        <div className="col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-4">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Camera className="w-5 h-5 text-blue-500" /> Tracking Status
            </h2>
            <div className="aspect-video bg-black rounded-lg border border-slate-800 flex items-center justify-center relative overflow-hidden group">
              <img 
                src="/api/video_feed" 
                alt="Live Camera Feed" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute top-2 right-2 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold tracking-wider text-emerald-400 border border-emerald-500/30">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                LIVE
              </div>
            </div>
            <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400 leading-relaxed">
                Ensure the finish line is well lit. The camera is running at 30 FPS. Detection is based on {labels.tag} IDs.
              </p>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
