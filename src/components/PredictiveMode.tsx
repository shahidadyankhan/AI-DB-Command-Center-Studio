import React from 'react';
import { 
  LineChart, 
  HardDrive, 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  CheckCircle, 
  Layers, 
  Database,
  ArrowRight
} from 'lucide-react';
import { ServerInstance, RecommendationItem } from '../types/dba';

interface PredictiveModeProps {
  servers: ServerInstance[];
  onRequestApproval: (rec: RecommendationItem) => void;
}

export const PredictiveMode: React.FC<PredictiveModeProps> = ({
  servers,
  onRequestApproval
}) => {
  const predictions = [
    {
      id: 'PRED-01',
      title: 'Storage Exhaustion Forecast (80% Threshold in 61 Days)',
      targetServer: 'SQL-PROD-03',
      targetDatabase: 'AnalyticsDataMart',
      horizon: '61 Days (Target date: Nov 28, 2026)',
      confidencePct: 92,
      confidenceLevel: 'HIGH',
      growthVelocity: '+38% MoM',
      currentFreeSpacePct: 21,
      evidence: '90-day linear regression model shows storage consumption accelerating from 22 GB/day to 38.4 GB/day following new mobile telemetry ingestion.',
      assumptions: 'Assumes continuous ingestion rate without archival purge job or table partition compression.',
      uncertainty: '±6 days margin based on month-end ETL variance.',
      recommendation: 'Expand SAN Storage LUN by +2.0 TB or deploy automated 90-day cold partition archival to Azure Blob.',
      safetyLevel: 'AMBER' as const,
      actionId: 'REC-004',
    },
    {
      id: 'PRED-02',
      title: 'Database Growth Velocity Anomaly (+38% vs 30-Day Baseline)',
      targetServer: 'SQL-PROD-03',
      targetDatabase: 'AnalyticsDataMart',
      horizon: 'Current 30-Day Window',
      confidencePct: 88,
      confidenceLevel: 'HIGH',
      growthVelocity: '+38.0%',
      currentFreeSpacePct: 21,
      evidence: 'sys.dm_db_file_space_usage shows analytical fact tables added 1.1 TB in last 30 days compared with historical 790 GB average.',
      assumptions: 'Clickstream raw table dbo.FactUserClickstream lacks retention index cleanup.',
      uncertainty: 'Data ingestion may slow after Q4 campaign concludes.',
      recommendation: 'Implement data lifecycle management purge policy to reclaim ~450 GB obsolete clickstream records.',
      safetyLevel: 'AMBER' as const,
      actionId: 'REC-006',
    },
    {
      id: 'PRED-03',
      title: 'Query Duration Degradation (7 Consecutive Days)',
      targetServer: 'SQL-PROD-01',
      targetDatabase: 'OrdersDB',
      horizon: 'Next 14 Days',
      confidencePct: 84,
      confidenceLevel: 'MEDIUM',
      growthVelocity: '+8.4% daily',
      currentFreeSpacePct: 34,
      evidence: 'Query Store trend analysis shows Query #41829 duration has deteriorated over 7 consecutive days due to clustered index fragmentation (38.2%).',
      assumptions: 'Daily order volume continues at ~180,000 transactions/day.',
      uncertainty: 'Weekend batch defragmentation may temporarily reset latency.',
      recommendation: 'Schedule targeted online index rebuild and statistics update with FULLSCAN.',
      safetyLevel: 'AMBER' as const,
      actionId: 'REC-007',
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <LineChart className="w-3.5 h-3.5" />
            <span>Mode E — Predictive Capacity & Risk Forecasting (Section 9)</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Predictive Analytics & Capacity Exhaustion Modeling
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Statistical regression forecasting storage exhaustion, database growth velocity, and query regressions.
          </p>
        </div>

        <div className="bg-slate-950 px-4 py-2 rounded-lg border border-slate-800 text-xs">
          <span className="text-slate-400">Predictive Engine: </span>
          <strong className="text-cyan-400 font-mono">90-Day Moving Regression Active</strong>
        </div>
      </div>

      {/* Predictive Models Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {predictions.map((p) => (
          <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-lg">
            
            <div className="space-y-3">
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/80">
                  {p.id} • {p.targetServer}
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {p.confidencePct}% Confidence
                </span>
              </div>

              {/* Title */}
              <h3 className="text-base font-bold text-white leading-snug">
                {p.title}
              </h3>

              {/* Metrics Pills */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Forecast Horizon</span>
                  <span className="text-amber-400 font-bold">{p.horizon}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Velocity Anomaly</span>
                  <span className="text-rose-400 font-bold">{p.growthVelocity}</span>
                </div>
              </div>

              {/* Evidence & Reasoning */}
              <div className="text-xs text-slate-300 space-y-2 pt-2 border-t border-slate-800/80">
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Observable Evidence:</span>
                  <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">{p.evidence}</p>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Model Assumptions:</span>
                  <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">{p.assumptions}</p>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Uncertainty Factor:</span>
                  <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">{p.uncertainty}</p>
                </div>
              </div>
            </div>

            {/* Action Box */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="text-xs text-slate-200">
                <strong>Recommended Remediation:</strong> {p.recommendation}
              </div>
              <button
                onClick={() => onRequestApproval({
                  id: p.actionId,
                  title: `Proactive Remediation for ${p.id}`,
                  why: p.evidence,
                  evidence: `${p.growthVelocity} velocity anomaly. 80% threshold in ${p.horizon}.`,
                  expectedBenefit: 'Avoids emergency storage suspension and maintains continuous business operations.',
                  risk: 'LOW',
                  implementationComplexity: 'MEDIUM',
                  rollbackMethod: 'Standard infrastructure storage rollback.',
                  validationMethod: 'Verify free volume space > 40%.',
                  priority: 'HIGH',
                  safetyLevel: p.safetyLevel,
                  targetServer: p.targetServer,
                  targetDatabase: p.targetDatabase,
                })}
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <span>Propose Action ({p.safetyLevel} Gate)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};
