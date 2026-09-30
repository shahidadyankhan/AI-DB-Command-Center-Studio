import React, { useState } from 'react';
import { 
  Server, 
  X, 
  Check, 
  Terminal, 
  ShieldCheck, 
  Database, 
  HardDrive, 
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
  Info
} from 'lucide-react';
import { ServerInstance, DatabaseInfo } from '../types/dba';

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServerAdded: (newServer: ServerInstance, allServers: ServerInstance[]) => void;
}

export const AddServerModal: React.FC<AddServerModalProps> = ({
  isOpen,
  onClose,
  onServerAdded,
}) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Form Fields: Step 1 (Connection)
  const [serverAddress, setServerAddress] = useState('sql-prod-04.corp.internal');
  const [instanceName, setInstanceName] = useState('MSSQLSERVER');
  const [port, setPort] = useState('1433');
  const [role, setRole] = useState('Payment Gateway & Settlement Hub');
  const [environment, setEnvironment] = useState<'production' | 'staging' | 'data-warehouse'>('production');
  const [authType, setAuthType] = useState<'sql' | 'windows'>('sql');
  const [username, setUsername] = useState('svc_ai_dba_agent');
  const [password, setPassword] = useState('StrongP@ssw0rd!2026');
  const [encryptConnection, setEncryptConnection] = useState(true);
  const [trustServerCert, setTrustServerCert] = useState(true);

  // Form Fields: Step 2 (Database Scope & HA)
  const [databasesInput, setDatabasesInput] = useState('PaymentsDB, SettlementMart, AuditArchive');
  const [haArchitecture, setHaArchitecture] = useState<'Always On Availability Groups' | 'Failover Cluster (FCI)' | 'Log Shipping' | 'Standalone'>('Always On Availability Groups');
  const [rpoMinutes, setRpoMinutes] = useState(5);
  const [rtoMinutes, setRtoMinutes] = useState(15);

  // Discovery / Test State: Step 3
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    discoveredVersion?: string;
    discoveredEdition?: string;
    discoveredOs?: string;
    discoveredCores?: number;
    discoveredMemoryGB?: number;
    permissionsChecked?: Array<{ name: string; granted: boolean }>;
    discoveredDatabases?: string[];
    message?: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const loadPreset = (type: 'prod-payments' | 'stg-inventory') => {
    if (type === 'prod-payments') {
      setServerAddress('sql-prod-04.corp.internal');
      setInstanceName('MSSQLSERVER');
      setRole('Payment Processing & Ledger Cluster');
      setEnvironment('production');
      setDatabasesInput('PaymentsDB, CardTokenStore, SettlementMart');
      setHaArchitecture('Always On Availability Groups');
      setRpoMinutes(5);
      setRtoMinutes(15);
    } else {
      setServerAddress('sql-stg-02.internal.dev');
      setInstanceName('SQLSTAGING');
      setRole('Inventory & Supply Chain QA');
      setEnvironment('staging');
      setDatabasesInput('InventoryDB_Staging, FulfillmentQA');
      setHaArchitecture('Standalone');
      setRpoMinutes(60);
      setRtoMinutes(120);
    }
    setTestResult(null);
  };

  const handleRunDiscoveryTest = async () => {
    setIsTesting(true);
    setTestResult(null);
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
        }),
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        message: err.message || 'Connection timeout or socket error',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRegisterServer = async () => {
    setIsSubmitting(true);
    try {
      const serverPayload = {
        name: serverAddress.split('.')[0].toUpperCase(),
        address: serverAddress,
        instanceName,
        port: Number(port) || 1433,
        role,
        environment,
        authType,
        username,
        databases: databasesInput.split(',').map(d => d.trim()).filter(Boolean),
        haArchitecture,
        rpoMinutes,
        rtoMinutes,
        discoveredSpecs: testResult,
      };

      const res = await fetch('/api/dba/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverPayload),
      });

      const data = await res.json();
      if (data.success && data.server) {
        onServerAdded(data.server, data.servers);
        onClose();
      }
    } catch (err) {
      console.error('Failed to register server:', err);
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
-- Enable Query Store diagnostics in user database:
USE [master];
GO
PRINT 'AI DBA Monitoring account configured successfully.';
`;

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
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                  Telemetry Onboarding
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Onboard an on-premise or cloud SQL Server instance into continuous AI DBA monitoring and risk detection.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
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
              className={`flex items-center space-x-2 ${activeStep === 1 ? 'text-cyan-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 1 ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>1</span>
              <span>1. Connection & Auth</span>
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
            <button
              onClick={() => setActiveStep(2)}
              className={`flex items-center space-x-2 ${activeStep === 2 ? 'text-cyan-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 2 ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>2</span>
              <span>2. Databases & HA</span>
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
            <button
              onClick={() => setActiveStep(3)}
              className={`flex items-center space-x-2 ${activeStep === 3 ? 'text-cyan-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 3 ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>3</span>
              <span>3. Probe & Onboard</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="hidden sm:flex items-center space-x-2 text-[11px]">
            <span className="text-slate-500">Template:</span>
            <button
              type="button"
              onClick={() => loadPreset('prod-payments')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
            >
              OLTP Production
            </button>
            <button
              type="button"
              onClick={() => loadPreset('stg-inventory')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
            >
              Staging / QA
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* STEP 1: CONNECTION & AUTH */}
          {activeStep === 1 && (
            <div className="space-y-5">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1 text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  Least-Privilege Connection Security
                </span>
                <p className="text-slate-400">
                  The AI DBA agent operates with <strong>read-only diagnostic privileges</strong> (<code className="text-cyan-300 font-mono">VIEW SERVER STATE</code>, <code className="text-cyan-300 font-mono">VIEW ANY DEFINITION</code>). It never requires <code className="text-rose-400 font-mono">sysadmin</code>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                
                {/* Host / Server Address */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">Server Hostname / IP Address *</label>
                  <input
                    type="text"
                    value={serverAddress}
                    onChange={(e) => setServerAddress(e.target.value)}
                    placeholder="e.g. sql-prod-04.corp.internal or 192.168.1.50"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[10px] text-slate-500">Fully Qualified Domain Name (FQDN) or IP</p>
                </div>

                {/* Instance Name */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-medium">Instance Name / Listener</label>
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
                  <label className="text-slate-300 font-medium">TDS Network Port</label>
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
                    <option value="production">Production (Tier 1 Strict SLA)</option>
                    <option value="staging">Staging / Pre-Production</option>
                    <option value="data-warehouse">Data Warehouse / BI Mart</option>
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
                  <span>Credentials & Authentication Method</span>
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
                      <span>Integrated / Kerberos</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-slate-400">Monitoring Login</label>
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
                  <span className="text-slate-400 font-mono">T-SQL Provisioning Script for this Server:</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(provisioningTsql)}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSnippet ? 'Copied to Clipboard' : 'Copy T-SQL'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400 max-h-24 overflow-y-auto">
                  {provisioningTsql}
                </pre>
              </div>

            </div>
          )}

          {/* STEP 2: DATABASE SCOPE & HA */}
          {activeStep === 2 && (
            <div className="space-y-5 text-xs">
              
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1 text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  Database Scope & RPO/RTO Configuration
                </span>
                <p className="text-slate-400">
                  Specify the user databases to monitor for wait statistics, blocking chains, and Query Store plan regressions.
                </p>
              </div>

              {/* Databases Input */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-medium">User Databases to Monitor (comma separated)</label>
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

              {/* SLA Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
                  <p className="text-[10px] text-slate-500">Maximum acceptable recovery time during full failover</p>
                </div>
              </div>

            </div>
          )}

          {/* STEP 3: PRE-FLIGHT TEST & DISCOVERY */}
          {activeStep === 3 && (
            <div className="space-y-5 text-xs">
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-sm">Automated Pre-Flight Connectivity & Telemetry Discovery</h4>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Connects to <strong className="text-cyan-300 font-mono">{serverAddress}:{port}</strong>, measures roundtrip latency, and inspects SQL Server version and DMV access.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRunDiscoveryTest}
                  disabled={isTesting}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold flex items-center space-x-2 shadow-md shadow-cyan-600/30 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Probing...' : 'Run Connectivity Probe'}</span>
                </button>
              </div>

              {/* Discovery Result */}
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
                          {testResult.success ? 'Connectivity Verified & Telemetry Discovered' : 'Connection Failed'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Socket Roundtrip Latency: <strong className="text-cyan-300 font-mono">{testResult.latencyMs} ms</strong>
                        </div>
                      </div>
                    </div>

                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      testResult.success ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {testResult.success ? 'DISCOVERY READY' : 'HANDSHAKE ERROR'}
                    </span>
                  </div>

                  {testResult.success && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <span className="text-slate-400">Discovered Version:</span>
                        <div className="text-white font-mono">{testResult.discoveredVersion}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-400">SQL Edition:</span>
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
                        <span className="text-slate-400 block mb-1.5 font-mono text-[11px]">Permission Verification:</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {testResult.permissionsChecked?.map((p, idx) => (
                            <div key={idx} className="flex items-center space-x-1.5 bg-slate-900/80 px-2 py-1 rounded border border-slate-800 text-[11px]">
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-slate-200">{p.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {!testResult.success && (
                    <div className="text-xs text-rose-300 mt-2">
                      Error details: {testResult.message}
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
                      Instance <strong className="text-white font-mono">{serverAddress.split('.')[0].toUpperCase()}</strong> will be added to the monitored inventory. Baseline statistical models will begin immediately.
                    </div>
                  </div>
                  <span className="text-emerald-400 font-mono text-xs font-bold">Health Initial: 96/100</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-300 pt-2 border-t border-slate-800">
                  <div>Role: <span className="text-cyan-300 truncate block">{role}</span></div>
                  <div>Environment: <span className="text-amber-300">{environment}</span></div>
                  <div>HA: <span className="text-emerald-300">{haArchitecture}</span></div>
                  <div>Databases: <span className="text-white">{databasesInput.split(',').length} DBs</span></div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Step {activeStep} of 3
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
                    handleRunDiscoveryTest();
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
                <span>{isSubmitting ? 'Registering...' : 'Register SQL Server Asset'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
