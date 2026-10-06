import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  TrendingDown, 
  GitCommit, 
  Layers, 
  Sparkles, 
  Check, 
  Copy, 
  ArrowRight, 
  ShieldAlert, 
  Clock, 
  RefreshCw, 
  FileCode, 
  Activity,
  AlertTriangle,
  GitPullRequest,
  Cpu
} from 'lucide-react';
import { QueryRegressionRecord, RecommendationItem } from '../types/dba';

interface QueryRegressionCheckerProps {
  regressions: QueryRegressionRecord[];
  onRequestApproval: (rec: RecommendationItem) => void;
}

export const QueryRegressionChecker: React.FC<QueryRegressionCheckerProps> = ({
  regressions,
  onRequestApproval
}) => {
  const [selectedQueryId, setSelectedQueryId] = useState<number>(() => regressions[0]?.queryId || 0);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [copiedQueryId, setCopiedQueryId] = useState<number | null>(null);

  // Sync selectedQueryId when regressions change or servers are decommissioned
  useEffect(() => {
    if (!regressions.some(q => q.queryId === selectedQueryId) && regressions.length > 0) {
      setSelectedQueryId(regressions[0].queryId);
    }
  }, [regressions, selectedQueryId]);

  const periods = ['ALL', 'Business Hours Peak', 'Checkout Rush (12-2pm)', 'Nightly ETL Batch'];

  const filteredRegressions = selectedPeriod === 'ALL'
    ? regressions
    : regressions.filter(q => q.workloadPeriod.includes(selectedPeriod));

  const currentQuery = regressions.find(q => q.queryId === selectedQueryId) || filteredRegressions[0] || regressions[0];

  if (!currentQuery || regressions.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
        <Zap className="w-12 h-12 mx-auto text-slate-600" />
        <h3 className="text-xl font-bold text-white">No Active Query Regressions Detected</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Query Store execution plans and CPU/duration distributions are within established runtime variance across monitored database workloads.
        </p>
      </div>
    );
  }

  const handleAiDissection = async () => {
    setIsAiAnalyzing(true);
    try {
      const res = await fetch('/api/dba/query-regressions/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryId: currentQuery.queryId }),
      });
      const data = await res.json();
      setAiAnalysis(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const copySql = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedQueryId(id);
    setTimeout(() => setCopiedQueryId(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950/20 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
              <Zap className="w-3.5 h-3.5" />
              <span>Continuous Query Performance Regression Engine</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              AI-Driven Query Regression & Execution Plan Diff Checker
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Establishes historical baseline metrics (duration, CPU, logical reads/writes, execution frequency) across multiple workload periods and correlates statistically significant regressions with code deployments and execution plan shifts.
            </p>
          </div>

          <button
            onClick={handleAiDissection}
            disabled={isAiAnalyzing}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition cursor-pointer disabled:opacity-50"
          >
            {isAiAnalyzing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-cyan-200" />
            )}
            <span>AI Plan Dissection & RCA</span>
          </button>
        </div>

        {/* Workload Period Filter Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-mono text-[11px]">Workload Period Filter:</span>
            <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {periods.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-3 py-1 rounded text-xs font-mono transition cursor-pointer ${
                    selectedPeriod === p ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            Active Regressions Flagged: <strong className="text-rose-400 font-bold">{filteredRegressions.length}</strong>
          </div>
        </div>
      </div>

      {/* Regressed Queries List & Detailed Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Query Regression Cards Feed */}
        <div className="space-y-3">
          <span className="text-xs font-mono uppercase text-slate-400 font-bold block">
            Statistically Flagged Queries ({filteredRegressions.length})
          </span>

          <div className="space-y-3">
            {filteredRegressions.map((q) => (
              <div
                key={q.queryId}
                onClick={() => {
                  setSelectedQueryId(q.queryId);
                  setAiAnalysis(null);
                }}
                className={`p-4 rounded-xl border text-xs transition cursor-pointer space-y-2 relative ${
                  selectedQueryId === q.queryId
                    ? 'bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-950'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-white">Query #{q.queryId}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                      {q.databaseName}
                    </span>
                  </div>

                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    q.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                    'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {q.severity} • z:{q.zScore}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-cyan-300 font-semibold truncate">
                  {q.objectName}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                  <span className="text-slate-400">Duration:</span>
                  <span className="text-rose-400 font-bold">
                    {q.baseline.avgDurationMs}ms ➔ {q.current.avgDurationMs}ms (+{q.durationRegressionPct}%)
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 font-mono">
                    {q.regressionNature}
                  </span>
                  <span>{q.workloadPeriod}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 2 Cols: Deep Regression Anatomy, Plan Comparison, Deployment Link */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Inspection Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                    QUERY #{currentQuery.queryId} • {currentQuery.databaseName}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Hash: {currentQuery.queryHash}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {currentQuery.objectName}
                </h3>
              </div>

              <div className="flex items-center space-x-2 font-mono text-xs">
                <span className="text-slate-400">Nature:</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                  {currentQuery.regressionNature}
                </span>
              </div>
            </div>

            {/* Baseline vs Current Key Metrics Grid */}
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase text-slate-400 block font-bold">
                Workload Baseline vs Current Execution Metrics ({currentQuery.workloadPeriod}):
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                {/* Duration */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[10px]">Avg Duration</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-slate-400 text-xs">{currentQuery.baseline.avgDurationMs}ms</span>
                    <span className="text-slate-500">➔</span>
                    <span className="text-rose-400 text-base font-bold">{currentQuery.current.avgDurationMs}ms</span>
                  </div>
                  <span className="text-rose-400 font-bold text-[10px] block">+{currentQuery.durationRegressionPct}% Slowdown</span>
                </div>

                {/* CPU Time */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[10px]">CPU Time</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-slate-400 text-xs">{currentQuery.baseline.avgCpuMs}ms</span>
                    <span className="text-slate-500">➔</span>
                    <span className="text-rose-400 text-base font-bold">{currentQuery.current.avgCpuMs}ms</span>
                  </div>
                  <span className="text-rose-400 font-bold text-[10px] block">+{currentQuery.cpuRegressionPct}% CPU Spike</span>
                </div>

                {/* Logical Reads */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[10px]">Logical Reads / Exec</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-slate-400 text-xs">{currentQuery.baseline.avgLogicalReads.toLocaleString()}</span>
                    <span className="text-slate-500">➔</span>
                    <span className="text-rose-400 text-base font-bold">{currentQuery.current.avgLogicalReads.toLocaleString()}</span>
                  </div>
                  <span className="text-rose-400 font-bold text-[10px] block">+{currentQuery.readsRegressionPct}% I/O Explosion</span>
                </div>

                {/* Frequency & Concurrency */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[10px]">Exec Frequency</span>
                  <div className="text-slate-200 text-base font-bold">
                    {currentQuery.baseline.executionCountPerHour.toLocaleString()}
                  </div>
                  <span className="text-cyan-400 text-[10px] block">calls / hour sustained</span>
                </div>
              </div>
            </div>

            {/* Side-by-Side Execution Plan Comparison Visualizer */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5 font-mono">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Execution Plan Diff: Plan {currentQuery.planComparison.previousPlanId} vs Plan {currentQuery.planComparison.currentPlanId}</span>
                </span>
                <span className="text-slate-400 font-mono text-[10px]">Query Store XML Plan Diff</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                {/* Previous Optimal Plan */}
                <div className="bg-emerald-950/20 border border-emerald-800/60 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[10px]">
                      OPTIMAL PLAN #{currentQuery.planComparison.previousPlanId}
                    </span>
                    <span className="text-emerald-400 text-[11px]">Cost: {currentQuery.planComparison.previousCostPct}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Primary Execution Operator:</span>
                    <div className="text-emerald-200 text-xs font-semibold mt-0.5">
                      {currentQuery.planComparison.previousOperator}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 pt-1">
                    TempDB Spills: <strong className="text-emerald-400">0 MB</strong> • Memory Grant: <strong className="text-slate-200">2 MB</strong>
                  </div>
                </div>

                {/* Current Regressed Plan */}
                <div className="bg-rose-950/20 border border-rose-800/60 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-bold text-[10px]">
                      REGRESSED PLAN #{currentQuery.planComparison.currentPlanId}
                    </span>
                    <span className="text-rose-400 text-[11px]">Cost: {currentQuery.planComparison.currentCostPct}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Degraded Execution Operator:</span>
                    <div className="text-rose-200 text-xs font-semibold mt-0.5">
                      {currentQuery.planComparison.currentOperator}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 pt-1">
                    TempDB Spills: <strong className="text-rose-400">{currentQuery.planComparison.tempdbSpillMB} MB</strong> • Memory Grant: <strong className="text-rose-300">{currentQuery.planComparison.memoryGrantMB} MB</strong>
                  </div>
                </div>
              </div>

              {/* Cardinality Estimation Disparity Note */}
              <div className="text-[11px] text-slate-300 bg-slate-900 p-2.5 rounded border border-slate-800">
                <strong>Why the Optimizer Switched:</strong> {currentQuery.planComparison.reasonForSwitch}
              </div>
            </div>

            {/* Code Deployment Correlation Linkage */}
            {currentQuery.correlatedDeployment && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5 font-mono">
                    <GitCommit className="w-4 h-4 text-amber-400" />
                    <span>Correlated Code Deployment Linkage ({currentQuery.correlatedDeployment.deploymentId})</span>
                  </span>
                  <span className="text-slate-400 font-mono text-[10px]">
                    {currentQuery.correlatedDeployment.deployedAt}
                  </span>
                </div>

                <div className="text-slate-300 text-[11px]">
                  <strong>Release:</strong> {currentQuery.correlatedDeployment.releaseTag} • <strong>Author:</strong> {currentQuery.correlatedDeployment.author} • <strong>Commit:</strong> <span className="font-mono text-cyan-400">{currentQuery.correlatedDeployment.commitHash}</span>
                </div>

                <p className="text-slate-400 text-[11px]">
                  {currentQuery.correlatedDeployment.description}
                </p>

                {currentQuery.correlatedDeployment.codeDiffSnippet && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-mono text-slate-400">Triggering Code Diff Snippet:</span>
                    <pre className="bg-slate-900 p-2.5 rounded font-mono text-[11px] text-amber-300 overflow-x-auto border border-slate-800">
                      {currentQuery.correlatedDeployment.codeDiffSnippet}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* SQL Snippet Preview */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>SQL Statement Definition:</span>
                <button
                  onClick={() => copySql(currentQuery.fullSqlText, currentQuery.queryId)}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer"
                >
                  {copiedQueryId === currentQuery.queryId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedQueryId === currentQuery.queryId ? 'Copied' : 'Copy SQL'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-3 rounded-lg font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800 max-h-36">
                {currentQuery.fullSqlText}
              </pre>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
              <div className="text-xs text-slate-300">
                <strong>Recommended Action:</strong> {currentQuery.recommendedAction.title}
              </div>

              <button
                onClick={() => onRequestApproval(currentQuery.recommendedAction)}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center space-x-2 cursor-pointer shadow-md shadow-cyan-600/30"
              >
                <ShieldAlert className="w-4 h-4 text-white" />
                <span>Execute Remediation ({currentQuery.recommendedAction.safetyLevel} Gate)</span>
              </button>
            </div>

          </div>

          {/* AI Plan Dissection Output Box */}
          {aiAnalysis && (
            <div className="bg-slate-900 border border-cyan-500/50 rounded-xl p-5 space-y-3 animate-in fade-in duration-200 shadow-xl text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white flex items-center gap-1.5 font-mono">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>AI Architectural Query Plan Dissection</span>
                </span>
                <span className="text-[10px] font-mono text-cyan-400">Gemini 3.8 Flash • Query Store Autopsy</span>
              </div>

              <div className="space-y-2 text-slate-300">
                <p className="font-semibold text-slate-100">{aiAnalysis.finding}</p>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1">
                  <span className="text-slate-400 block font-bold text-[10px]">ROOT CAUSE MECHANISM:</span>
                  <p className="text-[11px] text-slate-300">{aiAnalysis.rootCauseMechanism}</p>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1">
                  <span className="text-slate-400 block font-bold text-[10px]">WORKLOAD & CONCURRENCY IMPACT:</span>
                  <p className="text-[11px] text-rose-300">{aiAnalysis.workloadImpact}</p>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1">
                  <span className="text-slate-400 block font-bold text-[10px]">DEPLOYMENT LINKAGE:</span>
                  <p className="text-[11px] text-amber-300">{aiAnalysis.deploymentLinkage}</p>
                </div>

                {aiAnalysis.permanentFix && (
                  <div className="text-[11px] text-emerald-400 pt-1">
                    <strong>Permanent Architectural Fix:</strong> {aiAnalysis.permanentFix}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
