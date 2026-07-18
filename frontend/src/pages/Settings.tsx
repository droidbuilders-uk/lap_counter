import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Settings as SettingsIcon, Save, Monitor, ArrowDownUp, AlertTriangle, Camera, Cpu, Flag, Radio, Usb, Zap } from 'lucide-react';

interface CameraDevice {
  index: number;
  name: string;
}

export default function Settings() {
  const { setTheme: updateTheme } = useTheme();
  const [lapDirection, setLapDirection] = useState('down');
  const [debugOverlays, setDebugOverlays] = useState('true');
  const [cameraIndex, setCameraIndex] = useState('0');
  const [theme, setTheme] = useState('droid');
  const [arucoDict, setArucoDict] = useState('DICT_4X4_50');
  const [trackingMethod, setTrackingMethod] = useState('camera');
  const [serialPort, setSerialPort] = useState('/dev/ttyUSB0');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [saved, setSaved] = useState(false);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setLapDirection(data.lap_direction || 'down');
      setDebugOverlays(data.debug_overlays || 'true');
      setCameraIndex(data.camera_index || '0');
      setTheme(data.theme || 'droid');
      setArucoDict(data.aruco_dict || 'DICT_4X4_50');
      setTrackingMethod(data.tracking_method || 'camera');
      setSerialPort(data.serial_port || '/dev/ttyUSB0');
    };
    
    const fetchCameras = async () => {
      try {
        const res = await fetch('/api/settings/cameras');
        const data = await res.json();
        setCameras(data);
      } catch {
        console.error("Failed to fetch cameras");
      }
    };

    fetchSettings();
    fetchCameras();
  }, []);

  const handleSave = async () => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { key: 'lap_direction', value: lapDirection },
        { key: 'debug_overlays', value: debugOverlays },
        { key: 'camera_index', value: cameraIndex },
        { key: 'theme', value: theme },
        { key: 'aruco_dict', value: arucoDict },
        { key: 'tracking_method', value: trackingMethod },
        { key: 'serial_port', value: serialPort }
      ])
    });
    // Trigger theme update on root if changed
    updateTheme(theme as 'droid' | 'pro');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleResetDatabase = async () => {
    if (confirm('DANGER! Are you absolutely sure you want to reset the database? This will permanently delete ALL Droids, Races, and Laps. This action cannot be undone.')) {
      if (confirm('Final Warning: Erase all data?')) {
        await fetch('/api/settings/reset', { method: 'POST' });
        alert('Database has been reset.');
        window.location.reload();
      }
    }
  };

  const handleClearRaces = async () => {
    if (confirm('Are you sure you want to delete all Races and Laps? Your Droid roster will be kept.')) {
      await fetch('/api/settings/reset_races', { method: 'POST' });
      alert('Race history has been cleared.');
      window.location.reload();
    }
  };

  const handleFlashSensorBar = async () => {
    if (confirm("Ensure the ESP32 is plugged in via USB and your settings are saved. This will compile and flash the firmware natively. Continue?")) {
      setFlashing(true);
      try {
        const res = await fetch('/api/settings/flash_sensor_bar', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          alert("Successfully compiled and flashed to the ESP32!");
        } else {
          alert("Failed to flash:\n\n" + data.detail);
        }
      } catch (e) {
        alert("Error flashing: " + e);
      }
      setFlashing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-slate-400" />
          System Settings
        </h1>
        <p className="text-slate-400 mt-2">Configure the Lap Counter tracking behavior and UI preferences.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-8">
        
        {/* Lap Direction */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
            <ArrowDownUp className="w-5 h-5 text-blue-500" /> Lap Trigger Direction
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Select which direction a droid must pass the finish line to trigger a lap.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center gap-3 transition-colors ${lapDirection === 'down' ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
              <input type="radio" className="hidden" name="direction" value="down" checked={lapDirection === 'down'} onChange={() => setLapDirection('down')} />
              <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-1/2 left-0 right-0 border-t border-red-500/50 border-dashed" />
                <ArrowDownUp className="w-6 h-6 text-blue-500 absolute rotate-180" />
              </div>
              <span className="font-medium text-slate-200">Top to Bottom</span>
            </label>
            
            <label className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center gap-3 transition-colors ${lapDirection === 'up' ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
              <input type="radio" className="hidden" name="direction" value="up" checked={lapDirection === 'up'} onChange={() => setLapDirection('up')} />
              <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-1/2 left-0 right-0 border-t border-red-500/50 border-dashed" />
                <ArrowDownUp className="w-6 h-6 text-blue-500 absolute" />
              </div>
              <span className="font-medium text-slate-200">Bottom to Top</span>
            </label>

            <label className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center gap-3 transition-colors ${lapDirection === 'both' ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
              <input type="radio" className="hidden" name="direction" value="both" checked={lapDirection === 'both'} onChange={() => setLapDirection('both')} />
              <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-1/2 left-0 right-0 border-t border-red-500/50 border-dashed" />
                <ArrowDownUp className="w-6 h-6 text-blue-500 absolute" />
                <ArrowDownUp className="w-6 h-6 text-blue-500 absolute rotate-180" />
              </div>
              <span className="font-medium text-slate-200">Both Directions</span>
            </label>
          </div>
        </div>

        <hr className="border-slate-800" />

        {/* Tracking Method Selection */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
            <Radio className="w-5 h-5 text-indigo-500" /> Tracking Method
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Select how lap times are recorded.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={`cursor-pointer p-4 rounded-xl border flex flex-col gap-3 transition-colors ${trackingMethod === 'camera' ? 'bg-indigo-900/20 border-indigo-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
              <input type="radio" className="hidden" name="tracking" value="camera" checked={trackingMethod === 'camera'} onChange={() => setTrackingMethod('camera')} />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Camera className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="font-medium text-slate-200">Camera (OpenCV ArUco)</div>
              </div>
              <p className="text-xs text-slate-500">Track visual tags using a USB webcam or Raspberry Pi camera module.</p>
            </label>

            <label className={`cursor-pointer p-4 rounded-xl border flex flex-col gap-3 transition-colors ${trackingMethod === 'ir_serial' ? 'bg-indigo-900/20 border-indigo-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
              <input type="radio" className="hidden" name="tracking" value="ir_serial" checked={trackingMethod === 'ir_serial'} onChange={() => setTrackingMethod('ir_serial')} />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Radio className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="font-medium text-slate-200">IR Transponders (Serial)</div>
              </div>
              <p className="text-xs text-slate-500">Track active IR transmitters via an ESP32 or serial receiver.</p>
            </label>
          </div>
        </div>

        <hr className="border-slate-800" />

        {trackingMethod === 'camera' ? (
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <Camera className="w-5 h-5 text-orange-500" /> Camera Selection
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Select the camera device to use for ArUco tag tracking.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cameras.map(cam => (
                <label key={cam.index} className={`cursor-pointer p-4 rounded-xl border flex items-center gap-3 transition-colors ${cameraIndex === cam.index.toString() ? 'bg-orange-900/20 border-orange-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
                  <input type="radio" className="hidden" name="camera" value={cam.index} checked={cameraIndex === cam.index.toString()} onChange={() => setCameraIndex(cam.index.toString())} />
                  <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                    <Camera className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-200">{cam.name}</div>
                    <div className="text-xs text-slate-500">Device Index {cam.index}</div>
                  </div>
                </label>
              ))}
              {cameras.length === 0 && (
                <div className="col-span-full p-4 bg-red-950/20 border border-red-900/50 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> No cameras detected. Ensure your camera is plugged in and recognized by the system.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <Usb className="w-5 h-5 text-orange-500" /> Serial Port Configuration
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Specify the serial port connected to your IR receiver (e.g. ESP32).
            </p>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <label className="block text-sm font-medium text-slate-300 mb-2">Device Path (e.g. /dev/ttyUSB0, COM3)</label>
              <input 
                type="text" 
                value={serialPort} 
                onChange={(e) => setSerialPort(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                placeholder="/dev/ttyUSB0"
              />
            </div>
            <div className="mt-4 flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div>
                <h3 className="text-white font-medium text-sm">Update Firmware</h3>
                <p className="text-xs text-slate-400">Compile and upload the latest code directly to the ESP32 via PlatformIO.</p>
              </div>
              <button 
                onClick={handleFlashSensorBar}
                disabled={flashing}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                {flashing ? <span className="animate-spin text-lg">↻</span> : <Zap className="w-4 h-4" />}
                {flashing ? 'Flashing...' : 'Flash Device'}
              </button>
            </div>
          </div>
        )}

        <hr className="border-slate-800" />

        {/* Theme Selection */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
            <Monitor className="w-5 h-5 text-purple-500" /> UI Theme & Terminology
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Choose a visual style and terminology that fits your racing event.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={`cursor-pointer p-4 rounded-xl border flex flex-col gap-3 transition-colors ${theme === 'droid' ? 'bg-purple-900/20 border-purple-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
              <input type="radio" className="hidden" name="theme" value="droid" checked={theme === 'droid'} onChange={() => setTheme('droid')} />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-purple-500" />
                </div>
                <div className="font-medium text-slate-200">Droid Racing (Sci-Fi)</div>
              </div>
              <p className="text-xs text-slate-500">Uses Star Wars terminology: "Droids", "Garage", "ArUco Tags".</p>
            </label>

            <label className={`cursor-pointer p-4 rounded-xl border flex flex-col gap-3 transition-colors ${theme === 'pro' ? 'bg-purple-900/20 border-purple-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
              <input type="radio" className="hidden" name="theme" value="pro" checked={theme === 'pro'} onChange={() => setTheme('pro')} />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Flag className="w-5 h-5 text-purple-500" />
                </div>
                <div className="font-medium text-slate-200">Professional (Standard)</div>
              </div>
              <p className="text-xs text-slate-500">Uses neutral terminology: "Competitors", "Paddock", "Sensors".</p>
            </label>
          </div>
        </div>

        <hr className="border-slate-800" />

        {/* ArUco Dictionary Selection */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
            <Cpu className="w-5 h-5 text-blue-500" /> ArUco Tag Dictionary
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Select the dictionary that matches your racing tags. Most droid races use 4x4, but standard ArUco tags are often 6x6.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { id: 'DICT_4X4_50', name: '4x4 (50 IDs)', desc: 'Smallest set' },
              { id: 'DICT_4X4_1000', name: '4x4 (1000 IDs)', desc: 'Online Generator Default' },
              { id: 'DICT_6X6_250', name: '6x6 (250 IDs)', desc: 'Standard ArUco' },
              { id: 'DICT_APRILTAG_36h11', name: 'AprilTag 36h11', desc: 'Robotics' }
            ].map(dict => (
              <label key={dict.id} className={`cursor-pointer p-4 rounded-xl border flex flex-col transition-colors ${arucoDict === dict.id ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
                <div className="flex items-center gap-3 mb-1">
                  <input type="radio" className="hidden" name="dict" value={dict.id} checked={arucoDict === dict.id} onChange={() => setArucoDict(dict.id)} />
                  <span className="font-medium text-slate-200">{dict.name}</span>
                </div>
                <span className="text-xs text-slate-500">{dict.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Debug Overlays */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
            <Monitor className="w-5 h-5 text-emerald-500" /> Camera Debug Overlays
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Show green outlines around detected ArUco tags, center tracking dots, and performance metrics (FPS & Resolution) on the Live Video feed.
          </p>
          <label className="flex items-center gap-4 cursor-pointer">
            <div className={`relative inline-block w-12 h-6 transition-colors rounded-full ${debugOverlays === 'true' ? 'bg-emerald-500' : 'bg-slate-700'}`}>
              <input type="checkbox" className="hidden" checked={debugOverlays === 'true'} onChange={(e) => setDebugOverlays(e.target.checked ? 'true' : 'false')} />
              <span className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${debugOverlays === 'true' ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
            <span className="font-medium text-slate-200">{debugOverlays === 'true' ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>

        <hr className="border-slate-800" />

        <div className="flex items-center justify-between">
          <p className="text-emerald-400 text-sm font-medium h-5">
            {saved && 'Settings saved successfully!'}
          </p>
          <button 
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </div>

      </div>

      {/* Danger Zone */}
      <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-6 shadow-xl space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-red-500">
          <AlertTriangle className="w-5 h-5" /> Danger Zone
        </h2>
        <p className="text-sm text-red-400/80">
          These actions are destructive and irreversible. You can choose to wipe out your race history, or completely factory reset the entire database.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <button 
            onClick={handleClearRaces}
            className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-orange-900/20 flex-1"
          >
            <AlertTriangle className="w-4 h-4" /> Clear Race History
          </button>

          <button 
            onClick={handleResetDatabase}
            className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-900/20 flex-1"
          >
            <AlertTriangle className="w-4 h-4" /> Reset Entire Database
          </button>
        </div>
      </div>

    </div>
  );
}
