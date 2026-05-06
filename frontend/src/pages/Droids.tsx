import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Plus, Bot, Hash, Edit2, Trash2, X, Save, Trophy } from 'lucide-react';

interface Droid {
  id: number;
  name: string;
  aruco_id: number;
  color_hex: string;
}

export default function Droids() {
  const { labels, theme } = useTheme();
  const [droids, setDroids] = useState<Droid[]>([]);
  const [name, setName] = useState('');
  const [arucoId, setArucoId] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [error, setError] = useState('');
  const [editingDroid, setEditingDroid] = useState<Droid | null>(null);

  useEffect(() => {
    fetchDroids();
  }, []);
  
  // Auto-calculate next unused ID when not editing
  useEffect(() => {
    if (!editingDroid && droids.length > 0) {
      const usedIds = droids.map(d => d.aruco_id).sort((a,b) => a - b);
      let nextId = 0;
      for (let id of usedIds) {
        if (id === nextId) nextId++;
        else break;
      }
      if (nextId <= 49) {
        setArucoId(nextId.toString());
      }
    } else if (!editingDroid && droids.length === 0) {
      setArucoId('0');
    }
  }, [droids, editingDroid]);

  const fetchDroids = async () => {
    try {
      const res = await fetch('/api/droids');
      const data = await res.json();
      setDroids(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const url = editingDroid ? `/api/droids/${editingDroid.id}` : '/api/droids';
      const method = editingDroid ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          aruco_id: parseInt(arucoId),
          color_hex: color
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to save droid');
      }
      
      handleCancelEdit();
      fetchDroids();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to scrap this droid?")) return;
    await fetch(`/api/droids/${id}`, { method: 'DELETE' });
    if (editingDroid?.id === id) handleCancelEdit();
    fetchDroids();
  };
  
  const handleEdit = (droid: Droid) => {
    setEditingDroid(droid);
    setName(droid.name);
    setArucoId(droid.aruco_id.toString());
    setColor(droid.color_hex);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleCancelEdit = () => {
    setEditingDroid(null);
    setName('');
    setColor('#3b82f6');
    setError('');
    // Auto-ID will kick in automatically via useEffect
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          {theme === 'droid' ? <Bot className="w-8 h-8 text-blue-500" /> : <Trophy className="w-8 h-8 text-blue-500" />}
          {labels.garage}
        </h1>
        <p className="text-slate-400 mt-2">Register new {labels.competitors.toLowerCase()} and assign their {labels.tag}s.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Registration Form */}
        <div className="col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              {editingDroid ? (
                <><Edit2 className="w-5 h-5 text-blue-500" /> Edit Droid</>
              ) : (
                <><Plus className="w-5 h-5 text-emerald-500" /> Register Droid</>
              )}
            </h2>
            {editingDroid && (
              <button onClick={handleCancelEdit} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Droid Name</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="e.g. R2-D2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">ArUco ID</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="number" 
                  required
                  min="0"
                  max="49"
                  value={arucoId}
                  onChange={e => setArucoId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="0 - 49"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Team Color</label>
              <div className="flex gap-3">
                <input 
                  type="color" 
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="h-10 w-20 rounded cursor-pointer bg-slate-950 border border-slate-700"
                />
                <input 
                  type="text"
                  value={color}
                  readOnly
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-400 font-mono text-sm"
                />
              </div>
            </div>
            
            {error && <div className="text-red-400 text-sm bg-red-950/50 p-3 rounded-lg border border-red-900/50">{error}</div>}
            
            <button 
              type="submit"
              className={`w-full text-white font-medium py-2 px-4 rounded-lg transition-colors mt-6 shadow-lg flex items-center justify-center gap-2 ${
                editingDroid 
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' 
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
              }`}
            >
              {editingDroid ? <><Save className="w-4 h-4" /> Save Changes</> : <><Plus className="w-4 h-4" /> Add to Roster</>}
            </button>
          </form>
        </div>

        {/* Droid Roster */}
        <div className="col-span-1 md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            Roster <span className="bg-slate-800 text-slate-300 text-xs py-1 px-2 rounded-full">{droids.length}</span>
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {droids.map(droid => (
              <div key={droid.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between group hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-full shadow-inner flex items-center justify-center font-bold text-lg text-white/90 border-2 border-white/10"
                    style={{ backgroundColor: droid.color_hex }}
                  >
                    #{droid.aruco_id}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{droid.name}</h3>
                    <p className="text-slate-500 text-sm">{labels.tag}: {droid.aruco_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(droid)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(droid.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            {droids.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No droids registered yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
