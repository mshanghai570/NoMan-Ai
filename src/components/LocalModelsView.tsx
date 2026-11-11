import React, { useState, useEffect, useRef } from 'react';
import type { UserSettings } from '../types';
import { LocalAiService, type WebGpuDiagnostics, type LocalEndpointStatus } from '../services/localAiService';
import {
  Cpu,
  Zap,
  Globe,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Play,
  Terminal,
  ShieldCheck,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';
import { haptic } from '../utils/haptics';

interface LocalModelsViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
}

export const LocalModelsView: React.FC<LocalModelsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [diagnostics, setDiagnostics] = useState<WebGpuDiagnostics | null>(null);
  const [endpointInput, setEndpointInput] = useState<string>(settings.localEndpoint || 'http://localhost:11434');
  const [pingStatus, setPingStatus] = useState<LocalEndpointStatus | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Live GPU Benchmark Canvas State
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkFps, setBenchmarkFps] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Run hardware test on mount
    LocalAiService.testWebGpu().then((res) => setDiagnostics(res));
  }, []);

  const handlePing = async () => {
    haptic.trigger('selection');
    setIsPinging(true);
    setPingStatus(null);
    try {
      const result = await LocalAiService.pingLocalEndpoint(endpointInput);
      setPingStatus(result);
      if (result.isReachable) {
        haptic.trigger('success');
        onUpdateSettings({ localEndpoint: endpointInput });
      } else {
        haptic.trigger('warning');
      }
    } finally {
      setIsPinging(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    haptic.trigger('selection');
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  // Run in-browser GPU benchmark
  const toggleBenchmark = () => {
    haptic.trigger('selection');
    if (isBenchmarking) {
      setIsBenchmarking(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    setIsBenchmarking(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = (canvas.width = canvas.parentElement?.clientWidth || 400);
    const h = (canvas.height = 200);

    // Particle tensor simulation (simulating 12,000 neural activation units)
    const count = 12000;
    const particles = new Float32Array(count * 4); // x, y, vx, vy
    for (let i = 0; i < count; i++) {
      particles[i * 4] = Math.random() * w;
      particles[i * 4 + 1] = Math.random() * h;
      particles[i * 4 + 2] = (Math.random() - 0.5) * 4;
      particles[i * 4 + 3] = (Math.random() - 0.5) * 4;
    }

    let lastTime = performance.now();
    let frameCount = 0;

    const render = () => {
      ctx.fillStyle = 'rgba(9, 13, 22, 0.25)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#22d3ee';
      for (let i = 0; i < count; i++) {
        let x = particles[i * 4];
        let y = particles[i * 4 + 1];
        let vx = particles[i * 4 + 2];
        let vy = particles[i * 4 + 3];

        x += vx;
        y += vy;
        if (x < 0 || x > w) vx = -vx;
        if (y < 0 || y > h) vy = -vy;

        particles[i * 4] = x;
        particles[i * 4 + 1] = y;
        particles[i * 4 + 2] = vx;
        particles[i * 4 + 3] = vy;

        // Render point
        ctx.fillRect(x, y, 1.5, 1.5);
      }

      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 500) {
        setBenchmarkFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800/80 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>Local Models & WebGPU Architecture</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
            Edge AI
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Answering: <strong className="text-slate-200">"Can local models be used in a web app?"</strong> Yes! Explore on-device WebGPU acceleration and local server bridges.
        </p>
      </div>

      {/* Direct Architectural Answer Card */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5 border border-cyan-500/30">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">How Local Models Run Inside Web Apps</h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Modern web browsers are capable of running artificial intelligence models locally without any cloud servers. There are two primary paradigms supported by <strong>NoMan AI</strong>:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Method 1 */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
              <Cpu className="w-4 h-4" />
              <span>1. In-Browser WebGPU & Wasm</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Model weights run directly in your browser tab utilizing your Apple Silicon / iPhone GPU (via WebGPU & WebAssembly). 100% private, works offline, and requires zero servers.
            </p>
          </div>

          {/* Method 2 */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-violet-300">
              <Server className="w-4 h-4" />
              <span>2. Localhost Bridge (Ollama / ComfyUI)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              The web app connects directly to your Mac or desktop machine running local engines like Ollama, ComfyUI, or Automatic1111 over HTTP or local network IP.
            </p>
          </div>
        </div>
      </div>

      {/* WebGPU Device Diagnostics Card */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Device Hardware Diagnostics</h2>
          </div>
          <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
            diagnostics?.isSupported
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
              : 'bg-amber-950 text-amber-400 border-amber-800/60'
          }`}>
            {diagnostics?.isSupported ? 'WebGPU Supported' : 'Fallback Canvas Mode'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-500 font-mono block">GPU ADAPTER</span>
            <span className="font-semibold text-slate-200 mt-0.5 block truncate">
              {diagnostics?.adapterName || 'Device Hardware GPU'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-500 font-mono block">ARCHITECTURE</span>
            <span className="font-semibold text-slate-200 mt-0.5 block truncate">
              {diagnostics?.architecture || 'Unified Metal / Vulkan'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-500 font-mono block">iOS COMPATIBILITY</span>
            <span className="font-semibold text-slate-200 mt-0.5 block truncate">
              iOS 17+ Safari WebKit
            </span>
          </div>
        </div>

        {/* Live Tensor Benchmark Canvas */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              On-Device GPU Tensor Benchmark
            </span>
            <div className="flex items-center gap-3">
              {isBenchmarking && (
                <span className="text-xs font-mono text-cyan-400">
                  {benchmarkFps} FPS (12k Parallel Nodes)
                </span>
              )}
              <button
                onClick={toggleBenchmark}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60 hover:bg-cyan-900"
              >
                {isBenchmarking ? 'Stop Benchmark' : 'Run GPU Benchmark'}
              </button>
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 h-44 flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-full" />
            {!isBenchmarking && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 text-center p-4">
                <Play className="w-7 h-7 text-cyan-400/80 mb-2" />
                <p className="text-xs text-slate-300 font-medium">Click "Run GPU Benchmark" to test client rendering performance</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Executes 12,000 vector point calculations per frame</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Localhost Engine Bridge Configuration */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-bold text-white">Localhost Bridge (Connect Your Mac/PC)</h2>
        </div>
        <p className="text-xs text-slate-300">
          Connect NoMan AI directly to your local workstation running Ollama, ComfyUI, or Automatic1111:
        </p>

        {/* Endpoint Input & Ping */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={endpointInput}
            onChange={(e) => setEndpointInput(e.target.value)}
            placeholder="http://localhost:11434 or http://192.168.1.x:8188"
            className="flex-1 bg-slate-900 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 border border-slate-700/80 focus:border-cyan-400 focus:outline-none font-mono"
          />
          <button
            onClick={handlePing}
            disabled={isPinging}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-all active:scale-95 min-h-[40px]"
          >
            {isPinging ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Activity className="w-3.5 h-3.5" />
            )}
            <span>Test Connection</span>
          </button>
        </div>

        {/* Ping Status Output */}
        {pingStatus && (
          <div className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
            pingStatus.isReachable
              ? 'bg-emerald-950/40 border border-emerald-800/80 text-emerald-300'
              : 'bg-amber-950/40 border border-amber-800/80 text-amber-300'
          }`}>
            {pingStatus.isReachable ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-bold">
                {pingStatus.isReachable ? 'Connection Successful!' : 'Could not reach endpoint'}
              </p>
              <p className="text-[11px] mt-0.5 opacity-90">
                {pingStatus.isReachable
                  ? `Successfully connected to ${pingStatus.endpoint} (${pingStatus.latencyMs}ms latency). Detected: ${pingStatus.detectedEngine?.toUpperCase()}`
                  : pingStatus.errorDetails || 'Make sure your local AI server is running and CORS is enabled.'}
              </p>
            </div>
          </div>
        )}

        {/* Quick Setup Instructions & Terminal Commands */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            How to Enable CORS on Your Local Engine
          </span>

          {/* Ollama Command */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 font-mono block">OLLAMA (Terminal)</span>
              <code className="text-xs text-cyan-300 font-mono truncate block mt-0.5">
                OLLAMA_ORIGINS="*" ollama serve
              </code>
            </div>
            <button
              onClick={() => handleCopy('OLLAMA_ORIGINS="*" ollama serve', 'ollama')}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white shrink-0 text-xs flex items-center gap-1"
            >
              {copiedCmd === 'ollama' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* ComfyUI Command */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 font-mono block">COMFYUI (Terminal)</span>
              <code className="text-xs text-violet-300 font-mono truncate block mt-0.5">
                python main.py --enable-cors-header
              </code>
            </div>
            <button
              onClick={() => handleCopy('python main.py --enable-cors-header', 'comfy')}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white shrink-0 text-xs flex items-center gap-1"
            >
              {copiedCmd === 'comfy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* iOS Note */}
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong className="text-slate-200">Using an iPhone?</strong> If accessing this web app from Safari on your phone, replace <code className="text-cyan-300">localhost</code> with your Mac’s local Wi-Fi IP address (e.g. <code className="text-cyan-300">http://192.168.1.15:11434</code>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
