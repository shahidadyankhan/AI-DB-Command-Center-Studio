import React, { useState } from 'react';
import { 
  Database, 
  ShieldAlert, 
  Cpu, 
  HardDrive, 
  AlertTriangle, 
  Sparkles, 
  Sun, 
  Search, 
  History, 
  RefreshCw, 
  Play, 
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  BookOpen,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { ServerInstance, Incident } from '../types/dba';

interface HeaderProps {
  servers: ServerInstance[];
  incidents: Incident[];
  onOpenMorningBrief: () => void;
  onOpenHumansMissed: () => void;
  onOpenAiConsole: (presetPrompt?: string) => void;
  onOpenAuditLogs: () => void;
  onOpenDocs: () => void;
  onOpenAirGapped: () => void;
  onSimulate: (scenario: 'reset' | 'spike_storage' | 'trigger_blocking') => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  servers,
  incidents,
  onOpenMorningBrief,
  onOpenHumansMissed,
  onOpenAiConsole,
  onOpenAuditLogs,
  onOpenDocs,
  onOpenAirGapped,
  onSimulate,
  isLoading
}) => {
  const [showSimMenu, setShowSimMenu] = useState(false);

  const activeIncidents = incidents.filter(i => i.status === 'ACTIVE');
  const criticalCount = activeIncidents.filter(i => i.severity === 'CRITICAL').length;
  const avgHealth = Math.round(
    servers.reduce((acc, s) => acc + s.healthScore, 0) / (servers.length || 1)
  );

  const totalBlockedSessions = servers.reduce((acc, s) => acc + s.blockedSessionsCount, 0);
  const capacityRisks = servers.filter(s => s.daysTo80PctDisk <= 90).length;

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Brand & North Star */}
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 shadow-lg shadow-cyan-500/20 text-white font-bold">
              <Database className="w-6 h-6" />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full" title="Agent Online" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  AI DBA Command Center
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/80">
                    Agent v1.0 • Autonomous DBRE
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Observe → Correlate → Predict → Explain → Recommend → Approve → Execute → Validate → Learn
              </p>
            </div>
          </div>

          {/* Quick Action Badges & AI Trigger */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Morning Briefing Trigger */}
            <button
              onClick={onOpenMorningBrief}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium transition cursor-pointer"
              title="Daily Proactive Morning Briefing (Section 20)"
            >
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Morning Brief</span>
            </button>

            {/* Find What Humans Missed Trigger */}
            <button
              onClick={onOpenHumansMissed}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition cursor-pointer"
              title="Special Proactive Mode: Detect Sub-Threshold Degradation (Section 21)"
            >
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              <span>Humans Missed</span>
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            </button>

            {/* Audit Trail Drawer Trigger */}
            <button
              onClick={onOpenAuditLogs}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              title="Auditability Log (Section 25)"
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>Audit Trail</span>
            </button>

            {/* System Docs & Setup Guide Trigger */}
            <button
              onClick={onOpenDocs}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/80 text-cyan-300 text-xs font-medium transition cursor-pointer"
              title="Complete Setup Guide & Operational Documentation"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>System Docs</span>
            </button>

            {/* Air-Gapped & Ollama Mode Trigger */}
            <button
              onClick={onOpenAirGapped}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-800/80 text-emerald-300 text-xs font-medium transition cursor-pointer"
              title="Air-Gapped & Ollama Local LLM Settings (Zero Data Egress)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ollama / Air-Gap</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>

            {/* Telemetry Simulator Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSimMenu(!showSimMenu)}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                <span>Simulate Event</span>
              </button>

              {showSimMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1 z-50 text-xs">
                  <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
                    Live Telemetry Injections
                  </div>
                  <button
                    onClick={() => { onSimulate('trigger_blocking'); setShowSimMenu(false); }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-rose-500/10 text-rose-300 flex items-center space-x-2"
                  >
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    <span>Trigger Blocking Cascade</span>
                  </button>
                  <button
                    onClick={() => { onSimulate('spike_storage'); setShowSimMenu(false); }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-amber-500/10 text-amber-300 flex items-center space-x-2"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                    <span>Inject Storage Latency Spike</span>
                  </button>
                  <button
                    onClick={() => { onSimulate('reset'); setShowSimMenu(false); }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-800 text-slate-300 flex items-center space-x-2 border-t border-slate-800 mt-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reset Estate to Baseline</span>
                  </button>
                </div>
              )}
            </div>

            {/* AI Agent Console Trigger */}
            <button
              onClick={() => onOpenAiConsole()}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/30 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-cyan-200 animate-spin" style={{ animationDuration: '4s' }} />
              <span>Ask AI DBA</span>
            </button>
          </div>
        </div>

        {/* Global Estate Health Ribbon */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          
          {/* Health Score */}
          <div className="flex items-center space-x-2.5 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
              avgHealth >= 90 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
              avgHealth >= 75 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
              'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }`}>
              {avgHealth}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Estate Health</div>
              <div className="font-semibold text-slate-200">
                {avgHealth >= 90 ? 'Healthy Estate' : avgHealth >= 75 ? 'At Risk' : 'Critical Action'}
              </div>
            </div>
          </div>

          {/* Active Incidents */}
          <div className="flex items-center space-x-2.5 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800">
            <div className={`p-1.5 rounded-lg ${
              criticalCount > 0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse' : 'bg-slate-800 text-slate-400'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Active Incidents</div>
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span>{activeIncidents.length} Active</span>
                {criticalCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/30 text-rose-300 font-bold rounded">
                    {criticalCount} P1
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Blocked Sessions */}
          <div className="flex items-center space-x-2.5 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800">
            <div className={`p-1.5 rounded-lg ${
              totalBlockedSessions > 0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-400'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Blocked Sessions</div>
              <div className="font-semibold text-slate-200">
                {totalBlockedSessions} {totalBlockedSessions === 1 ? 'SPID' : 'SPIDs'}
              </div>
            </div>
          </div>

          {/* Capacity Risks */}
          <div className="flex items-center space-x-2.5 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800">
            <div className={`p-1.5 rounded-lg ${
              capacityRisks > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'
            }`}>
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Capacity Forecast</div>
              <div className="font-semibold text-slate-200">
                {capacityRisks} Volumes &lt;90d
              </div>
            </div>
          </div>

          {/* Always On HA Status */}
          <div className="flex items-center space-x-2.5 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Always On AG</div>
              <div className="font-semibold text-slate-200">
                Synchronized
              </div>
            </div>
          </div>

          {/* Managed Instances */}
          <div className="flex items-center space-x-2.5 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Instances</div>
              <div className="font-semibold text-slate-200">
                {servers.length} Monitored
              </div>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};
