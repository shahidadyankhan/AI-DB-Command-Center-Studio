import React, { useState, useEffect } from 'react';
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
  Check,
  Database,
  Server,
  Plus,
  ShieldAlert,
  Trash2,
  X
} from 'lucide-react';
import { ServerInstance, RecommendationItem } from '../types/dba';

interface ChangeReviewModeProps {
  servers?: ServerInstance[];
  onRequestApproval: (rec: RecommendationItem) => void;
  onOpenAddServer?: () => void;
  onClearMockServers?: () => Promise<boolean>;
}

export const ChangeReviewMode: React.FC<ChangeReviewModeProps> = ({
  servers = [],
  onRequestApproval,
  onOpenAddServer,
  onClearMockServers
}) => {
  const initialServer = servers[0];
  const initialDb = initialServer?.databases?.[0]?.name || 'ProductionDB';
  const [selectedServerName, setSelectedServerName] = useState<string>(() => initialServer?.name || '');
  const [targetDatabase, setTargetDatabase] = useState<string>(() => initialDb);
  const [changeTitle, setChangeTitle] = useState(() => `Create Nonclustered Covering Index on ${initialDb}`);
  const [changeScript, setChangeScript] = useState(() => `CREATE NONCLUSTERED INDEX IX_${initialDb}_Status 
ON dbo.${initialDb}_Transactions (Status, CreatedAt DESC) 
INCLUDE (Id, Amount) 
WITH (ONLINE = ON, SORT_IN_TEMPDB = ON, MAXDOP = 4);`);

  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [copiedRollback, setCopiedRollback] = useState(false);
  const [isClearingMock, setIsClearingMock] = useState(false);
  const [showClearMockConfirm, setShowClearMockConfirm] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const mockServers = servers.filter(
    (s) => s.telemetryMode === 'simulated' || ['sql-prod-01', 'sql-prod-02', 'sql-prod-03'].includes(s.id)
  );

  // Sync selectedServerName if current selection was removed or changed
  useEffect(() => {
    if (servers.length > 0) {
      const exists = servers.some(s => s.name === selectedServerName);
      if (!exists) {
        const s = servers[0];
        setSelectedServerName(s.name);
        const dbs = s.databases || [];
        const primaryDb = dbs[0]?.name || 'ProductionDB';
        setTargetDatabase(primaryDb);
        setChangeTitle(`Create Nonclustered Index on ${primaryDb}`);
        setChangeScript(`CREATE NONCLUSTERED INDEX IX_${primaryDb}_Status \nON dbo.${primaryDb}_Transactions (Status, CreatedAt DESC) \nINCLUDE (Id, Amount) \nWITH (ONLINE = ON, SORT_IN_TEMPDB = ON, MAXDOP = 4);`);
      }
    }
  }, [servers, selectedServerName]);

  const currentServer = servers.find(s => s.name === selectedServerName) || servers[0];
  const availableDatabases = currentServer?.databases || [];

  const handleServerChange = (sName: string) => {
    setSelectedServerName(sName);
    const s = servers.find(srv => srv.name === sName);
    if (s && s.databases && s.databases.length > 0) {
      const dbName = s.databases[0].name;
      setTargetDatabase(dbName);
      setChangeTitle(`Create Nonclustered Index on ${dbName}`);
      setChangeScript(`CREATE NONCLUSTERED INDEX IX_${dbName}_Status \nON dbo.${dbName}_Transactions (Status, CreatedAt DESC) \nINCLUDE (Id, Amount) \nWITH (ONLINE = ON, SORT_IN_TEMPDB = ON, MAXDOP = 4);`);
    }
  };

  const applyTemplate = (templateType: 'index' | 'compress' | 'maxdop') => {
    const db = targetDatabase || 'ProductionDB';
    if (templateType === 'index') {
      setChangeTitle(`Create Nonclustered Covering Index on ${db}`);
      setChangeScript(`CREATE NONCLUSTERED INDEX IX_${db}_Lookup 
ON dbo.${db}_Transactions (Status, CreatedAt DESC) 
INCLUDE (Id, Amount) 
WITH (ONLINE = ON, SORT_IN_TEMPDB = ON, MAXDOP = 4);`);
    } else if (templateType === 'compress') {
      setChangeTitle(`Enable PAGE Data Compression on ${db} Historical Table`);
      setChangeScript(`ALTER TABLE dbo.${db}_Transactions 
REBUILD WITH (DATA_COMPRESSION = PAGE, ONLINE = ON, SORT_IN_TEMPDB = ON);`);
    } else if (templateType === 'maxdop') {
      setChangeTitle(`Configure Instance Max Degree of Parallelism (MAXDOP 8)`);
      setChangeScript(`EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure 'max degree of parallelism', 8;
RECONFIGURE WITH OVERRIDE;`);
    }
  };

  const handleReview = async () => {
    if (!selectedServerName) return;
    setIsReviewing(true);
    try {
      const res = await fetch('/api/dba/cab-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeTitle,
          targetServer: selectedServerName,
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

  // Run initial evaluation when selectedServerName and targetDatabase are ready if reviewResult is null
  useEffect(() => {
    if (selectedServerName && !reviewResult) {
      handleReview();
    }
  }, [selectedServerName, targetDatabase]);

  const copyRollback = () => {
    if (reviewResult?.rollbackPlan) {
      navigator.clipboard.writeText(reviewResult.rollbackPlan);
      setCopiedRollback(true);
      setTimeout(() => setCopiedRollback(false), 2000);
    }
  };

  if (servers.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
        <GitPullRequest className="w-12 h-12 mx-auto text-slate-600" />
        <h3 className="text-xl font-bold text-white">No Monitored SQL Server Instances</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Mode F CAB Review requires at least one monitored SQL Server instance to execute pre-flight safety audits, lock escalation checks, and rollback plan validation.
        </p>
        {onOpenAddServer && (
          <button
            onClick={onOpenAddServer}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition cursor-pointer"
          >
            Register SQL Server Instance
          </button>
        )}
      </div>
    );
  }

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
            Pre-implementation risk grading, lock escalation audit, Always On secondary lag evaluation, and deterministic rollback verification across {servers.length} instance(s).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {actionFeedback && (
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded">
              {actionFeedback}
            </span>
          )}

          {mockServers.length > 0 && onClearMockServers && (
            <button
              type="button"
              onClick={() => setShowClearMockConfirm(true)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-rose-100 text-xs font-mono transition cursor-pointer"
              title="Decommission all mock/simulated servers"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Purge Mock ({mockServers.length})</span>
            </button>
          )}

          {onOpenAddServer && (
            <button
              onClick={onOpenAddServer}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Server</span>
            </button>
          )}

          <span className="text-xs font-mono px-3 py-1 rounded bg-slate-950 border border-slate-800 text-cyan-300">
            Strict Production Policy Enforced
          </span>
        </div>
      </div>

      {/* Confirmation Modal for Clearing All Mock Servers */}
      {showClearMockConfirm && onClearMockServers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                <Trash2 className="w-4 h-4" />
                <span>Purge All Mock Servers</span>
              </div>
              <button 
                onClick={() => setShowClearMockConfirm(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to decommission and remove all <strong className="text-white font-mono">{mockServers.length}</strong> mock/simulated servers? Connected real instances will remain untouched.
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearMockConfirm(false)}
                disabled={isClearingMock}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsClearingMock(true);
                  const ok = await onClearMockServers();
                  setIsClearingMock(false);
                  setShowClearMockConfirm(false);
                  if (ok) {
                    setActionFeedback('All mock servers purged from estate.');
                    setTimeout(() => setActionFeedback(null), 3000);
                  }
                }}
                disabled={isClearingMock}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30 flex items-center space-x-1.5 transition cursor-pointer"
              >
                {isClearingMock && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Purge Mock Servers</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Col: Change Submission Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>Proposed Change Submission</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">Target: {selectedServerName}</span>
          </div>

          {/* Quick Change Script Templates */}
          <div className="flex items-center space-x-2 text-[11px] font-mono">
            <span className="text-slate-400">Templates:</span>
            <button
              type="button"
              onClick={() => applyTemplate('index')}
              className="px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-cyan-700 text-cyan-300 transition cursor-pointer"
            >
              Covering Index
            </button>
            <button
              type="button"
              onClick={() => applyTemplate('compress')}
              className="px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-cyan-700 text-cyan-300 transition cursor-pointer"
            >
              PAGE Compression
            </button>
            <button
              type="button"
              onClick={() => applyTemplate('maxdop')}
              className="px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-cyan-700 text-cyan-300 transition cursor-pointer"
            >
              MAXDOP 8
            </button>
          </div>

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
                  value={selectedServerName}
                  onChange={(e) => handleServerChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {servers.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.role || 'SQL Workload'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Target Database</label>
                {availableDatabases.length > 0 ? (
                  <select
                    value={targetDatabase}
                    onChange={(e) => setTargetDatabase(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    {availableDatabases.map((db) => (
                      <option key={db.name} value={db.name}>
                        {db.name} ({db.sizeGB} GB)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={targetDatabase}
                    onChange={(e) => setTargetDatabase(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                )}
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
              <span>Run Strict AI DBA CAB Audit on {selectedServerName}</span>
            </button>
          </div>
        </div>

        {/* Right Col: CAB Review Evaluation & Rollback Plan */}
        {reviewResult ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>CAB Assessment Verdict</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {reviewResult.targetServer || selectedServerName} • {reviewResult.targetDatabase || targetDatabase}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-400">
                  Risk: <strong className={reviewResult.riskScore > 50 ? 'text-rose-400' : 'text-emerald-400'}>{reviewResult.riskScore}/100</strong>
                </span>
                <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded ${
                  reviewResult.cabRecommendation?.includes('APPROVE')
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {reviewResult.cabRecommendation}
                </span>
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-mono uppercase text-slate-400 block">Production Safety Checklist:</span>
              <div className="space-y-1.5 text-xs">
                {reviewResult.checks?.map((c: any, idx: number) => (
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
                {reviewResult.mandatoryPrerequisites?.map((p: string, i: number) => (
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
                id: `CAB-${Date.now()}`,
                title: `Execute Approved CAB Change: ${changeTitle}`,
                why: `Approved production change following strict CAB audit on ${selectedServerName}.`,
                evidence: `Pre-flight checks passed; deterministic rollback plan verified for ${targetDatabase}.`,
                expectedBenefit: 'Resolves database performance bottleneck without uncommitted lock escalation.',
                risk: reviewResult.riskLevel || 'MEDIUM',
                implementationComplexity: 'MEDIUM',
                rollbackMethod: reviewResult.rollbackPlan,
                validationMethod: reviewResult.validationCriteria || 'Verify sys.dm_os_wait_stats and Query Store latency.',
                priority: 'HIGH',
                safetyLevel: 'AMBER',
                sqlScript: changeScript,
                targetServer: selectedServerName,
                targetDatabase,
              })}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>Promote to Safety Execution Queue (AMBER Gate)</span>
            </button>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-xs">Analyzing change script against {selectedServerName} configuration...</p>
          </div>
        )}

      </div>

    </div>
  );
};
