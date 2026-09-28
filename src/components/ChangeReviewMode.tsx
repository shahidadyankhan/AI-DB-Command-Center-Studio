import React, { useState } from 'react';
import { 
  GitPullRequest, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  FileCode, 
  Play, 
  Send, 
  Sparkles,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { RecommendationItem } from '../types/dba';

interface ChangeReviewModeProps {
  onRequestApproval: (rec: RecommendationItem) => void;
}

export const ChangeReviewMode: React.FC<ChangeReviewModeProps> = ({
  onRequestApproval
}) => {
  const [changeTitle, setChangeTitle] = useState('Create Nonclustered Index on Orders (ProcessingStatus, CreatedDate)');
  const [targetServer, setTargetServer] = useState('SQL-PROD-01');
  const [targetDatabase, setTargetDatabase] = useState('OrdersDB');
  const [changeScript, setChangeScript] = useState(`CREATE NONCLUSTERED INDEX IX_Orders_Status_CreatedDate 
ON dbo.Orders (ProcessingStatus, CreatedDate) 
INCLUDE (OrderId, CustomerId, TotalAmount) 
WITH (ONLINE = ON, SORT_IN_TEMPDB = ON, MAXDOP = 4);`);

  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<any>({
    changeTitle: 'Create Nonclustered Index on Orders (ProcessingStatus, CreatedDate)',
    targetServer: 'SQL-PROD-01',
    targetDatabase: 'OrdersDB',
    riskScore: 32,
    riskLevel: 'MEDIUM',
    cabRecommendation: 'APPROVE WITH CONDITIONS',
    checks: [
      { name: 'ONLINE=ON Option Check', passed: true, note: 'Script includes WITH (ONLINE = ON), preventing exclusive table locking during index build.' },
      { name: 'SORT_IN_TEMPDB Option Check', passed: true, note: 'Sort allocated to TempDB; primary data file fragmentation avoided.' },
      { name: 'TempDB Capacity Verification', passed: true, note: 'TempDB volume has 180 GB free; estimated sort requirement is ~35 GB.' },
      { name: 'Lock Timeout Guard', passed: false, note: 'Missing "SET LOCK_TIMEOUT 5000;" to abort if schema lock cannot be acquired within 5s.' },
      { name: 'Always On Secondary Redo Lag', passed: true, note: 'Redo generation rate projected at 120 MB/s, well within 500 MB/s secondary throughput.' },
      { name: 'Deterministic Rollback Plan', passed: true, note: 'DROP INDEX statement verified and syntax checked.' },
    ],
    mandatoryPrerequisites: [
      'Prepend script with: SET LOCK_TIMEOUT 5000; to protect concurrent checkout transactions.',
      'Schedule execution during approved low-concurrency maintenance window (01:00 - 03:00 UTC).',
      'Verify Always On secondary replication synchronization lag is < 5 seconds before initiating execution.',
    ],
    rollbackPlan: 'DROP INDEX IX_Orders_Status_CreatedDate ON dbo.Orders;',
    validationCriteria: 'Monitor sys.dm_db_index_usage_stats seeks count > 5,000 within 2 hours; verify PAGEIOLATCH_SH drop on OrdersDB.',
  });

  const [copiedRollback, setCopiedRollback] = useState(false);

  const handleReview = async () => {
    setIsReviewing(true);
    try {
      const res = await fetch('/api/dba/cab-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeTitle,
          targetServer,
          targetDatabase,
          changeScript
        }),
      });
      const data = await res.json();
      setReviewResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsReviewing(false);
    }
  };

  const copyRollback = () => {
    if (reviewResult?.rollbackPlan) {
      navigator.clipboard.writeText(reviewResult.rollbackPlan);
      setCopiedRollback(true);
      setTimeout(() => setCopiedRollback(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <GitPullRequest className="w-3.5 h-3.5" />
            <span>Mode F — Strict CAB / DBA Change Reviewer (Section 3 Mode F)</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Production Change Advisory Board (CAB) & Rollback Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Pre-implementation risk grading, lock escalation audit, Always On secondary lag evaluation, and rollback verification.
          </p>
        </div>

        <span className="text-xs font-mono px-3 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
          Strict Production Policy Enforcement
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Col: Change Submission Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span>Proposed Change Submission</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">Change Request Title</label>
              <input
                type="text"
                value={changeTitle}
                onChange={(e) => setChangeTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Target SQL Server</label>
                <select
                  value={targetServer}
                  onChange={(e) => setTargetServer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="SQL-PROD-01">SQL-PROD-01 (Core OLTP)</option>
                  <option value="SQL-PROD-02">SQL-PROD-02 (Payments Primary)</option>
                  <option value="SQL-PROD-03">SQL-PROD-03 (Analytics Replica)</option>
                  <option value="SQL-DW-01">SQL-DW-01 (Data Warehouse)</option>
                  <option value="SQL-STG-01">SQL-STG-01 (Staging)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Target Database</label>
                <input
                  type="text"
                  value={targetDatabase}
                  onChange={(e) => setTargetDatabase(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">Proposed SQL DDL / DML Script</label>
              <textarea
                rows={6}
                value={changeScript}
                onChange={(e) => setChangeScript(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-cyan-200 font-mono text-xs focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>

            <button
              onClick={handleReview}
              disabled={isReviewing}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isReviewing ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Sparkles className="w-4 h-4 text-cyan-200" />
              )}
              <span>Run Strict AI DBA CAB Audit</span>
            </button>
          </div>
        </div>

        {/* Right Col: CAB Review Evaluation & Rollback Plan */}
        {reviewResult && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>CAB Assessment Verdict</span>
                </h3>
                <span className="text-xs text-slate-400">Strict DBA Guardrail Audit</span>
              </div>

              <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded ${
                reviewResult.cabRecommendation.includes('APPROVE')
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
                {reviewResult.cabRecommendation}
              </span>
            </div>

            {/* Checklist */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-mono uppercase text-slate-400 block">Production Safety Checklist:</span>
              <div className="space-y-1.5 text-xs">
                {reviewResult.checks.map((c: any, idx: number) => (
                  <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-start space-x-2">
                    {c.passed ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-200">{c.name}</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">{c.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mandatory Prerequisites */}
            <div className="bg-amber-950/20 border border-amber-800/40 rounded-lg p-3 text-xs space-y-1">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Mandatory CAB Prerequisites:</span>
              </span>
              <ul className="list-disc list-inside text-amber-200/90 text-[11px] space-y-1">
                {reviewResult.mandatoryPrerequisites.map((p: string, i: number) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>

            {/* Rollback Script Box (Section 17) */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Deterministic Rollback Script (Section 17)</span>
                <button
                  onClick={copyRollback}
                  className="flex items-center space-x-1 text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
                >
                  {copiedRollback ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedRollback ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] font-mono text-cyan-200 bg-slate-900 p-2 rounded border border-slate-800">
                {reviewResult.rollbackPlan}
              </p>
            </div>

            {/* Authorize via Safety Gate */}
            <button
              onClick={() => onRequestApproval({
                id: 'CAB-CHANGE-APPROVED',
                title: `Execute Approved CAB Change: ${changeTitle}`,
                why: 'Approved index optimization following CAB audit.',
                evidence: 'Online index option confirmed; rollback script generated.',
                expectedBenefit: 'Resolves scan overhead without blocking concurrent transactions.',
                risk: 'MEDIUM',
                implementationComplexity: 'MEDIUM',
                rollbackMethod: reviewResult.rollbackPlan,
                validationMethod: reviewResult.validationCriteria,
                priority: 'MEDIUM',
                safetyLevel: 'AMBER',
                sqlScript: changeScript,
                targetServer,
                targetDatabase,
              })}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <span>Promote to Execution Queue (AMBER Gate)</span>
            </button>
          </div>
        )}

      </div>

    </div>
  );
};
