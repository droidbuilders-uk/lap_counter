import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Settings, Flag, LayoutDashboard, Cpu } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Droids from './pages/Droids';
import Races from './pages/Races';
import SettingsPage from './pages/Settings';
import RaceResults from './pages/RaceResults';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
        {/* Navigation */}
        <nav className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Flag className="w-8 h-8 text-emerald-500" />
                <span className="font-bold text-xl tracking-tight text-white">LapCounter Pro</span>
              </div>
              <div className="flex space-x-4">
                <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
                  <LayoutDashboard className="w-4 h-4" /> Live Timing
                </Link>
                <Link to="/races" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
                  <Flag className="w-4 h-4" /> Race Control
                </Link>
                <Link to="/droids" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
                  <Cpu className="w-4 h-4" /> Droid Garage
                </Link>
                <Link to="/settings" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
                  <Settings className="w-4 h-4" /> Settings
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
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
