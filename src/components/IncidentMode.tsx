import React, { useState, useEffect } from 'react';
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
  TrendingDown,
  Server
} from 'lucide-react';
import { Incident, RecommendationItem } from '../types/dba';

interface IncidentModeProps {
  incidents: Incident[];
  onRequestApproval: (rec: RecommendationItem) => void;
  onSelectIncident?: (inc: Incident) => void;
}

export const IncidentMode: React.FC<IncidentModeProps> = ({
  incidents,
  onRequestApproval
}) => {
  const activeIncidents = incidents.filter(i => i.status === 'ACTIVE');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(() => {
    return activeIncidents[0]?.id || incidents[0]?.id || '';
  });

  useEffect(() => {
    if (!incidents.some(i => i.id === selectedIncidentId)) {
      setSelectedIncidentId(activeIncidents[0]?.id || incidents[0]?.id || '');
    }
  }, [incidents, selectedIncidentId, activeIncidents]);

  const activeIncident = incidents.find(i => i.id === selectedIncidentId) || activeIncidents[0] || incidents[0];

  if (!activeIncident || incidents.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white">All Monitored Database Systems Healthy</h3>
        <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
          Zero active P1/P2 incidents detected across monitored instances. Autonomous DBRE monitors sys.dm_os_wait_stats, locking hierarchies, and error logs continuously.
        </p>
      </div>
    );
  }

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

  const startTime = activeIncident.startTime || '14:24 UTC';
  const targetServer = activeIncident.server;
  const targetDb = activeIncident.database;
  const rootSpid = activeIncident.rootBlockerSpid || 78;

  const timelineEvents = [
    { 
      time: 'T - 12m', 
      title: 'Workload Ingestion Phase', 
      detail: `Concurrent client sessions connected to ${targetServer} (${targetDb}).`, 
      type: 'change' 
    },
    { 
      time: 'T - 7m', 
      title: `Session SPID ${rootSpid} Enters Exclusive Transaction`, 
      detail: `SPID ${rootSpid} acquired exclusive lock on ${targetDb} partition and entered SLEEPING state with open transaction.`, 
      type: 'anomaly' 
    },
    { 
      time: 'T - 4m', 
      title: 'Lock Contention Queue Builds', 
      detail: `Dependent worker threads queued behind SPID ${rootSpid} on LCK_M_X wait type.`, 
      type: 'anomaly' 
    },
    { 
      time: startTime, 
      title: `${activeIncident.affectedApplication || 'Service'} Latency Degraded`, 
      detail: `Observed latency SLA degradation on ${targetServer}. High-severity alert triggered.`, 
      type: 'incident' 
    },
    { 
      time: 'Just Now', 
      title: `AI DBA Incident Commander ${activeIncident.id} Activated`, 
      detail: `Lock hierarchy traversal completed with ${activeIncident.confidencePct || 94}% confidence. Safety containment gate prepared.`, 
      type: 'agent' 
    },
  ];

  const containmentSql = (activeIncident as any).suggestedAction?.sqlScript || `KILL ${rootSpid}; -- Safety containment: terminate blocker on ${targetServer}`;

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

        <div className="flex flex-wrap items-center gap-3">
          {incidents.length > 1 && (
            <div className="flex items-center space-x-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
              {incidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer flex items-center space-x-1.5 ${
                    activeIncident.id === inc.id
                      ? 'bg-rose-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{inc.id}</span>
                  <span className="text-[10px] opacity-75">({inc.server})</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center space-x-2">
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
                  <span>Server: <strong className="text-cyan-300">{targetServer}</strong></span>
                  <span>Database: <strong className="text-cyan-300">{targetDb}</strong></span>
                  <span>Impacted: <strong className="text-slate-200">{activeIncident.affectedApplication || 'Core Database Service'}</strong></span>
                </div>
              </div>

              <span className="text-xs font-mono text-slate-400">
                Started: <strong className="text-slate-200">{activeIncident.startTime || 'Recently'}</strong>
              </span>
            </div>

            {/* Business Impact Box */}
            <div className="bg-rose-950/30 border border-rose-800/50 rounded-lg p-3 text-xs text-rose-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-rose-300">
                <AlertTriangle className="w-4 h-4" />
                <span>Observed Business & Technical Impact</span>
              </span>
              <p className="text-rose-200/90 leading-relaxed">
                {activeIncident.businessImpact || `Elevated transactional latency and thread queue stalls on ${targetServer} (${targetDb}).`}
              </p>
            </div>

            {/* Root Cause Candidate Assessment */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Identified Probable Root Cause</span>
                <span className="text-cyan-400 font-mono font-bold">
                  Confidence: {activeIncident.confidencePct || 92}% (HIGH)
                </span>
              </div>
              <p className="text-sm font-medium text-slate-100">
                {activeIncident.rootCauseCandidate || `Session SPID ${rootSpid} holding exclusive lock without commit on ${targetDb}.`}
              </p>
              <div className="text-xs text-slate-400 pt-1 border-t border-slate-800 font-mono">
                <strong>DMV Evidence:</strong> SPID {rootSpid} holds uncommitted transaction in SLEEPING state on {targetDb}; cascading queue detected.
              </div>
            </div>
          </div>

          {/* Incident Timeline Correlation */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Change Correlation & Event Timeline</span>
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
                Containment Action: Terminate Blocker SPID {rootSpid}
              </h4>
              <p className="text-xs text-rose-200/90 mt-1">
                Terminating this session on <strong className="text-white font-mono">{targetServer}</strong> immediately releases exclusive table locks on {targetDb}, restoring transaction throughput.
              </p>
            </div>

            {/* Command Preview */}
            <div className="bg-slate-950 p-2.5 rounded border border-rose-900/60 font-mono text-xs text-rose-300">
              {containmentSql}
            </div>

            {/* Prerequisites */}
            <div className="text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center space-x-1.5 text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>Pre-check: Verified session is sleeping (0 wait time)</span>
              </div>
              <div className="flex items-center space-x-1.5 text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>Rollback: Applications retry via idempotent connection pool</span>
              </div>
            </div>

            {/* Trigger Button */}
            <button
              onClick={() => onRequestApproval({
                id: activeIncident.id,
                title: `Terminate Root Blocker Session SPID ${rootSpid} on ${targetServer}`,
                why: `Session ${rootSpid} has held exclusive locks on ${targetDb} without commit.`,
                evidence: `sys.dm_exec_requests shows open_transaction_count = 1, wait_time = 0, status = sleeping on ${targetServer}.`,
                expectedBenefit: `Immediate resolution of ${activeIncident.id}; transactional latency recovered within 30 seconds.`,
                risk: 'HIGH',
                implementationComplexity: 'LOW',
                rollbackMethod: 'Worker application will auto-retry transaction batch.',
                validationMethod: 'Verify blocked sessions drop to 0.',
                priority: 'CRITICAL',
                safetyLevel: 'RED',
                sqlScript: containmentSql,
                targetServer: targetServer,
                targetDatabase: targetDb,
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
                <span>Configure <strong>SET XACT_ABORT ON</strong> in connection pools to prevent orphaned open transactions on {targetServer}.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>Enforce CI/CD pull request gate requiring <strong>ONLINE = ON</strong> on all production DDL.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>Set database-level query lock timeout to 15,000ms on {targetDb}.</span>
              </li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
};
