import React from 'react';
import { 
  Server, 
  X, 
  Database, 
  HardDrive, 
  Cpu, 
  Layers, 
  Clock, 
  ShieldCheck, 
  GitCommit, 
  AlertTriangle,
  Activity
} from 'lucide-react';
import { ServerInstance } from '../types/dba';

interface ServerDetailModalProps {
  server: ServerInstance | null;
  onClose: () => void;
  onAskAiAboutServer: (serverName: string) => void;
}

export const ServerDetailModal: React.FC<ServerDetailModalProps> = ({
  server,
  onClose,
  onAskAiAboutServer
}) => {
  if (!server) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-bold text-white font-mono">
                  {server.name}
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                  server.status === 'healthy' ? 'bg-emerald-500/20 text-emerald-400' :
                  server.status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-rose-500/20 text-rose-400'
                }`}>
                  {server.status} • Health: {server.healthScore}%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {server.role} • {server.version} ({server.edition})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          
          {/* Quick Hardware Spec Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px] font-mono">CPU Schedulers</span>
              <span className="text-sm font-bold text-slate-200">{server.cpuCores} Cores ({server.cpuUsagePct}% used)</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px] font-mono">Memory / PLE</span>
              <span className="text-sm font-bold text-slate-200">{server.memoryUsedGB} / {server.memoryTotalGB} GB ({server.pageLifeExpectancySec}s)</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px] font-mono">Storage IO Latency</span>
              <span className="text-sm font-bold text-slate-200">Read: {server.avgReadLatencyMs}ms / Write: {server.avgWriteLatencyMs}ms</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px] font-mono">Backup Recovery Status</span>
              <span className="text-sm font-bold text-emerald-400">Full: {server.lastFullBackupHoursAgo}h ago / Log: {server.lastLogBackupMinutesAgo}m</span>
            </div>
          </div>

          {/* Hosted Databases (Section 4) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <span>Hosted Databases Inventory ({server.databases.length})</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">Section 4 Database Estate Model</span>
            </div>

            <div className="space-y-2">
              {server.databases.map((db, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-base font-bold text-white font-mono">{db.name}</span>
                      <span className="text-xs text-slate-400 ml-2">Owner: {db.owner}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-[10px]">
                      {db.criticality}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] font-mono text-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Size / Growth</span>
                      <span>{db.sizeGB} GB (+{db.growthRate30DaysPct}%/mo)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Recovery Model</span>
                      <span>{db.recoveryModel} (RPO: {db.rpoMinutes}m)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Always On HA</span>
                      <span className="text-emerald-400">{db.haStatus}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Workload Contribution</span>
                      <span>CPU: {db.cpuContributionPct}% • IO: {db.ioContributionPct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Changes History (Section 7) */}
          {server.recentChanges && server.recentChanges.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-cyan-400" />
                <span>Correlated Recent Changes (Section 7)</span>
              </h4>

              <div className="space-y-2">
                {server.recentChanges.map((chg) => (
                  <div key={chg.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-mono">{chg.id}: {chg.title}</span>
                      <span className="text-slate-400 font-mono text-[10px]">{chg.timestamp}</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{chg.description}</p>
                    {chg.correlatedAnomaly && (
                      <div className="mt-1 text-amber-300 text-[11px] flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span><strong>Correlated Anomaly:</strong> {chg.correlatedAnomaly}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Instance Telemetry Last Polled: Just now
          </span>

          <button
            onClick={() => {
              onClose();
              onAskAiAboutServer(server.name);
            }}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition cursor-pointer"
          >
            Investigate {server.name} with AI DBA →
          </button>
        </div>

      </div>
    </div>
  );
};
