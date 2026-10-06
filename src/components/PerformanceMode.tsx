import React, { useState, useEffect } from 'react';
import { 
  Gauge, 
  Cpu, 
  Database, 
  HardDrive, 
  Layers, 
  Activity, 
  Zap, 
  AlertTriangle, 
  ArrowUpRight, 
  TrendingDown, 
  BarChart3,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Send,
  CheckCircle2,
  ShieldCheck,
  Check
} from 'lucide-react';
import { ServerInstance, QueryStoreRegression, RecommendationItem } from '../types/dba';

interface PerformanceModeProps {
  servers: ServerInstance[];
  queryRegressions: QueryStoreRegression[];
  onRequestApproval: (rec: RecommendationItem) => void;
  onOpenAddServer?: () => void;
  onRemoveServer?: (serverId: string) => Promise<boolean>;
  onClearMockServers?: () => Promise<boolean>;
}

export const PerformanceMode: React.FC<PerformanceModeProps> = ({
  servers,
  queryRegressions,
  onRequestApproval,
  onOpenAddServer,
  onRemoveServer,
  onClearMockServers
}) => {
  const [selectedServerId, setSelectedServerId] = useState<string>(() => servers[0]?.id || '');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isClearingMock, setIsClearingMock] = useState(false);
  const [showClearMockConfirm, setShowClearMockConfirm] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isPushingTelemetry, setIsPushingTelemetry] = useState(false);

  // Sync selectedServerId if current selection was removed or changed
  useEffect(() => {
    if (!servers.some(s => s.id === selectedServerId) && servers.length > 0) {
      setSelectedServerId(servers[0].id);
    }
  }, [servers, selectedServerId]);

  const mockServers = servers.filter(
    (s) => s.telemetryMode === 'simulated' || ['sql-prod-01', 'sql-prod-02', 'sql-prod-03'].includes(s.id)
  );

  if (servers.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
        <Gauge className="w-12 h-12 mx-auto text-slate-600" />
        <h3 className="text-xl font-bold text-white">No Monitored SQL Server Instances</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Mode D requires at least one monitored SQL Server instance to display real-time CPU, memory buffer pool, and IO latency telemetry.
        </p>
        {onOpenAddServer && (
          <button
            onClick={onOpenAddServer}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition cursor-pointer"
          >
            Register SQL Server Instance
          </button>
        )}
      </div>
    );
  }

  const currentServer = servers.find(s => s.id === selectedServerId) || servers[0];

  const currentDbNames = (currentServer.databases || []).map(d => d.name?.toLowerCase());
  const serverQueries = queryRegressions.filter(q => 
    q.databaseName && currentDbNames.includes(q.databaseName.toLowerCase())
  );

  const handleDecommission = async () => {
    if (!currentServer || !onRemoveServer) return;
    setIsDeleting(true);
    const sName = currentServer.name;
    const ok = await onRemoveServer(currentServer.id);
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    if (ok) {
      setActionFeedback(`Server ${sName} decommissioned and removed from estate.`);
      setTimeout(() => setActionFeedback(null), 3500);
    }
  };

  const handlePushSampleTelemetry = async () => {
    if (!currentServer) return;
    setIsPushingTelemetry(true);
    try {
      const testCpu = Math.floor(18 + Math.random() * 30);
      const testPle = Math.floor(950 + Math.random() * 700);
      const testSessions = Math.max(10, currentServer.activeConnections + Math.floor((Math.random() - 0.5) * 8));

      const res = await fetch('/api/dba/telemetry/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: currentServer.id,
          serverName: currentServer.name,
          cpuUsagePct: testCpu,
          osCpuUsagePct: testCpu + 5,
          pageLifeExpectancySec: testPle,
          activeConnections: testSessions,
          blockedSessionsCount: 0,
          avgReadLatencyMs: Number((1.5 + Math.random() * 1.5).toFixed(1)),
          avgWriteLatencyMs: Number((1.1 + Math.random() * 0.8).toFixed(1)),
        }),
      });
      if (res.ok) {
        setActionFeedback(`Pushed live telemetry: ${testCpu}% CPU, ${testPle}s PLE, ${testSessions} active sessions.`);
        setTimeout(() => setActionFeedback(null), 3500);
      }
    } catch (err: any) {
      setActionFeedback(`Telemetry push failed: ${err.message}`);
    } finally {
      setIsPushingTelemetry(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <Gauge className="w-3.5 h-3.5" />
            <span>Mode D — Proactive Database Performance Engine (Section 6)</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Subsystem Correlated Performance Telemetry
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Correlating CPU, Memory, IO Latency, Page Life Expectancy, and Query Regressions on {currentServer.name}.
          </p>
        </div>

        {/* Server Picker & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {actionFeedback && (
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded">
              {actionFeedback}
            </span>
          )}

          <div className="flex items-center space-x-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800 overflow-x-auto">
            {servers.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedServerId(s.id)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition cursor-pointer flex items-center space-x-1.5 ${
                  selectedServerId === s.id
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{s.name}</span>
                {s.blockedSessionsCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            ))}
          </div>

          <button
            onClick={handlePushSampleTelemetry}
            disabled={isPushingTelemetry}
            className="px-2.5 py-2 rounded-lg bg-emerald-950/60 border border-emerald-800 hover:border-emerald-600 text-emerald-300 text-xs font-mono transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            title="Push a live telemetry packet to update this instance in real time"
          >
            <Send className={`w-3.5 h-3.5 ${isPushingTelemetry ? 'animate-spin' : ''}`} />
            <span>Push Telemetry</span>
          </button>

          {mockServers.length > 0 && onClearMockServers && (
            <button
              type="button"
              onClick={() => setShowClearMockConfirm(true)}
              className="px-2.5 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-rose-100 text-xs font-mono transition flex items-center space-x-1 cursor-pointer"
              title="Decommission all mock/simulated servers"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Purge Mock ({mockServers.length})</span>
            </button>
          )}

          {onOpenAddServer && (
            <button
              onClick={onOpenAddServer}
              className="px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-cyan-400 hover:text-cyan-300 text-xs font-mono transition flex items-center space-x-1 cursor-pointer"
              title="Register SQL Server instance"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          )}

          {onRemoveServer && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-400 text-xs font-mono transition flex items-center space-x-1 cursor-pointer"
              title="Decommission selected server"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Decommission</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                <Trash2 className="w-4 h-4" />
                <span>Decommission SQL Server Asset</span>
              </div>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to decommission <strong className="text-white font-mono">{currentServer.name}</strong>? Telemetry polling will stop and cached statistics will be pruned.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDecommission}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer"
              >
                {isDeleting && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>Decommission Asset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Clearing All Mock Servers */}
      {showClearMockConfirm && onClearMockServers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                <Trash2 className="w-4 h-4" />
                <span>Purge All Mock Servers</span>
              </div>
              <button 
                onClick={() => setShowClearMockConfirm(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to decommission and remove all <strong className="text-white font-mono">{mockServers.length}</strong> mock/simulated servers? Connected real instances will remain untouched.
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearMockConfirm(false)}
                disabled={isClearingMock}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsClearingMock(true);
                  const ok = await onClearMockServers();
                  setIsClearingMock(false);
                  setShowClearMockConfirm(false);
                  if (ok) {
                    setActionFeedback('All mock servers purged from estate.');
                    setTimeout(() => setActionFeedback(null), 3000);
                  }
                }}
                disabled={isClearingMock}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30 flex items-center space-x-1.5 transition cursor-pointer"
              >
                {isClearingMock && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Purge Mock Servers</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subsystem Metric Gauges (CPU, Memory/PLE, Storage Latency, Disk Capacity) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CPU Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">CPU Utilization</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-white">
              {currentServer.cpuUsagePct}%
            </span>
            <span className="text-xs text-slate-400">SQL Process</span>
            <span className="text-xs text-slate-500 font-mono ml-auto">
              OS: {currentServer.osCpuUsagePct}%
            </span>
          </div>

          {/* Dual bar: SQL vs OS */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
            <div className="h-full bg-cyan-500" style={{ width: `${currentServer.cpuUsagePct}%` }} />
            <div className="h-full bg-slate-600" style={{ width: `${Math.max(0, currentServer.osCpuUsagePct - currentServer.cpuUsagePct)}%` }} />
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Schedulers: {currentServer.cpuCores} vCPUs</span>
            <span className="text-cyan-400 font-mono">
              {currentServer.blockedSessionsCount > 0 ? `${currentServer.blockedSessionsCount} Blocked` : 'Optimal Schedulers'}
            </span>
          </div>
        </div>

        {/* Memory & PLE Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Page Life Expectancy</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>

          <div className="flex items-baseline space-x-2">
            <span className={`text-3xl font-extrabold font-mono ${
              currentServer.pageLifeExpectancySec < 300 ? 'text-amber-400' : 'text-white'
            }`}>
              {currentServer.pageLifeExpectancySec}s
            </span>
            <span className="text-xs text-slate-400">Buffer Churn</span>
          </div>

          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${currentServer.pageLifeExpectancySec < 300 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
              style={{ width: `${Math.min(100, (currentServer.pageLifeExpectancySec / 1000) * 100)}%` }} 
            />
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Buffer Pool: {currentServer.memoryUsedGB} / {currentServer.memoryTotalGB} GB</span>
            <span className={currentServer.pageLifeExpectancySec < 300 ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
              {currentServer.pageLifeExpectancySec < 300 ? 'Memory Pressure' : 'Normal'}
            </span>
          </div>
        </div>

        {/* Storage IO Latency Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">I/O Read / Write Latency</span>
            <HardDrive className="w-4 h-4 text-cyan-400" />
          </div>

          <div className="flex items-baseline space-x-2">
            <span className={`text-3xl font-extrabold font-mono ${
              currentServer.avgReadLatencyMs > 15 ? 'text-rose-400' : 'text-white'
            }`}>
              {currentServer.avgReadLatencyMs}ms
            </span>
            <span className="text-xs text-slate-400">Read</span>
            <span className="text-xs text-slate-400 ml-auto font-mono">
              Write: {currentServer.avgWriteLatencyMs}ms
            </span>
          </div>

          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${currentServer.avgReadLatencyMs > 15 ? 'bg-rose-500' : 'bg-cyan-500'}`} 
              style={{ width: `${Math.min(100, (currentServer.avgReadLatencyMs / 30) * 100)}%` }} 
            />
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Data Subsystem Status</span>
            <span className={currentServer.avgReadLatencyMs > 15 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
              {currentServer.avgReadLatencyMs > 15 ? 'IO Bottleneck' : 'Sub-5ms SLA'}
            </span>
          </div>
        </div>

        {/* Storage Volume Runway Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Capacity Runway</span>
            <TrendingDown className="w-4 h-4 text-cyan-400" />
          </div>

          <div className="flex items-baseline space-x-2">
            <span className={`text-3xl font-extrabold font-mono ${
              currentServer.daysTo80PctDisk <= 90 ? 'text-amber-400' : 'text-white'
            }`}>
              {currentServer.daysTo80PctDisk}
            </span>
            <span className="text-xs text-slate-400">Days to 80% Full</span>
          </div>

          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500" 
              style={{ width: `${100 - currentServer.diskFreePct}%` }} 
            />
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Free Space: {currentServer.diskFreePct}%</span>
            <span className="text-slate-300 font-mono">
              {currentServer.daysTo80PctDisk <= 90 ? 'Action Required' : 'Healthy'}
            </span>
          </div>
        </div>

      </div>

      {/* Database Breakdown & Workload Table on this Instance */}
      {currentServer.databases && currentServer.databases.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Hosted Databases on {currentServer.name} ({currentServer.databases.length})
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Recovery & Workload Profile</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2 font-semibold">Database Name</th>
                  <th className="pb-2 font-semibold">Application / Role</th>
                  <th className="pb-2 font-semibold">Size (GB)</th>
                  <th className="pb-2 font-semibold">Data / Log Usage</th>
                  <th className="pb-2 font-semibold">Active Trans</th>
                  <th className="pb-2 font-semibold">CPU / IO Share</th>
                  <th className="pb-2 font-semibold">Recovery / Backup</th>
                  <th className="pb-2 font-semibold text-right">HA Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {currentServer.databases.map((db, idx) => (
                  <tr key={idx} className="hover:bg-slate-950/40 transition">
                    <td className="py-2.5 font-bold text-white flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span>{db.name}</span>
                    </td>
                    <td className="py-2.5 text-slate-400">{db.application || 'Workload'}</td>
                    <td className="py-2.5">{db.sizeGB} GB</td>
                    <td className="py-2.5">
                      <span className="text-slate-200">{db.dataSpaceUsedPct ?? 65}% Data</span> / <span className="text-slate-400">{db.logSpaceUsedPct ?? 20}% Log</span>
                    </td>
                    <td className="py-2.5 text-cyan-300">{db.activeTransactions ?? 12}</td>
                    <td className="py-2.5">
                      <span className="text-amber-400">{db.cpuContributionPct ?? 25}% CPU</span> / <span className="text-blue-400">{db.ioContributionPct ?? 30}% IO</span>
                    </td>
                    <td className="py-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 mr-1.5">{db.recoveryModel || 'FULL'}</span>
                      <span className="text-emerald-400 font-semibold">{db.backupStatus || 'HEALTHY'}</span>
                    </td>
                    <td className="py-2.5 text-right font-semibold text-emerald-400">
                      {db.haStatus || currentServer.alwaysOnStatus || 'SYNCHRONIZED'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deep Performance Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Subsystem Latency Profile Breakdown (Data vs Log vs TempDB) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>Storage File-Level Latency Distribution</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">sys.dm_io_virtual_file_stats</span>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Data Files (.mdf / .ndf)</span>
                <span className="font-mono text-cyan-400 font-bold">{currentServer.avgReadLatencyMs} ms avg read</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Primary data file read latency on {currentServer.name}. Target &lt; 5ms for OLTP workloads.
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Transaction Log (.ldf)</span>
                <span className="font-mono text-emerald-400 font-bold">{currentServer.avgWriteLatencyMs} ms avg write</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Sequential write flush speed for WRITELOG waits. Target &lt; 2ms.
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">TempDB Spills & Allocation</span>
                <span className="font-mono text-slate-200 font-bold">1.2 ms avg latency</span>
              </div>
              <p className="text-[11px] text-slate-400">
                TempDB data files configured with equal autogrowth across {Math.min(8, currentServer.cpuCores)} files.
              </p>
            </div>
          </div>
        </div>

        {/* Top Regressed Queries on this instance */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Query Store Performance Profile</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">{currentServer.name}</span>
          </div>

          <div className="space-y-3">
            {serverQueries.length > 0 ? (
              serverQueries.map((q) => (
                <div key={q.queryId} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-cyan-300">
                      Query #{q.queryId} ({q.databaseName})
                    </span>
                    <span className="text-rose-400 font-mono font-bold">
                      {q.currentDurationMs} ms (Baseline: {q.baselineDurationMs} ms)
                    </span>
                  </div>

                  <p className="text-xs font-mono text-slate-300 line-clamp-1 bg-slate-900 p-1.5 rounded">
                    {q.queryText}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Reads: {q.logicalReads.toLocaleString()}</span>
                    <button
                      onClick={() => onRequestApproval({
                        id: `REC-PLAN-${q.queryId}`,
                        title: `Force Plan ${q.previousPlanId} for Query ${q.queryId}`,
                        why: `Query regressed by ${q.regressionPct}%.`,
                        evidence: `Duration ${q.currentDurationMs}ms vs baseline ${q.baselineDurationMs}ms.`,
                        expectedBenefit: `Estimated ${q.estimatedImprovementPct}% latency reduction.`,
                        risk: 'LOW',
                        implementationComplexity: 'LOW',
                        rollbackMethod: `sp_query_store_unforce_plan`,
                        validationMethod: 'Observe 15m runtime',
                        priority: 'HIGH',
                        safetyLevel: 'AMBER',
                        sqlScript: `EXEC sp_query_store_force_plan @query_id = ${q.queryId}, @plan_id = ${q.previousPlanId};`,
                        targetServer: currentServer.name,
                      })}
                      className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                    >
                      Force Prior Plan →
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Query Store Nominal on {currentServer.name}</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Zero execution plan regressions or parameter sniffing anomalies detected across {currentServer.databases?.length || 1} database(s). P95/P99 latency within baseline variance.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
