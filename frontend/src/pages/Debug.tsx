import { useState, useEffect, useRef } from 'react';
import { Camera, Terminal, AlertCircle, ScrollText } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Debug() {
  const { labels } = useTheme();
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'debug_log') {
          setLogs(prev => [...prev, data.message].slice(-100)); // Keep last 100 lines
        }
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Terminal className="w-8 h-8 text-amber-500" />
          Camera Debug
        </h1>
        <p className="text-slate-400 mt-2">Live diagnostic feed. Use this to align your camera and test {labels.tag} detection.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Feed */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden relative">
            <div className="aspect-video bg-black flex items-center justify-center relative">
              <img 
                src="/api/video_feed" 
                alt="Live Camera Debug Feed" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/640x480?text=Camera+Disconnected';
                }}
              />
              
              {/* Overlay HUD */}
              <div className="absolute bottom-4 left-4 flex gap-2">
                <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-emerald-400 flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  FEED_ACTIVE
                </div>
              </div>

              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-white/70">
                RESOLUTION: 640x480
              </div>
            </div>
            
            <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-4 text-sm text-slate-400 font-mono">
                <span className="text-emerald-500">SYSTEM_READY</span>
                <span className="text-slate-600">|</span>
                <span>ARUCO_DICT: 4X4_50</span>
              </div>
              <div className="text-xs text-slate-500 italic">
                Crosshairs and tag bounding boxes are rendered by the backend tracker.
              </div>
            </div>
          </div>
        </div>

        {/* Info / Instructions */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-white">
              <Camera className="w-5 h-5 text-blue-500" /> Alignment Guide
            </h2>
            <ul className="space-y-4 text-sm text-slate-400">
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">1</div>
                <p>Ensure the <strong>red finish line</strong> is centered horizontally or vertically depending on your track layout.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">2</div>
                <p>Position the camera so {labels.competitors.toLowerCase()} pass <strong>completely across</strong> the line.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">3</div>
                <p>Check that {labels.tag}s show a <strong>green outline</strong> and a blue dot when detected.</p>
              </li>
            </ul>

            <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
              <p className="text-xs text-blue-300 leading-relaxed">
                If the feed is dark, check the <strong>Exposure Settings</strong> in the backend configuration or increase lighting on the finish line.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-2 text-white">
              Performance
            </h2>
            <div className="space-y-3 pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 uppercase tracking-wider font-bold">Target FPS</span>
                <span className="text-white font-mono">30.0</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[95%]" />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 uppercase tracking-wider font-bold">Latency</span>
                <span className="text-emerald-400 font-mono">&lt; 100ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Serial Logs */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden mt-6">
          <div className="bg-slate-950/80 border-b border-slate-800 p-3 flex justify-between items-center">
            <h2 className="text-sm font-bold flex items-center gap-2 text-white font-mono">
              <ScrollText className="w-4 h-4 text-emerald-500" /> RAW SERIAL LOGS
            </h2>
            <div className="flex items-center gap-2">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
               </span>
               <span className="text-[10px] text-emerald-500 font-bold tracking-widest">LIVE</span>
            </div>
          </div>
          <div className="h-48 overflow-y-auto p-4 bg-[#0a0a0a] font-mono text-xs text-emerald-400 space-y-1">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">Waiting for serial data... Ensure IR Transponder method is selected and device is connected.</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="hover:bg-white/5 px-1 rounded break-all">{log}</div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
