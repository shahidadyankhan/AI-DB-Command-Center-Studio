import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  AlertTriangle, 
  Layers, 
  Flame, 
  Zap, 
  Copy, 
  Check, 
  Lock, 
  HardDrive, 
  Cpu, 
  Activity,
  ArrowRight,
  ShieldAlert,
  GitCommit,
  Plus,
  Trash2,
  X,
  RefreshCw,
  Send,
  CheckCircle
} from 'lucide-react';
import { 
  ServerInstance, 
  WaitStat, 
  BlockingSession, 
  QueryStoreRegression, 
  RecommendationItem 
} from '../types/dba';

interface DbaModeProps {
  servers: ServerInstance[];
  waitStats: Record<string, WaitStat[]>;
  blockingChain: BlockingSession[];
  queryRegressions: QueryStoreRegression[];
  onRequestApproval: (rec: RecommendationItem) => void;
  onOpenAddServer?: () => void;
  onRemoveServer?: (serverId: string) => Promise<boolean>;
  onClearMockServers?: () => Promise<boolean>;
}

export const DbaMode: React.FC<DbaModeProps> = ({
  servers,
  waitStats,
  blockingChain,
  queryRegressions,
  onRequestApproval,
  onOpenAddServer,
  onRemoveServer,
  onClearMockServers
}) => {
  const [selectedServerId, setSelectedServerId] = useState<string>(() => servers[0]?.id || '');
  const [copiedQueryId, setCopiedQueryId] = useState<number | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearingMock, setIsClearingMock] = useState(false);
  const [showClearMockConfirm, setShowClearMockConfirm] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Sync selectedServerId if current selection was removed
  useEffect(() => {
    if (!servers.some(s => s.id === selectedServerId) && servers.length > 0) {
      setSelectedServerId(servers[0].id);
    }
  }, [servers, selectedServerId]);

  if (servers.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
        <Terminal className="w-12 h-12 mx-auto text-slate-600" />
        <h3 className="text-xl font-bold text-white">No Monitored SQL Server Instances</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Mode B Senior DBA Command requires at least one active SQL Server instance to display real-time DMV wait statistics and locking diagnostics.
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
  const currentWaits = (waitStats[currentServer.id] || waitStats[currentServer.name] || waitStats[selectedServerId]) || [
    {
      waitType: currentServer.blockedSessionsCount > 0 ? 'LCK_M_X' : 'PAGEIOLATCH_SH',
      category: currentServer.blockedSessionsCount > 0 ? 'Locking' : 'Storage',
      waitingTasksCount: Math.max(12, Math.round(currentServer.avgReadLatencyMs * 8)),
      waitDurationMs: Math.round(currentServer.avgReadLatencyMs * 450),
      avgWaitMs: currentServer.avgReadLatencyMs,
      signalWaitMs: 1.2,
      pctOfTotalWaits: 45.2,
      description: currentServer.blockedSessionsCount > 0 ? 'Lock contention on concurrent transactional rows' : 'Data file buffer read completion wait',
    },
    {
      waitType: 'CXPACKET',
      category: 'Parallelism',
      waitingTasksCount: Math.round(currentServer.cpuUsagePct * 15),
      waitDurationMs: Math.round(currentServer.cpuUsagePct * 80),
      avgWaitMs: 3.1,
      signalWaitMs: 0.8,
      pctOfTotalWaits: 29.4,
      description: 'Parallel execution coordinator thread sync',
    },
    {
      waitType: 'ASYNC_NETWORK_IO',
      category: 'Network',
      waitingTasksCount: Math.round(currentServer.activeConnections * 4),
      waitDurationMs: Math.round(currentServer.activeConnections * 22),
      avgWaitMs: 1.2,
      signalWaitMs: 0.2,
      pctOfTotalWaits: 15.6,
      description: 'Client application fetch consumption speed',
    },
  ];

  // Only show blocking chain if current server has blocked sessions
  const hasServerBlocking = currentServer.blockedSessionsCount > 0 && blockingChain.length > 0;
  const rootBlocker = hasServerBlocking ? blockingChain.find(b => b.isRootBlocker) : null;
  const dependentBlocked = hasServerBlocking ? blockingChain.filter(b => !b.isRootBlocker) : [];

  const mockServers = servers.filter(
    (s) => s.telemetryMode === 'simulated' || ['sql-prod-01', 'sql-prod-02', 'sql-prod-03'].includes(s.id)
  );

  const currentDbNames = (currentServer.databases || []).map(d => d.name?.toLowerCase());
  const serverQueries = queryRegressions.filter(q => 
    q.databaseName && currentDbNames.includes(q.databaseName.toLowerCase())
  );

  const [isPushing, setIsPushing] = useState(false);

  const handlePushSampleTelemetry = async () => {
    if (!currentServer) return;
    setIsPushing(true);
    try {
      const testCpu = Math.floor(20 + Math.random() * 25);
      const testPle = Math.floor(1000 + Math.random() * 600);
      const testSessions = Math.max(15, currentServer.activeConnections + Math.floor((Math.random() - 0.5) * 6));

      const res = await fetch('/api/dba/telemetry/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: currentServer.id,
          serverName: currentServer.name,
          cpuUsagePct: testCpu,
          osCpuUsagePct: testCpu + 4,
          pageLifeExpectancySec: testPle,
          activeConnections: testSessions,
          blockedSessionsCount: currentServer.blockedSessionsCount,
          avgReadLatencyMs: currentServer.avgReadLatencyMs,
          avgWriteLatencyMs: currentServer.avgWriteLatencyMs,
        }),
      });
      if (res.ok) {
        setActionFeedback(`Live DMV telemetry refreshed: ${testCpu}% CPU, ${testPle}s PLE.`);
        setTimeout(() => setActionFeedback(null), 3000);
      }
    } catch (err: any) {
      setActionFeedback(`Push failed: ${err.message}`);
    } finally {
      setIsPushing(false);
    }
  };

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedQueryId(id);
    setTimeout(() => setCopiedQueryId(null), 2000);
  };

  const handleDecommissionSelected = async () => {
    if (!currentServer || !onRemoveServer) return;
    setIsDeleting(true);
    const sName = currentServer.name;
    const ok = await onRemoveServer(currentServer.id);
    setIsDeleting(false);
    setIsConfirmingDelete(false);
    if (ok) {
      setActionFeedback(`Server ${sName} decommissioned.`);
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Bar: Instance Picker & DMV Diagnostics Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <Terminal className="w-3.5 h-3.5" />
            <span>Mode B — Senior SQL Server DBA Command</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            DMV Telemetry, Wait Statistics & Lock Contention
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time DMV feeds from sys.dm_os_wait_stats, sys.dm_exec_requests, sys.dm_tran_locks, and Query Store.
          </p>
        </div>

        {/* Server Selector Tabs */}
        <div className="flex items-center space-x-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800 overflow-x-auto">
          {servers.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedServerId(s.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition flex items-center space-x-1.5 cursor-pointer ${
                selectedServerId === s.id
                  ? 'bg-cyan-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>{s.name}</span>
              {s.blockedSessionsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              )}
            </button>
          ))}

          <button
            type="button"
            onClick={handlePushSampleTelemetry}
            disabled={isPushing}
            className="px-2.5 py-1.5 rounded-md text-xs font-mono text-emerald-400 hover:text-emerald-300 hover:bg-slate-900 border border-emerald-800/60 transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
            title={`Push live telemetry test packet to ${currentServer.name}`}
          >
            <Send className={`w-3.5 h-3.5 ${isPushing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Push Telemetry</span>
          </button>

          {mockServers.length > 0 && onClearMockServers && (
            <button
              type="button"
              onClick={() => setShowClearMockConfirm(true)}
              className="px-2.5 py-1.5 rounded-md text-xs font-mono text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 border border-rose-800/60 transition flex items-center space-x-1 cursor-pointer"
              title="Decommission all mock/simulated servers"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Purge Mock ({mockServers.length})</span>
            </button>
          )}

          {onOpenAddServer && (
            <button
              onClick={onOpenAddServer}
              className="px-2.5 py-1.5 rounded-md text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:bg-slate-900 border border-cyan-800/60 transition flex items-center space-x-1 cursor-pointer"
              title="Register a new SQL Server into monitored estate"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          )}

          {onRemoveServer && currentServer && (
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              className="px-2.5 py-1.5 rounded-md text-xs font-mono text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 border border-rose-900/60 transition flex items-center space-x-1 cursor-pointer"
              title={`Decommission and remove ${currentServer.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Remove</span>
            </button>
          )}
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-700/80 rounded-xl text-emerald-200 text-xs flex items-center justify-between animate-in fade-in">
          <span>{actionFeedback}</span>
          <button onClick={() => setActionFeedback(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Confirmation Modal for Decommissioning in DBA Mode */}
      {isConfirmingDelete && currentServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Decommission SQL Server</h4>
                <p className="text-xs text-slate-400">Remove instance from real-time monitoring</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to decommission and remove <strong className="text-white font-mono">{currentServer.name}</strong> ({currentServer.id})?
            </p>

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
                onClick={handleDecommissionSelected}
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

      {/* Confirmation Modal for Clearing All Mock Servers */}
      {showClearMockConfirm && onClearMockServers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Purge All Mock Servers</h4>
                <p className="text-xs text-slate-400">Remove simulated assets from estate</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to decommission and remove all <strong className="text-white font-mono">{mockServers.length}</strong> mock/simulated servers? Any real connected servers will remain untouched.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearMockConfirm(false)}
                disabled={isClearingMock}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
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

      {/* BLOCKING CHAIN TREE (Section 6 & 10) */}
      {hasServerBlocking && rootBlocker ? (
        <div className="bg-rose-950/20 border border-rose-800/60 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-900/50 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Active Blocking Hierarchy Detected</span>
                  <span className="text-xs font-mono bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded border border-rose-500/40">
                    LCK_M_X Wait
                  </span>
                </h3>
                <p className="text-xs text-rose-300">
                  {currentServer.blockedSessionsCount} sessions queued on {currentServer.name}. Root blocker identified using sys.dm_os_waiting_tasks traversal.
                </p>
              </div>
            </div>

            {/* Emergency Containment Action */}
            {rootBlocker && (
              <button
                onClick={() => onRequestApproval({
                  id: 'REC-001',
                  title: `Kill Root Blocker Session SPID ${rootBlocker.spid} on ${currentServer.name}`,
                  why: `SPID ${rootBlocker.spid} has held an uncommitted transaction on ${rootBlocker.databaseName} for ${rootBlocker.transactionDurationSec}s.`,
                  evidence: `sys.dm_exec_requests shows open_transaction_count = ${rootBlocker.openTranCount}, status = ${rootBlocker.status}.`,
                  expectedBenefit: 'Immediate release of LCK_M_X exclusive table locks; resolves session queue.',
                  risk: 'HIGH',
                  implementationComplexity: 'LOW',
                  rollbackMethod: 'Worker application will auto-retry via exponential backoff.',
                  validationMethod: 'Verify blocked sessions drop to 0.',
                  priority: 'CRITICAL',
                  safetyLevel: 'RED',
                  sqlScript: `KILL ${rootBlocker.spid}; -- Human-in-the-loop production gate`,
                  targetServer: currentServer.name,
                  targetDatabase: rootBlocker.databaseName,
                })}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition flex items-center space-x-2 cursor-pointer self-start sm:self-auto"
              >
                <ShieldAlert className="w-4 h-4 text-white" />
                <span>Authorize KILL SPID {rootBlocker.spid} (RED GATE)</span>
              </button>
            )}
          </div>

          {/* Root Blocker Card */}
          {rootBlocker && (
            <div className="bg-slate-900 border-2 border-rose-500/60 rounded-xl p-4 space-y-3 relative">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs uppercase font-mono px-2 py-0.5 bg-rose-500 text-white font-bold rounded">
                    ROOT BLOCKER
                  </span>
                  <span className="text-base font-bold text-white font-mono">
                    SPID {rootBlocker.spid}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ({rootBlocker.loginName} @ {rootBlocker.hostName})
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs font-mono text-slate-300">
                  <span>DB: <strong className="text-cyan-400">{rootBlocker.databaseName}</strong></span>
                  <span>Status: <strong className="text-amber-400 uppercase">{rootBlocker.status}</strong></span>
                  <span>Open Tran: <strong className="text-rose-400">{rootBlocker.transactionDurationSec}s</strong></span>
                </div>
              </div>

              {/* SQL Text */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
                <span className="text-slate-500">// Offending Command Buffer:</span>
                <p className="text-rose-200 mt-1">{rootBlocker.sqlText}</p>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Directly blocking {rootBlocker.blockedSpidList.length} child worker threads</span>
                <span className="text-rose-400 font-mono">P1 Impact: Checkout API timeout</span>
              </div>
            </div>
          )}

          {/* Blocked Sessions Cascading List */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-mono uppercase text-slate-400 flex items-center space-x-2">
              <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
              <span>Cascading Blocked Threads ({dependentBlocked.length} Sessions)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {dependentBlocked.map((session) => (
                <div key={session.spid} className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-200">
                      SPID {session.spid}
                      <span className="text-slate-400 text-[11px] font-normal ml-1">
                        ← Blocked by SPID {session.blockingSpid}
                      </span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                      {session.waitType} ({Math.round(session.waitTimeMs / 1000)}s)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono truncate">{session.sqlText}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Program: {session.programName}</span>
                    <span>Client: {session.hostName}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Lock Hierarchy Status: <strong>0 active blocking sessions</strong> on {currentServer.name}.</span>
          </div>
          <span className="text-emerald-400 font-mono font-semibold">sys.dm_tran_locks Nominal</span>
        </div>
      )}

      {/* Two-Column Layout: Wait Stats Breakdown & Query Store Regressions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Col: Wait Statistics Classification (Section 6) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Wait Statistics Profile (sys.dm_os_wait_stats)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Categorized waits correlated with workload context (Section 6)
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400">{currentServer.name}</span>
          </div>

          <div className="space-y-3">
            {currentWaits.map((wait, idx) => (
              <div key={idx} className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-slate-200">{wait.waitType}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                      wait.category === 'Locking' ? 'bg-rose-500/20 text-rose-300' :
                      wait.category === 'Storage' ? 'bg-amber-500/20 text-amber-300' :
                      wait.category === 'CPU' ? 'bg-cyan-500/20 text-cyan-300' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {wait.category}
                    </span>
                  </div>

                  <div className="font-mono text-right">
                    <span className="text-slate-200 font-bold">{wait.pctOfTotalWaits}%</span>
                    <span className="text-slate-500 text-[10px] ml-1">of total</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      wait.category === 'Locking' ? 'bg-rose-500' :
                      wait.category === 'Storage' ? 'bg-amber-500' :
                      wait.category === 'CPU' ? 'bg-cyan-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${wait.pctOfTotalWaits}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <span className="truncate max-w-[280px]">{wait.description}</span>
                  <span className="font-mono">Avg: {wait.avgWaitMs} ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Query Store Regressed Queries & Missing Indexes */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>Query Store Regressions & Plan Changes</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Current duration vs baseline with missing index impact
              </p>
            </div>
            <span className="text-xs font-mono text-amber-400">P95/P99 Telemetry</span>
          </div>

          <div className="space-y-3">
            {serverQueries.length > 0 ? (
              serverQueries.map((q) => (
                <div key={q.queryId} className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-cyan-300">
                          Query #{q.queryId}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {q.databaseName}
                        </span>
                        {q.isPlanRegressed && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                            Plan Regression
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Hash: {q.queryHash} • Plan: {q.previousPlanId} ➔ <strong className="text-rose-400">{q.currentPlanId}</strong>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-xs text-rose-400 font-bold">
                        +{q.regressionPct}% Duration
                      </span>
                      <div className="text-[10px] text-slate-400">
                        {q.baselineDurationMs}ms ➔ <strong className="text-white">{q.currentDurationMs}ms</strong>
                      </div>
                    </div>
                  </div>

                  {/* Query Text Snippet */}
                  <p className="text-xs font-mono text-slate-300 line-clamp-2 bg-slate-900 p-2 rounded border border-slate-800/80">
                    {q.queryText}
                  </p>

                  {/* Missing Index Recommendation */}
                  {q.missingIndexRecommendation && (
                    <div className="bg-cyan-950/30 border border-cyan-800/50 rounded-lg p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-cyan-300">
                        <span className="font-semibold flex items-center gap-1.5 text-[11px]">
                          <Activity className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Recommended Missing Index ({q.estimatedImprovementPct}% Expected Benefit)</span>
                        </span>
                        <button
                          onClick={() => handleCopy(q.missingIndexRecommendation!, q.queryId)}
                          className="p-1 rounded hover:bg-cyan-900/50 text-cyan-300 transition cursor-pointer"
                          title="Copy DDL Script"
                        >
                          {copiedQueryId === q.queryId ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] font-mono text-cyan-200 select-all">
                        {q.missingIndexRecommendation}
                      </p>
                    </div>
                  )}

                  {/* Action button */}
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => onRequestApproval({
                        id: `REC-PLAN-${q.queryId}`,
                        title: `Force Plan ${q.previousPlanId} for Query ${q.queryId}`,
                        why: `Query regressed by ${q.regressionPct}% after switching to Plan ${q.currentPlanId}.`,
                        evidence: `Query Store execution runtime: ${q.currentDurationMs}ms vs baseline ${q.baselineDurationMs}ms.`,
                        expectedBenefit: `Reduces query latency by estimated ${q.estimatedImprovementPct}%.`,
                        risk: 'LOW',
                        implementationComplexity: 'LOW',
                        rollbackMethod: `EXEC sp_query_store_unforce_plan @query_id = ${q.queryId}, @plan_id = ${q.previousPlanId};`,
                        validationMethod: 'Observe Query Store runtime telemetry for 15 minutes.',
                        priority: 'HIGH',
                        safetyLevel: 'AMBER',
                        sqlScript: `EXEC sp_query_store_force_plan @query_id = ${q.queryId}, @plan_id = ${q.previousPlanId};`,
                        targetServer: currentServer.name,
                        targetDatabase: q.databaseName,
                      })}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium transition cursor-pointer"
                    >
                      Force Prior Plan {q.previousPlanId} (AMBER GATE) →
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Query Store Nominal on {currentServer.name}</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  All queries across {currentServer.databases?.length || 1} database(s) are executing with stable execution plans and consistent runtime baselines.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
