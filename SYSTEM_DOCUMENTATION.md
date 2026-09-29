# AI DBA COMMAND CENTER
## Complete Operations & Setup Guide — Production Master System Manual v1.0
### Autonomous Database Performance, Reliability, Security & Capacity Agent

---

## 0. EXECUTIVE OVERVIEW & AGENT IDENTITY

The **AI DBA Command Center** is an enterprise-grade autonomous database operations and performance intelligence agent.

It operates across multiple senior disciplines:
- **Senior SQL Server DBA**: DMV telemetry, Query Store execution plans, wait statistics, indexing, statistics, Always On Availability Groups, backup recovery.
- **Database Performance Engineer**: CPU scheduling, memory grant pressure, Page Life Expectancy (PLE), IO latency distribution (data, log, tempdb), parameter sensitivity.
- **Database Reliability Engineer (DBRE)**: MTTR minimization, incident response workflows, automatic containment, chaos engineering telemetry simulations.
- **Capacity Planning Engineer**: Moving regression modeling, storage exhaustion forecasting (80%, 90%, 100%), table-level space consumption velocity.
- **CAB & Change Reviewer**: Strict production change auditing, lock escalation guards (`SET LOCK_TIMEOUT`), rollback plan validation.
- **Executive Database Analyst**: 0–100 Platform Health Score calculation across 9 weighted dimensions, business impact evaluation, SLA/SLO reporting.

### Primary Objective:
> **Detect problems before users do, identify root causes using evidence, predict future risks, recommend the safest remediation, obtain appropriate approval before impactful actions, execute approved actions through authorized tools, validate the result, and document what happened.**

---

## 1. THE 5 CORE OPERATING PRINCIPLES

### P1 — Evidence First
Every conclusion must be supported by observable telemetry from DMVs, Query Store, or Windows performance counters. The agent strictly separates:
- **FACT** (Observable measurements)
- **INFERENCE** (Causal correlation and reasoning)
- **RECOMMENDATION** (Actionable mitigation with expected benefit)

### P2 — Correlation Before Action
Never react to one metric in isolation. The agent correlates:
```text
CPU ↔ Memory / PLE ↔ Disk Latency ↔ Wait Stats ↔ Blocking Tree ↔ Query Duration ↔ Execution Plans ↔ Deployments ↔ Baselines
```

### P3 — Baseline Before Alert
Establishes what "normal" means across different workload periods:
- Business Hours Peak (10am–4pm)
- Checkout Rush (12–2pm)
- Nightly ETL Batch (1–4am)
- Month-end Financial Close
Anomalies are detected using statistical deviation (z-score) rather than fragile static thresholds.

### P4 — Risk-Based Prioritization
Issues are scored transparently:
$$\text{Risk Score} = \text{Business Impact} \times \text{Technical Severity} \times \text{Probability} \times \text{Duration} \times \text{Exposure}$$

### P5 — Production Safety
Default production behavior follows the strict lifecycle:
```text
READ ➔ ANALYZE ➔ RECOMMEND ➔ REQUEST APPROVAL ➔ EXECUTE ➔ VALIDATE ➔ DOCUMENT
```

---

## 2. SQL SERVER SETUP & LEAST-PRIVILEGE PROVISIONING

### Step 1: Provision the Dedicated Agent Service Account
Execute the following T-SQL on your target SQL Server instance (2016 SP1, 2017, 2019, 2022, or Azure SQL Managed Instance):

```sql
USE [master];
GO

-- 1. Create dedicated monitoring login
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
```

### Step 2: Configure Query Store on Critical Databases
```sql
ALTER DATABASE [OrdersDB] 
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
```

### Step 3: Deploy the Immutable Audit Trail Table (Section 25 Compliance)
```sql
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
```

---

## 3. ARCHITECTURE & TELEMETRY INGESTION PIPELINE

### Diagnostic Data Sources:
1. **Wait Statistics**: `sys.dm_os_wait_stats` (evaluated via differential delta sampling). Categorized into:
   - `CPU`: `SOS_SCHEDULER_YIELD`, `THREADPOOL`
   - `Storage`: `PAGEIOLATCH_SH`, `PAGEIOLATCH_EX`, `ASYNC_IO_COMPLETION`
   - `Locking`: `LCK_M_X`, `LCK_M_IX`, `LCK_M_S`, `LCK_M_U`
   - `Parallelism`: `CXPACKET`, `CXCONSUMER`
   - `Log`: `WRITELOG`
   - `Memory`: `RESOURCE_SEMAPHORE`
   - `TempDB`: `PAGELATCH_UP`, `PAGELATCH_SH`
2. **Blocking & Lock Trees**: `sys.dm_exec_requests`, `sys.dm_os_waiting_tasks`, `sys.dm_tran_locks`.
3. **Query Store Regressions**: `sys.query_store_runtime_stats`, `sys.query_store_plan`.
4. **File Latency**: `sys.dm_io_virtual_file_stats` tracking separate read and write latency (ms) for `.mdf`, `.ndf`, and `.ldf` files.
5. **Memory & Buffer Pool**: `sys.dm_os_performance_counters` tracking Page Life Expectancy (PLE), Memory Grants Pending, and Target vs Total Server Memory.

