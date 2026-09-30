import React, { useState } from 'react';
import { 
  BookOpen, 
  X, 
  Copy, 
  Check, 
  Terminal, 
  ShieldCheck, 
  Server, 
  Database, 
  HardDrive, 
  Zap, 
  Flame, 
  CheckCircle2, 
  Download, 
  FileText, 
  ChevronRight,
  Layers,
  Activity,
  Lock,
  GitCommit,
  Sliders,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

interface SystemDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemDocumentationModal: React.FC<SystemDocumentationModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeChapter, setActiveChapter] = useState<'architecture' | 'setup' | 'connectivity' | 'modes' | 'safety' | 'console' | 'runbooks' | 'airgapped' | 'assets'>('setup');
  const [copiedCodeSnippet, setCopiedCodeSnippet] = useState<string | null>(null);
  const [copiedFullDoc, setCopiedFullDoc] = useState(false);

  if (!isOpen) return null;

  const copySnippet = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeSnippet(id);
    setTimeout(() => setCopiedCodeSnippet(null), 2000);
  };

  const tsqlProvisioningScript = `-- =========================================================================
-- AI DBA Command Center: Least-Privilege Monitoring User Setup
-- Compatible with: SQL Server 2016, 2017, 2019, 2022, Azure SQL MI
-- =========================================================================

USE [master];
GO

-- 1. Create dedicated monitoring login with strong cryptographic password
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'svc_ai_dba_agent')
BEGIN
    CREATE LOGIN [svc_ai_dba_agent] 
    WITH PASSWORD = N'ReplaceWithYourStrongPassword!2026', 
    CHECK_EXPIRATION = OFF, 
    CHECK_POLICY = ON;
END
GO

-- 2. Grant Core Server Telemetry Permissions
GRANT VIEW SERVER STATE TO [svc_ai_dba_agent];
-- For SQL Server 2022 (v16.x) and above:
IF @@MICROSOFTVERSION / 0x01000000 >= 16
BEGIN
    EXEC sp_executesql N'GRANT VIEW SERVER PERFORMANCE STATE TO [svc_ai_dba_agent];';
    EXEC sp_executesql N'GRANT VIEW SERVER SECURITY STATE TO [svc_ai_dba_agent];';
END
GO

GRANT VIEW ANY DEFINITION TO [svc_ai_dba_agent];
GRANT CONNECT SQL TO [svc_ai_dba_agent];
GO

-- 3. Grant Query Store & Database Diagnostic Permissions across user databases
DECLARE @Sql NVARCHAR(MAX) = N'';
SELECT @Sql = @Sql + N'
USE ' + QUOTENAME(name) + N';
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = ''svc_ai_dba_agent'')
BEGIN
    CREATE USER [svc_ai_dba_agent] FOR LOGIN [svc_ai_dba_agent];
END;
GRANT VIEW DATABASE STATE TO [svc_ai_dba_agent];
GRANT VIEW DEFINITION TO [svc_ai_dba_agent];
'
FROM sys.databases 
WHERE database_id > 4 
  AND state_desc = 'ONLINE' 
  AND is_read_only = 0;

EXEC sp_executesql @Sql;
GO

PRINT 'AI DBA Agent least-privilege telemetry user configured successfully.';
`;

  const queryStoreSetupScript = `-- =========================================================================
-- Recommended Query Store Configuration for Continuous Regression Auditing
-- Run on each Tier-1 database to enable plan capture & baseline modeling
-- =========================================================================

ALTER DATABASE [YourProductionDatabase] 
SET QUERY_STORE = ON 
(
    OPERATION_MODE = READ_WRITE,
    CLEANUP_POLICY_THRESHOLD_DAYS = 30,
    DATA_FLUSH_INTERVAL_SECONDS = 900,
    INTERVAL_LENGTH_MINUTES = 60,
    MAX_STORAGE_SIZE_MB = 2048,
    QUERY_CAPTURE_MODE = AUTO,
    SIZE_BASED_CLEANUP_MODE = AUTO,
    WAIT_STATS_CAPTURE_MODE = ON
);
GO

-- Verify Query Store is active and recording wait statistics
SELECT actual_state_desc, desired_state_desc, current_storage_size_mb, max_storage_size_mb, wait_stats_capture_mode_desc
FROM sys.database_query_store_options;
`;

  const auditTableSetupScript = `-- =========================================================================
-- Enterprise Audit Trail Repository (Section 25 Compliance)
-- =========================================================================

USE [master];
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'dba_autonomous_audit_log')
BEGIN
    CREATE TABLE dbo.dba_autonomous_audit_log
    (
        audit_id VARCHAR(32) PRIMARY KEY,
        timestamp_utc DATETIME2(3) NOT NULL DEFAULT (GETUTCDATE()),
        requester NVARCHAR(128) NOT NULL,
        agent_version NVARCHAR(64) NOT NULL,
        server_name NVARCHAR(128) NOT NULL,
        database_name NVARCHAR(128) NULL,
        action_name NVARCHAR(128) NOT NULL,
        safety_level VARCHAR(10) NOT NULL, -- GREEN, AMBER, RED
        approval_by NVARCHAR(128) NOT NULL,
        justification_reason NVARCHAR(512) NOT NULL,
        before_state_snapshot NVARCHAR(MAX) NULL,
        after_state_snapshot NVARCHAR(MAX) NULL,
        validation_result NVARCHAR(512) NULL,
        execution_status VARCHAR(20) NOT NULL -- SUCCESS, ROLLED_BACK, FAILED
    );

    CREATE NONCLUSTERED INDEX IX_Audit_ServerDate 
    ON dbo.dba_autonomous_audit_log (server_name, timestamp_utc DESC);
END
GO
`;

  const chapters = [
    { id: 'setup', title: '1. Quickstart & T-SQL Provisioning', icon: <Terminal className="w-4 h-4" /> },
    { id: 'architecture', title: '2. Architecture & 5 Principles', icon: <Layers className="w-4 h-4" /> },
    { id: 'connectivity', title: '3. Connectivity & Telemetry Ingestion', icon: <Server className="w-4 h-4" /> },
    { id: 'modes', title: '4. The 6 Operating Modes Guide', icon: <Activity className="w-4 h-4" /> },
    { id: 'safety', title: '5. Production Safety Gates & Rollback', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'console', title: '6. Natural Language Copilot & AI Schema', icon: <Zap className="w-4 h-4" /> },
    { id: 'runbooks', title: '7. Production Operations Runbooks', icon: <FileText className="w-4 h-4" /> },
    { id: 'airgapped', title: '8. Local Server & Ollama (Zero Egress)', icon: <Lock className="w-4 h-4 text-emerald-400" /> },
    { id: 'assets', title: '9. Adding SQL Server Assets & Discovery', icon: <Server className="w-4 h-4 text-cyan-400" /> },
  ];

  const fullMarkdownDocumentation = `# AI DBA COMMAND CENTER
## Complete Operations & Setup Guide — v1.0
### Autonomous Database Performance, Reliability & Capacity Agent

---

### CHAPTER 1: ARCHITECTURAL FOUNDATION & AGENT IDENTITY
The AI DBA Command Center is an enterprise autonomous database reliability and performance intelligence engine designed to operate alongside DBAs, DBREs, and SREs.
- Mission: Detect problems before users do, explain root causes with evidence, predict capacity risks, recommend safe remediation, enforce human approval gates, and document all outcomes.
- North Star: Observe -> Correlate -> Predict -> Explain -> Recommend -> Request Approval -> Execute -> Validate -> Learn.

### CHAPTER 2: SETUP & LEAST-PRIVILEGE TELEMETRY
Connects to SQL Server instances using dedicated non-sysadmin service accounts. Requires VIEW SERVER STATE, VIEW ANY DEFINITION, and Query Store access.

### CHAPTER 3: TELEMETRY INGESTION
Continuously correlates:
1. sys.dm_os_wait_stats (CPU, Storage, Locking, Parallelism, Log, TempDB)
2. sys.dm_exec_requests & sys.dm_tran_locks (Blocking chains and root blocker isolation)
3. sys.dm_io_virtual_file_stats (File-level latency for MDF, NDF, LDF)
4. Query Store runtime stats & execution plan hashes
5. sys.dm_os_performance_counters (Page Life Expectancy, Buffer Cache, Memory Grants)

### CHAPTER 4: OPERATING MODES
- Mode A (Executive): Estate Health Score (0-100), Risk Matrix, SLA/SLO metrics.
- Mode B (Senior DBA Command): Wait stats, blocking hierarchies, missing index impact.
- Mode C (Incident Commander): 10-step lifecycle (DETECT to DOCUMENT).
- Mode D (Performance Engine): CPU vs OS CPU, PLE, TempDB contention.
- Mode E (Predictive & Capacity): D3/Recharts exhaustion timelines, 80/90/100% threshold countdowns.
- Mode F (Change Review / CAB): Production change audit, lock timeouts, Always On redo lag check, rollback scripts.
- Storage Anomaly Engine: Statistical z-score anomaly detection, culprit table identification.
- Query Regression Checker: Multi-workload baselines, plan diffs, code deployment linkage.

### CHAPTER 5: PRODUCTION SAFETY GATES (HUMAN-IN-THE-LOOP)
- GREEN: Read-only diagnostics and telemetry collection (Auto-authorized).
- AMBER: Optimization changes such as index creation, stats updates, sp_configure (DBA sign-off).
- RED: Destructive or blocking actions such as session termination, failover, table drops (Explicit human signature required).

---
© 2026 AI DBA Command Center. Enterprise Production Standard.`;

  const copyFullMarkdown = () => {
    navigator.clipboard.writeText(fullMarkdownDocumentation);
    setCopiedFullDoc(true);
    setTimeout(() => setCopiedFullDoc(false), 2000);
  };

  const downloadMarkdownFile = () => {
    const blob = new Blob([fullMarkdownDocumentation], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'AI_DBA_Command_Center_Operations_Guide_v1.0.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-500/10">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  AI DBA Command Center System Documentation
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                  v1.0 Production Architecture
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete Enterprise Setup, Telemetry Ingestion, Safety Gates & Operational Runbooks
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={copyFullMarkdown}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition cursor-pointer border border-slate-700"
              title="Copy complete markdown guide"
            >
              {copiedFullDoc ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedFullDoc ? 'Copied' : 'Copy MD'}</span>
            </button>

            <button
              onClick={downloadMarkdownFile}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition cursor-pointer border border-slate-700"
              title="Download Markdown Documentation"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Master Body: Sidebar Navigation + Chapter Viewer */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Chapter Nav */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/60 p-3 overflow-y-auto space-y-1 text-xs shrink-0">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block px-3 py-1 font-bold">
              Operations Manual Chapters
            </span>

            {chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChapter(ch.id as any)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center space-x-2.5 transition cursor-pointer font-medium ${
                  activeChapter === ch.id
                    ? 'bg-cyan-950/70 text-cyan-200 border border-cyan-800/80 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span className={activeChapter === ch.id ? 'text-cyan-400' : 'text-slate-400'}>
                  {ch.icon}
                </span>
                <span className="truncate">{ch.title}</span>
              </button>
            ))}

            <div className="pt-4 px-3 text-[11px] text-slate-400 border-t border-slate-850 mt-4 space-y-1">
              <span className="font-bold text-slate-300 block">Agent Identity:</span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Autonomous Database Reliability & Performance Intelligence Agent
              </p>
            </div>
          </div>

          {/* Right Main Chapter Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-xs text-slate-200 leading-relaxed">
            
            {/* CHAPTER 1: QUICKSTART & PROVISIONING */}
            {activeChapter === 'setup' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-xl font-bold text-white">
                    Chapter 1: Quickstart & Least-Privilege SQL Server Provisioning
                  </h3>
                  <p className="text-slate-400 mt-1">
                    Step-by-step instructions to configure your SQL Server instance and deploy the dedicated monitoring service principal with strict least-privilege permissions.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white font-mono flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-cyan-400" />
                      <span>T-SQL Script: Provision svc_ai_dba_agent User</span>
                    </span>
                    <button
                      onClick={() => copySnippet(tsqlProvisioningScript, 'prov')}
                      className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 font-mono text-[11px] cursor-pointer"
                    >
                      {copiedCodeSnippet === 'prov' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCodeSnippet === 'prov' ? 'Copied' : 'Copy T-SQL'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-900 p-3 rounded-lg font-mono text-[11px] text-cyan-200 overflow-x-auto border border-slate-800 max-h-72">
                    {tsqlProvisioningScript}
                  </pre>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white font-mono flex items-center gap-2">
                      <Database className="w-4 h-4 text-amber-400" />
                      <span>T-SQL Script: Configure Query Store for Regressions</span>
                    </span>
                    <button
                      onClick={() => copySnippet(queryStoreSetupScript, 'qs')}
                      className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 font-mono text-[11px] cursor-pointer"
                    >
                      {copiedCodeSnippet === 'qs' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCodeSnippet === 'qs' ? 'Copied' : 'Copy T-SQL'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-900 p-3 rounded-lg font-mono text-[11px] text-amber-200 overflow-x-auto border border-slate-800 max-h-60">
                    {queryStoreSetupScript}
                  </pre>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-white">Pre-Requisites Checklist:</h4>
                  <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
                    <li>SQL Server 2016 SP1, 2017, 2019, 2022 (Standard or Enterprise Edition) or Azure SQL Managed Instance.</li>
                    <li>TCP port 1433 access from the agent host to the SQL Server listener or Always On Availability Group listener.</li>
                    <li>Query Store enabled on all Tier-1 critical databases with <code className="text-cyan-300 font-mono">WAIT_STATS_CAPTURE_MODE = ON</code>.</li>
                    <li>TempDB configured with 1 file per vCPU core (up to 8 files) with equal sizing and autogrowth settings.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* CHAPTER 2: ARCHITECTURE & 5 PRINCIPLES */}
            {activeChapter === 'architecture' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-xl font-bold text-white">
                    Chapter 2: Architecture & Core Operating Principles
                  </h3>
                  <p className="text-slate-400 mt-1">
                    The cognitive framework that governs how the agent reasons, ranks hypotheses, and enforces production safety.
                  </p>
                </div>

                {/* 5 Operating Principles Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-xs font-mono font-bold text-cyan-400 uppercase">P1 — Evidence First</span>
                    <h4 className="font-bold text-white text-sm">Empirical Telemetry Verification</h4>
                    <p className="text-slate-300 text-[11px]">
                      The agent never claims root cause, performance degradation, capacity risk, or configuration problems without observable evidence. Facts, inferences, and recommendations are strictly separated.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase">P2 — Correlation Before Action</span>
                    <h4 className="font-bold text-white text-sm">Holistic Cross-Subsystem Correlation</h4>
                    <p className="text-slate-300 text-[11px]">
                      Never reacts to isolated metrics (e.g. "CPU is high"). Correlates CPU with PLE, IO latency, wait statistics, lock graphs, execution plans, recent deployments, and historical baselines.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase">P3 — Baseline Before Alert</span>
                    <h4 className="font-bold text-white text-sm">Statistical Anomaly Over Static Thresholds</h4>
                    <p className="text-slate-300 text-[11px]">
                      Learns normal behavior for each server, database, and workload period (hourly peak, nightly ETL, month-end close). Uses moving regression and z-score anomaly modeling to eliminate false positives.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-xs font-mono font-bold text-rose-400 uppercase">P4 — Risk-Based Prioritization</span>
                    <h4 className="font-bold text-white text-sm">Business-Weighted Risk Formula</h4>
                    <p className="text-slate-300 text-[11px]">
                      Prioritizes using: <code className="text-cyan-300 font-mono">Risk = Impact × Severity × Probability × Duration × Exposure</code>. Issues on Tier-1 billing databases outrank non-critical background jobs.
                    </p>
                  </div>
                </div>

                {/* Section 16 Lifecycle Diagram */}
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-xs font-mono font-bold text-slate-400 uppercase block">
                    Autonomous Remediation Lifecycle (Section 16 Specification)
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-cyan-300">
                    {['OBSERVE', 'CORRELATE', 'PREDICT', 'EXPLAIN', 'RECOMMEND', 'APPROVE', 'EXECUTE', 'VALIDATE', 'LEARN'].map((step, i) => (
                      <React.Fragment key={i}>
                        <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 font-bold">{step}</span>
                        {i < 8 && <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CHAPTER 3: CONNECTIVITY & TELEMETRY */}
            {activeChapter === 'connectivity' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-xl font-bold text-white">
                    Chapter 3: Telemetry Ingestion & Polling Architecture
                  </h3>
                  <p className="text-slate-400 mt-1">
                    How the AI DBA Command Center continuously extracts and correlates SQL Server DMVs without introducing observer overhead.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-white text-sm">Key Ingestion Pipelines:</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                      <strong className="text-cyan-300 font-mono block">1. sys.dm_os_wait_stats</strong>
                      <p className="text-slate-400 text-[11px]">
                        Polled every 30 seconds with differential delta calculation. Categorizes engine waits into CPU, Storage, Locking, Memory, Parallelism, Log, TempDB, and Network.
                      </p>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                      <strong className="text-rose-300 font-mono block">2. Lock Graphs & Blocking Chains</strong>
                      <p className="text-slate-400 text-[11px]">
                        Continuous lock tree traversal via sys.dm_exec_requests and sys.dm_os_waiting_tasks. Recursively isolates the Root Blocker (SPID with blocking_session_id = 0).
                      </p>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                      <strong className="text-amber-300 font-mono block">3. Query Store Regressions</strong>
                      <p className="text-slate-400 text-[11px]">
                        Polls sys.query_store_runtime_stats to identify execution plan hash changes where P95/P99 duration regressed by &gt;50% compared with the 7-day baseline.
                      </p>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                      <strong className="text-emerald-300 font-mono block">4. sys.dm_io_virtual_file_stats</strong>
                      <p className="text-slate-400 text-[11px]">
                        Reads cumulative read/write milliseconds and byte transfers per physical database file (.mdf, .ndf, .ldf). Distinguishes disk latency from buffer cache stalls.
                      </p>
                    </div>
                  </div>
                </div>

                {/* API Security Note */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                  <span className="font-bold text-white flex items-center gap-1.5 font-mono">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span>Security & Credential Isolation</span>
                  </span>
                  <p className="text-slate-300 text-[11px]">
                    All Gemini API calls and SQL Server command execution are processed server-side via Express proxy routes (<code className="text-cyan-300 font-mono">/api/dba/*</code>). Database connection strings and API keys are never exposed to the client browser.
                  </p>
                </div>
              </div>
            )}

            {/* CHAPTER 4: OPERATING MODES GUIDE */}
            {activeChapter === 'modes' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-xl font-bold text-white">
                    Chapter 4: The 6 Operating Modes & Specialized Proactive Engines
                  </h3>
                  <p className="text-slate-400 mt-1">
                    Guidance for navigating between executive, operational, predictive, and change management perspectives.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">Mode A: Executive Dashboard</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">Leadership View</span>
                    </div>
                    <p className="text-slate-300 text-xs">
                      Translates complex database metrics into a unified <strong>0–100 Platform Health Score</strong> based on 9 weighted dimensions: Performance (20%), Availability/HA (15%), Backup/Recovery (15%), Security (15%), Storage Capacity (10%), Config Drift (10%), Patch Compliance (5%), Job Reliability (5%), and Growth Risk (5%). Tracks MTTR, prevented revenue loss, and key executive sign-offs.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">Mode B: Senior DBA Command</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">Deep Telemetry</span>
                    </div>
                    <p className="text-slate-300 text-xs">
                      Provides interactive lock hierarchy trees isolating the Root Blocker, real-time wait statistics breakdowns, Query Store regressed queries with plan IDs, and missing index DDL recommendations with expected benefit percentages.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">Mode C: Incident Commander</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold">P1 Triage</span>
                    </div>
                    <p className="text-slate-300 text-xs">
                      Executes the strict 10-step incident lifecycle: <code>DETECT ➔ SCOPE ➔ TRIAGE ➔ CORRELATE ➔ IDENTIFY ➔ CONTAIN ➔ REMEDIATE ➔ VALIDATE ➔ DOCUMENT</code>. Includes change correlation timelines and emergency containment safety gates.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">Mode E: Predictive Capacity & Recharts Timeline</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">Capacity Runway</span>
                    </div>
                    <p className="text-slate-300 text-xs">
                      Renders multi-curve storage trajectories for at-risk servers, plotting historical telemetry against accelerated anomaly curves and normal baselines. Calculates exact days remaining to <strong>80% Warning</strong>, <strong>90% Severe Exhaustion</strong>, and <strong>100% Hard Disk Outage</strong>, complete with What-If simulated recovery curves.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">Mode F: Change Review / Strict CAB</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">Pre-Deploy Audit</span>
                    </div>
                    <p className="text-slate-300 text-xs">
                      Evaluates proposed DDL/DML scripts prior to production deployment. Audits index creation for <code>ONLINE = ON</code>, TempDB sort requirements, lock timeouts (<code>SET LOCK_TIMEOUT</code>), and Always On replication redo lag, automatically generating verified rollback plans.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPTER 5: PRODUCTION SAFETY & AUDITING */}
            {activeChapter === 'safety' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-xl font-bold text-white">
                    Chapter 5: Production Safety Gates & Cryptographic Audit Trails
                  </h3>
                  <p className="text-slate-400 mt-1">
                    Section 15 Human-in-the-Loop policies, execution gates, and Section 25 auditability specifications.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-emerald-950/20 border border-emerald-800/60 rounded-xl p-3.5 space-y-1.5">
                    <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold font-mono text-[10px]">
                      GREEN GATE
                    </span>
                    <strong className="text-white block text-xs">Auto-Allowed Diagnostics</strong>
                    <p className="text-slate-400 text-[11px]">
                      Read-only DMV queries, metadata scans, performance counter sampling, trend analysis, and documentation generation. No human intervention needed.
                    </p>
                  </div>

                  <div className="bg-amber-950/20 border border-amber-800/60 rounded-xl p-3.5 space-y-1.5">
                    <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold font-mono text-[10px]">
                      AMBER GATE
                    </span>
                    <strong className="text-white block text-xs">Approval Required</strong>
                    <p className="text-slate-400 text-[11px]">
                      Index creation/drop, table statistics updates with FULLSCAN, plan forcing in Query Store, sp_configure adjustments (MAXDOP), and batch cleanup jobs.
                    </p>
                  </div>

                  <div className="bg-rose-950/20 border border-rose-800/60 rounded-xl p-3.5 space-y-1.5">
                    <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-bold font-mono text-[10px]">
                      RED GATE
                    </span>
                    <strong className="text-white block text-xs">Explicit Human Signature</strong>
                    <p className="text-slate-400 text-[11px]">
                      Terminating sessions (KILL SPID), initiating database failovers, restarting SQL Server services, applying emergency patches, and schema truncations.
                    </p>
                  </div>
                </div>

                {/* Audit Logging Script */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white font-mono flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Section 25 Compliance: Audit Repository Table</span>
                    </span>
                    <button
                      onClick={() => copySnippet(auditTableSetupScript, 'audit')}
                      className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 font-mono text-[11px] cursor-pointer"
                    >
                      {copiedCodeSnippet === 'audit' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCodeSnippet === 'audit' ? 'Copied' : 'Copy T-SQL'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-900 p-3 rounded-lg font-mono text-[11px] text-cyan-200 overflow-x-auto border border-slate-800 max-h-52">
                    {auditTableSetupScript}
                  </pre>
                </div>
              </div>
            )}

            {/* CHAPTER 6: NATURAL LANGUAGE COPILOT & SCHEMA */}
            {activeChapter === 'console' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-xl font-bold text-white">
                    Chapter 6: Natural Language Copilot & Section 28 Response Schema
                  </h3>
                  <p className="text-slate-400 mt-1">
                    Interacting with the agent via natural language while enforcing deterministic, evidence-grounded responses.
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="font-bold text-white text-xs block">Canonical Commands:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                    {[
                      'Show me unhealthy SQL Servers.',
                      'Why is SQL-PROD-01 experiencing high blocking?',
                      'Which databases are likely to have performance problems next month?',
                      'Find queries causing the most CPU.',
                      'Prepare an RCA for Incident INC-4092.',
                      'What can I safely automate right now?',
                      'What should I worry about tomorrow?',
                      'Give me the executive summary.',
                    ].map((cmd, idx) => (
                      <div key={idx} className="bg-slate-900 p-2 rounded border border-slate-850 text-cyan-300">
                        "{cmd}"
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="font-bold text-white text-xs block">Section 28 Structured Response Schema:</span>
                  <ul className="space-y-1.5 text-slate-300 text-[11px]">
                    <li><strong>🔎 Finding:</strong> One-sentence verified conclusion.</li>
                    <li><strong>📊 Evidence:</strong> Specific DMV measurements (wait ms, logical reads, PLE seconds).</li>
                    <li><strong>🧠 Analysis:</strong> Cross-subsystem correlation and reasoning.</li>
                    <li><strong>⚠️ Risk:</strong> Quantified score (0–100) and business impact.</li>
                    <li><strong>🎯 Recommendation:</strong> Actions with expected benefits, complexity, and rollback methods.</li>
                    <li><strong>🤖 Automation:</strong> Tasks AI can safely execute without intervention.</li>
                    <li><strong>👤 Approval:</strong> Required safety gate (GREEN, AMBER, RED) and reason.</li>
                    <li><strong>✅ Validation:</strong> Telemetry metrics used to confirm success.</li>
                    <li><strong>📝 Audit:</strong> Immutable records logged to the audit repository.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* CHAPTER 7: RUNBOOKS */}
            {activeChapter === 'runbooks' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-xl font-bold text-white">
                    Chapter 7: Production Operations Runbooks
                  </h3>
                  <p className="text-slate-400 mt-1">
                    Standard operating procedures for managing critical database incidents, storage exhaustion alerts, and plan regressions.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Runbook 1 */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-rose-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-rose-400" />
                        <span>Runbook 1: Resolving a Severe Blocking Cascade (P1 Incident)</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500 text-white font-bold">P1 SEV-1</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-xs pt-1">
                      <li>Navigate to <strong>Mode B (Senior DBA Command)</strong> or <strong>Mode C (Incident Commander)</strong>.</li>
                      <li>Review the Active Blocking Hierarchy to identify the <strong>Root Blocker SPID</strong> holding exclusive locks.</li>
                      <li>Verify session status is <code className="text-amber-300 font-mono">SLEEPING</code> with <code className="text-rose-300 font-mono">open_transaction_count &gt; 0</code>.</li>
                      <li>Click <strong>Authorize KILL SPID (RED GATE)</strong>.</li>
                      <li>Confirm operator identity (email signature) and review pre-checks.</li>
                      <li>Agent executes termination, confirms lock release in <code className="text-cyan-300 font-mono">sys.dm_os_waiting_tasks</code>, and logs audit record.</li>
                    </ol>
                  </div>

                  {/* Runbook 2 */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-amber-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm flex items-center gap-1.5">
                        <HardDrive className="w-4 h-4 text-amber-400" />
                        <span>Runbook 2: Managing Storage Exhaustion Anomaly (&gt;80% Alert)</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold">CAPACITY</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-xs pt-1">
                      <li>Open the <strong>Storage Anomaly Engine</strong> or <strong>Mode E (Predictive Timeline)</strong>.</li>
                      <li>Check the <strong>80%, 90%, and 100% Countdown Pills</strong> to assess urgency.</li>
                      <li>Inspect the <strong>Culprit Tables Breakdown</strong> to pinpoint uncompressed tables or runaway log files.</li>
                      <li>Review the <strong>Simulate Fix</strong> curve to verify expected capacity recovery.</li>
                      <li>Authorize the <strong>Batched Partition Compression</strong> or <strong>Log Truncation</strong> action via AMBER safety gate.</li>
                    </ol>
                  </div>

                  {/* Runbook 3 */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-cyan-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        <span>Runbook 3: Remediating a Query Store Plan Regression</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">PERFORMANCE</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-xs pt-1">
                      <li>Open the <strong>Query Regression Checker</strong>.</li>
                      <li>Filter by workload period (e.g. <em>Business Hours Peak</em>).</li>
                      <li>Inspect the side-by-side <strong>Execution Plan Diff</strong> to verify why the optimizer flipped (Scan vs Seek, TempDB spills).</li>
                      <li>Review the linked <strong>Code Deployment PR</strong> to verify triggering parameter or model changes.</li>
                      <li>Authorize <strong>Force Prior Plan</strong> via the AMBER safety gate to immediately restore sub-50ms execution.</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {/* CHAPTER 8: LOCAL SERVER & AIR-GAPPED OLLAMA */}
            {activeChapter === 'airgapped' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400 uppercase tracking-wider mb-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Zero Cloud Egress • 100% Private On-Premise Execution</span>
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      Chapter 8: Local Server Setup & Air-Gapped Ollama Deployment
                    </h3>
                    <p className="text-slate-400 mt-1 text-xs">
                      Run the entire AI DBA Command Center and open-weight LLMs locally on your private infrastructure without sending database schemas, queries, or telemetry to external clouds.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold shrink-0">
                    AIR-GAPPED READY
                  </span>
                </div>

                {/* Privacy Guarantee Box */}
                <div className="bg-emerald-950/20 border border-emerald-800/50 rounded-xl p-4 text-xs space-y-2 text-emerald-200">
                  <div className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Strict Data Sovereignty for Regulated Environments
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Financial institutions, healthcare providers (HIPAA), and defense contractors cannot transmit database telemetry, connection strings, or query plans across public internet networks. The AI DBA Command Center supports <strong>native Ollama integration</strong>: all neural model inference runs on localhost or private LAN GPUs/CPUs. Zero bytes leave your firewall.
                  </p>
                </div>

                {/* Architecture Diagram Box */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 font-mono text-[11px]">
                  <div className="text-slate-400 font-bold text-xs uppercase tracking-wider">Air-Gapped Network Topology:</div>
                  <pre className="text-emerald-300 overflow-x-auto p-2 bg-slate-900 rounded border border-slate-800">{`+-------------------------------------------------------------------------------+
|                       PRIVATE SECURE ON-PREMISE LAN                           |
|                                                                               |
|   +--------------------+          +---------------------+                     |
|   |  SQL Server 2022   |  <====>  | AI DBA Command Ctr  |                     |
|   |  (TDS Port 1433)   |   DMVs   | (Node.js Port 3000) |                     |
|   +--------------------+          +---------------------+                     |
|                                              ||                               |
|                                     Local REST API (11434)                    |
|                                              ||                               |
|                                   +----------------------+                    |
|                                   | Local Ollama Engine  |                    |
|                                   | (qwen2.5-coder /     |                    |
|                                   |  llama3.3 / deepseek)|                    |
|                                   +----------------------+                    |
|                                              ||                               |
|                                    [ ZERO INTERNET ACCESS ]                   |
+-------------------------------------------------------------------------------+`}</pre>
                </div>

                {/* Step-by-Step Instructions */}
                <div className="space-y-4">
                  <h4 className="font-bold text-white text-sm">Step-by-Step Local Deployment:</h4>
                  
                  {/* Step 1 */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">1</span>
                        <span>Install Ollama on Your Workstation or Linux Server</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Linux / Windows / macOS</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-emerald-300 flex items-center justify-between">
                      <span>curl -fsSL https://ollama.com/install.sh | sh</span>
                      <button onClick={() => copySnippet('curl -fsSL https://ollama.com/install.sh | sh', 'ollama_install')} className="p-1 hover:text-white">
                        {copiedCodeSnippet === 'ollama_install' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">2</span>
                        <span>Pull Recommended SQL Server Operations Model</span>
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">Qwen 2.5 Coder 32B</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-emerald-300 flex items-center justify-between">
                      <span>ollama pull qwen2.5-coder:32b</span>
                      <button onClick={() => copySnippet('ollama pull qwen2.5-coder:32b', 'ollama_pull')} className="p-1 hover:text-white">
                        {copiedCodeSnippet === 'ollama_pull' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      <strong>Tip:</strong> For systems with &lt;16 GB RAM or CPU only, use <code className="text-cyan-300 font-mono">ollama pull llama3.1:8b</code> or <code className="text-cyan-300 font-mono">ollama pull deepseek-r1:14b</code>.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">3</span>
                        <span>Set Local Air-Gapped Environment Variables (.env)</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Configuration</span>
                    </div>
                    <div className="bg-slate-900 p-3 rounded border border-slate-800 font-mono text-[11px] text-emerald-300 flex items-center justify-between">
                      <pre>{`LLM_PROVIDER="ollama"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="qwen2.5-coder:32b"
PORT=3000`}</pre>
                      <button onClick={() => copySnippet(`LLM_PROVIDER="ollama"\nOLLAMA_BASE_URL="http://localhost:11434"\nOLLAMA_MODEL="qwen2.5-coder:32b"\nPORT=3000`, 'env_config')} className="p-1 hover:text-white">
                        {copiedCodeSnippet === 'env_config' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">4</span>
                        <span>Launch On-Premise Command Center</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Node 18+</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-emerald-300 flex items-center justify-between">
                      <span>npm install && npm run build && npm start</span>
                      <button onClick={() => copySnippet('npm install && npm run build && npm start', 'start_cmd')} className="p-1 hover:text-white">
                        {copiedCodeSnippet === 'start_cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-emerald-400 font-mono">
                      ✓ Open http://localhost:3000 in your browser. All features operate with zero WAN transmission!
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* CHAPTER 9: ONBOARDING SQL SERVER ASSETS */}
            {activeChapter === 'assets' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
                      <Server className="w-3.5 h-3.5" />
                      <span>Estate Inventory & Telemetry Onboarding</span>
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      Chapter 9: Adding & Onboarding SQL Server Assets
                    </h3>
                    <p className="text-slate-400 mt-1 text-xs">
                      How to register on-premise, virtual machine, and cloud SQL Server instances into the AI DBA Command Center.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold shrink-0">
                    SELF-SERVICE ONBOARDING
                  </span>
                </div>

                {/* Workflow Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold">1</span>
                      <span>1. Least-Privilege User</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Create <code className="text-cyan-300 font-mono">svc_ai_dba_agent</code> in SSMS with <code className="text-slate-300 font-mono">VIEW SERVER STATE</code> (No sysadmin).
                    </p>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold">2</span>
                      <span>2. Register via UI / API</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Click <strong>+ Register SQL Server</strong> in Mode A (Executive) or Mode B (Senior DBA). Enter hostname, port, and databases.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold">3</span>
                      <span>3. Baseline Discovery</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Agent runs pre-flight probe, verifies Query Store, discovers storage LUNs, and starts 90-day moving baselines.
                    </p>
                  </div>
                </div>

                {/* Step-by-Step Guide */}
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="font-bold text-white text-sm">Step 1: Network & Firewall Connectivity</h4>
                    <p className="text-slate-300 leading-relaxed">
                      Ensure the server running the AI DBA Command Center has TCP connectivity to the SQL Server port (default <code className="text-cyan-300 font-mono">1433</code>). For named instances, ensure the SQL Server Browser service (UDP <code className="text-cyan-300 font-mono">1434</code>) is reachable or specify the static port.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-sm">Step 2: Service Account Provisioning Script (T-SQL)</h4>
                      <button 
                        onClick={() => copySnippet(tsqlProvisioningScript, 'onboard_tsql')}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                      >
                        {copiedCodeSnippet === 'onboard_tsql' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copy Script</span>
                      </button>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Execute this in SQL Server Management Studio (SSMS) on the target instance:
                    </p>
                    <pre className="bg-slate-900 p-3 rounded border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto max-h-40">
                      {tsqlProvisioningScript}
                    </pre>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="font-bold text-white text-sm">Step 3: Registration via REST API</h4>
                    <p className="text-slate-300 leading-relaxed">
                      You can automate asset onboarding in CI/CD or Terraform using the backend registration endpoint:
                    </p>
                    <pre className="bg-slate-900 p-3 rounded border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto">{`POST /api/dba/servers
Content-Type: application/json

{
  "name": "SQL-PROD-04",
  "address": "sql-prod-04.corp.internal",
  "port": 1433,
  "role": "Payment Gateway & Settlement Hub",
  "environment": "production",
  "databases": ["PaymentsDB", "SettlementMart"],
  "haArchitecture": "Always On Availability Groups",
  "rpoMinutes": 5,
  "rtoMinutes": 15
}`}</pre>
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>AI DBA Command Center System Standard • All Rights Reserved</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={copyFullMarkdown}
              className="text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
            >
              {copiedFullDoc ? '✓ Copied Markdown' : 'Copy Full Documentation (MD)'}
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            >
              Close Manual
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
