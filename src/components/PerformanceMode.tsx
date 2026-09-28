import React, { useState } from 'react';
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
  BarChart3
} from 'lucide-react';
import { ServerInstance, QueryStoreRegression, RecommendationItem } from '../types/dba';

interface PerformanceModeProps {
  servers: ServerInstance[];
  queryRegressions: QueryStoreRegression[];
  onRequestApproval: (rec: RecommendationItem) => void;
}

export const PerformanceMode: React.FC<PerformanceModeProps> = ({
  servers,
  queryRegressions,
  onRequestApproval
}) => {
  const [selectedServerId, setSelectedServerId] = useState<string>('sql-prod-01');

  const currentServer = servers.find(s => s.id === selectedServerId) || servers[0];

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
            Correlating CPU, Memory, IO Latency, Page Life Expectancy, and Query Regressions.
          </p>
        </div>

        {/* Server Picker */}
        <div className="flex items-center space-x-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
          {servers.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedServerId(s.id)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition cursor-pointer ${
                selectedServerId === s.id
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

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
            <div className="h-full bg-slate-600" style={{ width: `${currentServer.osCpuUsagePct - currentServer.cpuUsagePct}%` }} />
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Schedulers: {currentServer.cpuCores} vCPUs</span>
            <span className="text-cyan-400 font-mono">SOS_SCHEDULER_YIELD</span>
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
            <span className={currentServer.pageLifeExpectancySec < 300 ? 'text-amber-400' : 'text-emerald-400'}>
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
                Primary data file read latency. Target &lt; 5ms for OLTP workloads.
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
                8 proportional tempdb data files configured with equal autogrowth.
              </p>
            </div>
          </div>
        </div>

        {/* Top Regressed Queries on this instance */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Highest CPU & Duration Queries (Query Store)</span>
            </h3>
            <span className="text-xs text-slate-400">Last 1 hour</span>
          </div>

          <div className="space-y-3">
            {queryRegressions.slice(0, 2).map((q) => (
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
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
