import React, { useState } from 'react';
import { 
  Server, 
  X, 
  Check, 
  Terminal, 
  ShieldCheck, 
  Database, 
  Cpu, 
  RefreshCw, 
  Copy, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  Radio, 
  Lock,
  Layers,
  Sparkles,
  Zap,
  Info,
  Download,
  Activity
} from 'lucide-react';
import { ServerInstance } from '../types/dba';

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServerAdded: (newServer: ServerInstance, fullEstatePayload: any) => void;
}

export const AddServerModal: React.FC<AddServerModalProps> = ({
  isOpen,
  onClose,
  onServerAdded,
}) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Form Fields: Step 1 (Connection)
  const [serverAddress, setServerAddress] = useState('sql-prod-04.corp.internal');
  const [serverDisplayName, setServerDisplayName] = useState('');
  const [instanceName, setInstanceName] = useState('MSSQLSERVER');
  const [port, setPort] = useState('1433');
  const [role, setRole] = useState('Payment Gateway & Settlement Hub');
  const [environment, setEnvironment] = useState<'production' | 'staging' | 'data-warehouse'>('production');
  const [authType, setAuthType] = useState<'sql' | 'windows'>('sql');
  const [username, setUsername] = useState('svc_ai_dba_agent');
  const [password, setPassword] = useState('StrongP@ssw0rd!2026');
  const [encryptConnection, setEncryptConnection] = useState(true);
  const [trustServerCert, setTrustServerCert] = useState(true);

  // Ingestion Mode: Direct TDS vs Real-Time Push Agent vs Lab Simulation
  const [telemetryMode, setTelemetryMode] = useState<'direct-tds' | 'push-agent' | 'simulated'>('direct-tds');

  // Form Fields: Step 2 (Database Scope & HA)
  const [databasesInput, setDatabasesInput] = useState('PaymentsDB, SettlementMart, AuditArchive');
  const [haArchitecture, setHaArchitecture] = useState<'Always On Availability Groups' | 'Failover Cluster (FCI)' | 'Log Shipping' | 'Standalone'>('Always On Availability Groups');
  const [rpoMinutes, setRpoMinutes] = useState(5);
  const [rtoMinutes, setRtoMinutes] = useState(15);
  const [agentScriptFormat, setAgentScriptFormat] = useState<'powershell' | 'python'>('powershell');

  // Discovery / Test State: Step 3
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    isRealServer?: boolean;
    latencyMs: number;
    discoveredVersion?: string;
    discoveredEdition?: string;
    discoveredOs?: string;
    discoveredCores?: number;
    discoveredMemoryGB?: number;
    memoryUsedGB?: number;
    ple?: number;
    cpuUsagePct?: number;
    discoveredServerName?: string;
    machineName?: string;
    avgReadLatencyMs?: number;
    avgWriteLatencyMs?: number;
    permissionsChecked?: Array<{ name: string; granted: boolean }>;
    discoveredDatabases?: string[];
    databaseDetails?: Array<{
      name: string;
      sizeGB: number;
      growthRate30DaysPct: number;
      recoveryModel: string;
      state: string;
      dataSizeGB: number;
      logSizeGB: number;
    }>;
    volumeStats?: Array<{
      volumeMount: string;
      totalGB: number;
      freeGB: number;
      usedGB: number;
      diskFreePct: number;
    }>;
    backupInfo?: {
      hasBackups: boolean;
      lastFullBackupHoursAgo: number | null;
      lastLogBackupMinutesAgo: number | null;
      backupStatus: string;
    };
    topTables?: Array<{
      tableName: string;
      schema: string;
      sizeGB: number;
      rowCount: number;
    }>;
    waitStats?: any[];
    activeSessions?: number;
    blockedCount?: number;
    message?: string;
    errorCode?: string;
    diagnosticAdvice?: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedAgentScript, setCopiedAgentScript] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, isAgent: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isAgent) {
      setCopiedAgentScript(true);
      setTimeout(() => setCopiedAgentScript(false), 2000);
    } else {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    }
  };

  const loadPreset = (type: 'prod-payments' | 'stg-inventory' | 'local-docker') => {
    if (type === 'prod-payments') {
      setServerAddress('sql-prod-04.corp.internal');
      setInstanceName('MSSQLSERVER');
      setPort('1433');
      setRole('Payment Processing & Ledger Cluster');
      setEnvironment('production');
      setDatabasesInput('PaymentsDB, CardTokenStore, SettlementMart');
      setHaArchitecture('Always On Availability Groups');
      setTelemetryMode('direct-tds');
      setRpoMinutes(5);
      setRtoMinutes(15);
    } else if (type === 'local-docker') {
      setServerAddress('localhost');
      setInstanceName('MSSQLSERVER');
      setPort('1433');
      setRole('Local Docker SQL Server 2022');
      setEnvironment('staging');
      setUsername('sa');
      setPassword('StrongP@ssw0rd!2026');
      setDatabasesInput('TestDB, InventoryDB');
      setHaArchitecture('Standalone');
      setTelemetryMode('direct-tds');
      setRpoMinutes(60);
      setRtoMinutes(120);
    } else {
      setServerAddress('sql-stg-02.internal.dev');
      setInstanceName('SQLSTAGING');
      setPort('1433');
      setRole('Inventory & Supply Chain QA');
      setEnvironment('staging');
      setDatabasesInput('InventoryDB_Staging, FulfillmentQA');
      setHaArchitecture('Standalone');
      setTelemetryMode('push-agent');
      setRpoMinutes(60);
      setRtoMinutes(120);
    }
    setTestResult(null);
    setSubmissionError(null);
  };

  // Run TDS Handshake Probe
  const handleRunDiscoveryTest = async (forceSimulate: boolean = false) => {
    setIsTesting(true);
    setTestResult(null);
    setSubmissionError(null);
    try {
      const res = await fetch('/api/dba/servers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverAddress,
          instanceName,
          port: Number(port) || 1433,
          authType,
          username,
          password,
          encryptConnection,
          trustServerCert,
          databases: databasesInput.split(',').map(d => d.trim()).filter(Boolean),
          mode: forceSimulate ? 'simulate' : (telemetryMode === 'simulated' ? 'simulate' : 'live'),
        }),
      });

      const data = await res.json();
      setTestResult(data);
      if (data && data.success) {
        if (data.discoveredServerName) {
          setServerDisplayName(data.discoveredServerName);
        } else if (data.machineName) {
          setServerDisplayName(data.machineName);
        }
        if (data.discoveredDatabases && Array.isArray(data.discoveredDatabases) && data.discoveredDatabases.length > 0) {
          setDatabasesInput(data.discoveredDatabases.join(', '));
        }
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        isRealServer: false,
        latencyMs: 0,
        message: err.message || 'Connection timeout or socket error',
        diagnosticAdvice: 'Check that SQL Server is running and listening on port ' + port,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Register the Asset
  const handleRegisterServer = async () => {
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      const defaultHostName = serverAddress.split('.')[0] || 'SQL-NEW';
      const resolvedName = (serverDisplayName.trim() || testResult?.discoveredServerName || testResult?.machineName || defaultHostName).toUpperCase();

      const serverPayload = {
        name: resolvedName,
        address: serverAddress,
        instanceName,
        port: Number(port) || 1433,
        role,
        environment,
        authType,
        username,
        password,
        encryptConnection,
        trustServerCert,
        databases: databasesInput.split(',').map(d => d.trim()).filter(Boolean),
        haArchitecture,
        rpoMinutes,
        rtoMinutes,
        telemetryMode,
        discoveredSpecs: testResult || null,
      };

      const res = await fetch('/api/dba/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverPayload),
      });

      const data = await res.json();
      if (data.success && data.server) {
        onServerAdded(data.server, data);
        onClose();
      } else {
        setSubmissionError(data.error || data.message || 'Failed to register server asset');
      }
    } catch (err: any) {
      setSubmissionError(err.message || 'Server registration network failure');
    } finally {
      setIsSubmitting(false);
    }
  };

  const provisioningTsql = `-- Run on target SQL Server instance (${serverAddress}) in SSMS
USE [master];
GO
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = '${username}')
BEGIN
    CREATE LOGIN [${username}] WITH PASSWORD = N'${password}', CHECK_EXPIRATION = OFF, CHECK_POLICY = ON;
END
GO
GRANT VIEW SERVER STATE TO [${username}];
GRANT VIEW ANY DEFINITION TO [${username}];
GRANT CONNECT SQL TO [${username}];
-- SQL Server 2022+ Performance and Security states:
IF @@MICROSOFTVERSION / 0x01000000 >= 16
BEGIN
    EXEC sp_executesql N'GRANT VIEW SERVER PERFORMANCE STATE TO [${username}];';
    EXEC sp_executesql N'GRANT VIEW SERVER SECURITY STATE TO [${username}];';
END
GO
PRINT 'AI DBA Monitoring account configured successfully.';
`;

  const rawHostId = serverAddress.split('.')[0].toLowerCase().replace(/[^a-z0-9-]/g, '');
  const cleanServerId = rawHostId.startsWith('sql-') ? rawHostId : `sql-${rawHostId}`;
  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const pushEndpoint = `${originUrl}/api/dba/telemetry/push`;

  const sampleAgentCommand = agentScriptFormat === 'powershell' 
    ? `# Run this on the SQL Server machine in PowerShell 5.1+ (x64)
# Streams live CPU, PLE, wait stats, and sessions every 5s directly to AI DBA Command Center:
$url = "${originUrl}/api/dba/agent/script?serverId=${cleanServerId}&format=powershell"
Invoke-Expression (Invoke-RestMethod -Uri $url)`
    : `# Run in Python 3.8+ on the SQL Server host:
# pip install pyodbc
python -c "import urllib.request; exec(urllib.request.urlopen('${originUrl}/api/dba/agent/script?serverId=${cleanServerId}&format=python').read())"`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-500/10">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Register New SQL Server Asset
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Real-Time Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Onboard a real SQL Server instance (Direct TDS 1433 or Push Agent) into continuous AI DBA monitoring.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-3 sm:space-x-8">
            <button
              onClick={() => setActiveStep(1)}
              className={`flex items-center space-x-2 cursor-pointer ${activeStep === 1 ? 'text-cyan-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 1 ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>1</span>
              <span>1. Connection & Mode</span>
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
            <button
              onClick={() => setActiveStep(2)}
              className={`flex items-center space-x-2 cursor-pointer ${activeStep === 2 ? 'text-cyan-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 2 ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>2</span>
              <span>2. Telemetry Ingestion</span>
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
            <button
              onClick={() => setActiveStep(3)}
              className={`flex items-center space-x-2 cursor-pointer ${activeStep === 3 ? 'text-cyan-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 3 ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>3</span>
              <span>3. Handshake & Onboard</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="hidden sm:flex items-center space-x-2 text-[11px]">
            <span className="text-slate-500">Quick Fill:</span>
            <button
              type="button"
              onClick={() => loadPreset('prod-payments')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
            >
              Production OLTP
            </button>
            <button
              type="button"
              onClick={() => loadPreset('local-docker')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
            >
              Local Docker / Express
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* STEP 1: CONNECTION & AUTH */}
          {activeStep === 1 && (
            <div className="space-y-5">
              
              {/* Telemetry Architecture Choice */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Choose Real-Time Telemetry Ingestion Architecture:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => setTelemetryMode('direct-tds')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      telemetryMode === 'direct-tds'
                        ? 'bg-cyan-950/50 border-cyan-500 shadow-md shadow-cyan-950/40 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-cyan-300">
                        <Zap className="w-3.5 h-3.5" /> Direct TDS (Port 1433)
                      </span>
                      {telemetryMode === 'direct-tds' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      AI DBA connects directly to your SQL Server over TCP port 1433 and polls DMVs every 5s.
                    </p>
                  </div>

                  <div
                    onClick={() => setTelemetryMode('push-agent')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      telemetryMode === 'push-agent'
                        ? 'bg-emerald-950/50 border-emerald-500 shadow-md shadow-emerald-950/40 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-emerald-300">
                        <ShieldCheck className="w-3.5 h-3.5" /> Push Agent (Zero Inbound)
                      </span>
                      {telemetryMode === 'push-agent' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      For on-premise/firewalled servers. Run a 1-line PowerShell script on the host to stream DMVs out.
                    </p>
                  </div>

                  <div
                    onClick={() => setTelemetryMode('simulated')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      telemetryMode === 'simulated'
                        ? 'bg-purple-950/50 border-purple-500 shadow-md shadow-purple-950/40 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-purple-300">
                        <Sparkles className="w-3.5 h-3.5" /> Lab Simulation Baseline
                      </span>
                      {telemetryMode === 'simulated' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Instant simulated DMV telemetry for testing features without connecting physical hardware.
                    </p>
                  </div>
                </div>
              </div>

              {/* Server Host / Port Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                
                {/* Host / Server Address */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">Server Hostname / IP Address *</label>
                  <input
                    type="text"
                    value={serverAddress}
                    onChange={(e) => {
                      setServerAddress(e.target.value);
                      if (!serverDisplayName) {
                        const token = e.target.value.split('.')[0];
                        if (token && !/^\d+$/.test(token)) {
                          setServerDisplayName(token.toUpperCase());
                        }
                      }
                    }}
                    placeholder="e.g. 192.168.1.100, localhost, or sql-prod-04.corp.internal"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[10px] text-slate-500">Fully Qualified Domain Name (FQDN) or IP</p>
                </div>

                {/* Display Name / Server Tag */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-medium">Server Name / Display Alias</label>
                    {testResult?.discoveredServerName && (
                      <span className="text-[10px] text-emerald-400 font-mono">Discovered: {testResult.discoveredServerName}</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={serverDisplayName}
                    onChange={(e) => setServerDisplayName(e.target.value)}
                    placeholder={testResult?.discoveredServerName || serverAddress.split('.')[0].toUpperCase() || "e.g. SQL-PROD-01 or ORION-DB"}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[10px] text-slate-500">Identifier shown across Command Center and AI DBA diagnostics</p>
                </div>

                {/* Instance Name */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">Instance Name</label>
                  <input
                    type="text"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    placeholder="MSSQLSERVER (default) or Named Instance"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[10px] text-slate-500">Leave as MSSQLSERVER for default port 1433</p>
                </div>

                {/* Port */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">TCP Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="1433"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Environment */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">Environment Tier</label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="production">Production (Strict SLA & Audit)</option>
                    <option value="staging">Staging / Pre-Production</option>
                    <option value="data-warehouse">Data Warehouse / Analytics Mart</option>
                  </select>
                </div>

                {/* Server Business Role */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-slate-300 font-medium">Server Business Role / Service Description</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Core OLTP - Payment Processing & Settlement Hub"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

              </div>

              {/* Authentication Box */}
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
                <div className="font-semibold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    Credentials & Least-Privilege Monitoring Login
                  </span>
                  <div className="flex items-center space-x-3 text-[11px]">
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input 
                        type="radio" 
                        name="authType" 
                        checked={authType === 'sql'} 
                        onChange={() => setAuthType('sql')} 
                        className="text-cyan-500"
                      />
                      <span>SQL Authentication</span>
                    </label>
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input 
                        type="radio" 
                        name="authType" 
                        checked={authType === 'windows'} 
                        onChange={() => setAuthType('windows')} 
                        className="text-cyan-500"
                      />
                      <span>Integrated Windows Auth</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-slate-400">Login Name / User</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-4 pt-1 text-[11px] text-slate-400">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={encryptConnection}
                      onChange={(e) => setEncryptConnection(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                    />
                    <span>Encrypt Connection (TLS)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trustServerCert}
                      onChange={(e) => setTrustServerCert(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                    />
                    <span>Trust Server Certificate</span>
                  </label>
                </div>
              </div>

              {/* T-SQL Helper Snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">T-SQL Account Provisioning Script (Run in SSMS):</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(provisioningTsql, false)}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSnippet ? 'Copied' : 'Copy T-SQL'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400 max-h-24 overflow-y-auto">
                  {provisioningTsql}
                </pre>
              </div>

            </div>
          )}

          {/* STEP 2: DATABASE SCOPE & INGESTION DETAILS */}
          {activeStep === 2 && (
            <div className="space-y-5 text-xs">
              
              {/* Databases Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-medium">User Databases to Monitor (comma separated)</label>
                  {testResult?.discoveredDatabases && testResult.discoveredDatabases.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDatabasesInput(testResult.discoveredDatabases!.join(', '))}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Use All Discovered ({testResult.discoveredDatabases.length} DBs)</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={databasesInput}
                  onChange={(e) => setDatabasesInput(e.target.value)}
                  placeholder="PaymentsDB, SettlementMart, AuditArchive"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[10px] text-slate-500">
                  The agent will query <code className="text-slate-400 font-mono">sys.dm_db_file_space_usage</code> and Query Store across these databases.
                </p>
              </div>

              {/* High Availability Architecture */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-medium">High Availability & Disaster Recovery Architecture</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'Always On Availability Groups', label: 'Always On AG', sub: 'Synchronous / Asynchronous replicas' },
                    { id: 'Failover Cluster (FCI)', label: 'Failover Cluster (FCI)', sub: 'Shared SAN storage with quorum' },
                    { id: 'Log Shipping', label: 'Transactional Log Shipping', sub: 'Secondary warm standby instance' },
                    { id: 'Standalone', label: 'Standalone Instance', sub: 'Single node, standard backup policy' },
                  ].map((ha) => (
                    <div
                      key={ha.id}
                      onClick={() => setHaArchitecture(ha.id as any)}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        haArchitecture === ha.id
                          ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-xs">{ha.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{ha.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Push Agent Details (If Push Mode Selected) */}
              {telemetryMode === 'push-agent' && (
                <div className="bg-emerald-950/30 border border-emerald-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      <span>Ready-to-Run Real-Time Collector Script</span>
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setAgentScriptFormat('powershell')}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                          agentScriptFormat === 'powershell' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        PowerShell (.ps1)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAgentScriptFormat('python')}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                          agentScriptFormat === 'python' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        Python (.py)
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300">
                    Run this single command on the SQL Server machine. It collects DMV wait stats, CPU %, and PLE, streaming them every 5 seconds into <code className="text-emerald-300 font-mono">{pushEndpoint}</code>.
                  </p>

                  <div className="relative">
                    <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[10px] font-mono text-emerald-300 max-h-28 overflow-x-auto whitespace-pre">
                      {sampleAgentCommand}
                    </pre>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(sampleAgentCommand, true)}
                      className="absolute top-2 right-2 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-mono flex items-center gap-1 border border-slate-700 cursor-pointer"
                    >
                      {copiedAgentScript ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedAgentScript ? 'Copied' : 'Copy Script'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SLA Targets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium">Target RPO (Recovery Point Objective)</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={rpoMinutes}
                      onChange={(e) => setRpoMinutes(Number(e.target.value))}
                      className="w-24 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-white"
                    />
                    <span className="text-slate-400 text-xs">minutes</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Alerts if transactional log backups exceed RPO threshold</p>
                </div>

                <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium">Target RTO (Recovery Time Objective)</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={rtoMinutes}
                      onChange={(e) => setRtoMinutes(Number(e.target.value))}
                      className="w-24 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-white"
                    />
                    <span className="text-slate-400 text-xs">minutes</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Maximum acceptable recovery time during failover</p>
                </div>
              </div>

            </div>
          )}

          {/* STEP 3: PRE-FLIGHT TEST & ONBOARD */}
          {activeStep === 3 && (
            <div className="space-y-5 text-xs">
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <span>Pre-Flight Telemetry Handshake Verification</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      {telemetryMode === 'direct-tds' ? 'TDS Socket 1433' : telemetryMode === 'push-agent' ? 'Push Agent Live' : 'Simulation'}
                    </span>
                  </h4>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Target: <strong className="text-cyan-300 font-mono">{serverAddress}:{port}</strong> ({instanceName})
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleRunDiscoveryTest(false)}
                    disabled={isTesting}
                    className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold flex items-center space-x-1.5 shadow-md shadow-cyan-600/30 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Probing TDS...' : 'Run Live TDS Probe'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunDiscoveryTest(true)}
                    disabled={isTesting}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition cursor-pointer"
                    title="Test with simulated telemetry baseline if SQL Server is not reachable directly"
                  >
                    Lab Baseline
                  </button>
                </div>
              </div>

              {/* Test Result Display */}
              {testResult && (
                <div className={`p-4 rounded-xl border ${
                  testResult.success 
                    ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-200' 
                    : 'bg-rose-950/20 border-rose-800/60 text-rose-200'
                }`}>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                    <div className="flex items-center space-x-2">
                      {testResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                      )}
                      <div>
                        <div className="font-bold text-sm text-white">
                          {testResult.success ? (
                            testResult.isRealServer ? 'Real SQL Server Handshake Verified' : 'Baseline Discovery Ready'
                          ) : 'Handshake Notice'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Measured Latency: <strong className="text-cyan-300 font-mono">{testResult.latencyMs} ms</strong>
                          {testResult.isRealServer && <span className="ml-2 text-emerald-400 font-mono font-bold">● Real SQL Engine Connected</span>}
                        </div>
                      </div>
                    </div>

                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      testResult.success ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {testResult.success ? (testResult.isRealServer ? 'LIVE TDS VERIFIED' : 'SIMULATION READY') : (testResult.errorCode || 'OFFLINE')}
                    </span>
                  </div>

                  {testResult.success && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <span className="text-slate-400">Discovered Version:</span>
                        <div className="text-white font-mono truncate">{testResult.discoveredVersion}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-400">Edition:</span>
                        <div className="text-white font-mono">{testResult.discoveredEdition}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-400">Operating System:</span>
                        <div className="text-white font-mono">{testResult.discoveredOs}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-400">Hardware Profile:</span>
                        <div className="text-cyan-300 font-mono">
                          {testResult.discoveredCores} Cores • {testResult.discoveredMemoryGB} GB RAM
                        </div>
                      </div>

                      {/* Permissions Checklist */}
                      <div className="md:col-span-2 pt-2 border-t border-slate-800/80">
                        <span className="text-slate-400 block mb-1.5 font-mono text-[11px]">Permission & DMV Feeds:</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {testResult.permissionsChecked?.map((p, idx) => (
                            <div key={idx} className="flex items-center space-x-1.5 bg-slate-900/80 px-2 py-1 rounded border border-slate-800 text-[11px]">
                              {p.granted ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-rose-400" />}
                              <span className="text-slate-200">{p.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {!testResult.success && (
                    <div className="space-y-2 text-xs">
                      <div className="text-rose-300 font-mono">
                        {testResult.message}
                      </div>
                      {testResult.diagnosticAdvice && (
                        <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-slate-300">
                          <strong className="text-amber-400">DBA Guidance:</strong> {testResult.diagnosticAdvice}
                        </div>
                      )}
                      <div className="flex items-center space-x-3 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setTelemetryMode('push-agent');
                            setActiveStep(2);
                          }}
                          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer"
                        >
                          Switch to Real-Time Push Agent Mode
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRunDiscoveryTest(true)}
                          className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                        >
                          Use Lab Baseline Instead
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ready to Register Card */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="font-bold text-white text-xs uppercase tracking-wider">Asset Registration Summary</h5>
                    <div className="text-slate-400 text-xs mt-1">
                      Instance <strong className="text-white font-mono">{serverAddress.split('.')[0].toUpperCase()}</strong> will be onboarded. Real-time telemetry streaming will begin immediately.
                    </div>
                  </div>
                  <span className="text-emerald-400 font-mono text-xs font-bold">Health Score: 98/100</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-300 pt-2 border-t border-slate-800">
                  <div>Role: <span className="text-cyan-300 truncate block">{role}</span></div>
                  <div>Mode: <span className="text-emerald-300">{telemetryMode === 'direct-tds' ? 'Direct TDS' : telemetryMode === 'push-agent' ? 'Push Agent' : 'Simulated'}</span></div>
                  <div>HA: <span className="text-amber-300">{haArchitecture}</span></div>
                  <div>Databases: <span className="text-white">{databasesInput.split(',').length} DBs</span></div>
                </div>
              </div>

              {submissionError && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{submissionError}</span>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Step {activeStep} of 3 • Telemetry: <strong className="text-slate-300 font-mono">{telemetryMode}</strong>
          </div>

          <div className="flex items-center space-x-2">
            {activeStep > 1 && (
              <button
                type="button"
                onClick={() => setActiveStep((prev) => (prev - 1) as any)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Previous Step
              </button>
            )}

            {activeStep < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (activeStep === 2 && !testResult) {
                    handleRunDiscoveryTest(false);
                  }
                  setActiveStep((prev) => (prev + 1) as any);
                }}
                className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRegisterServer}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 flex items-center space-x-1.5 transition cursor-pointer"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{isSubmitting ? 'Registering Asset...' : 'Register SQL Server Asset'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
