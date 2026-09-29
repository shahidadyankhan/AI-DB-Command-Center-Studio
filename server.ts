import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  INITIAL_SERVERS,
  MOCK_WAIT_STATS,
  MOCK_BLOCKING_CHAIN,
  MOCK_QUERY_REGRESSIONS,
  MOCK_INCIDENTS,
  MOCK_RECOMMENDATIONS,
  MOCK_AUDIT_LOGS,
  MOCK_MORNING_BRIEF
} from './src/data/mockEstate.js';
import {
  MOCK_STORAGE_BASELINES,
  MOCK_STORAGE_ALERTS,
  MOCK_DETAILED_QUERY_REGRESSIONS
} from './src/data/mockStorageAndQueryData.js';
import type { DbaAgentResponse, RecommendationItem, AuditLogEntry } from './src/types/dba.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize GoogleGenAI SDK as per gemini-api skill instructions
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI client:', err);
  }
}

// =============================================================================
// LOCAL AIR-GAPPED & OLLAMA CONFIGURATION (ZERO DATA EGRESS)
// Supports running completely on-premise without cloud API calls.
// =============================================================================
interface LlmSettings {
  provider: 'ollama' | 'gemini';
  ollamaBaseUrl: string;
  ollamaModel: string;
}

let activeLlmConfig: LlmSettings = {
  provider: (process.env.LLM_PROVIDER as 'ollama' | 'gemini') || (apiKey ? 'gemini' : 'ollama'),
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5-coder:32b',
};

/**
 * Unified LLM Chat Engine
 * Routes requests to either local on-premise Ollama or Gemini based on active configuration.
 * When Ollama is selected, zero telemetry or data leaves your internal network.
 */
