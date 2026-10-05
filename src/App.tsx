/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Universal Header with Estate KPIs */}
      <Header
        servers={servers}
        incidents={incidents}
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
        activeIncidentCount={incidents.filter(i => i.status === 'ACTIVE').length}
      />

      {/* Main Mode Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentMode === 'executive' && (
          <ExecutiveMode
            servers={servers}
            incidents={incidents}
            recommendations={recommendations}
            onSelectServer={setSelectedServerForDetail}
            onSelectIncident={(inc) => {
              setCurrentMode('incident');
            }}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
            onOpenAddServer={() => setIsAddServerOpen(true)}
          />
        )}

        {currentMode === 'dba' && (
          <DbaMode
            servers={servers}
            waitStats={waitStats}
            blockingChain={blockingChain}
            queryRegressions={queryRegressions}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
            onOpenAddServer={() => setIsAddServerOpen(true)}
          />
        )}

        {currentMode === 'incident' && (
          <IncidentMode
            incidents={incidents}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
            onSelectIncident={(inc) => {}}
          />
        )}

        {currentMode === 'storage-anomalies' && (
          <StorageAnomalyEngine
            baselines={storageBaselines}
            alerts={storageAlerts}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
          />
        )}

        {currentMode === 'query-regressions' && (
          <QueryRegressionChecker
            regressions={detailedQueryRegressions}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
          />
        )}

        {currentMode === 'performance' && (
          <PerformanceMode
            servers={servers}
            queryRegressions={queryRegressions}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
          />
        )}

        {currentMode === 'predictive' && (
          <PredictiveMode
            servers={servers}
            baselines={storageBaselines}
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
          />
        )}

        {currentMode === 'change-review' && (
          <ChangeReviewMode
            onRequestApproval={(rec) => setSelectedRecForApproval(rec)}
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
