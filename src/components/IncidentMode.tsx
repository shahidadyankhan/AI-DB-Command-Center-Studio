import React from 'react';
import { 
  Flame, 
  CheckCircle2, 
  Clock, 
  GitCommit, 
  ShieldAlert, 
  AlertTriangle, 
  Layers, 
  Check, 
  FileText,
  TrendingDown
} from 'lucide-react';
import { Incident, RecommendationItem } from '../types/dba';

interface IncidentModeProps {
  incidents: Incident[];
  onRequestApproval: (rec: RecommendationItem) => void;
  onSelectIncident: (inc: Incident) => void;
}

export const IncidentMode: React.FC<IncidentModeProps> = ({
  incidents,
  onRequestApproval
}) => {
  const activeIncident = incidents.find(i => i.status === 'ACTIVE') || incidents[0];

  const steps = [
    { num: 1, name: 'DETECT', status: 'completed' },
    { num: 2, name: 'SCOPE', status: 'completed' },
    { num: 3, name: 'TRIAGE', status: 'completed' },
    { num: 4, name: 'CORRELATE', status: 'completed' },
    { num: 5, name: 'IDENTIFY', status: activeIncident?.status === 'ACTIVE' ? 'current' : 'completed' },
    { num: 6, name: 'CONTAIN', status: activeIncident?.status === 'ACTIVE' ? 'pending' : 'completed' },
    { num: 7, name: 'REMEDIATE', status: 'pending' },
    { num: 8, name: 'VALIDATE', status: 'pending' },
    { num: 9, name: 'DOCUMENT', status: 'pending' },
  ];

  const timelineEvents = [
    { time: '14:17 UTC', title: 'Application Release v4.12.0 deployed', detail: 'Deploy pipeline pushed new checkout batch retry worker service to K8S cluster.', type: 'change' },
    { time: '14:20 UTC', title: 'Ad-hoc Index Creation CHG-8902', detail: 'svc_dba_ops created index on OrderItems without ONLINE=ON, holding brief schema-stability lock.', type: 'change' },
    { time: '14:24 UTC', title: 'Session SPID 78 opens transaction', detail: 'svc_checkout_worker started BEGIN TRANSACTION and entered SLEEPING state (uncommitted for >340s).', type: 'anomaly' },
    { time: '14:25 UTC', title: 'First Blocking Cascade begins', detail: 'SPID 112 blocked on Orders partition (LCK_M_X lock).', type: 'anomaly' },
    { time: '14:28 UTC', title: 'Checkout P99 Latency reaches 3,200ms', detail: '14 downstream sessions blocked. Cart abandonment alerts trigger.', type: 'incident' },
    { time: '14:32 UTC', title: 'AI DBA Incident Commander INC-4092 created', detail: 'Autonomous detection, lock tree traversal, and correlation completed with 94% confidence.', type: 'agent' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-rose-400 uppercase tracking-wider mb-1">
            <Flame className="w-3.5 h-3.5" />
            <span>Mode C — Active Incident Commander (Section 14)</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Incident Response & Root Cause Containment
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            10-Step Autonomous Incident Lifecycle with Human-in-the-Loop Safety Gates
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
            activeIncident.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' : 'bg-amber-500/20 text-amber-400'
          }`}>
            {activeIncident.id} • {activeIncident.severity}
          </span>
          <span className="text-xs font-mono text-slate-400">
            Status: <strong className="text-white">{activeIncident.status}</strong>
          </span>
        </div>
      </div>

      {/* 10-Step Incident Commander Progress Bar (Section 14) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-x-auto">
        <div className="text-[11px] font-mono uppercase text-slate-400 mb-3 flex items-center justify-between">
          <span>Incident Commander 10-Step Lifecycle Workflow</span>
          <span className="text-cyan-400">Section 14 Operating Standard</span>
        </div>

        <div className="flex items-center min-w-max space-x-2">
          {steps.map((st, i) => (
            <React.Fragment key={st.num}>
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition ${
                st.status === 'completed'
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : st.status === 'current'
                  ? 'bg-rose-950/80 border-rose-600 text-rose-200 animate-pulse shadow-md shadow-rose-950'
                  : 'bg-slate-950/40 border-slate-800 text-slate-500'
              }`}>
                {st.status === 'completed' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">
                    {st.num}
                  </span>
                )}
                <span>{st.name}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-3 h-0.5 ${st.status === 'completed' ? 'bg-emerald-700' : 'bg-slate-800'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main Incident Details & Containment Action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Incident Triage & Timeline */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Incident Overview Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {activeIncident.title}
                </h3>
                <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1 font-mono">
                  <span>Server: <strong className="text-cyan-300">{activeIncident.server}</strong></span>
                  <span>Database: <strong className="text-cyan-300">{activeIncident.database}</strong></span>
                  <span>Impacted: <strong className="text-slate-200">{activeIncident.affectedApplication}</strong></span>
                </div>
              </div>

              <span className="text-xs font-mono text-slate-400">
                Started: <strong className="text-slate-200">{activeIncident.startTime}</strong>
              </span>
            </div>

            {/* Business Impact Box */}
            <div className="bg-rose-950/30 border border-rose-800/50 rounded-lg p-3 text-xs text-rose-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-rose-300">
                <AlertTriangle className="w-4 h-4" />
                <span>Observed Business & Technical Impact</span>
              </span>
              <p className="text-rose-200/90 leading-relaxed">
                {activeIncident.businessImpact}
              </p>
            </div>

            {/* Root Cause Candidate Assessment */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Identified Probable Root Cause</span>
                <span className="text-cyan-400 font-mono font-bold">
                  Confidence: {activeIncident.confidencePct}% (HIGH)
                </span>
              </div>
              <p className="text-sm font-medium text-slate-100">
                {activeIncident.rootCauseCandidate}
              </p>
              <div className="text-xs text-slate-400 pt-1 border-t border-slate-800">
                <strong>DMV Evidence:</strong> SPID {activeIncident.rootBlockerSpid} has held an exclusive LCK_M_X lock on dbo.Orders for &gt;340s.
              </div>
            </div>
          </div>

          {/* Incident Timeline Correlation (Section 7 & 10) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Change Correlation & Event Timeline (Section 7)</span>
            </h4>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {timelineEvents.map((evt, idx) => (
                <div key={idx} className="relative">
                  <div className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                    evt.type === 'change' ? 'bg-amber-400' :
                    evt.type === 'incident' ? 'bg-rose-500' :
                    evt.type === 'anomaly' ? 'bg-orange-400' :
                    'bg-cyan-400'
                  }`} />
                  <div className="text-xs font-mono text-slate-400">{evt.time}</div>
                  <div className="text-xs font-bold text-slate-200 mt-0.5">{evt.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{evt.detail}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Col: Remediation Gate & Safety Approval Action */}
        <div className="space-y-6">
          
          {/* Action Approval Box */}
          <div className="bg-gradient-to-b from-rose-950/60 to-slate-900 border-2 border-rose-500/70 rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center space-x-2 text-rose-300 font-mono text-xs uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Safety Gate: Approval Required</span>
            </div>

            <div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-rose-500 text-white font-bold rounded">
                RED SAFETY LEVEL
              </span>
              <h4 className="text-base font-bold text-white mt-2 leading-snug">
                Containment Action: Terminate Root Blocker SPID 78
              </h4>
              <p className="text-xs text-rose-200/90 mt-1">
                Terminating this idle transaction immediately releases exclusive table locks on dbo.Orders, restoring checkout operations.
              </p>
            </div>

            {/* Command Preview */}
            <div className="bg-slate-950 p-2.5 rounded border border-rose-900/60 font-mono text-xs text-rose-300">
              KILL 78; -- Verified target: SPID 78 svc_checkout_worker
            </div>

            {/* Prerequisites */}
            <div className="text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center space-x-1.5 text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>Pre-check: Verified session is sleeping (0 wait time)</span>
              </div>
              <div className="flex items-center space-x-1.5 text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>Rollback: Checkout workers retry via idempotent queue</span>
              </div>
            </div>

            {/* Trigger Button */}
            <button
              onClick={() => onRequestApproval({
                id: 'REC-001',
                title: 'Terminate Root Blocker Session SPID 78',
                why: 'Session 78 has held exclusive LCK_M_X locks on OrdersDB for >340s.',
                evidence: 'sys.dm_exec_requests shows open_transaction_count = 1, wait_time = 0, status = sleeping.',
                expectedBenefit: 'Immediate resolution of INC-4092; P99 checkout latency expected to recover within 30 seconds.',
                risk: 'HIGH',
                implementationComplexity: 'LOW',
                rollbackMethod: 'Worker application will auto-retry order batch.',
                validationMethod: 'Verify blocked sessions drop to 0.',
                priority: 'CRITICAL',
                safetyLevel: 'RED',
                sqlScript: 'KILL 78; -- Safety verification: SPID 78 svc_checkout_worker',
                targetServer: 'SQL-PROD-01',
                targetDatabase: 'OrdersDB',
              })}
              className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/40 transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-white" />
              <span>Review & Authorize Action (RED GATE)</span>
            </button>
          </div>

          {/* Preventative Recommendations */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-3">
            <span className="font-bold text-slate-200 block">Post-Containment Hardening</span>
            <ul className="space-y-2 text-slate-400 text-[11px]">
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>Configure <strong>SET XACT_ABORT ON</strong> in checkout worker connection pool to prevent orphaned transactions.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>Enforce CI/CD pull request gate requiring <strong>ONLINE = ON</strong> on all production index DDL.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>Set database-level query lock timeout to 15,000ms.</span>
              </li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
};
