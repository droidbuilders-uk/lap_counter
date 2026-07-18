import { useState, useEffect } from 'react';
import { Printer, Download, Cpu, RefreshCw, AlertTriangle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Markers = () => {
  const { labels, theme } = useTheme();
  const [markerId, setMarkerId] = useState(0);
  const [dictionary, setDictionary] = useState('DICT_4X4_50');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [trackingMethod, setTrackingMethod] = useState('camera');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        if (data.aruco_dict) {
          setDictionary(data.aruco_dict);
        }
        if (data.tracking_method) {
          setTrackingMethod(data.tracking_method);
        }
      });
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const getMarkerUrl = (id: number) => `/api/markers/${id}?dictionary=${dictionary}&size=1000`;

  if (trackingMethod === 'ir_serial') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="w-24 h-24 bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-12 h-12 text-indigo-500" />
        </div>
        <h2 className="text-3xl font-bold mb-4 text-white">IR Transponders Active</h2>
        <p className="text-slate-400 max-w-lg text-lg">
          You are currently using Serial IR Transponders to track laps. There is no need to print physical ArUco tags.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Cpu className="w-8 h-8 text-purple-500" /> ArUco Tag Generator
          </h1>
          <p className="text-slate-400 mt-2">Generate and print high-quality tracking tags for your {labels.competitors}.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => setMarkerId(Math.floor(Math.random() * 50))}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors`}
          >
            <RefreshCw className="w-4 h-4" /> Random
          </button>
          <button
            onClick={handlePrint}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-900/20`}
          >
            <Printer className="w-4 h-4" /> Print Tag
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-6 print:hidden">
          <div className={`p-6 rounded-2xl border ${theme === 'droid' ? 'bg-slate-900/50 border-slate-800' : 'bg-zinc-900/80 border-zinc-800'} backdrop-blur-sm shadow-xl`}>
            <h2 className="text-xl font-semibold mb-6 text-white flex items-center gap-2">Tag Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Marker ID</label>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={markerId}
                  onChange={(e) => setMarkerId(parseInt(e.target.value) || 0)}
                  className={`w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500 transition-colors`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Dictionary</label>
                <select
                  value={dictionary}
                  onChange={(e) => setDictionary(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500 transition-colors`}
                >
                  <option value="DICT_4X4_50">4x4 (50 IDs) - RECOMMENDED</option>
                  <option value="DICT_4X4_1000">4x4 (1000 IDs)</option>
                  <option value="DICT_6X6_250">6x6 (Standard ArUco)</option>
                  <option value="DICT_APRILTAG_36h11">AprilTag 36h11</option>
                </select>
                {settings?.aruco_dict && settings.aruco_dict !== dictionary && (
                  <div className="mt-2 p-2 bg-amber-950/20 border border-amber-900/50 rounded-lg text-amber-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" /> System is currently set to {settings.aruco_dict}
                  </div>
                )}
              </div>

              <div className="pt-4">
                <div className="p-4 bg-purple-950/20 border border-purple-900/50 rounded-xl text-purple-300 text-sm">
                  <p className="font-semibold mb-1 italic">Pro Tip:</p>
                  <p className="text-xs leading-relaxed">
                    The 4x4 dictionary is the most efficient for high-speed tracking (210fps). Smaller grids detect faster than larger ones!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2">
          <div className={`p-12 rounded-2xl border ${theme === 'droid' ? 'bg-white' : 'bg-white'} shadow-2xl flex flex-col items-center justify-center min-h-[500px]`}>
            <div className="text-center mb-8 print:hidden">
                <p className="text-slate-900 font-bold text-2xl uppercase tracking-widest">ArUco Tag ID: {markerId}</p>
                <p className="text-slate-500 text-sm">{dictionary}</p>
            </div>
            
            <div className="relative group">
                <img 
                    src={getMarkerUrl(markerId)} 
                    alt={`ArUco Tag ${markerId}`}
                    className="w-80 h-80 shadow-2xl border-[20px] border-black transition-transform duration-500 group-hover:scale-105"
                />
                <a 
                    href={getMarkerUrl(markerId)} 
                    download={`marker_${markerId}.png`}
                    className="absolute -bottom-4 -right-4 p-3 bg-slate-900 text-white rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                >
                    <Download className="w-5 h-5" />
                </a>
            </div>

            <div className="mt-12 text-center text-slate-400 hidden print:block">
                <p className="text-xl font-bold text-black border-t-2 border-black pt-4">LAPCOUNTER PRO | TAG ID: {markerId}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Markers;