async function executeLlmChat(systemInstruction: string, userPrompt: string): Promise<any | null> {
  // 1. Local On-Premise Ollama (100% Private, Air-Gapped)
  if (activeLlmConfig.provider === 'ollama') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for local models

      const res = await fetch(`${activeLlmConfig.ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: activeLlmConfig.ollamaModel,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt },
          ],
          format: 'json',
          stream: false,
          options: {
            temperature: 0.1,
          },
        }),
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json: any = await res.json();
        const content = json?.message?.content;
        if (content) {
          const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
          return JSON.parse(cleaned);
        }
      } else {
        console.warn(`Ollama responded with HTTP ${res.status}:`, await res.text());
      }
    } catch (err: any) {
      console.warn('Ollama local LLM query notice:', err.message);
    }
  }

  // 2. Cloud Gemini Provider (If configured and active)
  if (activeLlmConfig.provider === 'gemini' && aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: 'application/json',
        },
      });
      if (response.text) {
        return JSON.parse(response.text);
      }
    } catch (err: any) {
      console.warn('Gemini query notice:', err.message);
    }
  }

  return null;
}

// In-memory estate state allowing interactive simulations and action execution
let estateServers = JSON.parse(JSON.stringify(INITIAL_SERVERS));
let estateIncidents = JSON.parse(JSON.stringify(MOCK_INCIDENTS));
let estateRecommendations = JSON.parse(JSON.stringify(MOCK_RECOMMENDATIONS));
let estateAuditLogs = JSON.parse(JSON.stringify(MOCK_AUDIT_LOGS));
let estateBlockingChain = JSON.parse(JSON.stringify(MOCK_BLOCKING_CHAIN));
let estateStorageBaselines = JSON.parse(JSON.stringify(MOCK_STORAGE_BASELINES));
let estateStorageAlerts = JSON.parse(JSON.stringify(MOCK_STORAGE_ALERTS));
let estateQueryRegressions = JSON.parse(JSON.stringify(MOCK_DETAILED_QUERY_REGRESSIONS));

const MASTER_SYSTEM_INSTRUCTION = `
You are AI DBA Command Center, an enterprise-grade autonomous database operations and performance intelligence agent.
You operate as a Senior SQL Server DBA, Database Performance Engineer, DBRE, Capacity Planning Engineer, and Incident Response Analyst.

PRIMARY OBJECTIVE:
Detect problems before users do, identify root causes using evidence, predict future risks, recommend the safest remediation, obtain appropriate approval before impactful actions, execute approved actions through authorized tools, validate the result, and document what happened.

CORE OPERATING PRINCIPLES:
P1 - Evidence First: Separate FACT from INFERENCE from RECOMMENDATION. Never invent telemetry.
P2 - Correlation Before Action: Correlate CPU, Memory, Disk, IO latency, Waits, Blocking, Deadlocks, Query duration, Plans, Changes.
P3 - Baseline Before Alert: Anomaly detection against historical baseline over static thresholds.
P4 - Risk-Based Prioritization: Risk = Business Impact x Technical Severity x Probability x Duration x Exposure.
P5 - Production Safety: Default production behavior is READ -> ANALYZE -> RECOMMEND -> REQUEST APPROVAL -> EXECUTE -> VALIDATE -> DOCUMENT.
Actions must follow safety classifications:
- GREEN: Auto allowed (read-only queries, reporting, diagnostics, trend analysis)
- AMBER: Approval required (configuration changes, index creation, stats updates)
- RED: Explicit human approval required (killing sessions, failover, service restart, data deletion)

Always output structured JSON conforming to the section 28 response schema.
`;

// Helper for deterministic fallback responses if Gemini API is unavailable or rates limited
function generateExpertDbaResponse(prompt: string, mode: string = 'dba'): DbaAgentResponse {
  const p = prompt.toLowerCase();
  
  if (p.includes('unhealthy') || p.includes('estate') || p.includes('health') || mode === 'executive') {
    return {
      finding: 'SQL-PROD-01 is in CRITICAL state (Health Score: 78/100) due to an active root blocking cascade on OrdersDB. SQL-PROD-03 is in WARNING state (81/100) due to storage latency degradation and 61-day capacity exhaustion risk.',
      evidence: [
        'SQL-PROD-01: 14 blocked sessions waiting on LCK_M_X locks; Checkout P99 latency degraded from 85ms to 3,200ms.',
        'SQL-PROD-01: Root blocker SPID 78 has been idle in transaction for >340 seconds following App Release v4.12.0.',
        'SQL-PROD-03: Disk latency on analytical volume L:\\Data is 28.4ms (baseline < 5ms); storage growth velocity 38% MoM predicts 80% full in 61 days.',
        'SQL-PROD-02: Healthy (97/100), Always On AG fully synchronized, 0 deadlocks.',
      ],
      analysis: 'Temporal correlation reveals deployment CHG-8910 at 14:17 UTC introduced an uncommitted transaction in CheckoutService-Worker-04. At 14:20 UTC, ad-hoc index creation CHG-8902 on OrderItems without the ONLINE=ON clause escalated schema locks, precipitating the blocking cascade at 14:24 UTC.',
      risk: {
        score: 88,
        level: 'CRITICAL',
        businessImpact: 'Severe checkout checkout degradation on Tier 1 OrdersDB. Potential cart abandonment and SLA breach exceeding $45,000/hour.',
      },
      recommendations: [
        {
          id: 'REC-001',
          title: 'Terminate Root Blocker Session SPID 78',
          why: 'Session 78 has been idle in transaction for >340s, blocking 14 worker threads.',
          evidence: 'sys.dm_exec_requests shows open_transaction_count = 1, wait_time = 0, status = sleeping.',
          expectedBenefit: 'Immediate resolution of blocking cascade; P99 latency recovery within 30 seconds.',
          risk: 'HIGH',
          implementationComplexity: 'LOW',
          rollbackMethod: 'Worker application will retry transaction via idempotency key.',
          validationMethod: 'Verify blocked sessions count drops to 0 via sys.dm_os_waiting_tasks.',
          priority: 'CRITICAL',
          safetyLevel: 'RED',
          sqlScript: 'KILL 78; -- Safety Gate: Explicit Human Approval Required',
          targetServer: 'SQL-PROD-01',
          targetDatabase: 'OrdersDB',
        },
        {
          id: 'REC-002',
          title: 'Force Known Good Execution Plan for Query 41829',
          why: 'Query 41829 regressed 1,994% after plan change from Plan 104 to Plan 218.',
          evidence: 'Query Store shows duration increased from 42.5ms to 890.0ms.',
          expectedBenefit: '55% reduction in SQL-PROD-01 CPU pressure.',
          risk: 'LOW',
          implementationComplexity: 'LOW',
          rollbackMethod: 'EXEC sp_query_store_unforce_plan @query_id = 41829, @plan_id = 104;',
          validationMethod: 'Query Store runtime verification over 15-minute window.',
          priority: 'HIGH',
          safetyLevel: 'AMBER',
          sqlScript: 'EXEC sp_query_store_force_plan @query_id = 41829, @plan_id = 104;',
          targetServer: 'SQL-PROD-01',
          targetDatabase: 'OrdersDB',
        },
      ],
      automation: 'AI DBA can automatically capture post-incident diagnostic dumps and update the Query Store baseline.',
      approval: {
        required: true,
        level: 'RED',
        reason: 'Terminating session 78 requires human approval per Section 15 Human-in-the-Loop policy.',
      },
      validation: 'Compare P99 query duration and verify blocked sessions count drops to 0.',
      audit: 'Log timestamp, DBA identity, session ID, kill confirmation, and post-state verification to sys.dba_audit_events.',
      confidence: {
        level: 'HIGH',
        pct: 95,
        rationale: 'Direct causal evidence from sys.dm_exec_requests, lock graphs, and temporal change correlation.',
      },
      rootCauseCandidates: [
        { cause: 'Sleeping session with uncommitted transaction after app release', probabilityPct: 82, evidence: 'SPID 78 idle 342s, holding LCK_M_X locks' },
        { cause: 'Ad-hoc offline index creation schema lock contention', probabilityPct: 14, evidence: 'CHG-8902 index creation at 14:20 UTC' },
        { cause: 'Hardware IO bottleneck', probabilityPct: 4, evidence: 'Storage latency on PROD-01 is nominal (4.2ms)' },
      ],
      sourceMode: mode,
    };
  }

  if (p.includes('why is sql-prod-01') || p.includes('why is sql01') || p.includes('why is sql03') || p.includes('blocking')) {
    const isProd3 = p.includes('sql-prod-03') || p.includes('sql03');
    if (isProd3) {
      return {
        finding: 'SQL-PROD-03 is experiencing severe storage latency degradation (28.4ms) and memory grant starvation.',
        evidence: [
          'PAGEIOLATCH_SH wait statistics account for 58.4% of all engine waits (avg wait 38.2ms).',
          'RESOURCE_SEMAPHORE waits average 790ms per waiting query.',
          'Page Life Expectancy has dropped to 260 seconds, well below the 300s threshold for 384GB RAM.',
          'Recent configuration change CHG-8874 increased MAXDOP from 8 to 16.',
        ],
        analysis: 'Increasing MAXDOP to 16 caused massive concurrent thread saturation across the storage controller on volume L:\\Data. The analytical queries consume excessive memory grants, forcing other reporting queries into RESOURCE_SEMAPHORE wait queues.',
        risk: {
          score: 64,
          level: 'HIGH',
          businessImpact: 'Tableau and PowerBI corporate reports experiencing timeouts and failure to meet business SLA.',
        },
        recommendations: [
          {
            id: 'REC-003',
            title: 'Revert MAXDOP to 8 on AnalyticsDataMart',
            why: 'Restores thread scheduling balance and cuts disk queue depth in half.',
            evidence: 'OS thread queue length elevated to 48 when MAXDOP was 16.',
            expectedBenefit: 'Storage latency reduction from 28.4ms down to <8ms.',
            risk: 'LOW',
            implementationComplexity: 'LOW',
            rollbackMethod: 'EXEC sp_configure "max degree of parallelism", 16; RECONFIGURE;',
            validationMethod: 'Monitor sys.dm_os_wait_stats for PAGEIOLATCH_SH decrease.',
            priority: 'HIGH',
            safetyLevel: 'AMBER',
            sqlScript: 'EXEC sp_configure "show advanced options", 1; RECONFIGURE; EXEC sp_configure "max degree of parallelism", 8; RECONFIGURE;',
            targetServer: 'SQL-PROD-03',
          },
        ],
        automation: 'AI can execute telemetry monitoring before and after configuration reconfigure.',
        approval: {
          required: true,
          level: 'AMBER',
          reason: 'Instance configuration change requires DBA approval.',
        },
        validation: 'Verify PLE returns above 500s and PAGEIOLATCH_SH drops below 15ms.',
        audit: 'Audit sp_configure change, change requester, and before/after latency.',
        confidence: {
          level: 'HIGH',
          pct: 91,
          rationale: 'Direct correlation between CHG-8874 timestamp and wait stat inflection point.',
        },
      };
    }

    return {
      finding: 'SQL-PROD-01 slowdown is caused by a 14-session blocking cascade rooted in SPID 78 holding an exclusive LCK_M_X lock on dbo.Orders.',
      evidence: [
        'Root blocker: SPID 78 (svc_checkout_worker, host K8S-NODE-APP-19).',
        'Open transaction duration: 342 seconds; status: SLEEPING (awaiting command).',
        'Blocked sessions: 14 active threads waiting on LCK_M_X, including critical checkout API handlers.',
        'Top wait type: LCK_M_X (48.6% of all instance waits, avg 339ms).',
      ],
      analysis: 'The application worker initiated a batch update with BEGIN TRANSACTION, updated status on a batch of Order IDs, and then either suffered an unhandled client-side exception or timed out without executing COMMIT or ROLLBACK. The persistent lock prevents all concurrent order writes.',
      risk: {
        score: 92,
        level: 'CRITICAL',
        businessImpact: 'Checkout API requests are backing up. Web proxy thread pool saturation imminent.',
      },
      recommendations: [
        {
          id: 'REC-001',
          title: 'Kill Root Blocker Session 78',
          why: 'Releases exclusive locks immediately, unblocking 14 queued customer transactions.',
          evidence: 'SPID 78 has been idle in transaction for 342 seconds.',
          expectedBenefit: 'Instant relief for checkout queue; checkout API P99 latency returns to 85ms.',
          risk: 'HIGH',
          implementationComplexity: 'LOW',
          rollbackMethod: 'Client worker auto-retries with idempotent order batch token.',
          validationMethod: 'Query sys.dm_exec_requests to confirm 0 sessions blocked.',
          priority: 'CRITICAL',
          safetyLevel: 'RED',
          sqlScript: 'KILL 78; -- Explicit approval gate enforced',
          targetServer: 'SQL-PROD-01',
          targetDatabase: 'OrdersDB',
        },
      ],
      automation: 'Automated notification to on-call DBA channel; diagnostic snapshot collection.',
      approval: {
        required: true,
        level: 'RED',
        reason: 'Terminating active sessions on production requires explicit human approval.',
      },
      validation: 'Verify sys.dm_os_waiting_tasks shows no LCK_M_X waits on Orders table.',
      audit: 'Record incident INC-4092 containment action, operator ID, and timestamp.',
      confidence: {
        level: 'HIGH',
        pct: 96,
        rationale: 'Root blocker verified via DMV lock hierarchy traversal.',
      },
    };
  }

  if (p.includes('capacity') || p.includes('next month') || p.includes('predict') || mode === 'predictive') {
    return {
      finding: 'SQL-PROD-03 (AnalyticsDataMart) is projected to breach the 80% disk capacity threshold in 61 days; SQL-PROD-01 will experience memory pressure within 45 days.',
      evidence: [
        'SQL-PROD-03: Volume L:\\Data current free space is 21% (4.12 TB used out of 5.20 TB).',
        'Database growth velocity increased 38% compared with the previous 30-day baseline (prompt section 9 rule).',
        'SQL-PROD-01: Page Life Expectancy declining 12% week-over-week due to increasing working set size of OrdersDB.',
      ],
      analysis: 'AnalyticsDataMart is receiving continuous high-volume clickstream ingestion from the mobile app without an active data archiving strategy. At the current rate of 38.4 GB/day, disk exhaustion will occur in 61 days, risking transaction failure during month-end reporting.',
      risk: {
        score: 68,
        level: 'HIGH',
        businessImpact: 'Potential database suspension and analytics reporting failure in Q4 peak if capacity is not expanded.',
      },
      recommendations: [
        {
          id: 'REC-004',
          title: 'Expand SAN Storage LUN on SQL-PROD-03 by 2.0 TB',
          why: 'Provides 180 days of growth runway and avoids emergency disk resizing.',
          evidence: 'Predictive 61-day exhaustion curve based on 90-day linear regression.',
          expectedBenefit: 'Restores volume free space to 48%, mitigating disk outage risk.',
          risk: 'LOW',
          implementationComplexity: 'MEDIUM',
          rollbackMethod: 'SAN volume contraction (or non-reclaimable reserved LUN).',
          validationMethod: 'sys.dm_os_volume_stats reflects available_bytes > 2.5 TB.',
          priority: 'HIGH',
          safetyLevel: 'AMBER',
          targetServer: 'SQL-PROD-03',
          targetDatabase: 'AnalyticsDataMart',
        },
      ],
      automation: 'Automated weekly capacity projection report generation sent to IT Infrastructure.',
      approval: {
        required: true,
        level: 'AMBER',
        reason: 'Infrastructure resource allocation requires engineering lead approval.',
      },
      validation: 'Re-run capacity forecast model post-provisioning to confirm >180 days margin.',
      audit: 'Log capacity forecast metrics, assumptions, and hardware ticket ID.',
      confidence: {
        level: 'HIGH',
        pct: 92,
        rationale: 'R-squared value of 0.94 on 90-day storage consumption telemetry.',
      },
    };
  }

  // General fallback
  return {
    finding: `Evaluated estate telemetry for query: "${prompt}". 1 Critical Incident active on SQL-PROD-01; 1 Storage warning on SQL-PROD-03.`,
    evidence: [
      'Estate Health Score: 87/100 across 5 managed instances.',
      'Active root blocker SPID 78 holding 14 sessions on OrdersDB.',
      'Average read latency on SQL-PROD-03 is 28.4ms (Elevated).',
      'Always On Availability Groups healthy and synchronized across Tier 1 systems.',
    ],
    analysis: 'The primary operational risk is the uncommitted transaction cascade on SQL-PROD-01. Secondary risk is storage growth velocity on SQL-PROD-03.',
    risk: {
      score: 76,
      level: 'HIGH',
      businessImpact: 'Checkout API performance degraded; Analytics capacity buffer shrinking.',
    },
    recommendations: [
      {
        id: 'REC-001',
        title: 'Review and Terminate Root Blocker Session 78',
        why: 'Unblocks checkout queue on SQL-PROD-01.',
        evidence: 'Open transaction > 340s.',
        expectedBenefit: 'P99 checkout latency restoration.',
        risk: 'HIGH',
        implementationComplexity: 'LOW',
        rollbackMethod: 'Application retry.',
        validationMethod: 'DMV check for 0 blocked sessions.',
        priority: 'CRITICAL',
        safetyLevel: 'RED',
        sqlScript: 'KILL 78;',
        targetServer: 'SQL-PROD-01',
      },
    ],
    automation: 'Diagnostic DMV collection and automated alerting.',
    approval: {
      required: true,
      level: 'RED',
      reason: 'Human authorization required for corrective kill action.',
    },
    validation: 'Verify telemetry parameters return to nominal baseline within 5 minutes.',
    audit: 'All actions logged to enterprise audit repository.',
    confidence: {
      level: 'HIGH',
      pct: 93,
      rationale: 'Multi-source DMV correlation across sys.dm_os_wait_stats and sys.dm_exec_requests.',
    },
    sourceMode: mode,
  };
}

// 1. Natural Language DBA Query / Copilot Route
app.post('/api/dba/query', async (req, res) => {
  try {
    const { prompt, mode = 'dba', serverId, incidentId } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const estateSnapshot = {
      servers: estateServers.map((s: any) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        healthScore: s.healthScore,
        cpuUsagePct: s.cpuUsagePct,
        pageLifeExpectancySec: s.pageLifeExpectancySec,
        avgReadLatencyMs: s.avgReadLatencyMs,
        blockedSessionsCount: s.blockedSessionsCount,
        daysTo80PctDisk: s.daysTo80PctDisk,
        alwaysOnStatus: s.alwaysOnStatus,
      })),
      activeIncidents: estateIncidents.filter((i: any) => i.status === 'ACTIVE'),
      blockingChain: estateBlockingChain,
      queryRegressions: MOCK_QUERY_REGRESSIONS,
      operatingMode: mode,
    };

    const userMessage = `
User Query: "${prompt}"
Operating Mode: ${mode}
Selected Server: ${serverId || 'ALL'}
Selected Incident: ${incidentId || 'NONE'}

Live Estate Telemetry Snapshot:
${JSON.stringify(estateSnapshot, null, 2)}

Provide your response strictly complying with the Section 28 Response Format and Section 1 Core Operating Principles.
Return a valid JSON object matching:
{
  "finding": "One-sentence conclusion",
  "evidence": ["Evidence point 1", "Evidence point 2", ...],
  "analysis": "Correlation and reasoning",
  "risk": {
    "score": number 0-100,
    "level": "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH" | "CRITICAL",
    "businessImpact": "Detailed impact"
  },
  "recommendations": [
    {
      "id": "REC-xxx",
      "title": "Action title",
      "why": "Reason",
      "evidence": "Measurement",
      "expectedBenefit": "Benefit",
      "risk": "LOW" | "MEDIUM" | "HIGH",
      "implementationComplexity": "LOW" | "MEDIUM" | "HIGH",
      "rollbackMethod": "How to roll back",
      "validationMethod": "How to validate",
      "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "safetyLevel": "GREEN" | "AMBER" | "RED",
      "sqlScript": "Optional SQL script",
      "targetServer": "Server name",
      "targetDatabase": "Database name"
    }
  ],
  "automation": "What AI can safely do",
  "approval": {
    "required": boolean,
    "level": "GREEN" | "AMBER" | "RED",
    "reason": "Approval justification"
  },
  "validation": "How success will be measured",
  "audit": "What should be recorded",
  "confidence": {
    "level": "HIGH" | "MEDIUM" | "LOW",
    "pct": number 0-100,
    "rationale": "Confidence reasoning"
  },
  "rootCauseCandidates": [
    { "cause": "Cause description", "probabilityPct": number, "evidence": "Supporting metric" }
  ]
}
`;

    const parsedLlmResponse = await executeLlmChat(MASTER_SYSTEM_INSTRUCTION, userMessage);
    if (parsedLlmResponse) {
      return res.json({
        ...parsedLlmResponse,
        sourceMode: mode,
        llmProvider: activeLlmConfig.provider,
        llmModel: activeLlmConfig.provider === 'ollama' ? activeLlmConfig.ollamaModel : 'gemini-3.8-flash',
        isAirGapped: activeLlmConfig.provider === 'ollama',
      });
    }

    // Deterministic expert DBA fallback
    const fallbackResponse = generateExpertDbaResponse(prompt, mode);
    return res.json({
      ...fallbackResponse,
      llmProvider: 'deterministic-expert-fallback',
      isAirGapped: true,
    });
  } catch (error: any) {
    console.error('Error handling DBA query:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 2. Daily Proactive Morning Briefing Route (Section 20)
app.post('/api/dba/briefing', async (req, res) => {
  try {
    const briefingPrompt = `Generate the Daily AI DBA Morning Briefing adhering strictly to Section 20 of the specification:
    1. Healthy systems
    2. Watch items (emerging risks)
    3. Action Required (immediate risks)
    4. Emerging Trends (performance, capacity, security)
    5. Overnight Events (incidents, alerts, backup/index jobs)
    6. Recommended Actions ranked by risk
    7. Automation Opportunities
    8. Management Attention

    Current Estate State:
    ${JSON.stringify({ servers: estateServers, incidents: estateIncidents }, null, 2)}
    `;

    const parsedBriefing = await executeLlmChat(MASTER_SYSTEM_INSTRUCTION, briefingPrompt);
    if (parsedBriefing) {
      return res.json(parsedBriefing);
    }

    // Fallback briefing
    return res.json(MOCK_MORNING_BRIEF);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Root Cause Analysis (RCA) Generator (Section 10)
app.post('/api/dba/rca', async (req, res) => {
  try {
    const { incidentId } = req.body;
    const incident = estateIncidents.find((i: any) => i.id === incidentId) || estateIncidents[0];

    const rcaPayload = {
      incidentId: incident.id,
      title: incident.title,
      timeline: [
        { time: '14:17 UTC', event: 'App Release v4.12.0 deployed by deploy-pipeline to Checkout service' },
        { time: '14:20 UTC', event: 'Ad-hoc index creation CHG-8902 on OrderItems without ONLINE=ON' },
        { time: '14:24 UTC', event: 'SPID 78 enters SLEEPING state with uncommitted open transaction' },
        { time: '14:25 UTC', event: 'First blocked session (SPID 112) detected on LCK_M_X lock' },
        { time: '14:28 UTC', event: 'Blocked sessions count escalates to 14; Checkout P99 spikes to 3,200ms' },
        { time: '14:32 UTC', event: 'AI DBA Command Center triggers INC-4092 and identifies root blocker SPID 78' },
      ],
      evidence: [
        'sys.dm_exec_requests: session_id = 78, status = sleeping, open_transaction_count = 1, wait_time = 0ms',
        'sys.dm_tran_active_transactions: transaction_begin_time = 14:24:12 UTC (active for 342s)',
        'sys.dm_os_waiting_tasks: 14 sessions blocked on resource_description containing compile partition of dbo.Orders',
        'sys.dm_os_wait_stats: LCK_M_X cumulative wait time 482,000ms',
      ],
      rootCauseCandidates: [
        { cause: 'Uncommitted transaction in worker thread following application release batch retry logic error', probabilityPct: 84 },
        { cause: 'Ad-hoc schema lock contention during concurrent index build', probabilityPct: 12 },
        { cause: 'Storage subsystem I/O stall', probabilityPct: 4 },
      ],
      probableCause: 'Application Release v4.12.0 worker thread failed to catch an asynchronous timeout exception, leaving an open transaction with exclusive lock on dbo.Orders.',
      businessImpact: 'Checkout API P99 latency degraded from 85ms to 3,200ms across 1,420 active connections; customer checkout timeouts occurred.',
      preventativeActions: [
        'Enforce connection string setting "SET XACT_ABORT ON" across checkout microservices.',
        'Implement strict CI/CD linting rule disallowing CREATE INDEX without WITH (ONLINE = ON) in production.',
        'Configure database-level DEFAULT_TRANSACTION_TIMEOUT to 60 seconds.',
      ],
      safetyGate: 'RED - Human approval required to execute KILL 78 to restore service.',
    };

    return res.json(rcaPayload);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Change Review / CAB Engine (Section 3 Mode F)
app.post('/api/dba/cab-review', async (req, res) => {
  try {
    const { changeTitle, changeScript, targetServer, targetDatabase } = req.body;

    const evaluation = {
      changeTitle: changeTitle || 'Proposed Index Creation on OrdersDB',
      targetServer: targetServer || 'SQL-PROD-01',
      targetDatabase: targetDatabase || 'OrdersDB',
      riskScore: 45,
      riskLevel: 'MEDIUM',
      cabRecommendation: 'APPROVE WITH CONDITIONS',
      checks: [
        { name: 'ONLINE=ON Index Option', passed: true, note: 'Script includes WITH (ONLINE = ON, SORT_IN_TEMPDB = ON)' },
        { name: 'TempDB Capacity Verification', passed: true, note: 'TempDB volume has 180 GB free (requires ~35 GB for sort)' },
        { name: 'Lock Timeout Guard', passed: false, note: 'Missing SET LOCK_TIMEOUT 5000; to prevent indefinite schema locks' },
        { name: 'Always On Secondary Lag Impact', passed: true, note: 'Estimated redo log generation: 140 MB/sec, replica latency within threshold' },
        { name: 'Rollback Script Present', passed: true, note: 'DROP INDEX statement verified' },
      ],
      mandatoryPrerequisites: [
        'Add "SET LOCK_TIMEOUT 5000;" to prevent blocking active checkout transactions.',
        'Schedule implementation during standard maintenance window (01:00 - 03:00 UTC).',
      ],
      rollbackPlan: 'DROP INDEX IX_Orders_Status_CreatedDate ON dbo.Orders;',
      validationCriteria: 'Check sys.dm_db_index_usage_stats for seeks and verify PAGEIOLATCH_SH reduction for 24 hours.',
    };

    return res.json(evaluation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Safe Action Execution Loop (Sections 15, 16, 17, 24, 25)
app.post('/api/dba/execute-action', async (req, res) => {
  try {
    const { actionId, safetyLevel, targetServer, approvalNote, confirmedBy } = req.body;

    // Production safety gate check
    if (safetyLevel === 'RED' && (!confirmedBy || confirmedBy.trim() === '')) {
      return res.status(403).json({
        error: 'ACTION REQUIRES EXPLICIT HUMAN APPROVAL. Confirmation signature is missing.',
      });
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

    let actionName = 'EXECUTE_RECOMMENDATION';
    let beforeState = 'Unknown';
    let afterState = 'Normal';
    let validationResult = 'Telemetry verified';

    if (actionId === 'REC-001' || actionId === 'KILL_78') {
      actionName = 'KILL_ROOT_BLOCKER_SPID_78';
      beforeState = 'SPID 78 sleeping with 1 open tran, 14 blocked sessions, Health 78';
      
      // Update in-memory estate to simulate real remediation
      const prod1 = estateServers.find((s: any) => s.id === 'sql-prod-01');
      if (prod1) {
        prod1.blockedSessionsCount = 0;
        prod1.healthScore = 95;
        prod1.status = 'healthy';
        prod1.cpuUsagePct = 42;
      }
      estateBlockingChain = [];
      const inc4092 = estateIncidents.find((i: any) => i.id === 'INC-4092');
      if (inc4092) {
        inc4092.status = 'RESOLVED';
        inc4092.stage = 'DOCUMENT';
      }

      afterState = 'SPID 78 terminated, 0 blocked sessions, Health restored to 95/100';
      validationResult = 'sys.dm_os_waiting_tasks shows 0 active locks on OrdersDB; Checkout P99 recovered to 88ms';
    } else if (actionId === 'REC-002') {
      actionName = 'FORCE_QUERY_STORE_PLAN_41829';
      beforeState = 'Plan 218 active (Avg Duration: 890ms, Reads: 245k)';
      afterState = 'Plan 104 forced (Avg Duration: 42.5ms, Reads: 12.4k)';
      validationResult = 'CPU utilization dropped 18% within 2 minutes; P95 duration restored to 58ms';
      const q41829 = estateQueryRegressions.find((q: any) => q.queryId === 41829);
      if (q41829) {
        q41829.current.avgDurationMs = 42.5;
        q41829.current.avgLogicalReads = 12400;
        q41829.durationRegressionPct = 0;
        q41829.severity = 'LOW';
      }
    } else if (actionId === 'REC-003') {
      actionName = 'CREATE_INDEX_ORDERS_STATUS_ONLINE';
      beforeState = 'Table Scan on Orders status queries (245k reads/exec)';
      afterState = 'Index Seek enabled with IX_Orders_Status_CreatedDate';
      validationResult = 'Logical reads reduced by 78.4%';
    } else if (actionId === 'REC-STORAGE-PROD03') {
      actionName = 'COMPRESS_AND_PURGE_CLICKSTREAM_LUN';
      beforeState = 'L:\\Data at 79.2% (4,120 GB used, 1 day to 80% threshold, z-score: 3.84)';
      const p3 = estateStorageBaselines.find((b: any) => b.id === 'BASE-PROD03-DATA');
      if (p3) {
        p3.usedGB = 3200;
        p3.freeGB = 2000;
        p3.utilizationPct = 61.5;
        p3.daysTo80Pct = 96;
        p3.daysTo90Pct = 145;
        p3.daysTo100Pct = 188;
        p3.isAnomaly = false;
        p3.anomalySeverity = 'NORMAL';
        p3.currentDailyGrowthGB = 13.0;
        p3.growthVelocitySurgePct = 4.0;
        p3.zScore = 0.21;
      }
      const prod3Server = estateServers.find((s: any) => s.id === 'sql-prod-03');
      if (prod3Server) {
        prod3Server.healthScore = 94;
        prod3Server.daysTo80PctDisk = 96;
        prod3Server.storageStatus = 'normal';
      }
      afterState = 'PAGE compression applied, 920 GB reclaimed. L:\\Data now at 61.5% utilization (96 days to 80%)';
      validationResult = 'sys.dm_os_volume_stats confirmed 2,000 GB free space on volume L:\\Data';
    } else if (actionId === 'REC-STORAGE-PROD01') {
      actionName = 'TRUNCATE_SHRINK_LOG_ORDERSDB';
      beforeState = 'T:\\Log at 72.5% (580 GB used, 4 days to 80% threshold)';
      const p1Log = estateStorageBaselines.find((b: any) => b.id === 'BASE-PROD01-LOG');
      if (p1Log) {
        p1Log.usedGB = 230;
        p1Log.freeGB = 570;
        p1Log.utilizationPct = 28.7;
        p1Log.daysTo80Pct = 95;
        p1Log.daysTo90Pct = 140;
        p1Log.isAnomaly = false;
        p1Log.anomalySeverity = 'NORMAL';
      }
      afterState = 'Inactive VLFs reclaimed. T:\\Log size reduced from 580 GB to 230 GB';
      validationResult = 'DBCC SHRINKFILE completed with 0 errors; VLF count reduced from 1,420 to 64';
    } else if (actionId === 'REC-008') {
      actionName = 'DEPLOY_PLAN_GUIDE_MERCHANT_TYPE';
      beforeState = 'CONVERT_IMPLICIT forcing Index Scan (68,000 reads/exec)';
      const q77 = estateQueryRegressions.find((q: any) => q.queryId === 77102);
      if (q77) {
        q77.current.avgDurationMs = 8.1;
        q77.current.avgLogicalReads = 420;
        q77.durationRegressionPct = 0;
        q77.severity = 'LOW';
      }
      afterState = 'Plan guide active with explicit VARCHAR(50) parameter hint';
      validationResult = 'sys.dm_exec_query_stats shows duration dropped from 74ms to 8.1ms; CPU dropped 92%';
    }

    const auditEntry: AuditLogEntry = {
      id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp,
      requester: confirmedBy || 'AI DBA Agent [Automated]',
      agent: 'AI DBA Command Center v1.0',
      server: targetServer || 'SQL-PROD-01',
      database: 'OrdersDB',
      action: actionName,
      reason: approvalNote || 'Remediation of detected performance anomaly',
      safetyLevel: safetyLevel || 'AMBER',
      approvalBy: confirmedBy ? `${confirmedBy} [Explicit UI Gate]` : 'AUTO_POLICY_GREEN',
      beforeState,
      afterState,
      validation: validationResult,
      status: 'SUCCESS',
    };

    estateAuditLogs.unshift(auditEntry);

    return res.json({
      success: true,
      auditEntry,
      servers: estateServers,
      incidents: estateIncidents,
      blockingChain: estateBlockingChain,
      storageBaselines: estateStorageBaselines,
      queryRegressions: estateQueryRegressions,
      message: `Action ${actionName} executed safely. Validation confirmed. Audit record ${auditEntry.id} generated.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Reset or Inject Telemetry Simulations
app.post('/api/dba/simulate', async (req, res) => {
  try {
    const { scenario } = req.body;
    if (scenario === 'reset') {
      estateServers = JSON.parse(JSON.stringify(INITIAL_SERVERS));
      estateIncidents = JSON.parse(JSON.stringify(MOCK_INCIDENTS));
      estateBlockingChain = JSON.parse(JSON.stringify(MOCK_BLOCKING_CHAIN));
      estateStorageBaselines = JSON.parse(JSON.stringify(MOCK_STORAGE_BASELINES));
      estateStorageAlerts = JSON.parse(JSON.stringify(MOCK_STORAGE_ALERTS));
      estateQueryRegressions = JSON.parse(JSON.stringify(MOCK_DETAILED_QUERY_REGRESSIONS));
    } else if (scenario === 'spike_storage') {
      const prod3 = estateServers.find((s: any) => s.id === 'sql-prod-03');
      if (prod3) {
        prod3.avgReadLatencyMs = 46.8;
        prod3.healthScore = 69;
        prod3.status = 'critical';
      }
      const b3 = estateStorageBaselines.find((b: any) => b.id === 'BASE-PROD03-DATA');
      if (b3) {
        b3.currentDailyGrowthGB = 64.0;
        b3.growthVelocitySurgePct = 412.0;
        b3.daysTo80Pct = 0; // breaching now
        b3.daysTo90Pct = 8;
        b3.daysTo100Pct = 16;
      }
    } else if (scenario === 'trigger_blocking') {
      const prod1 = estateServers.find((s: any) => s.id === 'sql-prod-01');
      if (prod1) {
        prod1.blockedSessionsCount = 18;
        prod1.healthScore = 72;
        prod1.status = 'critical';
        estateBlockingChain = JSON.parse(JSON.stringify(MOCK_BLOCKING_CHAIN));
      }
    }

    return res.json({
      servers: estateServers,
      incidents: estateIncidents,
      blockingChain: estateBlockingChain,
      storageBaselines: estateStorageBaselines,
      queryRegressions: estateQueryRegressions,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Storage Growth Anomaly Detection System (GET & AI Deep Report)
app.get('/api/dba/storage-anomalies', (req, res) => {
  res.json({
    baselines: estateStorageBaselines,
    alerts: estateStorageAlerts,
  });
});

app.post('/api/dba/storage-anomalies/deep-report', async (req, res) => {
  try {
    const { baselineId } = req.body;
    const target = estateStorageBaselines.find((b: any) => b.id === baselineId) || estateStorageBaselines[0];

    const deepStoragePrompt = `Generate a comprehensive Predictive Storage Growth Anomaly Report for:
    Server: ${target.serverName}, Database: ${target.databaseName}, Volume: ${target.volumeMount}
    Total Capacity: ${target.totalCapacityGB} GB, Used: ${target.usedGB} GB (${target.utilizationPct}%)
    Baseline Daily Growth: ${target.baselineDailyGrowthGB} GB/day vs Observed Current: ${target.currentDailyGrowthGB} GB/day (+${target.growthVelocitySurgePct}%)
    Z-Score Anomaly Rating: ${target.zScore}
    Days to 80%: ${target.daysTo80Pct} days (${target.projectedDate80})
    Days to 90%: ${target.daysTo90Pct} days (${target.projectedDate90})
    Days to 100%: ${target.daysTo100Pct} days (${target.projectedDate100})
    Top Consumer: ${JSON.stringify(target.topTableConsumers[0])}

    Provide your expert response as a valid JSON object matching:
    {
      "executiveSummary": "Concise high-level finding",
      "statisticalAnalysis": "Deviation z-score analysis comparing 90-day baseline to current velocity",
      "predictedTimelines": {
        "threshold80": "Timeline and date for 80% full",
        "threshold90": "Timeline and date for 90% full",
        "threshold100": "Timeline and date for complete capacity exhaustion"
      },
      "tableBreakdown": "Details on culprit tables and partition churn",
      "technicalImpact": "Impact on SQL Server autogrowth, log writes, and buffer pool",
      "businessImpact": "SLA and revenue impact",
      "rankedRemediations": [
        { "step": 1, "action": "Action name", "benefit": "Capacity reclaimed", "safetyLevel": "AMBER" | "RED" | "GREEN", "script": "SQL or script" }
      ]
    }`;

    const parsedReport = await executeLlmChat(MASTER_SYSTEM_INSTRUCTION, deepStoragePrompt);
    if (parsedReport) {
      return res.json(parsedReport);
    }

    // Deterministic fallback report
    return res.json({
      executiveSummary: `Critical storage growth anomaly detected on ${target.serverName} (${target.databaseName}). Volume ${target.volumeMount} is growing at ${target.currentDailyGrowthGB} GB/day (+${target.growthVelocitySurgePct}% vs baseline) with a statistically significant z-score of ${target.zScore}.`,
      statisticalAnalysis: `Moving 90-day baseline was established at ${target.baselineDailyGrowthGB} GB/day (standard deviation: 6.7 GB). The current rate of ${target.currentDailyGrowthGB} GB/day exceeds 3.8 standard deviations, confirming a non-linear ingestion surge.`,
      predictedTimelines: {
        threshold80: `Breaching 80% (4,160 GB) in ${target.daysTo80Pct} day(s) on ${target.projectedDate80}.`,
        threshold90: `Breaching 90% (4,680 GB) in ${target.daysTo90Pct} days on ${target.projectedDate90}.`,
        threshold100: `Complete physical disk exhaustion (5,200 GB) in ${target.daysTo100Pct} days on ${target.projectedDate100}.`,
      },
      tableBreakdown: `The primary culprit is ${target.topTableConsumers[0]?.tableName}, which accounts for ${target.topTableConsumers[0]?.sizeGB} GB (${target.topTableConsumers[0]?.pctOfDatabase}% of database) and added ${target.topTableConsumers[0]?.growth30dGB} GB over the past 30 days due to uncompressed raw JSON payload streaming.`,
      technicalImpact: `When disk utilization reaches 100%, SQL Server will fail to allocate new extents, causing data file autogrowth to stall. Transactions requiring page allocations will abort with error 1105 (Could not allocate space for object in database), freezing write traffic.`,
      businessImpact: `Halts executive reporting and billing reconcile pipelines. Potential SLA penalty of $12,000/hour during month-end financial closing.`,
      rankedRemediations: [
        {
          step: 1,
          action: 'Enable PAGE or COLUMNSTORE Data Compression on historical partitions',
          benefit: 'Reclaims approximately 920 GB of uncompressed storage immediately.',
          safetyLevel: 'AMBER',
          script: `ALTER TABLE ${target.topTableConsumers[0]?.tableName} REBUILD WITH (DATA_COMPRESSION = PAGE, ONLINE = ON);`,
        },
        {
          step: 2,
          action: 'Deploy automated 90-day retention partition purge job',
          benefit: 'Permanently caps ongoing database growth to < 14 GB/day.',
          safetyLevel: 'AMBER',
          script: `DELETE TOP (50000) FROM ${target.topTableConsumers[0]?.tableName} WHERE EventTimestamp < DATEADD(DAY, -90, GETUTCDATE());`,
        },
        {
          step: 3,
          action: 'Request +2.0 TB SAN LUN storage expansion on volume ' + target.volumeMount,
          benefit: 'Provides 180+ days of buffer margin for seasonal data spikes.',
          safetyLevel: 'AMBER',
          script: '-- Engage SAN Administrator to expand virtual disk volume L:\\Data',
        },
      ],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. AI-Driven Query Performance Regression Checker (GET & AI Dissection)
app.get('/api/dba/query-regressions', (req, res) => {
  res.json({
    regressions: estateQueryRegressions,
  });
});

app.post('/api/dba/query-regressions/ai-analyze', async (req, res) => {
  try {
    const { queryId } = req.body;
    const query = estateQueryRegressions.find((q: any) => q.queryId === Number(queryId)) || estateQueryRegressions[0];

    const regressionPrompt = `Perform an architectural Query Performance Regression Analysis for:
    Query ID: ${query.queryId} (${query.databaseName} - ${query.objectName})
    Workload Period: ${query.workloadPeriod}
    SQL Text: ${query.sqlSnippet}
    Baseline: Duration ${query.baseline.avgDurationMs}ms, CPU ${query.baseline.avgCpuMs}ms, Reads ${query.baseline.avgLogicalReads}, Execs/hr ${query.baseline.executionCountPerHour}
    Current: Duration ${query.current.avgDurationMs}ms (+${query.durationRegressionPct}%), CPU ${query.current.avgCpuMs}ms (+${query.cpuRegressionPct}%), Reads ${query.current.avgLogicalReads} (+${query.readsRegressionPct}%)
    Z-Score Anomaly: ${query.zScore}
    Regression Nature: ${query.regressionNature}
    Plan Diff: Previous Plan ${query.planComparison.previousPlanId} (${query.planComparison.previousOperator}) vs Current Plan ${query.planComparison.currentPlanId} (${query.planComparison.currentOperator})
    Cost Diff: ${query.planComparison.previousCostPct}% vs ${query.planComparison.currentCostPct}%
    TempDB Spill: ${query.planComparison.tempdbSpillMB} MB
    Correlated Deployment: ${JSON.stringify(query.correlatedDeployment || {})}

    Provide your analysis as a valid JSON object matching:
    {
      "finding": "One-sentence executive summary",
      "rootCauseMechanism": "Deep technical explanation of why the SQL Server query optimizer regressed",
      "workloadImpact": "Analysis considering ${query.workloadPeriod} baseline vs current concurrency",
      "deploymentLinkage": "How the code change or config change caused this plan switch",
      "planOperatorComparison": {
        "previousOperatorPros": "Why Plan ${query.planComparison.previousPlanId} was efficient",
        "currentOperatorBottlenecks": "Why Plan ${query.planComparison.currentPlanId} is disastrous"
      },
      "immediateRemediation": {
        "actionName": "Action to run now",
        "safetyLevel": "AMBER" | "RED",
        "sqlScript": "Exact T-SQL statement",
        "expectedRecovery": "Quantified expected benefit"
      },
      "permanentFix": "Architecture or code change to prevent recurrence"
    }`;

    const parsedAnalysis = await executeLlmChat(MASTER_SYSTEM_INSTRUCTION, regressionPrompt);
    if (parsedAnalysis) {
      return res.json(parsedAnalysis);
    }

    // Deterministic fallback
    return res.json({
      finding: `Query #${query.queryId} regressed by +${query.durationRegressionPct}% (${query.baseline.avgDurationMs}ms -> ${query.current.avgDurationMs}ms) following a sub-optimal ${query.regressionNature}.`,
      rootCauseMechanism: query.planComparison.reasonForSwitch,
      workloadImpact: `During ${query.workloadPeriod}, this query executes ${query.baseline.executionCountPerHour.toLocaleString()} times per hour. The increase from 12.4k to 245k logical reads per call consumes 1,840 CPU seconds per hour, causing worker scheduler thread exhaustion.`,
      deploymentLinkage: query.correlatedDeployment 
        ? `Directly correlated with ${query.correlatedDeployment.deploymentId} (${query.correlatedDeployment.releaseTag}) deployed at ${query.correlatedDeployment.deployedAt}. Code change in ${query.correlatedDeployment.description} altered parameter evaluation context.`
        : 'Triggered by out-of-date table statistics causing cardinality under-estimation.',
      planOperatorComparison: {
        previousOperatorPros: `Plan ${query.planComparison.previousPlanId} performed a precision ${query.planComparison.previousOperator} requiring only 2 MB memory grant and 0 TempDB spills.`,
        currentOperatorBottlenecks: `Plan ${query.planComparison.currentPlanId} performs a costly ${query.planComparison.currentOperator} scanning the entire table, generating ${query.planComparison.tempdbSpillMB} MB of TempDB disk spills.`,
      },
      immediateRemediation: {
        actionName: query.recommendedAction.title,
        safetyLevel: query.recommendedAction.safetyLevel,
        sqlScript: query.recommendedAction.sqlScript || '',
        expectedRecovery: query.recommendedAction.expectedBenefit,
      },
      permanentFix: 'Deploy covering index with ONLINE=ON and add strict type definitions to prevent ORM parameter variance.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Get Estate Snapshot
app.get('/api/dba/estate', (req, res) => {
  res.json({
    servers: estateServers,
    incidents: estateIncidents,
    recommendations: estateRecommendations,
    auditLogs: estateAuditLogs,
    waitStats: MOCK_WAIT_STATS,
    blockingChain: estateBlockingChain,
    queryRegressions: MOCK_QUERY_REGRESSIONS,
    detailedQueryRegressions: estateQueryRegressions,
    storageBaselines: estateStorageBaselines,
    storageAlerts: estateStorageAlerts,
    morningBrief: MOCK_MORNING_BRIEF,
  });
});


// 9. LLM Provider Management & Local Air-Gapped Ollama API
app.get('/api/dba/llm-provider', async (req, res) => {
  let ollamaOnline = false;
  let availableOllamaModels: string[] = [];
  let latencyMs: number | undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const start = Date.now();
    const tagsRes = await fetch(`${activeLlmConfig.ollamaBaseUrl}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    latencyMs = Date.now() - start;

    if (tagsRes.ok) {
      const data: any = await tagsRes.json();
      ollamaOnline = true;
      if (Array.isArray(data.models)) {
        availableOllamaModels = data.models.map((m: any) => m.name);
      }
    }
  } catch (e) {
    ollamaOnline = false;
  }

  res.json({
    currentProvider: activeLlmConfig.provider,
    ollamaBaseUrl: activeLlmConfig.ollamaBaseUrl,
    ollamaModel: activeLlmConfig.ollamaModel,
    geminiAvailable: !!apiKey,
    isAirGapped: activeLlmConfig.provider === 'ollama',
    ollamaOnline,
    availableOllamaModels,
    latencyMs,
  });
});

app.post('/api/dba/llm-provider', (req, res) => {
  const { provider, ollamaBaseUrl, ollamaModel } = req.body;
  if (provider === 'ollama' || provider === 'gemini') {
    activeLlmConfig.provider = provider;
  }
  if (ollamaBaseUrl && typeof ollamaBaseUrl === 'string') {
    activeLlmConfig.ollamaBaseUrl = ollamaBaseUrl.trim();
  }
  if (ollamaModel && typeof ollamaModel === 'string') {
    activeLlmConfig.ollamaModel = ollamaModel.trim();
  }

  res.json({
    success: true,
    currentProvider: activeLlmConfig.provider,
    ollamaBaseUrl: activeLlmConfig.ollamaBaseUrl,
    ollamaModel: activeLlmConfig.ollamaModel,
    isAirGapped: activeLlmConfig.provider === 'ollama',
    message: `LLM provider updated to ${activeLlmConfig.provider.toUpperCase()} (${
      activeLlmConfig.provider === 'ollama' ? '100% Private Air-Gapped Mode' : 'Cloud Gemini'
    })`,
  });
});

app.post('/api/dba/test-ollama', async (req, res) => {
  const { url } = req.body;
  const targetUrl = url || activeLlmConfig.ollamaBaseUrl;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const start = Date.now();
    const response = await fetch(`${targetUrl}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latency = Date.now() - start;

    if (response.ok) {
      const data: any = await response.json();
      const models = Array.isArray(data.models) ? data.models.map((m: any) => m.name) : [];
      return res.json({
        online: true,
        latencyMs: latency,
        models,
        message: `Successfully connected to local Ollama instance at ${targetUrl}. Found ${models.length} model(s). Zero data leaves your network.`,
      });
    } else {
      return res.json({
        online: false,
        message: `Ollama at ${targetUrl} returned HTTP status ${response.status}`,
      });
    }
  } catch (err: any) {
    return res.json({
      online: false,
      error: err.message,
      message: `Could not reach Ollama at ${targetUrl}. Ensure Ollama is running ('ollama serve') and accessible from this host.`,
    });
  }
});

// Mount Vite or static server
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`AI DBA Command Center Server running on port ${PORT}`);
  });
}

setupServer();
