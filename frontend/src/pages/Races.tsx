import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Flag, Play, Square, Trophy, Clock, Timer, ChevronRight, Repeat } from 'lucide-react';

interface Droid {
  id: number;
  name: string;
  aruco_id: number;
  color_hex: string;
}

interface Race {
  id: number;
  name: string;
  status: string;
  start_time: string | null;
  race_type: string;
  duration_seconds: number;
  max_laps: number;
}

export default function Races() {
  const { labels } = useTheme();
  const [droids, setDroids] = useState<Droid[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  
  // New Race Form
  const [name, setName] = useState('');
  const [raceType, setRaceType] = useState('time');
  const [duration, setDuration] = useState(240); // 4 mins
  const [maxLaps, setMaxLaps] = useState(10);
  const [selectedDroids, setSelectedDroids] = useState<number[]>([]);

  const fetchDroids = async () => {
    const res = await fetch('/api/droids');
    setDroids(await res.json());
  };

  const fetchRaces = async () => {
    const res = await fetch('/api/races');
    setRaces(await res.json());
  };

  useEffect(() => {
    fetchDroids();
    fetchRaces();
  }, []);

  const handleCreateRace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDroids.length === 0) return alert(`Select at least one ${labels.competitor.toLowerCase()}!`);
    
    const response = await fetch('/api/races', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        race_type: raceType,
        duration_seconds: duration,
        max_laps: maxLaps,
        droid_ids: selectedDroids
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      alert(errorData.detail || 'Failed to create race');
      return;
    }
    
    setName('');
    setSelectedDroids([]);
    fetchRaces();
  };

  const startRace = async (id: number) => {
    await fetch(`/api/races/${id}/start`, { method: 'POST' });
    fetchRaces();
  };

  const stopRace = async (id: number) => {
    await fetch(`/api/races/${id}/stop`, { method: 'POST' });
    fetchRaces();
  };

  const repeatRace = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/races/${id}/repeat`, { method: 'POST' });
    fetchRaces();
  };

  const toggleDroid = (id: number) => {
    setSelectedDroids(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Flag className="w-8 h-8 text-red-500" />
          Race Control
        </h1>
        <p className="text-slate-400 mt-2">Create new events, set the rules, and manage the grid.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create Race Form */}
        <div className="col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" /> New Race
          </h2>
          
          <form onSubmit={handleCreateRace} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Event Name</label>
              <input 
                type="text" required value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Semi-Final Heat 1"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Race Type</label>
                <select 
                  value={raceType} onChange={e => setRaceType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="time">Timed Heat</option>
                  <option value="laps">First to X Laps</option>
                </select>
              </div>
              
              {raceType === 'time' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Duration (sec)</label>
                  <input 
                    type="number" required min="10" value={duration} onChange={e => setDuration(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Laps to Win</label>
                  <input 
                    type="number" required min="1" value={maxLaps} onChange={e => setMaxLaps(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              )}
            </div>

            <div className="pt-2">
              <label className="block text-sm font-medium text-slate-400 mb-3">Select Grid ({labels.competitors})</label>
              <div className={`max-h-48 overflow-y-auto pr-2 custom-scrollbar ${droids.length >= 10 ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}`}>
                {droids.map(droid => (
                  <label key={droid.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedDroids.includes(droid.id) ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
                    <input 
                      type="checkbox" 
                      checked={selectedDroids.includes(droid.id)}
                      onChange={() => toggleDroid(droid.id)}
                      className="w-4 h-4 rounded border-slate-700 text-blue-500 focus:ring-blue-500/50 focus:ring-offset-slate-950 bg-slate-900"
                    />
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: droid.color_hex }}
                    />
                    <span className="font-medium">{droid.name}</span>
                  </label>
                ))}
                {droids.length === 0 && <p className="text-sm text-slate-500 italic">No {labels.competitors.toLowerCase()} available. Register them in the {labels.garage}.</p>}
              </div>
            </div>
            
            <button 
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-4 rounded-lg transition-colors mt-6 shadow-lg shadow-emerald-900/20"
            >
              Create Race
            </button>
          </form>
        </div>

        {/* History / Active Races */}
        <div className="col-span-1 lg:col-span-2 space-y-4">
          {races.map(race => {
            const isFinished = race.status === 'finished';
            const cardClass = `bg-slate-900 border rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${race.status === 'active' ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-red-500/20' : isFinished ? 'border-slate-800 hover:border-slate-600 hover:bg-slate-800/50 cursor-pointer group' : 'border-slate-800'}`;
            
            const cardContent = (
              <>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className={`font-bold text-lg ${isFinished ? 'group-hover:text-blue-400 transition-colors' : 'text-white'}`}>{race.name}</h3>
                    {race.status === 'active' && (
                      <span className="animate-pulse bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-500/30 uppercase tracking-wider font-bold">Live</span>
                    )}
                    {race.status === 'finished' && (
                      <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Finished</span>
                    )}
                    {race.status === 'pending' && (
                      <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full border border-blue-500/30 uppercase tracking-wider font-bold">Ready</span>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <Timer className="w-4 h-4" /> 
                      {race.race_type === 'time' ? `${race.duration_seconds}s Heat` : `${race.max_laps} Laps`}
                    </span>
                    {race.start_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" /> 
                        {new Date(race.start_time.replace(' ', 'T') + (race.start_time.endsWith('Z') ? '' : 'Z')).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex w-full sm:w-auto gap-3 items-center">
                  {race.status === 'pending' && (
                    <button onClick={(e) => { e.preventDefault(); startRace(race.id); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-4 py-2 rounded-lg font-medium transition-colors">
                      <Play className="w-4 h-4 fill-current" /> Start
                    </button>
                  )}
                  {race.status === 'active' && (
                    <button onClick={(e) => { e.preventDefault(); stopRace(race.id); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 px-4 py-2 rounded-lg font-medium transition-colors">
                      <Square className="w-4 h-4 fill-current" /> Stop
                    </button>
                  )}
                  {race.status === 'finished' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => repeatRace(e, race.id)} 
                        title="Repeat Race"
                        className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded-lg transition-colors"
                      >
                        <Repeat className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors self-center" />
                    </div>
                  )}
                </div>
              </>
            );

            return isFinished ? (
              <Link key={race.id} to={`/races/${race.id}`} className={cardClass}>
                {cardContent}
              </Link>
            ) : (
              <div key={race.id} className={cardClass}>
                {cardContent}
              </div>
            );
          })}
          
          {races.length === 0 && (
            <div className="py-12 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
              <Flag className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No races have been created yet.</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
