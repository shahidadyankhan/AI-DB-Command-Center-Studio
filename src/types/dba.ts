export interface ServerInstance {
  id: string;
  name: string;
  role: string;
  environment: 'production' | 'staging' | 'data-warehouse';
  os: string;
  version: string;
  edition: string;
  cpuCores: number;
  cpuUsagePct: number;
  osCpuUsagePct: number;
  memoryTotalGB: number;
  memoryUsedGB: number;
  pageLifeExpectancySec: number; // PLE: < 300s indicates memory pressure
  targetServerMemoryGB: number;
  totalServerMemoryGB: number;
  healthScore: number;
  status: 'healthy' | 'warning' | 'critical';
  storageStatus: 'normal' | 'warning' | 'critical';
  diskFreePct: number;
  daysTo80PctDisk: number;
  avgReadLatencyMs: number;
  avgWriteLatencyMs: number;
  activeConnections: number;
  blockedSessionsCount: number;
  deadlocksLast24h: number;
  alwaysOnStatus: 'healthy' | 'synchronizing' | 'degraded' | 'not-applicable';
  lastFullBackupHoursAgo: number;
  lastLogBackupMinutesAgo: number;
  databases: DatabaseInfo[];
  recentChanges: ChangeCorrelationEvent[];
}

export interface DatabaseInfo {
  name: string;
  serverId: string;
  owner: string;
  application: string;
  criticality: 'Tier 1 - Mission Critical' | 'Tier 2 - Business Essential' | 'Tier 3 - Standard';
  sizeGB: number;
  growthRate30DaysPct: number;
  recoveryModel: 'FULL' | 'SIMPLE' | 'BULK_LOGGED';
  rpoMinutes: number;
  rtoMinutes: number;
  backupStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  haStatus: 'SYNCHRONIZED' | 'SYNCHRONIZING' | 'SUSPENDED' | 'STANDALONE';
  cpuContributionPct: number;
  ioContributionPct: number;
  activeTransactions: number;
  logSpaceUsedPct: number;
  dataSpaceUsedPct: number;
}

export interface WaitStat {
  waitType: string;
  category: 'CPU' | 'Storage' | 'Locking' | 'Parallelism' | 'Memory' | 'Log' | 'TempDB' | 'Network';
  waitingTasksCount: number;
  waitDurationMs: number;
  avgWaitMs: number;
  signalWaitMs: number;
  pctOfTotalWaits: number;
  description: string;
}

export interface BlockingSession {
  spid: number;
  status: 'running' | 'sleeping' | 'suspended';
  command: string;
  databaseName: string;
  loginName: string;
  programName: string;
  hostName: string;
  waitType: string;
  waitTimeMs: number;
  blockingSpid: number; // 0 if root
  isRootBlocker: boolean;
  blockedSpidList: number[];
  sqlText: string;
  openTranCount: number;
  transactionDurationSec: number;
}

export interface QueryStoreRegression {
  queryId: number;
  queryHash: string;
  databaseName: string;
  queryText: string;
  baselineDurationMs: number;
  currentDurationMs: number;
  regressionPct: number;
  cpuTimeMs: number;
  logicalReads: number;
  executionCountLastHour: number;
  previousPlanId: number;
  currentPlanId: number;
  isPlanRegressed: boolean;
  missingIndexRecommendation?: string;
  estimatedImprovementPct: number;
}