---

## 4. THE 6 OPERATING MODES & SPECIALIZED ENGINES

| Mode | Purpose | Primary Features |
| :--- | :--- | :--- |
| **Mode A: Executive** | Strategic health & risk | 0–100 weighted health score (9 dimensions), SLA/SLO, decision queue. |
| **Mode B: Senior DBA** | In-depth troubleshooting | Root blocker isolation, wait statistics classification, missing index DDL. |
| **Mode C: Incident Commander** | P1 active incident triage | 10-step lifecycle (`DETECT` to `DOCUMENT`), deployment correlation. |
| **Mode D: Performance** | Subsystem deep dive | CPU vs OS CPU, memory grant stalls, file-level IO latency. |
| **Mode E: Predictive** | Capacity planning | D3/Recharts storage exhaustion timelines, 80/90/100% countdowns. |
| **Mode F: Change Review (CAB)** | Pre-deployment audit | `ONLINE=ON` check, TempDB sort verification, lock timeouts, rollback scripts. |
| **Storage Anomaly Engine** | Statistical growth spikes | $z$-score deviations, table consumers, culprit identification. |
| **Query Regression Checker** | Workload plan autopsy | Plan diffs (Seek vs Scan, TempDB spills), deployment commit linkage. |
| **Find What Humans Missed** | Sub-threshold anomalies | Micro-stutters, silent log backup throughput degradation, soft-NUMA skew. |

---

## 5. HUMAN-IN-THE-LOOP PRODUCTION SAFETY GATES

Actions are categorized into 3 strict policy gates:

### 🟢 GREEN GATE — Auto-Allowed
- Read-only diagnostics, DMV polling, Query Store sampling, and report generation.
- Zero risk to production stability; executes autonomously.

### 🟡 AMBER GATE — DBA Sign-Off Required
- Non-destructive optimizations: creating indexes with `ONLINE = ON`, updating statistics with `FULLSCAN`, forcing verified execution plans in Query Store, adjusting `sp_configure` parameters.
- Requires operator approval confirmation.

### 🔴 RED GATE — Explicit Human Signature Required
- High-impact and destructive actions: terminating sessions (`KILL <spid>`), triggering Always On Availability Group failovers, restarting SQL Server, dropping tables.
- Enforces operator identity capture, pre-check verification, and deterministic rollback validation.

---

## 6. NATURAL LANGUAGE COPILOT COMMANDS

Users can interact with the agent using conversational natural language. Commands follow the **Section 28 Structured Response Schema**:
- **🔎 Finding**: Single-sentence conclusion.
- **📊 Evidence**: Measurable DMV metrics.
- **🧠 Analysis**: Cross-subsystem correlation.
- **⚠️ Risk**: Impact score (0–100) and business ramifications.
- **🎯 Recommendation**: Prioritized corrective actions.
- **🤖 Automation**: Safe autonomous actions.
- **👤 Approval**: Required gate (Green, Amber, Red).
- **✅ Validation**: How success is measured.
- **📝 Audit**: Record stored in `dba_autonomous_audit_log`.

---

## 7. PRODUCTION OPERATIONS RUNBOOKS

### Runbook 1: Containing a High-Blocking Cascade (P1)
1. Switch to **Mode B (Senior DBA)** or **Mode C (Incident Commander)**.
2. Locate the **Root Blocker SPID** at the top of the blocking hierarchy.
3. Verify session status is `SLEEPING` with `open_transaction_count > 0`.
4. Click **Authorize KILL SPID (RED GATE)**.
5. Provide your email signature and verify pre-checks.
6. The agent executes the termination, confirms lock release in `sys.dm_os_waiting_tasks`, and records the audit log.

### Runbook 2: Managing Storage Exhaustion Anomaly
1. Open the **Storage Anomaly Engine** or **Mode E (Predictive Timeline)**.
2. Review the **80%, 90%, and 100% Countdown Pills**.
3. Inspect the **Culprit Tables Breakdown** (e.g. uncompressed clickstream tables).
4. Review the **Simulate Fix** recovery trajectory.
5. Click **Authorize Remediation (AMBER GATE)** to apply batched partition compression and scheduled purges.

### Runbook 3: Remediating a Query Store Plan Regression
1. Open the **Query Regression Checker**.
2. Filter by workload period (e.g., *Business Hours Peak*).
3. Review the side-by-side **Execution Plan Diff** (e.g., Index Seek vs Clustered Index Scan).
4. Inspect the correlated **Git Deployment PR** and commit diff snippet.
5. Click **Execute Remediation (AMBER GATE)** to force the prior known-good plan in Query Store.

---
*AI DBA Command Center — Operating Standard v1.0*
