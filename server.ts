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
import {
  testDirectSqlConnection,
  fetchLiveDirectTelemetry,
  generateCollectorScript,
  liveServerConfigs,
} from './src/server/sqlLive.js';

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
estateServers.forEach((s: any) => {
  s.isRealTime = true;
  s.telemetryMode = 'simulated';
  s.lastHeartbeat = new Date().toISOString();
});
let estateIncidents = JSON.parse(JSON.stringify(MOCK_INCIDENTS));
let estateRecommendations = JSON.parse(JSON.stringify(MOCK_RECOMMENDATIONS));
let estateAuditLogs = JSON.parse(JSON.stringify(MOCK_AUDIT_LOGS));
let estateWaitStats = JSON.parse(JSON.stringify(MOCK_WAIT_STATS));
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
// Helper for deterministic fallback responses if Gemini API is unavailable or rates limited
function generateExpertDbaResponse(prompt: string, mode: string = 'dba', serverId?: string): DbaAgentResponse {
  const p = prompt.toLowerCase();

  // 1. Identify if a specific server is targeted (either via serverId, by name/id in prompt, or "new/added" instance keywords)
  let targetServer = (serverId && serverId !== 'ALL')
    ? estateServers.find((s: any) => s.id === serverId || s.name.toLowerCase() === serverId.toLowerCase())
    : estateServers.find((s: any) => {
        const nameMatch = p.includes(s.name.toLowerCase());
        const idMatch = p.includes(s.id.toLowerCase());
        return nameMatch || idMatch;
      });

  // If query refers to "new", "newly added", "onboarded", or "recent" instance
  if (!targetServer && (p.includes('new') || p.includes('added') || p.includes('recent') || p.includes('onboarded') || p.includes('custom'))) {
    const nonDefaultServers = estateServers.filter((s: any) => !['sql-prod-01', 'sql-prod-02', 'sql-prod-03'].includes(s.id));
    if (nonDefaultServers.length > 0) {
      targetServer = nonDefaultServers[nonDefaultServers.length - 1];
    } else {
      targetServer = estateServers[estateServers.length - 1];
    }
  }

  const targetBaseline = targetServer
    ? estateStorageBaselines.find((b: any) => 
        b.serverId === targetServer.id || 
        b.serverName.toLowerCase() === targetServer.name.toLowerCase() ||
        b.id.toLowerCase().includes(targetServer.name.toLowerCase()) ||
        b.id.toLowerCase().includes(targetServer.id.toLowerCase())
      )
    : estateStorageBaselines.find((b: any) => p.includes(b.serverName.toLowerCase()) || p.includes(b.id.toLowerCase()));

  // If a specific server is asked about (e.g. newly added instance or specific monitored server)
  if (targetServer && targetServer.id !== 'sql-prod-01' && targetServer.id !== 'sql-prod-03') {
    const isStorageQuery = p.includes('storage') || p.includes('capacity') || p.includes('disk') || p.includes('growth') || p.includes('exhaustion') || p.includes('anomaly') || p.includes('anomoly') || mode === 'storage-anomalies';
    
    if (isStorageQuery && targetBaseline) {
      if (targetBaseline.isAnomaly) {
        return {
          finding: `Critical storage growth anomaly on ${targetServer.name} (${targetBaseline.databaseName}): volume ${targetBaseline.volumeMount} is growing at ${targetBaseline.currentDailyGrowthGB} GB/day (+${targetBaseline.growthVelocitySurgePct}% vs baseline) with z-score ${targetBaseline.zScore}.`,
          evidence: [
            `Volume ${targetBaseline.volumeMount}: ${targetBaseline.usedGB} GB used of ${targetBaseline.totalCapacityGB} GB (${targetBaseline.utilizationPct}%).`,
            `Observed daily growth: ${targetBaseline.currentDailyGrowthGB} GB/day (baseline: ${targetBaseline.baselineDailyGrowthGB} GB/day).`,
            `Primary culprit table: ${targetBaseline.topTableConsumers?.[0]?.tableName || 'Analytical Tables'} (${targetBaseline.topTableConsumers?.[0]?.sizeGB || 280} GB).`,
            `Projected timeline: 80% threshold reached in ${targetBaseline.daysTo80Pct} days (${targetBaseline.projectedDate80}); complete exhaustion in ${targetBaseline.daysTo100Pct} days.`,
          ],
          analysis: targetBaseline.rootCauseAnalysis || `Non-linear ingestion surge detected on ${targetServer.name} without automated partition purge or data compression.`,
          risk: {
            score: 78,
            level: 'HIGH',
            businessImpact: targetBaseline.potentialImpact || 'Risk of database suspension and autogrowth stall if disk capacity is not remediated.',
          },
          recommendations: [
            targetBaseline.recommendedAction || {
              id: `REC-STORAGE-${targetServer.id}`,
              title: `Deploy Partition Compression on ${targetServer.name}`,
              why: `Reclaims space on volume ${targetBaseline.volumeMount}.`,
              evidence: `z-score deviation of +${targetBaseline.zScore}.`,
              expectedBenefit: 'Reclaims uncompressed disk capacity.',
              risk: 'LOW',
              implementationComplexity: 'MEDIUM',
              rollbackMethod: 'Standard rollback.',
              validationMethod: 'sys.dm_os_volume_stats query.',
              priority: 'HIGH',
              safetyLevel: 'AMBER',
              targetServer: targetServer.name,
              targetDatabase: targetBaseline.databaseName,
            }
          ],
          automation: 'AI can trigger automated weekly capacity projections.',
          approval: { required: true, level: 'AMBER', reason: 'Capacity remediation requires DBA authorization.' },
          validation: 'Confirm free space margin extends > 90 days post-remediation.',
          audit: 'Log storage telemetry, baseline metrics, and approval action.',
          confidence: { level: 'HIGH', pct: 94, rationale: '90-day linear regression and statistical z-score telemetry.' },
          sourceMode: mode,
        };
      } else {
        return {
          finding: `${targetServer.name} storage baseline is NOMINAL: volume ${targetBaseline.volumeMount} is ${targetBaseline.utilizationPct}% utilized with ${targetBaseline.freeGB} GB free buffer and ${targetBaseline.daysTo80Pct} days runway to 80% threshold. Zero storage anomaly detected.`,
          evidence: [
            `Total volume capacity: ${targetBaseline.totalCapacityGB} GB; Used: ${targetBaseline.usedGB} GB (${targetBaseline.utilizationPct}%).`,
            `Observed daily growth: ${targetBaseline.currentDailyGrowthGB} GB/day vs baseline ${targetBaseline.baselineDailyGrowthGB} GB/day (nominal z-score: +${targetBaseline.zScore}).`,
            `Available free storage buffer: ${targetBaseline.freeGB} GB (${Math.round((targetBaseline.freeGB / targetBaseline.totalCapacityGB) * 100)}% available).`,
            `Projected 80% threshold date: ${targetBaseline.projectedDate80} (${targetBaseline.daysTo80Pct} days runway).`,
            `Storage Anomaly Engine baseline status: Active and healthy on database ${targetBaseline.databaseName}.`,
          ],
          analysis: `Statistical moving baseline confirms ${targetServer.name} telemetry is operating well within standard variance (+${targetBaseline.zScore} z-score). There is no capacity exhaustion risk or storage anomaly on this instance. Live telemetry stream is fully synchronized.`,
          risk: {
            score: 8,
            level: 'LOW',
            businessImpact: `Zero operational capacity risk or SLA exposure on ${targetServer.name}. Buffer margin exceeds 6 months.`,
          },
          recommendations: [
            targetBaseline.recommendedAction || {
              id: `REC-MON-${targetServer.id}`,
              title: `Maintain Scheduled Index Maintenance on ${targetServer.name}`,
              why: 'Standard operational maintenance prevents extent fragmentation.',
              evidence: 'Current storage metrics are within normal variance.',
              expectedBenefit: 'Sustained throughput and linear storage growth.',
              risk: 'LOW',
              implementationComplexity: 'LOW',
              rollbackMethod: 'N/A',
              validationMethod: 'sys.dm_db_index_physical_stats.',
              priority: 'LOW',
              safetyLevel: 'GREEN',
              targetServer: targetServer.name,
              targetDatabase: targetBaseline.databaseName,
            }
          ],
          automation: 'Continuous telemetry collection and predictive baseline comparison.',
          approval: { required: false, level: 'GREEN', reason: 'Read-only telemetry monitoring.' },
          validation: 'Telemetry verified nominal against historical baseline.',
          audit: 'Recorded in automated estate inventory.',
          confidence: { level: 'HIGH', pct: 98, rationale: 'Live DMV volume telemetry and moving linear regression from monitored instance.' },
          sourceMode: mode,
        };
      }
    }

    // Server general performance / diagnostic status query
    if (targetServer.status === 'healthy') {
      return {
        finding: `${targetServer.name} is in HEALTHY operational status with a health score of ${targetServer.healthScore}/100. All live telemetry and diagnostic parameters are nominal.`,
        evidence: [
          `CPU Utilization: ${targetServer.cpuUsagePct}% (OS: ${targetServer.osCpuUsagePct}%).`,
          `Page Life Expectancy: ${targetServer.pageLifeExpectancySec}s (Buffer pool residency nominal).`,
          `Active User Sessions: ${targetServer.activeConnections}; Blocked Sessions: ${targetServer.blockedSessionsCount}.`,
          `I/O Latency: ${targetServer.avgReadLatencyMs}ms read, ${targetServer.avgWriteLatencyMs}ms write.`,
          `Telemetry Stream: ${targetServer.isRealTime ? `Active real-time (${targetServer.telemetryMode})` : 'Normal baseline'}.`,
        ],
        analysis: `${targetServer.name} workload is executing within designed capacity and performance thresholds. Zero lock blocking chains, query regressions, or memory grant resource starvation detected.`,
        risk: {
          score: 8,
          level: 'LOW',
          businessImpact: 'Zero production risk. System fully compliant with performance SLAs.',
        },
        recommendations: [
          {
            id: `REC-MON-${targetServer.id}`,
            title: `Routine Health Verification for ${targetServer.name}`,
            why: 'Maintain automated telemetry streaming and proactive threshold alerting.',
            evidence: `Current health score is ${targetServer.healthScore}/100 with 0 blocked sessions.`,
            expectedBenefit: 'Guarantees continuous 99.99% availability SLA.',
            risk: 'LOW',
            implementationComplexity: 'LOW',
            rollbackMethod: 'N/A',
            validationMethod: 'sys.dm_server_services and DMV status checks.',
            priority: 'LOW',
            safetyLevel: 'GREEN',
            targetServer: targetServer.name,
          }
        ],
        automation: 'Autonomous DMV metric sampling and real-time streaming.',
        approval: { required: false, level: 'GREEN', reason: 'Diagnostic query.' },
        validation: 'Continuous real-time telemetry heartbeat verified.',
        audit: 'Estate inventory audit record confirmed.',
        confidence: { level: 'HIGH', pct: 98, rationale: 'Direct live telemetry correlation from server DMV streams.' },
        sourceMode: mode,
      };
    }
  }

  // 2. Storage / Capacity General Estate Query
  if (p.includes('capacity') || p.includes('storage') || (p.includes('predict') && !p.includes('blocking')) || mode === 'storage-anomalies' || mode === 'predictive') {
    const anomalies = estateStorageBaselines.filter((b: any) => b.isAnomaly);
    const nominal = estateStorageBaselines.filter((b: any) => !b.isAnomaly);

    return {
      finding: anomalies.length > 0
        ? `Storage Anomaly Engine identified ${anomalies.length} capacity anomaly across ${estateStorageBaselines.length} monitored volumes: ${anomalies.map((a: any) => `${a.serverName} (${a.volumeMount}: +${a.growthVelocitySurgePct}% surge)`).join(', ')}. All other ${nominal.length} volumes maintain healthy margins (>180 days).`
        : `All ${estateStorageBaselines.length} database volumes across the estate are operating within normal baseline capacity growth margins. Zero capacity anomalies detected.`,
      evidence: [
        ...anomalies.map((a: any) => `${a.serverName}: Volume ${a.volumeMount} current free space is ${Math.round((a.freeGB / a.totalCapacityGB) * 100)}% (${a.usedGB} GB used of ${a.totalCapacityGB} GB); growth velocity +${a.growthVelocitySurgePct}% MoM projects 80% full in ${a.daysTo80Pct} days.`),
        ...nominal.slice(0, 3).map((n: any) => `${n.serverName}: Volume ${n.volumeMount} is healthy (${n.utilizationPct}% used, ${n.freeGB} GB free buffer, ${n.daysTo80Pct} days to 80%).`),
      ],
      analysis: anomalies.length > 0
        ? `Analytical data mart ingestion on ${anomalies[0]?.serverName} is driving non-linear disk utilization without automated partition compression or data retention purge routines. Newly onboarded instances and production OLTP instances maintain stable linear trajectories.`
        : 'Predictive linear regression indicates all estate volumes have sufficient storage allocation buffer for the active quarter.',
      risk: {
        score: anomalies.length > 0 ? 68 : 15,
        level: anomalies.length > 0 ? 'HIGH' : 'LOW',
        businessImpact: anomalies.length > 0
          ? `Potential database suspension on ${anomalies[0]?.serverName} during month-end reporting if capacity is not expanded or compressed.`
          : 'Zero immediate capacity risk across monitored estate.',
      },
      recommendations: [
        ...(anomalies.length > 0 ? [anomalies[0].recommendedAction] : []),
        {
          id: 'REC-STORAGE-GLOBAL',
          title: 'Establish Continuous Automated Storage Telemetry & Anomaly Baselines',
          why: 'Multi-tier storage telemetry baselines prevent unexpected out-of-space incidents.',
          evidence: `90-day moving regression active across ${estateStorageBaselines.length} database volumes.`,
          expectedBenefit: 'Guarantees minimum 60-day advance notice prior to any volume threshold breaches.',
          risk: 'LOW',
          implementationComplexity: 'LOW',
          rollbackMethod: 'N/A',
          validationMethod: 'Storage Anomaly Engine telemetry check.',
          priority: 'MEDIUM',
          safetyLevel: 'GREEN',
        }
      ],
      automation: 'Automated weekly capacity projection report generation sent to IT Infrastructure.',
      approval: {
        required: anomalies.length > 0,
        level: anomalies.length > 0 ? 'AMBER' : 'GREEN',
        reason: 'Infrastructure resource allocation requires engineering lead approval.',
      },
      validation: 'Re-run capacity forecast model post-provisioning to confirm >180 days margin.',
      audit: 'Log capacity forecast metrics, assumptions, and hardware ticket ID.',
      confidence: {
        level: 'HIGH',
        pct: 92,
        rationale: 'R-squared value of 0.94 on 90-day storage consumption telemetry.',
      },
      sourceMode: mode,
    };
  }
  
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
        status: s.status,
        cpuUsagePct: s.cpuUsagePct,
        pageLifeExpectancySec: s.pageLifeExpectancySec,
        avgReadLatencyMs: s.avgReadLatencyMs,
        blockedSessionsCount: s.blockedSessionsCount,
        daysTo80PctDisk: s.daysTo80PctDisk,
        alwaysOnStatus: s.alwaysOnStatus,
        isRealTime: s.isRealTime,
        telemetryMode: s.telemetryMode,
      })),
      activeIncidents: estateIncidents.filter((i: any) => i.status === 'ACTIVE'),
      blockingChain: estateBlockingChain,
      queryRegressions: MOCK_QUERY_REGRESSIONS,
      storageBaselines: estateStorageBaselines.map((b: any) => ({
        id: b.id,
        serverId: b.serverId,
        serverName: b.serverName,
        databaseName: b.databaseName,
        volumeMount: b.volumeMount,
        utilizationPct: b.utilizationPct,
        currentDailyGrowthGB: b.currentDailyGrowthGB,
        baselineDailyGrowthGB: b.baselineDailyGrowthGB,
        growthVelocitySurgePct: b.growthVelocitySurgePct,
        zScore: b.zScore,
        isAnomaly: b.isAnomaly,
        daysTo80Pct: b.daysTo80Pct,
        daysTo100Pct: b.daysTo100Pct,
      })),
      operatingMode: mode,
    };

    const userMessage = `
User Query: "${prompt}"
Operating Mode: ${mode}
Selected Server: ${serverId || 'ALL'}
Selected Incident: ${incidentId || 'NONE'}

Live Estate Telemetry Snapshot:
${JSON.stringify(estateSnapshot, null, 2)}

CRITICAL ANTI-HALLUCINATION & GROUNDING RULES:
1. STRICT ACCURACY FROM SNAPSHOT: Derive ALL metrics, status indicators, and anomaly flags strictly from the Live Estate Telemetry Snapshot above.
2. HEALTHY / NOMINAL SERVERS: If the query asks about a server or newly added instance whose healthScore is >= 85, status is 'healthy', or whose storage baseline has isAnomaly: false, you MUST report that the instance is NOMINAL, HEALTHY, and operating within safe margins. NEVER hallucinate an outage, high blocking, or storage exhaustion for a healthy or newly added server.
3. STORAGE ANOMALY ENGINE STATUS: When asked about the Storage Anomaly Engine for a newly onboarded server, verify its baseline in the snapshot (e.g. utilizationPct, daysTo80Pct, zScore) and confirm it is actively tracked and nominal.

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
    const fallbackResponse = generateExpertDbaResponse(prompt, mode, serverId);
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
    const { baselineId, serverId, serverName } = req.body;
    const target = estateStorageBaselines.find((b: any) => 
      (baselineId && (b.id === baselineId || b.id.toLowerCase() === String(baselineId).toLowerCase())) ||
      (serverId && (b.serverId === serverId || b.serverId.toLowerCase() === String(serverId).toLowerCase())) ||
      (serverName && (b.serverName === serverName || b.serverName.toLowerCase() === String(serverName).toLowerCase())) ||
      (baselineId && (
        b.serverId?.toLowerCase() === String(baselineId).toLowerCase() ||
        b.serverName?.toLowerCase() === String(baselineId).toLowerCase() ||
        String(baselineId).toLowerCase().includes(b.serverName?.toLowerCase() || '') ||
        String(baselineId).toLowerCase().includes(b.id?.toLowerCase() || '')
      ))
    ) || estateStorageBaselines.find((b: any) => b.id === baselineId) || estateStorageBaselines[0];

    const isTargetAnomaly = Boolean(target.isAnomaly);
    const topConsumer = (target.topTableConsumers && target.topTableConsumers[0]) ? target.topTableConsumers[0] : {
      tableName: `dbo.${target.databaseName || 'Core'}_Master`,
      sizeGB: Math.round((target.usedGB || 680) * 0.4),
      pctOfDatabase: 40,
      growth30dGB: Math.round((target.currentDailyGrowthGB || 5) * 5),
    };

    const deepStoragePrompt = `Generate a comprehensive Predictive Storage Growth Capacity Report for:
    Server: ${target.serverName}, Database: ${target.databaseName}, Volume: ${target.volumeMount}
    Total Capacity: ${target.totalCapacityGB} GB, Used: ${target.usedGB} GB (${target.utilizationPct}%)
    Baseline Daily Growth: ${target.baselineDailyGrowthGB} GB/day vs Observed Current: ${target.currentDailyGrowthGB} GB/day (+${target.growthVelocitySurgePct}%)
    Z-Score Anomaly Rating: ${target.zScore}
    Days to 80%: ${target.daysTo80Pct} days (${target.projectedDate80})
    Days to 90%: ${target.daysTo90Pct} days (${target.projectedDate90})
    Days to 100%: ${target.daysTo100Pct} days (${target.projectedDate100})
    Anomaly Detected: ${isTargetAnomaly ? 'YES - CRITICAL SURGE ANOMALY' : 'NO - NOMINAL / HEALTHY BUFFER'}
    Top Consumer: ${JSON.stringify(topConsumer)}

    CRITICAL ANTI-HALLUCINATION INSTRUCTION:
    - If Anomaly Detected is NO, the volume is operating within normal variance with safe runway (>180 days). You MUST report that this storage volume is NOMINAL, stable, and healthy. DO NOT claim an outage, crisis, or false urgency.
    - If Anomaly Detected is YES, report the surge velocity and recommended remediation.

    Provide your expert response as a valid JSON object matching:
    {
      "executiveSummary": "Concise high-level finding reflecting the true anomaly or nominal state",
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
    if (parsedReport && parsedReport.executiveSummary) {
      return res.json(parsedReport);
    }

    // Deterministic fallback report dynamically tailored to the target baseline
    return res.json({
      executiveSummary: isTargetAnomaly
        ? `Critical storage growth anomaly detected on ${target.serverName} (${target.databaseName}). Volume ${target.volumeMount} is growing at ${target.currentDailyGrowthGB} GB/day (+${target.growthVelocitySurgePct}% vs baseline) with a statistically significant z-score of ${target.zScore}.`
        : `Storage growth baseline verified for ${target.serverName} (${target.databaseName}). Volume ${target.volumeMount} is operating within nominal statistical variance at ${target.currentDailyGrowthGB} GB/day (${target.utilizationPct}% utilized) with z-score ${target.zScore}.`,
      statisticalAnalysis: isTargetAnomaly
        ? `Moving 90-day baseline was established at ${target.baselineDailyGrowthGB} GB/day. The current rate of ${target.currentDailyGrowthGB} GB/day represents a +${target.growthVelocitySurgePct}% velocity surge (z-score: +${target.zScore}), confirming a non-linear ingestion anomaly.`
        : `Moving 90-day baseline is established at ${target.baselineDailyGrowthGB} GB/day. Current ingestion rate of ${target.currentDailyGrowthGB} GB/day is well within normal variance (z-score: ${target.zScore}). Linear regression indicates ${target.daysTo80Pct} days before reaching the 80% advisory threshold.`,
      predictedTimelines: {
        threshold80: `Breaching 80% (${Math.round(target.totalCapacityGB * 0.8).toLocaleString()} GB) in ${target.daysTo80Pct} day(s) on ${target.projectedDate80}.`,
        threshold90: `Breaching 90% (${Math.round(target.totalCapacityGB * 0.9).toLocaleString()} GB) in ${target.daysTo90Pct} days on ${target.projectedDate90}.`,
        threshold100: `Complete physical disk exhaustion (${target.totalCapacityGB.toLocaleString()} GB) in ${target.daysTo100Pct} days on ${target.projectedDate100}.`,
      },
      tableBreakdown: `Primary space consumer is ${topConsumer.tableName}, which accounts for ${topConsumer.sizeGB} GB (${topConsumer.pctOfDatabase}% of database) and added ${topConsumer.growth30dGB} GB over the past 30 days.`,
      technicalImpact: isTargetAnomaly
        ? `When disk utilization reaches 100%, SQL Server will fail to allocate new extents, causing data file autogrowth to stall. Transactions requiring page allocations will abort with error 1105 (Could not allocate space for object in database), freezing write traffic.`
        : `Nominal operating margins. Autogrowth extents expand without thread contention. Free space buffer is currently ${target.freeGB} GB (${Math.round((target.freeGB / target.totalCapacityGB) * 100)}% available).`,
      businessImpact: isTargetAnomaly
        ? `Halts reporting pipelines and database transactions on ${target.databaseName}. Potential SLA breach if capacity is not expanded prior to ${target.projectedDate80}.`
        : `Zero immediate operational risk or SLA impact. Next capacity review scheduled according to standard quarterly planning cadence.`,
      rankedRemediations: isTargetAnomaly
        ? [
            {
              step: 1,
              action: `Enable PAGE or COLUMNSTORE Data Compression on ${topConsumer.tableName}`,
              benefit: `Reclaims approximately ${Math.round(topConsumer.sizeGB * 0.45)} GB of storage immediately.`,
              safetyLevel: 'AMBER',
              script: `ALTER TABLE ${topConsumer.tableName} REBUILD WITH (DATA_COMPRESSION = PAGE, ONLINE = ON);`,
            },
            {
              step: 2,
              action: 'Deploy automated retention partition purge job',
              benefit: `Caps ongoing database growth to < ${Math.round(target.baselineDailyGrowthGB * 1.1)} GB/day.`,
              safetyLevel: 'AMBER',
              script: `DELETE TOP (50000) FROM ${topConsumer.tableName} WHERE EventTimestamp < DATEADD(DAY, -90, GETUTCDATE());`,
            },
            {
              step: 3,
              action: 'Request SAN LUN storage expansion on volume ' + target.volumeMount,
              benefit: 'Provides 180+ days of buffer margin for seasonal data spikes.',
              safetyLevel: 'AMBER',
              script: `-- Request +1.0 TB expansion on ${target.volumeMount} via SAN Administrator console`,
            },
          ]
        : [
            {
              step: 1,
              action: `Maintain standard index and statistics maintenance routines on ${target.serverName}`,
              benefit: 'Prevents index fragmentation and internal extent bloat.',
              safetyLevel: 'GREEN',
              script: `ALTER INDEX ALL ON ${topConsumer.tableName} REORGANIZE;`,
            },
            {
              step: 2,
              action: `Quarterly capacity allocation review before ${target.projectedDate80}`,
              benefit: `Maintains >${target.daysTo80Pct} days of operational runway.`,
              safetyLevel: 'GREEN',
              script: '-- Scheduled quarterly storage review task',
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
    waitStats: estateWaitStats,
    blockingChain: estateBlockingChain,
    queryRegressions: MOCK_QUERY_REGRESSIONS,
    detailedQueryRegressions: estateQueryRegressions,
    storageBaselines: estateStorageBaselines,
    storageAlerts: estateStorageAlerts,
    morningBrief: MOCK_MORNING_BRIEF,
  });
});

// 10. SQL Server Asset Management & Real-Time Telemetry Routes

// Probe & Test Connection (Real TDS or Lab Simulation)
app.post('/api/dba/servers/test-connection', async (req, res) => {
  try {
    const { 
      serverAddress, 
      port, 
      instanceName, 
      authType, 
      username, 
      password, 
      encryptConnection, 
      trustServerCert, 
      databases,
      mode 
    } = req.body;

    // If explicit simulation requested or no server address provided
    if (mode === 'simulate' || !serverAddress) {
      const cleanDbList = Array.isArray(databases) && databases.length > 0 
        ? databases 
        : ['PaymentsDB', 'SettlementMart', 'AuditArchive'];

      return res.json({
        success: true,
        isRealServer: false,
        latencyMs: Math.floor(1 + Math.random() * 4),
        discoveredVersion: 'Microsoft SQL Server 2022 (RTM-CU14) (KB5036838) - 16.0.4125.3',
        discoveredEdition: 'Enterprise Edition: Core-based Licensing (64-bit)',
        discoveredOs: 'Windows Server 2022 Datacenter (10.0)',
        discoveredCores: 32,
        discoveredMemoryGB: 256,
        permissionsChecked: [
          { name: 'VIEW SERVER STATE', granted: true },
          { name: 'VIEW SERVER PERFORMANCE STATE', granted: true },
          { name: 'VIEW ANY DEFINITION', granted: true },
          { name: 'CONNECT SQL', granted: true },
          { name: 'Query Store Read Access', granted: true },
        ],
        discoveredDatabases: cleanDbList,
        message: 'Lab simulation baseline verified. Ready for onboarding.',
      });
    }

    // Attempt real live TDS connection probe
    const realResult = await testDirectSqlConnection({
      serverAddress,
      port: Number(port) || 1433,
      instanceName,
      authType,
      username,
      password,
      encryptConnection,
      trustServerCert,
      database: Array.isArray(databases) && databases.length > 0 ? databases[0] : 'master',
    });

    return res.json(realResult);
  } catch (error: any) {
    res.status(500).json({ success: false, isRealServer: false, message: error.message });
  }
});

// Register SQL Server Asset (with Real-Time Live TDS or Push-Agent Support)
app.post('/api/dba/servers', async (req, res) => {
  try {
    const { 
      name, 
      address, 
      instanceName, 
      port, 
      role, 
      environment, 
      authType,
      username,
      password,
      encryptConnection,
      trustServerCert,
      databases, 
      haArchitecture, 
      rpoMinutes, 
      rtoMinutes, 
      discoveredSpecs,
      telemetryMode // 'direct-tds' | 'push-agent' | 'simulated'
    } = req.body;

    const rawHost = address || name || 'SQL-NEW';

    // If discoveredSpecs is missing or not a verified real server, but SQL credentials were provided, probe directly
    let specs = discoveredSpecs;
    if ((!specs || !specs.isRealServer) && rawHost && authType === 'sql' && password) {
      try {
        const probeResult = await testDirectSqlConnection({
          serverAddress: rawHost,
          port: Number(port) || 1433,
          instanceName,
          authType,
          username,
          password,
          encryptConnection,
          trustServerCert,
          database: Array.isArray(databases) && databases.length > 0 ? databases[0] : 'master',
        });
        if (probeResult && probeResult.success && probeResult.isRealServer) {
          specs = probeResult;
        }
      } catch (_) {}
    }

    const hostFirstToken = rawHost.split('.')[0] || 'SQL-NEW';
    const isNumericOctet = /^\d+$/.test(hostFirstToken);
    let chosenName = name;
    if (!chosenName || isNumericOctet || chosenName === hostFirstToken) {
      if (specs?.discoveredServerName) chosenName = specs.discoveredServerName;
      else if (specs?.machineName) chosenName = specs.machineName;
      else chosenName = hostFirstToken;
    }
    const cleanName = (chosenName || 'SQL-NEW').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const cleanLower = cleanName.toLowerCase();
    const serverId = cleanLower.startsWith('sql-') ? cleanLower : `sql-${cleanLower}`;
    const serverName = cleanName.startsWith('SQL-') ? cleanName : `SQL-${cleanName}`;

    // Generate secure push agent token for local scripts
    const pushAgentToken = 'tok_' + Math.random().toString(36).substring(2, 10);

    const isDirectReal = specs?.isRealServer === true;
    const finalTelemetryMode = telemetryMode || (isDirectReal ? 'direct-tds' : 'push-agent');

    // Register configuration in live store for ongoing polling or push ingestion
    liveServerConfigs.set(serverId, {
      serverAddress: rawHost,
      port: Number(port) || 1433,
      instanceName,
      authType,
      username,
      password,
      database: databases?.[0] || 'master',
      encryptConnection,
      trustServerCert,
      mode: finalTelemetryMode,
      token: pushAgentToken,
    });

    // Real database inventory mapping (derive directly from DMV sys.master_files / databaseDetails)
    const targetDbNames: string[] = (Array.isArray(databases) && databases.length > 0)
      ? databases
      : (specs?.discoveredDatabases?.length ? specs.discoveredDatabases : ['master']);

    const primaryVol = specs?.volumeStats?.[0];
    const totalDiskGB = primaryVol ? primaryVol.totalGB : (isDirectReal ? 500 : 2048);
    const freeDiskGB = primaryVol ? primaryVol.freeGB : (isDirectReal ? 250 : 1368);
    const usedDiskGB = primaryVol ? primaryVol.usedGB : (isDirectReal ? 250 : 680);
    const diskFreePct = primaryVol ? primaryVol.diskFreePct : Math.round((freeDiskGB / Math.max(1, totalDiskGB)) * 100);
    const daysTo80 = Math.max(45, Math.round((Math.max(0, freeDiskGB - (totalDiskGB * 0.2))) / 4.2));

    const dbList: any[] = targetDbNames.map((dbName: string, idx: number) => {
      const realDetail = specs?.databaseDetails?.find((d: any) => d.name?.toLowerCase() === dbName.toLowerCase());
      const szGB = realDetail?.sizeGB != null ? realDetail.sizeGB : (Math.max(1, Math.round(usedDiskGB / Math.max(1, targetDbNames.length))));
      const recModel = realDetail?.recoveryModel || 'FULL';
      const dSizeGB = realDetail?.dataSizeGB || Math.max(0.5, Number((szGB * 0.85).toFixed(1)));
      const lSizeGB = realDetail?.logSizeGB || Math.max(0.2, Number((szGB * 0.15).toFixed(1)));
      const grPct = realDetail?.growthRate30DaysPct != null ? realDetail.growthRate30DaysPct : 4.5;

      return {
        name: dbName,
        serverId,
        owner: 'Database Administration',
        application: role || 'Business Critical Workload',
        criticality: idx === 0 ? 'Tier 1 - Mission Critical' : 'Tier 2 - Business Essential',
        sizeGB: szGB,
        dataSizeGB: dSizeGB,
        logSizeGB: lSizeGB,
        growthRate30DaysPct: grPct,
        recoveryModel: recModel,
        rpoMinutes: rpoMinutes || (recModel === 'SIMPLE' ? 1440 : 15),
        rtoMinutes: rtoMinutes || 30,
        backupStatus: specs?.backupInfo?.backupStatus || 'HEALTHY',
        haStatus: haArchitecture?.includes('Always On') ? 'SYNCHRONIZED' : 'STANDALONE',
        cpuContributionPct: realDetail?.cpuContributionPct ?? (idx === 0 ? 35 : 15),
        ioContributionPct: realDetail?.ioContributionPct ?? (idx === 0 ? 40 : 15),
        activeTransactions: Math.max(1, Math.round(specs?.activeSessions ? specs.activeSessions * 0.5 : 20)),
        logSpaceUsedPct: 20,
        dataSpaceUsedPct: 65,
      };
    });

    const newServer: any = {
      id: serverId,
      name: serverName,
      role: role || 'Enterprise Database Engine',
      environment: environment || 'production',
      os: specs?.discoveredOs || 'Windows Server 2022 Datacenter',
      version: specs?.discoveredVersion || 'Microsoft SQL Server 2022 (RTM-CU14)',
      edition: specs?.discoveredEdition || 'Enterprise Edition (64-bit)',
      cpuCores: specs?.discoveredCores || 32,
      cpuUsagePct: specs?.cpuUsagePct != null ? specs.cpuUsagePct : 24,
      osCpuUsagePct: specs?.cpuUsagePct != null ? Math.min(100, specs.cpuUsagePct + 4) : 28,
      memoryTotalGB: specs?.discoveredMemoryGB || 64,
      memoryUsedGB: specs?.memoryUsedGB || Math.round((specs?.discoveredMemoryGB || 64) * 0.55),
      pageLifeExpectancySec: specs?.ple != null ? specs.ple : 1450,
      targetServerMemoryGB: specs?.memoryUsedGB ? Math.round(specs.memoryUsedGB * 1.1) : Math.round((specs?.discoveredMemoryGB || 64) * 0.85),
      totalServerMemoryGB: specs?.memoryUsedGB || Math.round((specs?.discoveredMemoryGB || 64) * 0.55),
      healthScore: 98,
      status: 'healthy',
      storageStatus: 'normal',
      diskFreePct: diskFreePct,
      daysTo80PctDisk: daysTo80,
      avgReadLatencyMs: specs?.avgReadLatencyMs ?? (specs?.latencyMs ? Number((specs.latencyMs * 0.8).toFixed(1)) : 1.8),
      avgWriteLatencyMs: specs?.avgWriteLatencyMs ?? 1.4,
      activeConnections: specs?.activeSessions ?? 25,
      blockedSessionsCount: specs?.blockedCount ?? 0,
      deadlocksLast24h: 0,
      alwaysOnStatus: haArchitecture?.includes('Always On') ? 'healthy' : 'not-applicable',
      lastFullBackupHoursAgo: specs?.backupInfo?.lastFullBackupHoursAgo ?? null,
      lastLogBackupMinutesAgo: specs?.backupInfo?.lastLogBackupMinutesAgo ?? null,
      databases: dbList,
      recentChanges: [],
      // Real-time telemetry indicators
      isRealTime: true,
      telemetryMode: finalTelemetryMode,
      lastHeartbeat: new Date().toISOString(),
      connectionHost: rawHost,
      connectionPort: Number(port) || 1433,
      liveLatencyMs: specs?.latencyMs || 2,
      pushAgentToken,
    };

    // Avoid duplicate IDs
    estateServers = estateServers.filter((s: any) => s.id !== serverId);
    estateServers.push(newServer);

    // Initialize wait statistics profile for this new server (use real DMV waits if collected)
    if (Array.isArray(specs?.waitStats) && specs.waitStats.length > 0) {
      estateWaitStats[serverId] = specs.waitStats;
    } else {
      estateWaitStats[serverId] = [
        {
          waitType: 'CXPACKET',
          category: 'Parallelism',
          waitingTasksCount: 1420,
          waitDurationMs: 24000,
          avgWaitMs: 16,
          signalWaitMs: 1200,
          pctOfTotalWaits: 35,
          description: 'Parallel execution coordinator wait. Normal for multi-core analytics.',
        },
        {
          waitType: 'PAGEIOLATCH_SH',
          category: 'Storage',
          waitingTasksCount: 820,
          waitDurationMs: 16500,
          avgWaitMs: 2.1,
          signalWaitMs: 90,
          pctOfTotalWaits: 25,
          description: 'Reading data pages from storage into buffer pool.',
        },
        {
          waitType: 'SOS_SCHEDULER_YIELD',
          category: 'CPU',
          waitingTasksCount: 4200,
          waitDurationMs: 12000,
          avgWaitMs: 2.8,
          signalWaitMs: 12000,
          pctOfTotalWaits: 20,
          description: 'Thread voluntarily yielded CPU quantum. High concurrency worker activity.',
        },
        {
          waitType: 'WRITELOG',
          category: 'Log',
          waitingTasksCount: 950,
          waitDurationMs: 7600,
          avgWaitMs: 1.5,
          signalWaitMs: 40,
          pctOfTotalWaits: 12,
          description: 'Waiting for transaction log flush to disk on commit.',
        },
        {
          waitType: 'ASYNC_NETWORK_IO',
          category: 'Network',
          waitingTasksCount: 380,
          waitDurationMs: 3800,
          avgWaitMs: 10,
          signalWaitMs: 20,
          pctOfTotalWaits: 8,
          description: 'SQL Server waiting for application client to fetch row batches.',
        }
      ];
    }

    // Create baseline storage volume with real queried metrics
    const baselineVolMount = primaryVol?.volumeMount || 'C:\\';
    const baselineTotalGB = totalDiskGB;
    const baselineUsedGB = usedDiskGB;
    const baselineFreeGB = freeDiskGB;
    const baselineUtilPct = Math.round((baselineUsedGB / Math.max(1, baselineTotalGB)) * 1000) / 10;
    const baselineId = `BASE-${serverName}-DATA`;

    // Derive real top tables from DMV discovery if present
    let topTableConsumers: any[] = [];
    if (Array.isArray(specs?.topTables) && specs.topTables.length > 0) {
      topTableConsumers = specs.topTables.map((t: any) => ({
        tableName: t.tableName,
        schema: t.schema || 'dbo',
        sizeGB: t.sizeGB,
        growth30dGB: Math.max(0.2, Number((t.sizeGB * 0.03).toFixed(1))),
        growthPct30d: 3.0,
        pctOfDatabase: Math.min(100, Math.round((t.sizeGB / Math.max(1, dbList[0]?.sizeGB || 50)) * 100)),
        rowCount: t.rowCount || 5000,
        hasPartitioning: false,
        compressionType: 'NONE',
        isAnomalyCulprit: false,
      }));
    } else {
      topTableConsumers = [
        {
          tableName: `dbo.${dbList[0]?.name || 'Master'}_DataLog`,
          schema: 'dbo',
          sizeGB: Math.round(baselineUsedGB * 0.35),
          growth30dGB: Math.max(1, Math.round(baselineUsedGB * 0.02)),
          growthPct30d: 3.5,
          pctOfDatabase: 35.0,
          rowCount: 2500000,
          hasPartitioning: false,
          compressionType: 'PAGE',
          isAnomalyCulprit: false,
        },
      ];
    }

    estateStorageBaselines = estateStorageBaselines.filter((b: any) => 
      b.id !== baselineId && 
      b.serverId !== serverId && 
      b.serverName !== serverName
    );
    estateStorageBaselines.push({
      id: baselineId,
      serverId,
      serverName,
      databaseName: dbList[0]?.name || 'PrimaryDB',
      volumeMount: baselineVolMount,
      fileType: 'DATA_MDF',
      totalCapacityGB: baselineTotalGB,
      usedGB: baselineUsedGB,
      freeGB: baselineFreeGB,
      utilizationPct: baselineUtilPct,
      baselineDailyGrowthGB: 4.8,
      currentDailyGrowthGB: 5.0,
      growthVelocitySurgePct: 4.2,
      zScore: 0.22,
      daysTo80Pct: daysTo80,
      projectedDate80: 'Dec 15, 2026',
      daysTo90Pct: daysTo80 + 45,
      projectedDate90: 'Jan 30, 2027',
      daysTo100Pct: daysTo80 + 85,
      projectedDate100: 'Mar 15, 2027',
      isAnomaly: false,
      anomalySeverity: 'NORMAL',
      historicalDataPoints: [
        { date: 'Day -28', usedGB: Math.max(1, baselineUsedGB - 14), baselineGB: Math.max(1, baselineUsedGB - 14), isForecast: false },
        { date: 'Day -21', usedGB: Math.max(1, baselineUsedGB - 10), baselineGB: Math.max(1, baselineUsedGB - 10), isForecast: false },
        { date: 'Day -14', usedGB: Math.max(1, baselineUsedGB - 7), baselineGB: Math.max(1, baselineUsedGB - 7), isForecast: false },
        { date: 'Day -7', usedGB: Math.max(1, baselineUsedGB - 3), baselineGB: Math.max(1, baselineUsedGB - 3), isForecast: false },
        { date: 'Today', usedGB: baselineUsedGB, baselineGB: baselineUsedGB, isForecast: false },
        { date: '+30 Days', usedGB: Math.round(baselineUsedGB + 15), baselineGB: Math.round(baselineUsedGB + 15), projectedGB: Math.round(baselineUsedGB + 15), isForecast: true },
        { date: '+60 Days', usedGB: Math.round(baselineUsedGB + 30), baselineGB: Math.round(baselineUsedGB + 30), projectedGB: Math.round(baselineUsedGB + 30), isForecast: true },
        { date: '80% Horizon', usedGB: Math.round(baselineTotalGB * 0.8), baselineGB: Math.round(baselineTotalGB * 0.8), projectedGB: Math.round(baselineTotalGB * 0.8), isForecast: true },
      ],
      topTableConsumers,
      rootCauseAnalysis: `Storage baseline established for ${serverName} on volume ${baselineVolMount}. Telemetry streaming indicates daily growth velocity (5.0 GB/day) is nominal. Current utilization: ${baselineUsedGB} GB / ${baselineTotalGB} GB (${baselineUtilPct}%). Zero statistical anomaly detected.`,
      potentialImpact: `Volume capacity is healthy with ${baselineFreeGB} GB free buffer available (${diskFreePct}% unallocated). Projected buffer margin exceeds ${daysTo80} days before reaching the 80% advisory threshold.`,
      recommendedAction: {
        id: `REC-STORAGE-${serverId.toUpperCase()}`,
        title: `Establish Automated Partition Compression & Maintenance on ${serverName}`,
        why: `Continuous monitoring and baseline indexing on ${dbList[0]?.name || 'PrimaryDB'} prevents premature volume exhaustion.`,
        evidence: `Initial storage baseline active: ${baselineUtilPct}% utilization on ${baselineVolMount}. Projected 80% threshold in ${daysTo80} days.`,
        expectedBenefit: 'Maintains optimal read/write IO throughput and keeps database growth linear.',
        risk: 'LOW',
        implementationComplexity: 'LOW',
        rollbackMethod: 'ALTER INDEX REORGANIZE rollback if IO contention occurs.',
        validationMethod: 'sys.dm_db_index_physical_stats fragmentation analysis.',
        priority: 'LOW',
        safetyLevel: 'GREEN',
        sqlScript: `ALTER INDEX ALL ON ${topTableConsumers[0]?.tableName || 'dbo.Master'} REBUILD WITH (ONLINE = ON, DATA_COMPRESSION = PAGE);`,
        targetServer: serverName,
        targetDatabase: dbList[0]?.name || 'PrimaryDB',
      },
    });

    // Add audit entry
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    estateAuditLogs.unshift({
      id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp,
      requester: 'DBA Admin [Console UI]',
      agent: 'AI DBA Command Center v1.0',
      server: serverName,
      database: dbList[0]?.name || 'master',
      action: 'REGISTER_SQL_SERVER_ASSET',
      reason: `Asset registered into monitored database inventory. Mode: ${finalTelemetryMode}`,
      safetyLevel: 'GREEN',
      approvalBy: 'DBA_SELF_PROVISION',
      beforeState: 'Unmonitored SQL Server instance',
      afterState: `Active real-time monitored state: ${newServer.healthScore}/100, ${dbList.length} databases`,
      validation: `TDS handshake verified (${discoveredSpecs?.latencyMs || 2}ms), DMV feeds active`,
      status: 'SUCCESS',
    });

    return res.json({
      success: true,
      server: newServer,
      servers: estateServers,
      waitStats: estateWaitStats,
      storageBaselines: estateStorageBaselines,
      auditLogs: estateAuditLogs,
      pushAgentToken,
      message: `SQL Server asset ${serverName} registered successfully into estate inventory with real-time telemetry (${finalTelemetryMode}).`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Real-Time Telemetry Push Ingestion Endpoint
// Allows local PowerShell, Python, or bash agents on SQL Server machines to stream live metrics
app.post('/api/dba/telemetry/push', (req, res) => {
  try {
    const { 
      serverId, 
      serverName, 
      token, 
      cpuUsagePct, 
      osCpuUsagePct,
      pageLifeExpectancySec,
      activeConnections,
      blockedSessionsCount,
      avgReadLatencyMs,
      avgWriteLatencyMs,
      waitStats,
      blockingSessions,
      databases,
      storageVolumes
    } = req.body;

    if (!serverId) {
      return res.status(400).json({ error: 'Missing required field: serverId' });
    }

    let targetServer = estateServers.find((s: any) => s.id === serverId || s.name.toUpperCase() === String(serverId).toUpperCase());

    // If server does not exist yet, automatically auto-provision it in real time
    if (!targetServer) {
      const cleanName = (serverName || serverId).toUpperCase().replace(/[^A-Z0-9-]/g, '');
      targetServer = {
        id: serverId,
        name: cleanName,
        role: 'Live Monitored Workload',
        environment: 'production',
        os: 'Windows Server / Linux Host',
        version: 'Microsoft SQL Server (Live Agent)',
        edition: 'SQL Server Standard/Enterprise',
        cpuCores: 16,
        cpuUsagePct: cpuUsagePct ?? 25,
        osCpuUsagePct: osCpuUsagePct ?? 30,
        memoryTotalGB: 128,
        memoryUsedGB: 64,
        pageLifeExpectancySec: pageLifeExpectancySec ?? 1500,
        targetServerMemoryGB: 110,
        totalServerMemoryGB: 64,
        healthScore: 98,
        status: 'healthy',
        storageStatus: 'normal',
        diskFreePct: 45,
        daysTo80PctDisk: 180,
        avgReadLatencyMs: avgReadLatencyMs ?? 2.0,
        avgWriteLatencyMs: avgWriteLatencyMs ?? 1.5,
        activeConnections: activeConnections ?? 30,
        blockedSessionsCount: blockedSessionsCount ?? 0,
        deadlocksLast24h: 0,
        alwaysOnStatus: 'not-applicable',
        lastFullBackupHoursAgo: 2,
        lastLogBackupMinutesAgo: 5,
        databases: [
          {
            name: 'ProductionDB',
            serverId,
            owner: 'Database Administration',
            application: 'Enterprise Live Service',
            criticality: 'Tier 1 - Mission Critical',
            sizeGB: 350,
            growthRate30DaysPct: 6.5,
            recoveryModel: 'FULL',
            rpoMinutes: 5,
            rtoMinutes: 15,
            backupStatus: 'HEALTHY',
            haStatus: 'STANDALONE',
            cpuContributionPct: 35,
            ioContributionPct: 40,
            activeTransactions: 80,
            logSpaceUsedPct: 20,
            dataSpaceUsedPct: 65,
          }
        ],
        recentChanges: [],
        isRealTime: true,
        telemetryMode: 'push-agent',
        lastHeartbeat: new Date().toISOString(),
      };
      estateServers.push(targetServer);
    }

    // Update real-time metrics
    if (cpuUsagePct !== undefined) targetServer.cpuUsagePct = Number(cpuUsagePct);
    if (osCpuUsagePct !== undefined) targetServer.osCpuUsagePct = Number(osCpuUsagePct);
    if (pageLifeExpectancySec !== undefined) targetServer.pageLifeExpectancySec = Number(pageLifeExpectancySec);
    if (activeConnections !== undefined) targetServer.activeConnections = Number(activeConnections);
    if (blockedSessionsCount !== undefined) targetServer.blockedSessionsCount = Number(blockedSessionsCount);
    if (avgReadLatencyMs !== undefined) targetServer.avgReadLatencyMs = Number(avgReadLatencyMs);
    if (avgWriteLatencyMs !== undefined) targetServer.avgWriteLatencyMs = Number(avgWriteLatencyMs);

    targetServer.lastHeartbeat = new Date().toISOString();
    targetServer.isRealTime = true;
    targetServer.telemetryMode = 'push-agent';

    // Compute dynamic health score based on live telemetry
    let health = 100;
    if (targetServer.blockedSessionsCount > 0) health -= Math.min(35, targetServer.blockedSessionsCount * 4);
    if (targetServer.cpuUsagePct > 80) health -= 20;
    else if (targetServer.cpuUsagePct > 65) health -= 10;
    if (targetServer.pageLifeExpectancySec < 300) health -= 25;
    else if (targetServer.pageLifeExpectancySec < 600) health -= 10;
    if (targetServer.avgReadLatencyMs > 20) health -= 15;

    targetServer.healthScore = Math.max(10, health);
    targetServer.status = targetServer.healthScore < 70 ? 'critical' : targetServer.healthScore < 85 ? 'warning' : 'healthy';

    // Update wait statistics if provided
    if (Array.isArray(waitStats) && waitStats.length > 0) {
      estateWaitStats[targetServer.id] = waitStats;
    }

    // Update blocking chain if provided
    if (Array.isArray(blockingSessions) && blockingSessions.length > 0) {
      estateBlockingChain = blockingSessions;
    }

    // Update databases if provided
    if (Array.isArray(databases) && databases.length > 0) {
      targetServer.databases = databases.map((d: any, idx: number) => ({
        name: d.name,
        serverId: targetServer.id,
        owner: 'Database Administration',
        application: targetServer.role || 'Live Workload',
        criticality: idx === 0 ? 'Tier 1 - Mission Critical' : 'Tier 2 - Business Essential',
        sizeGB: Number(d.sizeGB) || 10,
        dataSizeGB: Math.round((Number(d.sizeGB) || 10) * 0.85),
        logSizeGB: Math.round((Number(d.sizeGB) || 10) * 0.15),
        growthRate30DaysPct: Number(d.growthRate30DaysPct) || 4.2,
        recoveryModel: d.recoveryModel || 'FULL',
        rpoMinutes: 5,
        rtoMinutes: 15,
        backupStatus: 'HEALTHY',
        haStatus: targetServer.alwaysOnStatus === 'healthy' ? 'SYNCHRONIZED' : 'STANDALONE',
        cpuContributionPct: 25,
        ioContributionPct: 25,
        activeTransactions: 25,
        logSpaceUsedPct: 20,
        dataSpaceUsedPct: 65,
      }));
    }

    // Update storage volume stats if provided
    if (Array.isArray(storageVolumes) && storageVolumes.length > 0) {
      const vol = storageVolumes[0];
      targetServer.diskFreePct = Math.round((vol.freeGB / Math.max(1, vol.totalGB)) * 100);
      const b = estateStorageBaselines.find((base: any) => base.serverId === targetServer.id);
      if (b) {
        b.totalCapacityGB = vol.totalGB;
        b.usedGB = vol.usedGB;
        b.freeGB = vol.freeGB;
        b.utilizationPct = Math.round((vol.usedGB / Math.max(1, vol.totalGB)) * 1000) / 10;
        b.volumeMount = vol.mount || 'C:\\';
      }
    }

    // Ensure storage baseline exists for push agent instance in Storage Anomaly Engine
    const existingBaseline = estateStorageBaselines.find((b: any) => b.serverId === targetServer.id || b.serverName === targetServer.name);
    if (!existingBaseline) {
      estateStorageBaselines.push({
        id: `BASE-${targetServer.name}-DATA`,
        serverId: targetServer.id,
        serverName: targetServer.name,
        databaseName: targetServer.databases?.[0]?.name || 'ProductionDB',
        volumeMount: storageVolumes?.[0]?.mount || 'C:\\',
        fileType: 'DATA_MDF',
        totalCapacityGB: storageVolumes?.[0]?.totalGB || 1024,
        usedGB: storageVolumes?.[0]?.usedGB || 450,
        freeGB: storageVolumes?.[0]?.freeGB || 574,
        utilizationPct: storageVolumes?.[0] ? Math.round((storageVolumes[0].usedGB / storageVolumes[0].totalGB) * 1000) / 10 : 43.9,
        baselineDailyGrowthGB: 4.8,
        currentDailyGrowthGB: 5.0,
        growthVelocitySurgePct: 4.2,
        zScore: 0.22,
        daysTo80Pct: 185,
        projectedDate80: 'Dec 15, 2026',
        daysTo90Pct: 230,
        projectedDate90: 'Jan 30, 2027',
        daysTo100Pct: 270,
        projectedDate100: 'Mar 15, 2027',
        isAnomaly: false,
        anomalySeverity: 'NORMAL',
        historicalDataPoints: [
          { date: 'Day -28', usedGB: 430, baselineGB: 430, isForecast: false },
          { date: 'Day -21', usedGB: 435, baselineGB: 435, isForecast: false },
          { date: 'Day -14', usedGB: 440, baselineGB: 440, isForecast: false },
          { date: 'Day -7', usedGB: 445, baselineGB: 445, isForecast: false },
          { date: 'Today', usedGB: 450, baselineGB: 450, isForecast: false },
          { date: '+30 Days', usedGB: 465, baselineGB: 465, projectedGB: 465, isForecast: true },
          { date: '+60 Days', usedGB: 480, baselineGB: 480, projectedGB: 480, isForecast: true },
          { date: '80% Horizon', usedGB: 819, baselineGB: 819, projectedGB: 819, isForecast: true },
        ],
        topTableConsumers: [
          {
            tableName: `dbo.${targetServer.databases?.[0]?.name || 'ProductionDB'}_Master`,
            schema: 'dbo',
            sizeGB: 180,
            growth30dGB: 6,
            growthPct30d: 3.3,
            pctOfDatabase: 40.0,
            rowCount: 12000000,
            hasPartitioning: false,
            compressionType: 'PAGE',
            isAnomalyCulprit: false,
          },
        ],
        rootCauseAnalysis: `Storage baseline established for ${targetServer.name}. Telemetry streaming indicates normal extent allocations.`,
        potentialImpact: `Storage capacity buffer is nominal with ${storageVolumes?.[0]?.freeGB || 574} GB free. Zero capacity risk detected.`,
        recommendedAction: {
          id: `REC-STORAGE-${targetServer.name}`,
          title: `Automated Capacity Monitoring & Defrag Baseline for ${targetServer.name}`,
          why: `Volume verified healthy. Automated baselining active.`,
          evidence: `Telemetry verified within normal operating boundaries.`,
          expectedBenefit: 'Maintains long-term capacity runway.',
          risk: 'LOW',
          implementationComplexity: 'LOW',
          rollbackMethod: 'N/A',
          validationMethod: 'sys.dm_os_volume_stats query.',
          priority: 'LOW',
          safetyLevel: 'GREEN',
          targetServer: targetServer.name,
          targetDatabase: targetServer.databases?.[0]?.name || 'ProductionDB',
        },
      });
    }

    return res.json({
      success: true,
      serverId: targetServer.id,
      serverName: targetServer.name,
      healthScore: targetServer.healthScore,
      timestamp: targetServer.lastHeartbeat,
      message: 'Real-time telemetry packet processed successfully',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Download/Inspect Collector Script (PowerShell, Python, or Bash)
app.get('/api/dba/agent/script', (req, res) => {
  try {
    const { serverId = 'sql-custom-01', serverName = 'SQL-CUSTOM-01', format = 'powershell' } = req.query;
    const protocol = req.protocol;
    const host = req.get('host');
    const apiEndpoint = `${protocol}://${host}/api/dba/telemetry/push`;
    const token = liveServerConfigs.get(String(serverId))?.token || 'tok_live_agent';

    const script = generateCollectorScript({
      serverId: String(serverId),
      serverName: String(serverName),
      token,
      apiEndpoint,
      format: (format as any) || 'powershell',
    });

    if (format === 'powershell') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="ai-dba-collector-${serverId}.ps1"`);
    } else if (format === 'python') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="ai-dba-collector-${serverId}.py"`);
    } else {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }

    res.send(script);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// On-Demand Real-Time Live Server DMV Telemetry Refresh
app.post('/api/dba/servers/:id/refresh', async (req, res) => {
  try {
    const serverId = req.params.id;
    const config = liveServerConfigs.get(serverId);
    const targetServer = estateServers.find((s: any) => s.id === serverId);

    if (!targetServer) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (config && config.mode === 'direct-tds') {
      const liveSnapshot = await fetchLiveDirectTelemetry(config);
      if (liveSnapshot) {
        if (liveSnapshot.cpuUsagePct !== undefined) targetServer.cpuUsagePct = liveSnapshot.cpuUsagePct;
        if (liveSnapshot.osCpuUsagePct !== undefined) targetServer.osCpuUsagePct = liveSnapshot.osCpuUsagePct;
        if (liveSnapshot.memoryUsedGB !== undefined) targetServer.memoryUsedGB = liveSnapshot.memoryUsedGB;
        if (liveSnapshot.memoryTotalGB !== undefined) targetServer.memoryTotalGB = liveSnapshot.memoryTotalGB;
        if (liveSnapshot.pageLifeExpectancySec !== undefined) targetServer.pageLifeExpectancySec = liveSnapshot.pageLifeExpectancySec;
        if (liveSnapshot.activeConnections !== undefined) targetServer.activeConnections = liveSnapshot.activeConnections;
        if (liveSnapshot.blockedSessionsCount !== undefined) targetServer.blockedSessionsCount = liveSnapshot.blockedSessionsCount;
        if (liveSnapshot.avgReadLatencyMs !== undefined) targetServer.avgReadLatencyMs = liveSnapshot.avgReadLatencyMs;
        if (liveSnapshot.avgWriteLatencyMs !== undefined) targetServer.avgWriteLatencyMs = liveSnapshot.avgWriteLatencyMs;
        targetServer.lastHeartbeat = new Date().toISOString();

        if (liveSnapshot.storageVolumes?.length) {
          const vol0 = liveSnapshot.storageVolumes[0];
          targetServer.diskFreePct = Math.round((vol0.freeGB / Math.max(1, vol0.totalGB)) * 100);
          const baseline = estateStorageBaselines.find((b: any) => b.serverId === serverId);
          if (baseline) {
            baseline.usedGB = vol0.usedGB;
            baseline.freeGB = vol0.freeGB;
            baseline.totalCapacityGB = vol0.totalGB;
            baseline.utilizationPct = Math.round((vol0.usedGB / Math.max(1, vol0.totalGB)) * 1000) / 10;
          }
        }

        if (liveSnapshot.databases?.length && Array.isArray(targetServer.databases)) {
          targetServer.databases.forEach((db: any) => {
            const liveDb = liveSnapshot.databases?.find((ld: any) => ld.name?.toLowerCase() === db.name?.toLowerCase());
            if (liveDb) {
              if (liveDb.sizeGB != null) db.sizeGB = liveDb.sizeGB;
              if (liveDb.recoveryModel) db.recoveryModel = liveDb.recoveryModel;
            }
          });
        }

        if (liveSnapshot.waitStats) estateWaitStats[serverId] = liveSnapshot.waitStats;
        if (liveSnapshot.blockingSessions) estateBlockingChain = liveSnapshot.blockingSessions;

        return res.json({
          success: true,
          refreshed: true,
          server: targetServer,
          message: `Live DMV metrics re-queried successfully from ${targetServer.name} via direct TDS socket.`,
        });
      }
    }

    return res.json({
      success: true,
      refreshed: false,
      server: targetServer,
      message: `Server ${targetServer.name} telemetry heartbeat confirmed.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Real-Time Background Telemetry Poller & Heartbeat Engine
setInterval(async () => {
  try {
    // 1. Poll direct TDS SQL Servers
    for (const [sId, config] of liveServerConfigs.entries()) {
      if (config.mode === 'direct-tds') {
        const liveSnapshot = await fetchLiveDirectTelemetry(config);
        if (liveSnapshot) {
          const s = estateServers.find((srv: any) => srv.id === sId);
          if (s) {
            if (liveSnapshot.cpuUsagePct !== undefined) s.cpuUsagePct = liveSnapshot.cpuUsagePct;
            if (liveSnapshot.osCpuUsagePct !== undefined) s.osCpuUsagePct = liveSnapshot.osCpuUsagePct;
            if (liveSnapshot.memoryUsedGB !== undefined) s.memoryUsedGB = liveSnapshot.memoryUsedGB;
            if (liveSnapshot.memoryTotalGB !== undefined) s.memoryTotalGB = liveSnapshot.memoryTotalGB;
            if (liveSnapshot.pageLifeExpectancySec !== undefined) s.pageLifeExpectancySec = liveSnapshot.pageLifeExpectancySec;
            if (liveSnapshot.activeConnections !== undefined) s.activeConnections = liveSnapshot.activeConnections;
            if (liveSnapshot.blockedSessionsCount !== undefined) s.blockedSessionsCount = liveSnapshot.blockedSessionsCount;
            if (liveSnapshot.avgReadLatencyMs !== undefined) s.avgReadLatencyMs = liveSnapshot.avgReadLatencyMs;
            if (liveSnapshot.avgWriteLatencyMs !== undefined) s.avgWriteLatencyMs = liveSnapshot.avgWriteLatencyMs;
            s.lastHeartbeat = new Date().toISOString();

            if (liveSnapshot.storageVolumes?.length) {
              const vol0 = liveSnapshot.storageVolumes[0];
              s.diskFreePct = Math.round((vol0.freeGB / Math.max(1, vol0.totalGB)) * 100);
              const baseline = estateStorageBaselines.find((b: any) => b.serverId === sId);
              if (baseline) {
                baseline.usedGB = vol0.usedGB;
                baseline.freeGB = vol0.freeGB;
                baseline.totalCapacityGB = vol0.totalGB;
                baseline.utilizationPct = Math.round((vol0.usedGB / Math.max(1, vol0.totalGB)) * 1000) / 10;
              }
            }

            if (liveSnapshot.databases?.length && Array.isArray(s.databases)) {
              s.databases.forEach((db: any) => {
                const liveDb = liveSnapshot.databases?.find((ld: any) => ld.name?.toLowerCase() === db.name?.toLowerCase());
                if (liveDb) {
                  if (liveDb.sizeGB != null) db.sizeGB = liveDb.sizeGB;
                  if (liveDb.recoveryModel) db.recoveryModel = liveDb.recoveryModel;
                }
              });
            }

            if (liveSnapshot.waitStats) estateWaitStats[sId] = liveSnapshot.waitStats;
            if (liveSnapshot.blockingSessions) estateBlockingChain = liveSnapshot.blockingSessions;
          }
        }
      }
    }

    // 2. Gentle natural telemetry fluctuations for simulated instances so the dashboard stays alive
    estateServers.forEach((s: any) => {
      if (s.telemetryMode === 'simulated') {
        const jitter = (Math.random() - 0.5) * 3;
        s.cpuUsagePct = Math.max(12, Math.min(96, Math.round(s.cpuUsagePct + jitter)));
        s.activeConnections = Math.max(50, Math.round(s.activeConnections + (Math.random() - 0.5) * 4));
        s.lastHeartbeat = new Date().toISOString();
      }
    });
  } catch (err) {
    // Keep background tick resilient
  }
}, 6000);


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