export interface ChangeCorrelationEvent {
  id: string;
  timestamp: string;
  type: 'DEPLOYMENT' | 'INDEX_CHANGE' | 'CONFIG_CHANGE' | 'PATCH' | 'SCHEMA_CHANGE';
  title: string;
  author: string;
  targetServer: string;
  targetDatabase: string;
  description: string;
  correlatedAnomaly?: string;
  correlationConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface Incident {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'ACTIVE' | 'CONTAINED' | 'RESOLVING' | 'RESOLVED';
  stage: 'DETECT' | 'TRIAGE' | 'CORRELATE' | 'IDENTIFY' | 'CONTAIN' | 'REMEDIATE' | 'VALIDATE' | 'DOCUMENT';
  server: string;
  database: string;
  affectedApplication: string;
  startTime: string;
  rootBlockerSpid?: number;
  rootCauseCandidate: string;
  confidencePct: number;
  businessImpact: string;
  triageDetails: string;
  recommendedAction: string;
  approvalRequired: 'GREEN' | 'AMBER' | 'RED';
}

export interface RootCauseCandidate {
  cause: string;
  probabilityPct: number;
  evidence: string;
}

export interface HealthScoreBreakdown {
  overall: number;
  performance: number; // 20%
  availability: number; // 15%
  backupRecovery: number; // 15%
  security: number; // 15%
  capacity: number; // 10%
  configuration: number; // 10%
  patchCompliance: number; // 5%
  jobReliability: number; // 5%
  dataGrowthRisk: number; // 5%
}

export interface RecommendationItem {
  id: string;
  title: string;
  why: string;
  evidence: string;
  expectedBenefit: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  implementationComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  rollbackMethod: string;
  validationMethod: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  safetyLevel: 'GREEN' | 'AMBER' | 'RED';
  sqlScript?: string;
  targetServer: string;
  targetDatabase?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  requester: string;
  agent: string;
  server: string;
  database: string;
  action: string;
  reason: string;
  safetyLevel: 'GREEN' | 'AMBER' | 'RED';
  approvalBy: string;
  beforeState: string;
  afterState: string;
  validation: string;
  status: 'SUCCESS' | 'ROLLED_BACK' | 'FAILED';
}

export interface DbaAgentResponse {
  finding: string;
  evidence: string[];
  analysis: string;
  risk: {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH' | 'CRITICAL';
    businessImpact: string;
  };
  recommendations: RecommendationItem[];
  automation: string;
  approval: {
    required: boolean;
    level: 'GREEN' | 'AMBER' | 'RED';
    reason: string;
  };
  validation: string;
  audit: string;
  confidence: {
    level: 'HIGH' | 'MEDIUM' | 'LOW';
    pct: number;
    rationale: string;
  };
  rootCauseCandidates?: RootCauseCandidate[];
  sourceMode?: string;
}

export interface MorningBriefing {
  generatedAt: string;
  healthSummary: string;
  healthySystems: string[];
  watchItems: Array<{ server: string; issue: string; trend: string }>;
  actionRequiredItems: Array<{ server: string; issue: string; urgency: string; recommendedAction: string }>;
  emergingTrends: string[];
  overnightEvents: string[];
  automationOpportunities: string[];
  managementAttention: string[];
}

export interface StorageDataPoint {
  date: string;
  usedGB: number;
  baselineGB: number;
  projectedGB?: number;
  isForecast?: boolean;
}

export interface StorageTableGrowth {
  tableName: string;
  schema: string;
  sizeGB: number;
  pctOfDatabase: number;
  growth30dGB: number;
  growthPct30d: number;
  rowCount: number;
  hasPartitioning: boolean;
  compressionType: 'NONE' | 'ROW' | 'PAGE' | 'COLUMNSTORE';
  isAnomalyCulprit: boolean;
}

export interface StorageGrowthBaseline {
  id: string;
  serverId: string;
  serverName: string;
  databaseName: string;
  volumeMount: string;
  fileType: 'DATA_MDF' | 'LOG_LDF' | 'ALL';
  totalCapacityGB: number;
  usedGB: number;
  freeGB: number;
  utilizationPct: number;
  baselineDailyGrowthGB: number;
  currentDailyGrowthGB: number;
  growthVelocitySurgePct: number; // e.g. +142%
  zScore: number; // e.g. 3.4 standard deviations
  isAnomaly: boolean;
  anomalySeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL';
  daysTo80Pct: number;
  daysTo90Pct: number;
  daysTo100Pct: number;
  projectedDate80: string;
  projectedDate90: string;
  projectedDate100: string;
  historicalDataPoints: StorageDataPoint[];
  topTableConsumers: StorageTableGrowth[];
  rootCauseAnalysis: string;
  potentialImpact: string;
  recommendedAction: RecommendationItem;
}

export interface StorageForecastAlert {
  id: string;
  timestamp: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  serverId: string;
  databaseName: string;
  metric: string;
  baselineValue: string;
  observedValue: string;
  deviation: string;
  criticalThresholdTarget: string; // e.g. "80% in 61 days"
  impact: string;
  remediationSql?: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'REMEDIATING' | 'RESOLVED';
}

export interface QueryWorkloadMetrics {
  avgDurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  avgCpuMs: number;
  avgLogicalReads: number;
  avgLogicalWrites: number;
  executionCountPerHour: number;
}

export interface PlanComparisonDiff {
  previousPlanId: number;
  currentPlanId: number;
  previousOperator: string;
  currentOperator: string;
  previousCostPct: number;
  currentCostPct: number;
  tempdbSpillMB: number;
  memoryGrantMB: number;
  reasonForSwitch: string;
  estimatedRowsVsActual: string;
}

export interface DeploymentCorrelationInfo {
  deploymentId: string;
  releaseTag: string;
  deployedAt: string;
  author: string;
  commitHash: string;
  pullRequest: string;
  description: string;
  codeDiffSnippet?: string;
}

export interface QueryRegressionRecord {
  queryId: number;
  queryHash: string;
  databaseName: string;
  objectName: string;
  sqlSnippet: string;
  fullSqlText: string;
  workloadPeriod: 'Business Hours Peak' | 'Checkout Rush (12-2pm)' | 'Nightly ETL Batch' | 'Weekend Reporting';
  baseline: QueryWorkloadMetrics;
  current: QueryWorkloadMetrics;
  durationRegressionPct: number;
  cpuRegressionPct: number;
  readsRegressionPct: number;
  zScore: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  regressionNature: 
    | 'Execution Plan Switch' 
    | 'Parameter Sniffing' 
    | 'Missing Index Escalation' 
    | 'Implicit Type Conversion' 
    | 'TempDB Spill & Memory Grant';
  planComparison: PlanComparisonDiff;
  correlatedDeployment?: DeploymentCorrelationInfo;
  aiDiagnosticAnalysis?: string;
  recommendedAction: RecommendationItem;
}

export type OperatingMode =
  | 'executive'
  | 'dba'
  | 'incident'
  | 'performance'
  | 'predictive'
  | 'change-review'
  | 'storage-anomalies'
  | 'query-regressions';

