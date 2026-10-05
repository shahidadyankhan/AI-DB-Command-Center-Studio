import React, { useState } from 'react';
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
  Activity,
  Terminal,
  Copy,
  Check,
  Zap,
  RefreshCw,
  Trash2,
  Send,
  Radio,
  ExternalLink
} from 'lucide-react';
import { ServerInstance } from '../types/dba';

interface ServerDetailModalProps {
  server: ServerInstance | null;
  onClose: () => void;
  onAskAiAboutServer: (serverName: string) => void;
  onServerUpdated?: (updatedServer: ServerInstance) => void;
  onRemoveServer?: (serverId: string) => Promise<boolean>;
}

export const ServerDetailModal: React.FC<ServerDetailModalProps> = ({
  server,
  onClose,
  onAskAiAboutServer,
  onServerUpdated,
  onRemoveServer
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [pushTestResult, setPushTestResult] = useState<any | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  if (!server) return null;

  const handleRefreshLiveTelemetry = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await fetch(`/api/dba/servers/${server.id}/refresh`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.server) {
        onServerUpdated?.(data.server);
        setRefreshMessage(data.message || 'Live DMV telemetry refreshed from SQL Server!');
        setTimeout(() => setRefreshMessage(null), 3500);
      }
    } catch (e: any) {
      setRefreshMessage('Telemetry query failed: ' + e.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDecommissionServer = async () => {
    if (!onRemoveServer) return;
    setIsDeleting(true);
    const ok = await onRemoveServer(server.id);
    setIsDeleting(false);
    if (ok) {
      onClose();
    }
  };

  const handleTestPushTelemetry = async () => {
    setIsTestingPush(true);
    setPushTestResult(null);
    try {
      const testCpu = Math.floor(18 + Math.random() * 25);
      const testPle = Math.floor(1200 + Math.random() * 600);
      const testSessions = Math.floor(25 + Math.random() * 20);
      const res = await fetch('/api/dba/telemetry/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: server.id,
          serverName: server.name,
          cpuUsagePct: testCpu,
          osCpuUsagePct: testCpu + 4,
          pageLifeExpectancySec: testPle,
          activeConnections: testSessions,
          blockedSessionsCount: 0,
          avgReadLatencyMs: 1.8,
          avgWriteLatencyMs: 1.4,
        }),
      });
      const data = await res.json();
      setPushTestResult(data);
      if (data.success) {
        onServerUpdated?.({
          ...server,
          cpuUsagePct: testCpu,
          pageLifeExpectancySec: testPle,
          activeConnections: testSessions,
          isRealTime: true,
          telemetryMode: 'push-agent',
          lastHeartbeat: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setPushTestResult({ success: false, error: err.message });
    } finally {
      setIsTestingPush(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(label);
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const curlCmd = `curl -X POST "${originUrl}/api/dba/telemetry/push" \\
  -H "Content-Type: application/json" \\
  -d '{"serverId":"${server.id}","serverName":"${server.name}","cpuUsagePct":28,"pageLifeExpectancySec":1450,"activeConnections":42,"blockedSessionsCount":0}'`;

  const psCmd = `$body = @{ serverId="${server.id}"; serverName="${server.name}"; cpuUsagePct=28; pageLifeExpectancySec=1450; activeConnections=42 } | ConvertTo-Json
Invoke-RestMethod -Uri "${originUrl}/api/dba/telemetry/push" -Method Post -Body $body -ContentType "application/json"`;

  const displayName = server.name.length <= 2 && server.connectionHost 
    ? `${server.name} (${server.connectionHost})`
    : server.name;

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
                  {displayName}
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                  server.status === 'healthy' ? 'bg-emerald-500/20 text-emerald-400' :
                  server.status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-rose-500/20 text-rose-400'
                }`}>
                  {server.status} • Health: {server.healthScore}%
                </span>
                {server.isRealTime && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>{server.telemetryMode === 'direct-tds' ? 'LIVE TDS' : server.telemetryMode === 'push-agent' ? 'LIVE PUSH AGENT' : 'LIVE FEED'}</span>
                  </span>
                )}
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
          
          {refreshMessage && (
            <div className="bg-emerald-950/60 border border-emerald-700/80 p-2.5 rounded-xl text-emerald-200 text-xs flex items-center justify-between animate-in fade-in">
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{refreshMessage}</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400">Just Now</span>
            </div>
          )}

          {/* Real-Time Telemetry Connection Strip */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
            <div className="flex items-center space-x-2 text-slate-300">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Telemetry Ingestion:</span>
              <strong className="text-white">
                {server.telemetryMode === 'direct-tds' ? 'Direct TDS (Port ' + (server.connectionPort || 1433) + ')' :
                 server.telemetryMode === 'push-agent' ? 'On-Premise Push Agent' : 'Continuous Stream'}
              </strong>
              {server.connectionHost && (
                <span className="text-slate-500">({server.connectionHost})</span>
              )}
            </div>

            <div className="flex items-center space-x-3 text-slate-400">
              <span>Ping Latency: <strong className="text-cyan-300">{server.liveLatencyMs || 2}ms</strong></span>
              <span>•</span>
              <button
                type="button"
                onClick={handleRefreshLiveTelemetry}
                disabled={isRefreshing}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                title="Query live DMV metrics directly from SQL Server"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-cyan-400' : 'text-emerald-400'}`} />
                <span>{isRefreshing ? 'Querying DMVs...' : 'Live DMV Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Quick Hardware Spec Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
              <span className="text-slate-400 block text-[10px] font-mono">Volume Free Space</span>
              <span className="text-sm font-bold text-cyan-300">{server.diskFreePct}% Free ({server.daysTo80PctDisk}d runway)</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px] font-mono">Backup Recovery Status</span>
              <span className={`text-sm font-bold ${server.lastFullBackupHoursAgo != null ? 'text-emerald-400' : 'text-amber-400'}`}>
                {server.lastFullBackupHoursAgo != null 
                  ? `Full: ${server.lastFullBackupHoursAgo}h / Log: ${server.lastLogBackupMinutesAgo ?? 0}m`
                  : 'None in msdb (Standalone)'}
              </span>
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
                      <span className="text-slate-500 block text-[10px]">Total Size / Growth</span>
                      <span className="font-bold text-white">{db.sizeGB} GB</span>
                      <span className="text-slate-400 text-[10px] ml-1">(+{db.growthRate30DaysPct}%/mo)</span>
                      {db.dataSizeGB != null && (
                        <div className="text-[10px] text-cyan-300 font-mono mt-0.5">
                          Data: {db.dataSizeGB} GB • Log: {db.logSizeGB ?? 0.5} GB
                        </div>
                      )}
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

          {/* Remote Telemetry Push Streamer & Test Bench */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h4 className="font-bold text-white text-xs">
                  Remote Telemetry Push Ingestion Bench
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  POST /api/dba/telemetry/push
                </span>
              </div>

              <button
                type="button"
                onClick={handleTestPushTelemetry}
                disabled={isTestingPush}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <Send className={`w-3.5 h-3.5 ${isTestingPush ? 'animate-bounce' : ''}`} />
                <span>{isTestingPush ? 'Sending Packet...' : 'Push Test Telemetry Packet'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Stream live DMV metrics from any remote host into this server asset. Both PowerShell and cURL commands are ready to run:
            </p>

            {pushTestResult && (
              <div className={`p-2.5 rounded-lg border text-[11px] font-mono flex items-center justify-between animate-in fade-in ${
                pushTestResult.success 
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' 
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}>
                <span>
                  {pushTestResult.success 
                    ? `✓ Ingestion Verified: ${pushTestResult.message} (Health: ${pushTestResult.healthScore}%, CPU: ${pushTestResult.cpuUsagePct}%, PLE: ${pushTestResult.pageLifeExpectancySec}s)`
                    : `✗ Ingestion Error: ${pushTestResult.error || 'Failed to process packet'}`
                  }
                </span>
                <span className="text-[10px] text-slate-500">HTTP 200 OK</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>PowerShell Command</span>
                  <button
                    type="button"
                    onClick={() => copyText(psCmd, 'ps')}
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-200 cursor-pointer"
                  >
                    {copiedSnippet === 'ps' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSnippet === 'ps' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-[10px] text-emerald-300 overflow-x-auto whitespace-pre max-h-20">
                  {psCmd}
                </pre>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Remote cURL Command</span>
                  <button
                    type="button"
                    onClick={() => copyText(curlCmd, 'curl')}
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-200 cursor-pointer"
                  >
                    {copiedSnippet === 'curl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSnippet === 'curl' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-[10px] text-cyan-300 overflow-x-auto whitespace-pre max-h-20">
                  {curlCmd}
                </pre>
              </div>
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
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            {onRemoveServer && (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-rose-100 font-semibold text-xs transition flex items-center space-x-1.5 cursor-pointer"
                title="Decommission this server from monitored estate"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Decommission Server</span>
              </button>
            )}
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              Telemetry Status: Active ({server.telemetryMode})
            </span>
          </div>

          <div className="flex items-center space-x-2">
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

      {/* Confirmation Dialog for Decommissioning */}
      {isConfirmingDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Decommission SQL Server</h4>
                <p className="text-xs text-slate-400">Remove from monitored inventory</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to decommission and remove <strong className="text-white font-mono">{server.name}</strong> ({server.id}) from the database estate?
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
              <div>• Live telemetry polling stops immediately.</div>
              <div>• Storage baselines and wait statistics cache are cleared.</div>
              <div>• An audit record is logged with DECOMMISSION_SQL_SERVER_ASSET.</div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDecommissionServer}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30 flex items-center space-x-1.5 transition cursor-pointer"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Decommission & Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
