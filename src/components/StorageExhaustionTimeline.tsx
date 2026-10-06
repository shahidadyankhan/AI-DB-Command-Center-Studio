import React, { useState, useMemo, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Area, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine, 
  ReferenceDot,
  Legend
} from 'recharts';
import { 
  HardDrive, 
  AlertTriangle, 
  TrendingUp, 
  Calendar, 
  ShieldAlert, 
  Clock, 
  Layers, 
  Sliders, 
  CheckCircle2, 
  Zap, 
  ArrowRight,
  Info
} from 'lucide-react';
import { StorageGrowthBaseline, RecommendationItem } from '../types/dba';

interface StorageExhaustionTimelineProps {
  baselines: StorageGrowthBaseline[];
  onRequestApproval: (rec: RecommendationItem) => void;
}

export const StorageExhaustionTimeline: React.FC<StorageExhaustionTimelineProps> = ({
  baselines,
  onRequestApproval
}) => {
  // Filter for servers and volumes identified as 'At Risk'
  const atRiskBaselines = useMemo(() => {
    return baselines.filter(b => b.isAnomaly || b.daysTo80Pct <= 90 || b.utilizationPct >= 70);
  }, [baselines]);

  const [selectedId, setSelectedId] = useState<string>(
    () => atRiskBaselines[0]?.id || baselines[0]?.id || ''
  );
  const [metricUnit, setMetricUnit] = useState<'GB' | 'PCT'>('GB');
  const [simulateRemediation, setSimulateRemediation] = useState(false);
  const [projectionDays, setProjectionDays] = useState<30 | 60 | 90>(60);

  // Sync selectedId with active baselines
  useEffect(() => {
    if (!baselines.some(b => b.id === selectedId) && baselines.length > 0) {
      setSelectedId(atRiskBaselines[0]?.id || baselines[0]?.id || '');
    }
  }, [baselines, selectedId, atRiskBaselines]);

  const activeBaseline = useMemo(() => {
    return baselines.find(b => b.id === selectedId) || atRiskBaselines[0] || baselines[0];
  }, [baselines, selectedId, atRiskBaselines]);

  // Generate enriched timeline series with historical, current anomaly, baseline, and simulated recovery curves
  const chartData = useMemo(() => {
    if (!activeBaseline) return [];

    const totalCap = activeBaseline.totalCapacityGB;
    const thresh80 = totalCap * 0.8;
    const thresh90 = totalCap * 0.9;
    const thresh100 = totalCap;

    const data: Array<{
      date: string;
      dayIndex: number;
      actualGB?: number;
      projectedGB?: number;
      baselineGB?: number;
      remediatedGB?: number;
      confidenceHigh?: number;
      confidenceLow?: number;
      actualPct?: number;
      projectedPct?: number;
      baselinePct?: number;
      remediatedPct?: number;
      isForecast: boolean;
      milestone?: string;
    }> = [];

    // Historical 8 points
    const hist = (activeBaseline.historicalDataPoints || []).filter(p => !p.isForecast);
    hist.forEach((pt, idx) => {
      const dayOffset = (idx - hist.length + 1) * 7;
      const actual = pt.usedGB || 0;
      const base = pt.baselineGB || actual;
      data.push({
        date: pt.date,
        dayIndex: dayOffset,
        actualGB: actual,
        baselineGB: base,
        actualPct: Number(((actual / (totalCap || 1)) * 100).toFixed(1)),
        baselinePct: Number(((base / (totalCap || 1)) * 100).toFixed(1)),
        isForecast: false,
        milestone: pt.date === 'Today' ? 'Current Telemetry' : undefined,
      });
    });

    // Forecast generation from today up to projectionDays
    const todayUsed = activeBaseline.usedGB || 0;
    const surgeDaily = activeBaseline.currentDailyGrowthGB || 0;
    const baseDaily = activeBaseline.baselineDailyGrowthGB || 0;
    const remediatedDaily = Math.min(baseDaily, 10.0); // If compressed/purged
    const immediateReclaim = Math.max(50, Math.round(todayUsed * 0.22)); // Dynamic ~22% reclaim potential via compression/purge

    const forecastSteps = [
      { days: 7, label: '+7 Days' },
      { days: 14, label: '+14 Days' },
      { days: 21, label: '+21 Days' },
      { days: 28, label: '+28 Days' },
      { days: 45, label: '+45 Days' },
      { days: 60, label: '+60 Days' },
      { days: 90, label: '+90 Days' },
    ].filter(s => s.days <= projectionDays);

    forecastSteps.forEach((step) => {
      const projGB = Math.min(totalCap, todayUsed + surgeDaily * step.days);
      const normGB = todayUsed + baseDaily * step.days;
      
      // Remediated trajectory: immediate reclaim drop, then slower normal growth
      const remGB = Math.max(
        totalCap * 0.4,
        todayUsed - immediateReclaim + remediatedDaily * step.days
      );

      // Uncertainty bounds (±12% variance)
      const confHigh = Math.min(totalCap, projGB * 1.08);
      const confLow = Math.max(todayUsed, projGB * 0.94);

      let milestone: string | undefined = undefined;
      if (activeBaseline.daysTo100Pct && Math.abs(step.days - activeBaseline.daysTo100Pct) <= 7) {
        milestone = '100% Full (Outage Point)';
      } else if (activeBaseline.daysTo90Pct && Math.abs(step.days - activeBaseline.daysTo90Pct) <= 5) {
        milestone = '90% Severe Exhaustion';
      } else if (activeBaseline.daysTo80Pct && Math.abs(step.days - activeBaseline.daysTo80Pct) <= 3) {
        milestone = '80% Advisory Threshold';
      }

      data.push({
        date: step.label,
        dayIndex: step.days,
        projectedGB: Math.round(projGB),
        baselineGB: Math.round(normGB),
        remediatedGB: Math.round(remGB),
        confidenceHigh: Math.round(confHigh),
        confidenceLow: Math.round(confLow),
        projectedPct: Number(((projGB / totalCap) * 100).toFixed(1)),
        baselinePct: Number(((normGB / totalCap) * 100).toFixed(1)),
        remediatedPct: Number(((remGB / totalCap) * 100).toFixed(1)),
        isForecast: true,
        milestone,
      });
    });

    return data;
  }, [activeBaseline, projectionDays]);

  if (!activeBaseline || baselines.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
        <HardDrive className="w-10 h-10 mx-auto text-slate-600 mb-2" />
        <h4 className="text-base font-bold text-white">All Monitored Storage Baselines Nominal</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          No storage volumes currently exceeding anomaly thresholds or critical runway limits.
        </p>
      </div>
    );
  }

  const totalCapacity = activeBaseline.totalCapacityGB || 5000;
  const val80 = metricUnit === 'GB' ? totalCapacity * 0.8 : 80;
  const val90 = metricUnit === 'GB' ? totalCapacity * 0.9 : 90;
  const val100 = metricUnit === 'GB' ? totalCapacity : 100;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      
      {/* Component Title & At-Risk Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-amber-400 uppercase tracking-wider mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>D3/Recharts Predictive Timeline • Storage Anomaly Engine</span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Storage Exhaustion Trajectory & Threshold Horizon</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
              {atRiskBaselines.length} Volumes At Risk
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Statistical regression plotting current consumption surge against normal baseline, threshold breach dates (80%, 90%, 100%), and remediated what-if trajectory.
          </p>
        </div>

        {/* Action & Toggle Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Metric Toggle: GB vs % */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setMetricUnit('GB')}
              className={`px-2.5 py-1 rounded transition cursor-pointer ${
                metricUnit === 'GB' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Capacity (GB)
            </button>
            <button
              onClick={() => setMetricUnit('PCT')}
              className={`px-2.5 py-1 rounded transition cursor-pointer ${
                metricUnit === 'PCT' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Percentage (%)
            </button>
          </div>

          {/* Horizon Selection */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            {[30, 60, 90].map((days) => (
              <button
                key={days}
                onClick={() => setProjectionDays(days as any)}
                className={`px-2 py-1 rounded transition cursor-pointer ${
                  projectionDays === days ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>

          {/* What-If Remediation Toggle */}
          <button
            onClick={() => setSimulateRemediation(!simulateRemediation)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition cursor-pointer ${
              simulateRemediation
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold shadow-md shadow-emerald-950'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Simulate Fix ({simulateRemediation ? 'ON' : 'OFF'})</span>
          </button>
        </div>
      </div>

      {/* Monitored Volume Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
        {baselines.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedId(b.id)}
            className={`px-4 py-2 rounded-xl border text-xs font-mono transition flex items-center space-x-3 shrink-0 cursor-pointer ${
              selectedId === b.id
                ? 'bg-amber-950/50 border-amber-500 text-amber-200 shadow-md shadow-amber-950'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="text-left">
              <div className="font-bold flex items-center gap-1.5">
                <span>{b.serverName} • {b.databaseName}</span>
                {b.isAnomaly ? (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                Mount: {b.volumeMount} • <strong className={b.daysTo80Pct <= 90 ? "text-rose-400" : "text-emerald-400"}>{b.daysTo80Pct}d to 80%</strong> • z-score: +{b.zScore}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Main Chart Visualization */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
        
        {/* Top Chart Legend & Callout */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-sm bg-cyan-400" />
              <span className="text-slate-300">Historical Telemetry</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-0.5 bg-rose-500 border-t-2 border-dashed border-rose-500" />
              <span className="text-rose-400 font-bold">
                {activeBaseline.isAnomaly ? `Current Anomaly Surge (+${activeBaseline.growthVelocitySurgePct}%)` : `Current Baseline Velocity (${activeBaseline.currentDailyGrowthGB} GB/day)`}
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-0.5 bg-slate-500" />
              <span className="text-slate-400">Expected Normal Baseline</span>
            </div>
            {simulateRemediation && (
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-0.5 bg-emerald-400" />
                <span className="text-emerald-300 font-bold">Simulated Remediation Recovery</span>
              </div>
            )}
          </div>

          <div className="text-xs font-mono text-slate-400">
            Total LUN Capacity: <strong className="text-white">{activeBaseline.totalCapacityGB} GB</strong>
          </div>
        </div>

        {/* Recharts Composed Area & Line Chart */}
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
            >
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="remediatedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />

              <YAxis 
                domain={[0, metricUnit === 'GB' ? totalCapacity * 1.05 : 105]}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                unit={metricUnit === 'GB' ? ' GB' : '%'}
              />

              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  borderColor: '#334155', 
                  borderRadius: '0.75rem',
                  color: '#f8fafc',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}
                formatter={(value: any, name: any) => {
                  const val = typeof value === 'number' ? value.toLocaleString() : value;
                  return [
                    `${val} ${metricUnit === 'GB' ? 'GB' : '%'}`,
                    name === 'actualGB' || name === 'actualPct' ? 'Historical Used' :
                    name === 'projectedGB' || name === 'projectedPct' ? 'Projected Anomaly' :
                    name === 'baselineGB' || name === 'baselinePct' ? 'Normal Baseline' :
                    name === 'remediatedGB' || name === 'remediatedPct' ? 'Remediated Trajectory' : name
                  ];
                }}
              />

              {/* Critical Threshold Reference Lines */}
              <ReferenceLine 
                y={val80} 
                stroke="#f59e0b" 
                strokeDasharray="4 4" 
                strokeWidth={1.5}
                label={{ 
                  value: `80% Warning (${metricUnit === 'GB' ? `${Math.round(totalCapacity * 0.8)} GB` : '80%'})`, 
                  fill: '#f59e0b', 
                  fontSize: 10,
                  position: 'insideTopRight'
                }} 
              />

              <ReferenceLine 
                y={val90} 
                stroke="#f97316" 
                strokeDasharray="4 4" 
                strokeWidth={1.5}
                label={{ 
                  value: `90% Severe Exhaustion (${metricUnit === 'GB' ? `${Math.round(totalCapacity * 0.9)} GB` : '90%'})`, 
                  fill: '#f97316', 
                  fontSize: 10,
                  position: 'insideTopRight'
                }} 
              />

              <ReferenceLine 
                y={val100} 
                stroke="#ef4444" 
                strokeWidth={2}
                label={{ 
                  value: `100% Hard Disk Full (${metricUnit === 'GB' ? `${totalCapacity} GB` : '100%'})`, 
                  fill: '#ef4444', 
                  fontSize: 11,
                  position: 'insideBottomRight'
                }} 
              />

              {/* Historical Area */}
              <Area 
                type="monotone" 
                dataKey={metricUnit === 'GB' ? 'actualGB' : 'actualPct'}
                stroke="#06b6d4" 
                strokeWidth={2.5}
                fill="url(#actualGradient)" 
                name={metricUnit === 'GB' ? 'actualGB' : 'actualPct'}
              />

              {/* Projected Anomaly Surge Line */}
              <Line 
                type="monotone" 
                dataKey={metricUnit === 'GB' ? 'projectedGB' : 'projectedPct'}
                stroke="#f43f5e" 
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={{ r: 4, fill: '#f43f5e', stroke: '#0f172a', strokeWidth: 2 }}
                name={metricUnit === 'GB' ? 'projectedGB' : 'projectedPct'}
              />

              {/* Baseline Line */}
              <Line 
                type="monotone" 
                dataKey={metricUnit === 'GB' ? 'baselineGB' : 'baselinePct'}
                stroke="#64748b" 
                strokeWidth={1.5}
                dot={false}
                name={metricUnit === 'GB' ? 'baselineGB' : 'baselinePct'}
              />

              {/* Remediated Trajectory Line (When toggled) */}
              {simulateRemediation && (
                <Line 
                  type="monotone" 
                  dataKey={metricUnit === 'GB' ? 'remediatedGB' : 'remediatedPct'}
                  stroke="#10b981" 
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
                  name={metricUnit === 'GB' ? 'remediatedGB' : 'remediatedPct'}
                />
              )}

            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Milestone Threshold Countdown Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
          <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-3 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold">
              80%
            </div>
            <div>
              <div className="text-slate-400 text-[10px]">Breach Countdown</div>
              <div className="font-bold text-amber-300">
                {activeBaseline.daysTo80Pct} Day(s) ({activeBaseline.projectedDate80})
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-orange-500/40 rounded-xl p-3 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 font-bold">
              90%
            </div>
            <div>
              <div className="text-slate-400 text-[10px]">Severe Saturation</div>
              <div className="font-bold text-orange-300">
                {activeBaseline.daysTo90Pct} Days ({activeBaseline.projectedDate90})
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-rose-500/40 rounded-xl p-3 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 font-bold">
              100%
            </div>
            <div>
              <div className="text-slate-400 text-[10px]">Total Disk Full Outage</div>
              <div className="font-bold text-rose-300">
                {activeBaseline.daysTo100Pct} Days ({activeBaseline.projectedDate100})
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Action Strip: Immediate Remediation Linkage */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3 text-xs">
          <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white">
              Recommended Remediation: {activeBaseline.recommendedAction.title}
            </div>
            <div className="text-slate-400 text-[11px]">
              Expected benefit: {activeBaseline.recommendedAction.expectedBenefit}
            </div>
          </div>
        </div>

        <button
          onClick={() => onRequestApproval(activeBaseline.recommendedAction)}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center space-x-1.5 shrink-0 cursor-pointer shadow-md shadow-cyan-600/30"
        >
          <span>Authorize Remediation ({activeBaseline.recommendedAction.safetyLevel} Gate)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
