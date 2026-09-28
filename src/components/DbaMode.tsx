import React, { useState } from 'react';
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
  GitCommit
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
}

export const DbaMode: React.FC<DbaModeProps> = ({
  servers,
  waitStats,
  blockingChain,
  queryRegressions,
  onRequestApproval
}) => {
  const [selectedServerId, setSelectedServerId] = useState<string>('sql-prod-01');
  const [copiedQueryId, setCopiedQueryId] = useState<number | null>(null);

  const currentServer = servers.find(s => s.id === selectedServerId) || servers[0];
  const currentWaits = waitStats[selectedServerId] || waitStats['sql-prod-01'] || [];

  const rootBlocker = blockingChain.find(b => b.isRootBlocker);
  const dependentBlocked = blockingChain.filter(b => !b.isRootBlocker);

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedQueryId(id);
    setTimeout(() => setCopiedQueryId(null), 2000);
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
        </div>
      </div>

      {/* BLOCKING CHAIN TREE (Section 6 & 10) */}
      {blockingChain.length > 0 && selectedServerId === 'sql-prod-01' ? (
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
                  {blockingChain.length} sessions queued. Root blocker identified using sys.dm_os_waiting_tasks traversal.
                </p>
              </div>
            </div>

            {/* Emergency Containment Action */}
            {rootBlocker && (
              <button
                onClick={() => onRequestApproval({
                  id: 'REC-001',
                  title: `Kill Root Blocker Session SPID ${rootBlocker.spid}`,
                  why: `SPID ${rootBlocker.spid} has held an uncommitted transaction on OrdersDB for ${rootBlocker.transactionDurationSec}s.`,
                  evidence: `sys.dm_exec_requests shows open_transaction_count = ${rootBlocker.openTranCount}, status = ${rootBlocker.status}.`,
                  expectedBenefit: 'Immediate release of LCK_M_X exclusive table locks; resolves checkout queue.',
                  risk: 'HIGH',
                  implementationComplexity: 'LOW',
                  rollbackMethod: 'Worker application will auto-retry via exponential backoff.',
                  validationMethod: 'Verify blocked sessions drop to 0.',
                  priority: 'CRITICAL',
                  safetyLevel: 'RED',
                  sqlScript: `KILL ${rootBlocker.spid}; -- Human-in-the-loop production gate`,
                  targetServer: 'SQL-PROD-01',
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
            {queryRegressions.map((q) => (
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
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
