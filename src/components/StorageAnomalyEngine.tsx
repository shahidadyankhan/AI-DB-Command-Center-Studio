import React, { useState } from 'react';
import { 
  HardDrive, 
  TrendingUp, 
  AlertTriangle, 
  Sparkles, 
  FileText, 
  Database, 
  Layers, 
  ArrowRight, 
  Calendar, 
  ShieldAlert, 
  Clock, 
  CheckCircle,
  Copy,
  Check,
  RefreshCw,
  BarChart2
} from 'lucide-react';
import { StorageGrowthBaseline, StorageForecastAlert, RecommendationItem } from '../types/dba';

interface StorageAnomalyEngineProps {
  baselines: StorageGrowthBaseline[];
  alerts: StorageForecastAlert[];
  onRequestApproval: (rec: RecommendationItem) => void;
}

export const StorageAnomalyEngine: React.FC<StorageAnomalyEngineProps> = ({
  baselines,
  alerts,
  onRequestApproval
}) => {
  const [selectedBaselineId, setSelectedBaselineId] = useState<string>(baselines[0]?.id || 'BASE-PROD03-DATA');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<any>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  const currentBaseline = baselines.find(b => b.id === selectedBaselineId) || baselines[0];

  const handleGenerateAiReport = async () => {
    setIsGeneratingReport(true);
    try {
      const res = await fetch('/api/dba/storage-anomalies/deep-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baselineId: currentBaseline.id }),
      });
      const data = await res.json();
      setAiReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const copyScript = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-amber-400 uppercase tracking-wider mb-1">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Storage Growth Baseline & Predictive Anomaly Engine</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Proactive Database Storage & Capacity Exhaustion Forecast
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Continuously monitors multi-tier storage volumes, compares against historical 90-day moving baselines, flags statistical z-score deviations, and projects critical threshold dates (80%, 90%, 100%).
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleGenerateAiReport}
              disabled={isGeneratingReport}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition cursor-pointer disabled:opacity-50"
            >
              {isGeneratingReport ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-200" />
              )}
              <span>Generate AI Capacity Report</span>
            </button>
          </div>
        </div>

        {/* Global Alert Ribbons */}
        <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {alerts.map((alt) => (
            <div key={alt.id} className="bg-rose-950/30 border border-rose-800/60 rounded-xl p-3 flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0 mt-0.5 animate-pulse">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white font-mono">{alt.serverId} • {alt.databaseName}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500 text-white font-bold">
                    {alt.severity}
                  </span>
                </div>
                <div className="text-rose-200 text-[11px] mt-0.5">
                  <strong>{alt.metric}:</strong> {alt.observedValue} (Baseline: {alt.baselineValue})
                </div>
                <div className="text-[11px] text-amber-300 font-mono mt-1">
                  ⏱️ <strong>Threshold:</strong> {alt.criticalThresholdTarget}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Target Volume Selector Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
        {baselines.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedBaselineId(b.id)}
            className={`px-4 py-2.5 rounded-xl border text-xs font-mono text-left transition cursor-pointer flex items-center space-x-3 shrink-0 ${
              selectedBaselineId === b.id
                ? 'bg-amber-950/40 border-amber-500 text-amber-200 shadow-md shadow-amber-950'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div>
              <div className="font-bold flex items-center gap-1.5">
                <span>{b.serverName} ({b.databaseName})</span>
                {b.isAnomaly && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </div>
              <div className="text-[10px] text-slate-500">
                {b.volumeMount} • {b.utilizationPct}% Used ({b.daysTo80Pct}d to 80%)
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Main Grid: Baseline Deviation & Threshold Countdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Baseline Telemetry & Exhaustion Timeline */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Statistical Anomaly & Velocity Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono text-cyan-400 uppercase font-bold">
                  Storage Baseline Profile • {currentBaseline.volumeMount}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {currentBaseline.databaseName} Capacity Status
                </h3>
              </div>

              <div className="flex items-center space-x-2 font-mono text-xs">
                <span className={`px-2.5 py-1 rounded font-bold ${
                  currentBaseline.isAnomaly ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {currentBaseline.isAnomaly ? `ANOMALY: z-score +${currentBaseline.zScore}` : 'BASELINE NOMINAL'}
                </span>
              </div>
            </div>

            {/* Capacity & Velocity Comparison Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Volume Utilization</span>
                <span className="text-lg font-bold text-white">{currentBaseline.utilizationPct}%</span>
                <span className="text-slate-500 block text-[10px]">{currentBaseline.usedGB} / {currentBaseline.totalCapacityGB} GB</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">90-Day Baseline</span>
                <span className="text-lg font-bold text-slate-200">{currentBaseline.baselineDailyGrowthGB}</span>
                <span className="text-slate-500 block text-[10px]">GB / day normal</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Current Observed</span>
                <span className={`text-lg font-bold ${currentBaseline.growthVelocitySurgePct > 50 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {currentBaseline.currentDailyGrowthGB}
                </span>
                <span className="text-rose-400 block text-[10px]">GB / day (+{currentBaseline.growthVelocitySurgePct}%)</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Free Space Buffer</span>
                <span className={`text-lg font-bold ${currentBaseline.freeGB < 500 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {currentBaseline.freeGB} GB
                </span>
                <span className="text-slate-500 block text-[10px]">{Math.round(100 - currentBaseline.utilizationPct)}% unallocated</span>
              </div>
            </div>

            {/* Threshold Progression Bars (80%, 90%, 100%) */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-mono uppercase text-slate-400 block">Critical Capacity Threshold Predictions:</span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 80% */}
                <div className={`p-3 rounded-lg border text-xs ${
                  currentBaseline.daysTo80Pct <= 7 ? 'bg-amber-950/30 border-amber-700/80 text-amber-200' : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}>
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold">80% Threshold</span>
                    <span className="font-bold text-amber-400">{currentBaseline.daysTo80Pct} Day(s)</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Date: <strong>{currentBaseline.projectedDate80}</strong>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${Math.min(100, (currentBaseline.utilizationPct / 80) * 100)}%` }} />
                  </div>
                </div>

                {/* 90% */}
                <div className={`p-3 rounded-lg border text-xs ${
                  currentBaseline.daysTo90Pct <= 20 ? 'bg-orange-950/30 border-orange-700/80 text-orange-200' : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}>
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold">90% Threshold</span>
                    <span className="font-bold text-orange-400">{currentBaseline.daysTo90Pct} Days</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Date: <strong>{currentBaseline.projectedDate90}</strong>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-orange-400" style={{ width: `${Math.min(100, (currentBaseline.utilizationPct / 90) * 100)}%` }} />
                  </div>
                </div>

                {/* 100% */}
                <div className={`p-3 rounded-lg border text-xs ${
                  currentBaseline.daysTo100Pct <= 30 ? 'bg-rose-950/30 border-rose-700/80 text-rose-200' : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}>
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold">100% Exhaustion</span>
                    <span className="font-bold text-rose-400">{currentBaseline.daysTo100Pct} Days</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Date: <strong>{currentBaseline.projectedDate100}</strong>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-rose-500" style={{ width: `${currentBaseline.utilizationPct}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Growth Trajectory Data Table / Chart Visualization */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-mono uppercase text-slate-400 block">Baseline vs Observed & Projected Trajectory:</span>
              
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 overflow-x-auto">
                <div className="flex items-center justify-between min-w-[500px] gap-2 text-center text-[10px] font-mono">
                  {currentBaseline.historicalDataPoints.map((pt, idx) => (
                    <div key={idx} className="flex-1 space-y-1">
                      <div className="text-slate-500 truncate">{pt.date}</div>
                      <div className={`p-1.5 rounded ${
                        pt.isForecast ? 'bg-amber-950/40 border border-amber-600/50 text-amber-300 font-bold' : 'bg-slate-900 text-slate-200'
                      }`}>
                        {pt.usedGB} GB
                      </div>
                      <div className="text-[9px] text-slate-500">
                        base: {pt.baselineGB}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Card 2: Culprit Tables Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <span>Table-Level Space Consumers & Growth Velocity</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Granular space analysis from sys.dm_db_partition_stats & sys.allocation_units
                </p>
              </div>
              <span className="text-xs font-mono text-cyan-400">{currentBaseline.topTableConsumers.length} Monitored</span>
            </div>

            <div className="space-y-2 text-xs">
              {currentBaseline.topTableConsumers.map((tbl, idx) => (
                <div key={idx} className={`p-3.5 rounded-xl border space-y-2 ${
                  tbl.isAnomalyCulprit ? 'bg-rose-950/20 border-rose-800/60' : 'bg-slate-950 border-slate-800'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-white text-xs">{tbl.tableName}</span>
                      {tbl.isAnomalyCulprit && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500 text-white font-bold animate-pulse">
                          ANOMALY CULPRIT (+{tbl.growthPct30d}%)
                        </span>
                      )}
                    </div>

                    <div className="font-mono text-right text-xs">
                      <span className="text-slate-200 font-bold">{tbl.sizeGB} GB</span>
                      <span className="text-slate-400 text-[11px] ml-1">({tbl.pctOfDatabase}% of DB)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-slate-400">
                    <div>
                      <span>Rows:</span> <strong className="text-slate-200">{tbl.rowCount.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>30d Growth:</span> <strong className={tbl.growth30dGB > 100 ? 'text-rose-400' : 'text-slate-200'}>+{tbl.growth30dGB} GB</strong>
                    </div>
                    <div>
                      <span>Partitioning:</span> <strong className={tbl.hasPartitioning ? 'text-emerald-400' : 'text-amber-400'}>{tbl.hasPartitioning ? 'YES' : 'NO'}</strong>
                    </div>
                    <div>
                      <span>Compression:</span> <strong className={tbl.compressionType === 'NONE' ? 'text-rose-400' : 'text-emerald-400'}>{tbl.compressionType}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Col: Root Cause & AI Report & Remediation */}
        <div className="space-y-6">
          
          {/* Remediation Action Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-slate-400 font-bold">Recommended Remediation</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                currentBaseline.recommendedAction.safetyLevel === 'RED' ? 'bg-rose-500 text-white' :
                currentBaseline.recommendedAction.safetyLevel === 'AMBER' ? 'bg-amber-500 text-slate-950' :
                'bg-emerald-500 text-white'
              }`}>
                {currentBaseline.recommendedAction.safetyLevel} GATE
              </span>
            </div>

            <div>
              <h4 className="text-base font-bold text-white leading-snug">
                {currentBaseline.recommendedAction.title}
              </h4>
              <p className="text-xs text-slate-300 mt-1">
                {currentBaseline.recommendedAction.why}
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1 font-mono">
              <div className="text-emerald-400 font-bold">
                ✓ {currentBaseline.recommendedAction.expectedBenefit}
              </div>
              <div className="text-slate-400 text-[11px]">
                Rollback: {currentBaseline.recommendedAction.rollbackMethod}
              </div>
            </div>

            {currentBaseline.recommendedAction.sqlScript && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Executable SQL Script:</span>
                  <button
                    onClick={() => copyScript(currentBaseline.recommendedAction.sqlScript!)}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedScript ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedScript ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 p-2.5 rounded font-mono text-[11px] text-cyan-200 overflow-x-auto border border-slate-800">
                  {currentBaseline.recommendedAction.sqlScript}
                </pre>
              </div>
            )}

            <button
              onClick={() => onRequestApproval(currentBaseline.recommendedAction)}
              className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-amber-600/30"
            >
              <ShieldAlert className="w-4 h-4 text-slate-950" />
              <span>Authorize Remediation ({currentBaseline.recommendedAction.safetyLevel})</span>
            </button>
          </div>

          {/* AI Generated Capacity Report Output */}
          {aiReport && (
            <div className="bg-slate-900 border border-amber-500/50 rounded-xl p-5 space-y-3 animate-in fade-in duration-200 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>AI Predictive Capacity Report</span>
                </span>
                <span className="text-[10px] font-mono text-cyan-400">Gemini 3.8 Flash</span>
              </div>

              <div className="text-xs space-y-2 text-slate-300">
                <p className="font-medium text-slate-200">{aiReport.executiveSummary}</p>
                
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1">
                  <span className="text-slate-400 block font-bold text-[10px]">STATISTICAL ANALYSIS:</span>
                  <p className="text-[11px] text-slate-300">{aiReport.statisticalAnalysis}</p>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1">
                  <span className="text-slate-400 block font-bold text-[10px]">TECHNICAL IMPACT:</span>
                  <p className="text-[11px] text-rose-300">{aiReport.technicalImpact}</p>
                </div>

                {aiReport.rankedRemediations && (
                  <div className="space-y-1 pt-1">
                    <span className="text-slate-400 block font-bold text-[10px]">RANKED REMEDIATIONS:</span>
                    {aiReport.rankedRemediations.map((rem: any, i: number) => (
                      <div key={i} className="bg-slate-950 p-2 rounded text-[11px] border border-slate-850">
                        <strong className="text-amber-300">Step {rem.step}: {rem.action}</strong>
                        <div className="text-slate-400 text-[10px]">{rem.benefit}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Root Cause Technical Deep Dive */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
            <span className="font-bold text-slate-200 block">Root Cause & Architectural Assessment</span>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {currentBaseline.rootCauseAnalysis}
            </p>
            <div className="pt-2 border-t border-slate-800 text-[11px] text-rose-300">
              <strong>Potential Business Impact:</strong> {currentBaseline.potentialImpact}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
