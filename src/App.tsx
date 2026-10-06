/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { ModeSelector } from './components/ModeSelector';
import { ExecutiveMode } from './components/ExecutiveMode';
import { DbaMode } from './components/DbaMode';
import { IncidentMode } from './components/IncidentMode';
import { PerformanceMode } from './components/PerformanceMode';
import { PredictiveMode } from './components/PredictiveMode';
import { ChangeReviewMode } from './components/ChangeReviewMode';
import { StorageAnomalyEngine } from './components/StorageAnomalyEngine';
import { QueryRegressionChecker } from './components/QueryRegressionChecker';
import { HumansMissedModal } from './components/HumansMissedModal';
import { MorningBriefModal } from './components/MorningBriefModal';
import { SafetyApprovalModal } from './components/SafetyApprovalModal';
import { AiConsoleModal } from './components/AiConsoleModal';
import { ServerDetailModal } from './components/ServerDetailModal';
import { AuditLogDrawer } from './components/AuditLogDrawer';
import { SystemDocumentationModal } from './components/SystemDocumentationModal';
import { LocalAirGappedModal } from './components/LocalAirGappedModal';
import { AddServerModal } from './components/AddServerModal';

import {
  INITIAL_SERVERS,
  MOCK_INCIDENTS,
  MOCK_RECOMMENDATIONS,
  MOCK_AUDIT_LOGS,
  MOCK_WAIT_STATS,
  MOCK_BLOCKING_CHAIN,
  MOCK_QUERY_REGRESSIONS,
  MOCK_MORNING_BRIEF
} from './data/mockEstate';

import {
  MOCK_STORAGE_BASELINES,
  MOCK_STORAGE_ALERTS,
  MOCK_DETAILED_QUERY_REGRESSIONS
} from './data/mockStorageAndQueryData';

import {
  ServerInstance,
  Incident,
  RecommendationItem,
  AuditLogEntry,
  OperatingMode,
  MorningBriefing,
  StorageGrowthBaseline,
  StorageForecastAlert,
  QueryRegressionRecord
} from './types/dba';

