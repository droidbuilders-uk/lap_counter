import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Settings, Flag, LayoutDashboard, Cpu, Trophy, Terminal } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Droids from './pages/Droids';
import Races from './pages/Races';
import SettingsPage from './pages/Settings';
import RaceResults from './pages/RaceResults';
import Debug from './pages/Debug';
import Markers from './pages/Markers';
import { useTheme } from './context/ThemeContext';

function App() {
  const { labels, theme } = useTheme();

  return (
    <BrowserRouter>
      <div className={`min-h-screen ${theme === 'droid' ? 'bg-slate-950' : 'bg-zinc-950'} text-slate-200 font-sans`}>
        {/* Navigation */}
        <nav className={`${theme === 'droid' ? 'bg-slate-900/50' : 'bg-zinc-900/80'} backdrop-blur-md border-b ${theme === 'droid' ? 'border-slate-800' : 'border-zinc-800'} sticky top-0 z-50`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Flag className="w-8 h-8 text-emerald-500" />
                <span className="font-bold text-xl tracking-tight text-white">LapCounter Pro</span>
              </div>
              <div className="flex space-x-4">
                <Link to="/" className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 ${theme === 'droid' ? 'hover:bg-slate-800' : 'hover:bg-zinc-800'} hover:text-white transition-colors`}>
                  <LayoutDashboard className="w-4 h-4" /> Live Timing
                </Link>
                <Link to="/races" className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 ${theme === 'droid' ? 'hover:bg-slate-800' : 'hover:bg-zinc-800'} hover:text-white transition-colors`}>
                  <Flag className="w-4 h-4" /> Race Control
                </Link>
                <Link to="/droids" className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 ${theme === 'droid' ? 'hover:bg-slate-800' : 'hover:bg-zinc-800'} hover:text-white transition-colors`}>
                  {theme === 'droid' ? <Cpu className="w-4 h-4" /> : <Trophy className="w-4 h-4" />} {labels.garage}
                </Link>
                <Link to="/settings" className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 ${theme === 'droid' ? 'hover:bg-slate-800' : 'hover:bg-zinc-800'} hover:text-white transition-colors`}>
                  <Settings className="w-4 h-4" /> Settings
                </Link>
                <Link to="/debug" className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 ${theme === 'droid' ? 'hover:bg-slate-800' : 'hover:bg-zinc-800'} hover:text-white transition-colors`}>
                  <Terminal className="w-4 h-4" /> Debug
                </Link>
                <Link to="/markers" className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 ${theme === 'droid' ? 'hover:bg-slate-800' : 'hover:bg-zinc-800'} hover:text-white transition-colors`}>
                  <Cpu className="w-4 h-4" /> Tag Maker
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/droids" element={<Droids />} />
            <Route path="/races" element={<Races />} />
            <Route path="/races/:id" element={<RaceResults />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/debug" element={<Debug />} />
            <Route path="/markers" element={<Markers />} />
          </Routes>
        </main>
      </div>
      </BrowserRouter>
  );
}

export default App;
