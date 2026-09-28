import React from 'react';
import { 
  Search, 
  X, 
  AlertTriangle, 
  Sparkles, 
  Eye, 
  CheckCircle, 
  HardDrive, 
  ShieldCheck, 
  Database,
  ArrowRight
} from 'lucide-react';
import { RecommendationItem } from '../types/dba';

interface HumansMissedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestApproval: (rec: RecommendationItem) => void;
}

export const HumansMissedModal: React.FC<HumansMissedModalProps> = ({
  isOpen,
  onClose,
  onRequestApproval
}) => {
  if (!isOpen) return null;

  const hiddenFindings = [
    {
      id: 'MISS-01',
      category: 'Sub-Threshold Degradation',
      title: 'Micro-Stutter Latch Waits During Order Peaks (SQL-PROD-01)',
      severity: 'HIGH',
      description: 'Conventional 60-second monitoring intervals average out short 800ms thread stalls. However, high-resolution extended events reveal 42ms PAGEIOLATCH_SH jitter exactly when checkout concurrency exceeds 1,200 requests/sec.',
      hiddenDetail: 'Conventional alert threshold is set at >20ms sustained for 5 minutes. The micro-bursts last 45 seconds each, silently causing checkout cart drop-offs.',
      recommendation: 'Enable indirect checkpoints with TARGET_RECOVERY_TIME = 60 SECONDS to smooth buffer flushes.',
      safetyLevel: 'AMBER' as const,
      targetServer: 'SQL-PROD-01',
      targetDatabase: 'OrdersDB',
    },
    {
      id: 'MISS-02',
      category: 'Silent Backup Risk',
      title: 'Log Backup Throughput Degradation on SQL-PROD-03',
      severity: 'MEDIUM',
      description: 'Transaction log backups are still completing with exit status 0 (Success), so monitoring reports Green. However, transfer throughput has quietly degraded by 48% over 3 weeks due to SAN secondary tier saturation.',
      hiddenDetail: 'At this rate, during the upcoming month-end batch ETL, log backup duration will exceed the 15-minute RPO window, causing transaction log growth stalls.',
      recommendation: 'Re-route SQL Server backup stripe to NVMe staging volume with automated compression.',
      safetyLevel: 'AMBER' as const,
      targetServer: 'SQL-PROD-03',
      targetDatabase: 'AnalyticsDataMart',
    },
    {
      id: 'MISS-03',
      category: 'Configuration Drift',
      title: 'Ad-hoc Max Worker Threads Disparity Post-Reboot (SQL-DW-01)',
      severity: 'LOW',
      description: 'sp_configure "max worker threads" was set to 0 (dynamic), but NUMA node scheduler affinity is unbalanced after the last OS patch reboot, leaving Node 2 with 3x the thread queue of Node 1.',
      hiddenDetail: 'Standard CPU graphs report 79% overall, concealing the fact that 2 out of 8 NUMA schedulers are completely saturated.',
      recommendation: 'Rebalance NUMA node worker thread distribution and reset auto-soft NUMA partitions.',
      safetyLevel: 'AMBER' as const,
      targetServer: 'SQL-DW-01',
      targetDatabase: 'EnterpriseDW',
    },
    {
      id: 'MISS-04',
      category: 'Obsolete Data Reclamation',
      title: '52 Million Obsolete Abandoned Cart Rows (OrdersDB)',
      severity: 'INFORMATIONAL',
      description: '52,400,000 unindexed abandoned cart records older than 180 days occupy ~50 GB in the clustered index of OrdersDB, increasing buffer pool page churn and lowering Page Life Expectancy.',
      hiddenDetail: 'Monitoring dashboards never alert on dead records since disk capacity still has 34% free. Purging will reclaim ~50 GB of high-speed buffer pool RAM.',
      recommendation: 'Schedule batched transactional purge during approved maintenance window.',
      safetyLevel: 'AMBER' as const,
      targetServer: 'SQL-PROD-01',
      targetDatabase: 'OrdersDB',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white">
                  "Find What Humans Missed" Autonomous Proactive Scanner
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Section 21 Standard
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Sub-threshold anomalies, micro-stutters, and silent risks that bypass conventional alert thresholds.
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

        {/* Content List */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="bg-indigo-950/20 border border-indigo-800/40 rounded-xl p-4 text-xs text-indigo-200">
            <div className="font-bold flex items-center gap-1.5 text-indigo-300 mb-1">
              <Eye className="w-4 h-4" />
              <span>Core Question: "What would an experienced Principal DBA notice that monitoring dashboards miss?"</span>
            </div>
            <p className="text-indigo-200/80">
              Traditional monitoring relies on static alert thresholds (e.g. CPU &gt; 85% for 10m). The AI DBA Command Center scans for micro-jitter, degradation velocity trends, buffer churn patterns, and silent operational drag.
            </p>
          </div>

          <div className="space-y-4">
            {hiddenFindings.map((f) => (
              <div key={f.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-indigo-400">{f.id}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                      {f.category}
                    </span>
                    <span className="font-mono text-slate-400 text-[11px]">{f.targetServer}</span>
                  </div>

                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    f.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                    f.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {f.severity}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white leading-snug">{f.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{f.description}</p>

                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-850 text-xs text-slate-400 space-y-1">
                  <span className="font-semibold text-slate-300 block text-[11px]">Why Humans Miss It:</span>
                  <p className="text-[11px] text-slate-400">{f.hiddenDetail}</p>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-850 text-xs">
                  <span className="text-cyan-400 text-[11px]">
                    <strong>Remedy:</strong> {f.recommendation}
                  </span>
                  <button
                    onClick={() => {
                      onClose();
                      onRequestApproval({
                        id: f.id,
                        title: `Proactive Remediation: ${f.title}`,
                        why: f.description,
                        evidence: f.hiddenDetail,
                        expectedBenefit: 'Preempts technical debt and prevents future P1 incidents.',
                        risk: 'LOW',
                        implementationComplexity: 'LOW',
                        rollbackMethod: 'Standard procedure rollback.',
                        validationMethod: 'Continuous telemetry verification.',
                        priority: 'MEDIUM',
                        safetyLevel: f.safetyLevel,
                        targetServer: f.targetServer,
                        targetDatabase: f.targetDatabase,
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition flex items-center space-x-1 cursor-pointer shrink-0"
                  >
                    <span>Approve Remediation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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