export default function App() {
  const [servers, setServers] = useState<ServerInstance[]>(INITIAL_SERVERS);
  const [incidents, setIncidents] = useState<Incident[]>(MOCK_INCIDENTS);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(MOCK_RECOMMENDATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(MOCK_AUDIT_LOGS);
  const [waitStats, setWaitStats] = useState(MOCK_WAIT_STATS);
  const [blockingChain, setBlockingChain] = useState(MOCK_BLOCKING_CHAIN);
  const [queryRegressions, setQueryRegressions] = useState(MOCK_QUERY_REGRESSIONS);
  const [morningBrief, setMorningBrief] = useState<MorningBriefing>(MOCK_MORNING_BRIEF);

  const [storageBaselines, setStorageBaselines] = useState<StorageGrowthBaseline[]>(MOCK_STORAGE_BASELINES);
  const [storageAlerts, setStorageAlerts] = useState<StorageForecastAlert[]>(MOCK_STORAGE_ALERTS);
  const [detailedQueryRegressions, setDetailedQueryRegressions] = useState<QueryRegressionRecord[]>(MOCK_DETAILED_QUERY_REGRESSIONS);

  const [currentMode, setCurrentMode] = useState<OperatingMode>('executive');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modal / Drawer states
  const [isMorningBriefOpen, setIsMorningBriefOpen] = useState(false);
  const [isHumansMissedOpen, setIsHumansMissedOpen] = useState(false);
  const [isAiConsoleOpen, setIsAiConsoleOpen] = useState(false);
  const [aiConsoleInitialPrompt, setAiConsoleInitialPrompt] = useState<string | undefined>(undefined);
  const [selectedServerForDetail, setSelectedServerForDetail] = useState<ServerInstance | null>(null);
  const [selectedRecForApproval, setSelectedRecForApproval] = useState<RecommendationItem | null>(null);
  const [isAuditLogDrawerOpen, setIsAuditLogDrawerOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isAirGappedOpen, setIsAirGappedOpen] = useState(false);
  const [isAddServerOpen, setIsAddServerOpen] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [lastStreamUpdate, setLastStreamUpdate] = useState<Date>(new Date());

  // Continuous Real-Time Telemetry Stream Poller (every 3 seconds)
  useEffect(() => {
    let isMounted = true;
    const fetchEstate = async () => {
      try {
        const res = await fetch('/api/dba/estate');
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.servers) {
            setServers(data.servers);
            setSelectedServerForDetail(prev => {
              if (!prev) return null;
              const refreshed = data.servers.find((s: any) => s.id === prev.id);
              return refreshed || prev;
            });
          }
          if (data.incidents) setIncidents(data.incidents);
          if (data.recommendations) setRecommendations(data.recommendations);
          if (data.auditLogs) setAuditLogs(data.auditLogs);
          if (data.waitStats) setWaitStats(data.waitStats);
          if (data.blockingChain) setBlockingChain(data.blockingChain);
          if (data.morningBrief) setMorningBrief(data.morningBrief);
          if (data.storageBaselines) setStorageBaselines(data.storageBaselines);
          if (data.storageAlerts) setStorageAlerts(data.storageAlerts);
          if (data.queryRegressions) setQueryRegressions(data.queryRegressions);
          if (data.detailedQueryRegressions) setDetailedQueryRegressions(data.detailedQueryRegressions);
          setLastStreamUpdate(new Date());
        }
      } catch (err) {
        // Keep streaming resilient
      }
    };

    fetchEstate();

    let intervalId: any = null;
    if (isLiveStreaming) {
      intervalId = setInterval(fetchEstate, 3000);
    }
    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLiveStreaming]);

  // Telemetry Simulation Injector
  const handleSimulate = async (scenario: 'reset' | 'spike_storage' | 'trigger_blocking') => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dba/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers);
        setIncidents(data.incidents);
        setBlockingChain(data.blockingChain);
        if (data.storageBaselines) setStorageBaselines(data.storageBaselines);
        if (data.queryRegressions) setDetailedQueryRegressions(data.queryRegressions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Execution of approved action
  const handleExecuteSuccess = (data: any) => {
    if (data.servers) setServers(data.servers);
    if (data.incidents) setIncidents(data.incidents);
    if (data.blockingChain) setBlockingChain(data.blockingChain);
    if (data.storageBaselines) setStorageBaselines(data.storageBaselines);
    if (data.queryRegressions) setDetailedQueryRegressions(data.queryRegressions);
    if (data.auditEntry) {
      setAuditLogs(prev => [data.auditEntry, ...prev]);
    }
  };

  const handleOpenAiConsoleWithPrompt = (presetPrompt?: string) => {
    setAiConsoleInitialPrompt(presetPrompt);
    setIsAiConsoleOpen(true);
  };

  const handleServerAdded = (newServer: ServerInstance, data: any) => {
    if (data.servers) setServers(data.servers);
    if (data.waitStats) setWaitStats(data.waitStats);
    if (data.storageBaselines) setStorageBaselines(data.storageBaselines);
    if (data.auditLogs) setAuditLogs(data.auditLogs);
    setSelectedServerForDetail(newServer);
  };

  const handleRemoveServer = async (serverId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/dba/servers/${encodeURIComponent(serverId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.servers) setServers(data.servers);
        if (data.incidents) setIncidents(data.incidents);
        if (data.recommendations) setRecommendations(data.recommendations);
        if (data.waitStats) setWaitStats(data.waitStats);
        if (data.blockingChain) setBlockingChain(data.blockingChain);
        if (data.storageBaselines) setStorageBaselines(data.storageBaselines);
        if (data.storageAlerts) setStorageAlerts(data.storageAlerts);
        if (data.detailedQueryRegressions) setDetailedQueryRegressions(data.detailedQueryRegressions);
        if (data.queryRegressions) setQueryRegressions(data.queryRegressions);
        if (data.auditLogs) setAuditLogs(data.auditLogs);
        if (data.morningBrief) setMorningBrief(data.morningBrief);
        setSelectedServerForDetail(prev => prev && prev.id === serverId ? null : prev);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to remove server:', err);
      return false;
    }
  };

  const handleClearMockServers = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/dba/servers/clear-mock', {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.servers) setServers(data.servers);
        if (data.incidents) setIncidents(data.incidents);
        if (data.recommendations) setRecommendations(data.recommendations);
        if (data.waitStats) setWaitStats(data.waitStats);
        if (data.blockingChain) setBlockingChain(data.blockingChain);
        if (data.storageBaselines) setStorageBaselines(data.storageBaselines);
        if (data.storageAlerts) setStorageAlerts(data.storageAlerts);
        if (data.detailedQueryRegressions) setDetailedQueryRegressions(data.detailedQueryRegressions);
        if (data.queryRegressions) setQueryRegressions(data.queryRegressions);
        if (data.auditLogs) setAuditLogs(data.auditLogs);
        if (data.morningBrief) setMorningBrief(data.morningBrief);
        setSelectedServerForDetail(prev => {
          if (!prev) return null;
          return data.servers?.some((s: any) => s.id === prev.id) ? prev : null;
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to clear mock servers:', err);
      return false;
    }
  };

  // Real active storage baselines strictly linked to servers currently in estate
  const activeStorageBaselines = useMemo(() => {
    const list = storageBaselines.filter(b => 
      servers.some(s => 
        s.id.toLowerCase() === b.serverId?.toLowerCase() || 
        s.name.toLowerCase() === b.serverName?.toLowerCase()
      )
    );
    // Ensure every server in estate has at least one baseline representation
    servers.forEach(s => {
      const exists = list.some(b => 
        b.serverId?.toLowerCase() === s.id.toLowerCase() || 
        b.serverName?.toLowerCase() === s.name.toLowerCase()
      );
      if (!exists) {
        const totalCap = Math.round(500 * (100 / Math.max(1, s.diskFreePct || 40)));
        const usedCap = Math.round(totalCap * ((100 - (s.diskFreePct || 40)) / 100));
        const freeCap = totalCap - usedCap;
        const dbName = s.databases?.[0]?.name || 'ProductionDB';
        list.push({
          id: `BASE-${s.name}-DATA`,
          serverId: s.id,
          serverName: s.name,
          databaseName: dbName,
          volumeMount: 'C:\\Data',
          fileType: 'DATA_MDF',
          totalCapacityGB: totalCap,
          usedGB: usedCap,
          freeGB: freeCap,
          utilizationPct: Math.round(((usedCap / totalCap) * 100) * 10) / 10,
          baselineDailyGrowthGB: 4.5,
          currentDailyGrowthGB: s.daysTo80PctDisk <= 90 ? 16.0 : 4.8,
          growthVelocitySurgePct: s.daysTo80PctDisk <= 90 ? 68.0 : 3.5,
          zScore: s.daysTo80PctDisk <= 90 ? 2.2 : 0.2,
          daysTo80Pct: s.daysTo80PctDisk || 140,
          projectedDate80: 'Dec 15, 2026',
          daysTo90Pct: (s.daysTo80PctDisk || 140) + 40,
          projectedDate90: 'Jan 25, 2027',
          daysTo100Pct: (s.daysTo80PctDisk || 140) + 80,
          projectedDate100: 'Mar 10, 2027',
          isAnomaly: s.daysTo80PctDisk <= 90 || s.diskFreePct <= 25,
          anomalySeverity: s.daysTo80PctDisk <= 30 ? 'CRITICAL' : s.daysTo80PctDisk <= 90 ? 'HIGH' : 'NORMAL',
          historicalDataPoints: [
            { date: 'Day -28', usedGB: Math.max(1, usedCap - 14), baselineGB: Math.max(1, usedCap - 14), isForecast: false },
            { date: 'Day -21', usedGB: Math.max(1, usedCap - 10), baselineGB: Math.max(1, usedCap - 10), isForecast: false },
            { date: 'Day -14', usedGB: Math.max(1, usedCap - 7), baselineGB: Math.max(1, usedCap - 7), isForecast: false },
            { date: 'Day -7', usedGB: Math.max(1, usedCap - 3), baselineGB: Math.max(1, usedCap - 3), isForecast: false },
            { date: 'Today', usedGB: usedCap, baselineGB: usedCap, isForecast: false },
            { date: '+30 Days', usedGB: Math.round(usedCap + 15), baselineGB: Math.round(usedCap + 15), projectedGB: Math.round(usedCap + 15), isForecast: true },
            { date: '+60 Days', usedGB: Math.round(usedCap + 30), baselineGB: Math.round(usedCap + 30), projectedGB: Math.round(usedCap + 30), isForecast: true },
            { date: '80% Horizon', usedGB: Math.round(totalCap * 0.8), baselineGB: Math.round(totalCap * 0.8), projectedGB: Math.round(totalCap * 0.8), isForecast: true },
          ],
          topTableConsumers: [
            {
              tableName: `dbo.${dbName}_Master`,
              schema: 'dbo',
              sizeGB: Math.round(usedCap * 0.35),
              growth30dGB: 5,
              growthPct30d: 3.2,
              pctOfDatabase: 35.0,
              rowCount: 8000000,
              hasPartitioning: false,
              compressionType: 'PAGE',
              isAnomalyCulprit: false,
            }
          ],
          rootCauseAnalysis: `Storage baseline established for ${s.name}. Telemetry streaming indicates normal extent allocations.`,
          potentialImpact: `Storage runway is projected at ${s.daysTo80PctDisk || 140} days before reaching 80% capacity limit.`,
          recommendedAction: {
            id: `REC-STORAGE-${s.name}`,
            title: `Capacity Monitoring & Defrag for ${s.name}`,
            why: `Continuous monitoring and baseline indexing on ${dbName} prevents premature volume exhaustion.`,
            evidence: `Current disk free space is ${s.diskFreePct}%.`,
            expectedBenefit: 'Maintains long-term capacity runway.',
            risk: 'LOW',
            implementationComplexity: 'LOW',
            rollbackMethod: 'N/A',
            validationMethod: 'sys.dm_os_volume_stats query.',
            priority: 'LOW',
            safetyLevel: 'GREEN',
            targetServer: s.name,
            targetDatabase: dbName,
          }
        });
      }
    });
    return list;
  }, [servers, storageBaselines]);

  const activeStorageAlerts = useMemo(() => {
    return storageAlerts.filter(a => 
      servers.some(s => 
        s.id.toLowerCase() === a.serverId?.toLowerCase() || 
        s.name.toLowerCase() === a.serverId?.toLowerCase()
      )
    );
  }, [servers, storageAlerts]);

  const activeIncidents = useMemo(() => {
    return incidents.filter(i => 
      servers.some(s => 
        s.name.toLowerCase() === i.server?.toLowerCase() || 
        s.id.toLowerCase() === i.server?.toLowerCase()
      )
    );
  }, [servers, incidents]);

  const activeDetailedQueryRegressions = useMemo(() => {
    if (servers.length === 0) return [];
    const activeDbNames = new Set(
      servers.flatMap(s => (s.databases || []).map(d => d.name?.toLowerCase())).filter(Boolean)
    );
    return detailedQueryRegressions.filter(q => 
      !q.databaseName || activeDbNames.has(q.databaseName.toLowerCase())
    );
  }, [servers, detailedQueryRegressions]);

  const activeQueryStoreRegressions = useMemo(() => {
    if (servers.length === 0) return [];
    const activeDbNames = new Set(
      servers.flatMap(s => (s.databases || []).map(d => d.name?.toLowerCase())).filter(Boolean)
    );
    return queryRegressions.filter(q => 
      !q.databaseName || activeDbNames.has(q.databaseName.toLowerCase())
    );
  }, [servers, queryRegressions]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Universal Header with Estate KPIs */}
      <Header
        servers={servers}
        incidents={activeIncidents}
        onOpenMorningBrief={() => setIsMorningBriefOpen(true)}
        onOpenHumansMissed={() => setIsHumansMissedOpen(true)}
        onOpenAiConsole={handleOpenAiConsoleWithPrompt}
        onOpenAuditLogs={() => setIsAuditLogDrawerOpen(true)}
        onOpenDocs={() => setIsDocsOpen(true)}
        onOpenAirGapped={() => setIsAirGappedOpen(true)}
        onOpenAddServer={() => setIsAddServerOpen(true)}
        onSimulate={handleSimulate}
        isLoading={isLoading}
        isLiveStreaming={isLiveStreaming}
        onToggleLiveStreaming={() => setIsLiveStreaming(!isLiveStreaming)}
        lastStreamUpdate={lastStreamUpdate}
      />

      {/* 6 Operating Modes Switcher */}
      <ModeSelector
        currentMode={currentMode}
        onSelectMode={setCurrentMode}
        activeIncidentCount={activeIncidents.filter(i => i.status === 'ACTIVE').length}
        storageAnomalyCount={activeStorageAlerts.filter(a => a.status === 'ACTIVE').length}
        queryRegressionCount={activeDetailedQueryRegressions.length}
        predictiveRiskCount={activeStorageBaselines.filter(b => b.isAnomaly || b.daysTo80Pct <= 90 || (b.usedGB / (b.totalCapacityGB || 1)) >= 0.8).length}
      />

      {/* Main Mode Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentMode === 'executive' && (
          <ExecutiveMode
            servers={servers}
            incidents={activeIncidents}
            recommendations={recommendations}
            onSelectServer={setSelectedServerForDetail}
            onSelectIncident={(inc) => {
              setCurrentMode('incident');
            }}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
            onOpenAddServer={() => setIsAddServerOpen(true)}
            onRemoveServer={handleRemoveServer}
            onClearMockServers={handleClearMockServers}
          />
        )}

        {currentMode === 'dba' && (
          <DbaMode
            servers={servers}
            waitStats={waitStats}
            blockingChain={blockingChain}
            queryRegressions={activeQueryStoreRegressions}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
            onOpenAddServer={() => setIsAddServerOpen(true)}
            onRemoveServer={handleRemoveServer}
            onClearMockServers={handleClearMockServers}
          />
        )}

        {currentMode === 'incident' && (
          <IncidentMode
            incidents={activeIncidents}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
            onSelectIncident={(inc) => {}}
          />
        )}

        {currentMode === 'storage-anomalies' && (
          <StorageAnomalyEngine
            baselines={activeStorageBaselines}
            alerts={activeStorageAlerts}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
          />
        )}

        {currentMode === 'query-regressions' && (
          <QueryRegressionChecker
            regressions={activeDetailedQueryRegressions}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
          />
        )}

        {currentMode === 'performance' && (
          <PerformanceMode
            servers={servers}
            queryRegressions={activeQueryStoreRegressions}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
            onOpenAddServer={() => setIsAddServerOpen(true)}
            onRemoveServer={handleRemoveServer}
            onClearMockServers={handleClearMockServers}
          />
        )}

        {currentMode === 'predictive' && (
          <PredictiveMode
            servers={servers}
            baselines={activeStorageBaselines}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
            onOpenAddServer={() => setIsAddServerOpen(true)}
            onRemoveServer={handleRemoveServer}
            onClearMockServers={handleClearMockServers}
          />
        )}

        {currentMode === 'change-review' && (
          <ChangeReviewMode
            servers={servers}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
            onOpenAddServer={() => setIsAddServerOpen(true)}
          />
        )}
      </main>

      {/* Footer System Status Ribbon */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-3 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-mono text-[11px] text-slate-400">
              AI DBA Command Center Engine v1.0 • Autonomous DBRE
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            North Star: Observe → Correlate → Predict → Explain → Recommend → Request Approval → Execute → Validate → Learn
          </div>
        </div>
      </footer>

      {/* Modals & Slide-Overs */}
      
      {/* 1. Morning Briefing Modal (Section 20) */}
      <MorningBriefModal
        isOpen={isMorningBriefOpen}
        onClose={() => setIsMorningBriefOpen(false)}
        briefing={morningBrief}
        onRequestApproval={(rec) => {
          setIsMorningBriefOpen(false);
          setSelectedRecForApproval(rec);
        }}
      />

      {/* 2. "Find What Humans Missed" Proactive Modal (Section 21) */}
      <HumansMissedModal
        isOpen={isHumansMissedOpen}
        onClose={() => setIsHumansMissedOpen(false)}
        servers={servers}
        onRequestApproval={(rec) => {
          setSelectedRecForApproval(rec);
        }}
      />

      {/* 3. Safety Approval Modal (Sections 15, 16, 17) */}
      <SafetyApprovalModal
        isOpen={!!selectedRecForApproval}
        onClose={() => setSelectedRecForApproval(null)}
        recommendation={selectedRecForApproval}
        onExecuteSuccess={handleExecuteSuccess}
      />

      {/* 4. AI DBA Natural Language Console (Sections 19, 28, 29) */}
      <AiConsoleModal
        isOpen={isAiConsoleOpen}
        onClose={() => setIsAiConsoleOpen(false)}
        initialPrompt={aiConsoleInitialPrompt}
        onRequestApproval={(rec) => {
          setIsAiConsoleOpen(false);
          setSelectedRecForApproval(rec);
        }}
      />

      {/* 5. Server Details Modal (Section 4) */}
      <ServerDetailModal
        server={selectedServerForDetail}
        onClose={() => setSelectedServerForDetail(null)}
        onRemoveServer={handleRemoveServer}
        onServerUpdated={(updated) => {
          setServers(prev => prev.map(s => s.id === updated.id ? updated : s));
          setSelectedServerForDetail(updated);
        }}
        onAskAiAboutServer={(serverName) => {
          handleOpenAiConsoleWithPrompt(`Why is ${serverName} experiencing performance or capacity risk? Provide evidence and recommendations.`);
        }}
      />

      {/* 6. Audit Log Drawer (Sections 25 & 26) */}
      <AuditLogDrawer
        isOpen={isAuditLogDrawerOpen}
        onClose={() => setIsAuditLogDrawerOpen(false)}
        auditLogs={auditLogs}
      />

      {/* 7. Complete System Documentation & Setup Guide Modal */}
      <SystemDocumentationModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />

      {/* 8. Local Air-Gapped & Ollama Settings Modal */}
      <LocalAirGappedModal
        isOpen={isAirGappedOpen}
        onClose={() => setIsAirGappedOpen(false)}
      />

      {/* 9. Register New SQL Server Asset Modal */}
      <AddServerModal
        isOpen={isAddServerOpen}
        onClose={() => setIsAddServerOpen(false)}
        onServerAdded={handleServerAdded}
      />

    </div>
  );
}
