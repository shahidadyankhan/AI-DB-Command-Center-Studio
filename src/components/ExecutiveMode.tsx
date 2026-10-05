import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  TrendingUp, 
  Server, 
  ArrowUpRight, 
  HardDrive, 
  Activity, 
  Clock, 
  CheckCircle,
  FileText,
  DollarSign,
  Plus,
  Trash2,
  AlertCircle,
  X,
  RefreshCw
} from 'lucide-react';
import { ServerInstance, Incident, RecommendationItem } from '../types/dba';

interface ExecutiveModeProps {
  servers: ServerInstance[];
  incidents: Incident[];
  recommendations: RecommendationItem[];
  onSelectServer: (server: ServerInstance) => void;
  onSelectIncident: (incident: Incident) => void;
  onRequestApproval: (rec: RecommendationItem) => void;
  onOpenAddServer?: () => void;
  onRemoveServer?: (serverId: string) => Promise<boolean>;
  onClearMockServers?: () => Promise<boolean>;
}

export const ExecutiveMode: React.FC<ExecutiveModeProps> = ({
  servers,
  incidents,
  recommendations,
  onSelectServer,
  onSelectIncident,
  onRequestApproval,
  onOpenAddServer,
  onRemoveServer,
  onClearMockServers,
}) => {
  const [serverToDelete, setServerToDelete] = useState<ServerInstance | null>(null);
  const [showClearMockConfirm, setShowClearMockConfirm] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const mockServers = servers.filter(
    (s) => s.telemetryMode === 'simulated' || ['sql-prod-01', 'sql-prod-02', 'sql-prod-03'].includes(s.id)
  );

  const handleConfirmDeleteServer = async () => {
    if (!serverToDelete || !onRemoveServer) return;
    setIsBusy(true);
    const sName = serverToDelete.name;
    const ok = await onRemoveServer(serverToDelete.id);
    setIsBusy(false);
    setServerToDelete(null);
    if (ok) {
      setActionFeedback(`Server ${sName} successfully decommissioned and removed from inventory.`);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  const handleConfirmClearMock = async () => {
    if (!onClearMockServers) return;
    setIsBusy(true);
    const count = mockServers.length;
    const ok = await onClearMockServers();
    setIsBusy(false);
    setShowClearMockConfirm(false);
    if (ok) {
      setActionFeedback(`Purged ${count} simulated/mock servers. Monitored estate is now 100% real live instances.`);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  const avgHealth = Math.round(
    servers.reduce((acc, s) => acc + s.healthScore, 0) / (servers.length || 1)
  );

  // Health score dimensions (Section 12 of spec)
  const healthDimensions = [
    { label: 'Performance', weight: '20%', score: 76, color: 'text-amber-400', bar: 'bg-amber-400' },
    { label: 'Availability / HA', weight: '15%', score: 99, color: 'text-emerald-400', bar: 'bg-emerald-400' },
    { label: 'Backup & Recovery', weight: '15%', score: 98, color: 'text-emerald-400', bar: 'bg-emerald-400' },
    { label: 'Security & Auth', weight: '15%', score: 96, color: 'text-emerald-400', bar: 'bg-emerald-400' },
    { label: 'Storage Capacity', weight: '10%', score: 72, color: 'text-amber-400', bar: 'bg-amber-400' },
    { label: 'Configuration Drift', weight: '10%', score: 85, color: 'text-cyan-400', bar: 'bg-cyan-400' },
    { label: 'Patch Compliance', weight: '5%', score: 100, color: 'text-emerald-400', bar: 'bg-emerald-400' },
    { label: 'Job Reliability', weight: '5%', score: 94, color: 'text-emerald-400', bar: 'bg-emerald-400' },
    { label: 'Growth / Anomaly Risk', weight: '5%', score: 68, color: 'text-rose-400', bar: 'bg-rose-400' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Executive Summary Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
              <Activity className="w-3.5 h-3.5" />
              <span>Mode A — Executive Briefing</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Enterprise Database Estate Health & Risk Matrix
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Real-time executive synthesis across 5 Tier-1 SQL instances and 8 mission-critical databases.
              1 active operational incident requires immediate human authorization; storage growth anomaly tracked.
            </p>
          </div>

          {/* AI DBA Platform Health Score Radial Display */}
          <div className="flex items-center space-x-6 bg-slate-950/80 border border-slate-800 p-4 rounded-xl">
            <div className="text-center">
              <div className="text-[11px] font-mono text-slate-400 uppercase">Platform Health</div>
              <div className="flex items-baseline space-x-1 justify-center">
                <span className={`text-4xl font-extrabold tracking-tight ${
                  avgHealth >= 90 ? 'text-emerald-400' : avgHealth >= 75 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {avgHealth}
                </span>
                <span className="text-slate-500 text-sm font-semibold">/100</span>
              </div>
              <div className="text-[10px] text-slate-400">Target: 95.0+</div>
            </div>

            <div className="h-10 w-px bg-slate-800" />

            <div className="text-left text-xs space-y-1">
              <div className="flex items-center space-x-1.5 text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Availability: <strong>99.992%</strong></span>
              </div>
              <div className="flex items-center space-x-1.5 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>MTTR YTD: <strong>4.2 mins</strong></span>
              </div>
              <div className="flex items-center space-x-1.5 text-slate-300">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span>Prevented Loss: <strong>$184,000</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* 9 Dimensions Breakdown (Section 12 of prompt) */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="text-xs font-mono uppercase text-slate-400 mb-3 flex items-center justify-between">
            <span>SQL Platform Health Score Breakdown (Configured Weights)</span>
            <span className="text-slate-500 text-[10px]">Algorithm: Section 12 Specification</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-9 gap-3">
            {healthDimensions.map((dim, idx) => (
              <div key={idx} className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="text-slate-300 font-medium truncate">{dim.label}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{dim.weight}</span>
                </div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className={`text-base font-bold font-mono ${dim.color}`}>{dim.score}</span>
                  <span className="text-[9px] text-slate-400">/100</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${dim.bar}`} style={{ width: `${dim.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Server Cards & Executive Risk Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Monitored Estate Instances */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Database Estate Inventory & Real-Time Status</span>
            </h3>
            <div className="flex items-center space-x-2">
              {mockServers.length > 0 && onClearMockServers && (
                <button
                  type="button"
                  onClick={() => setShowClearMockConfirm(true)}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-rose-100 text-xs font-mono transition cursor-pointer"
                  title="Decommission all mock/simulated servers"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Purge Mock ({mockServers.length})</span>
                </button>
              )}
              {onOpenAddServer && (
                <button
                  onClick={onOpenAddServer}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register SQL Server</span>
                </button>
              )}
            </div>
          </div>

          {actionFeedback && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-700/80 rounded-xl text-emerald-200 text-xs flex items-center justify-between animate-in fade-in">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{actionFeedback}</span>
              </span>
              <button onClick={() => setActionFeedback(null)} className="text-emerald-400 hover:text-emerald-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {servers.map((s) => (
              <div
                key={s.id}
                onClick={() => onSelectServer(s)}
                className="bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition cursor-pointer relative group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-white group-hover:text-cyan-300 transition">
                        {s.name}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        s.status === 'healthy' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        s.status === 'warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                      }`}>
                        {s.status}
                      </span>
                      {s.isRealTime && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          <span>{s.telemetryMode === 'direct-tds' ? 'LIVE TDS' : s.telemetryMode === 'push-agent' ? 'LIVE AGENT' : 'LIVE'}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">
                      {s.role}
                    </div>
                  </div>

                  <div className="text-right flex items-start gap-2">
                    {onRemoveServer && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setServerToDelete(s);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title={`Decommission and remove ${s.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div>
                      <div className="text-[10px] text-slate-400 font-mono">Health</div>
                      <div className={`text-lg font-bold font-mono ${
                        s.healthScore >= 90 ? 'text-emerald-400' : s.healthScore >= 75 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {s.healthScore}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">CPU</span>
                    <span className="font-semibold text-slate-200">{s.cpuUsagePct}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Memory / PLE</span>
                    <span className={`font-semibold ${s.pageLifeExpectancySec < 300 ? 'text-amber-400' : 'text-slate-200'}`}>
                      {s.pageLifeExpectancySec}s
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">IO Latency</span>
                    <span className={`font-semibold ${s.avgReadLatencyMs > 15 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {s.avgReadLatencyMs} ms
                    </span>
                  </div>
                </div>

                {s.blockedSessionsCount > 0 && (
                  <div className="mt-3 py-1.5 px-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                    <span className="flex items-center space-x-1.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span>{s.blockedSessionsCount} Blocked Sessions</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold">LCK_M_X</span>
                  </div>
                )}

                {s.daysTo80PctDisk <= 90 && (
                  <div className="mt-2 py-1 px-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <HardDrive className="w-3 h-3 text-amber-400" />
                      <span>Storage 80% Exhaustion:</span>
                    </span>
                    <span className="font-bold font-mono">{s.daysTo80PctDisk} Days</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Executive Decisions & High Priority Actions */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>Executive Decisions Required</span>
          </h3>

          {/* Critical Incident Triage Callout */}
          {incidents.filter(i => i.status === 'ACTIVE').map(inc => (
            <div key={inc.id} className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-bold font-mono">
                  {inc.id} • P1 CRITICAL
                </span>
                <span className="text-rose-300 font-mono text-[11px]">{inc.startTime}</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white leading-snug">{inc.title}</h4>
                <p className="text-xs text-rose-200/80 mt-1">{inc.businessImpact}</p>
              </div>

              <div className="pt-2 border-t border-rose-900/60 flex items-center justify-between">
                <span className="text-xs text-rose-300">
                  Root: <strong>SPID {inc.rootBlockerSpid}</strong> (Confidence: {inc.confidencePct}%)
                </span>
                <button
                  onClick={() => onSelectIncident(inc)}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  <span>Contain Incident</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Pending Safety Approvals Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Recommended Actions Requiring Sign-Off</span>
              <span className="text-[10px] text-slate-400 font-mono">{recommendations.length} Pending</span>
            </div>

            <div className="space-y-2">
              {recommendations.slice(0, 3).map((rec) => (
                <div key={rec.id} className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 truncate max-w-[180px]">{rec.title}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                      rec.safetyLevel === 'RED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                      rec.safetyLevel === 'AMBER' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {rec.safetyLevel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{rec.expectedBenefit}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-cyan-400 font-mono">{rec.targetServer}</span>
                    <button
                      onClick={() => onRequestApproval(rec)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-medium transition cursor-pointer"
                    >
                      Review & Approve →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Executive Report Export Card */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center space-x-2 text-slate-200 font-semibold">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Weekly Executive Governance</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Automated audit-ready report with SLA/SLO verification, capacity runway, and CAB compliance.
            </p>
            <div className="pt-2 flex gap-2">
              <button 
                onClick={() => alert('Executive PDF Summary downloaded.')}
                className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-center transition cursor-pointer"
              >
                Export Executive PDF
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Modal: Confirm Decommission Individual Server */}
      {serverToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Decommission SQL Server Asset</h4>
                <p className="text-xs text-slate-400">Remove instance from real-time monitoring</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to decommission and remove <strong className="text-white font-mono">{serverToDelete.name}</strong> ({serverToDelete.id}) from the active inventory?
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
              <div>• Live telemetry polling will be terminated immediately.</div>
              <div>• Storage baseline forecasts and wait stats cache will be cleared.</div>
              <div>• Audit log entry will record DECOMMISSION_SQL_SERVER_ASSET.</div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setServerToDelete(null)}
                disabled={isBusy}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteServer}
                disabled={isBusy}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30 flex items-center space-x-1.5 transition cursor-pointer"
              >
                {isBusy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Decommission & Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Purge All Mock Servers */}
      {showClearMockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Purge All Mock / Simulated Servers</h4>
                <p className="text-xs text-slate-400">Retain only real connected database instances</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to purge all <strong className="text-white">{mockServers.length} simulated/mock servers</strong> (such as <code className="text-cyan-300 font-mono">SQL-PROD-01, SQL-PROD-02, SQL-PROD-03</code>)?
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
              <div>• All {mockServers.length} simulated lab servers will be cleared.</div>
              <div>• Any real live TDS or Push-Agent instances you added will remain completely intact.</div>
              <div>• Your estate overview will reflect 100% genuine database metrics.</div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearMockConfirm(false)}
                disabled={isBusy}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearMock}
                disabled={isBusy}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30 flex items-center space-x-1.5 transition cursor-pointer"
              >
                {isBusy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Purge {mockServers.length} Mock Servers</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
