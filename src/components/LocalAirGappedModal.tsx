import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  X, 
  Terminal, 
  Server, 
  Cpu, 
  Check, 
  Copy, 
  RefreshCw, 
  ExternalLink, 
  Radio, 
  AlertTriangle,
  Lock,
  ArrowRight,
  Database,
  Sparkles,
  Zap,
  Globe
} from 'lucide-react';
import { LlmProviderConfig } from '../types/dba';

interface LocalAirGappedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated?: (config: LlmProviderConfig) => void;
}

export const LocalAirGappedModal: React.FC<LocalAirGappedModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'guide' | 'docker'>('config');
  const [provider, setProvider] = useState<'ollama' | 'gemini'>('ollama');
  const [ollamaUrl, setOllamaUrl] = useState<string>('http://localhost:11434');
  const [selectedModel, setSelectedModel] = useState<string>('qwen2.5-coder:32b');
  const [customModel, setCustomModel] = useState<string>('');
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    online: boolean;
    latencyMs?: number;
    models?: string[];
    message?: string;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Fetch current server LLM configuration
  useEffect(() => {
    if (isOpen) {
      fetch('/api/dba/llm-provider')
        .then(res => res.json())
        .then((data: LlmProviderConfig) => {
          setProvider(data.currentProvider);
          if (data.ollamaBaseUrl) setOllamaUrl(data.ollamaBaseUrl);
          if (data.ollamaModel) setSelectedModel(data.ollamaModel);
          if (data.ollamaOnline !== undefined) {
            setTestResult({
              online: !!data.ollamaOnline,
              latencyMs: data.latencyMs,
              models: data.availableOllamaModels || [],
            });
          }
        })
        .catch(err => console.warn('Failed to load LLM config:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/dba/test-ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ollamaUrl }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.models && data.models.length > 0 && !data.models.includes(selectedModel)) {
        // If current model not in list, auto-select first available
        setSelectedModel(data.models[0]);
      }
    } catch (err: any) {
      setTestResult({
        online: false,
        message: err.message || 'Network connection failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const finalModel = customModel.trim() ? customModel.trim() : selectedModel;
      const res = await fetch('/api/dba/llm-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          ollamaBaseUrl: ollamaUrl,
          ollamaModel: finalModel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        if (onConfigUpdated) {
          onConfigUpdated({
            currentProvider: provider,
            ollamaBaseUrl: ollamaUrl,
            ollamaModel: finalModel,
            geminiAvailable: true,
            isAirGapped: provider === 'ollama',
            ollamaOnline: testResult?.online,
            availableOllamaModels: testResult?.models,
          });
        }
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const recommendedModels = [
    {
      id: 'qwen2.5-coder:32b',
      name: 'Qwen 2.5 Coder (32B)',
      tagline: 'Best for T-SQL syntax, execution plan diffs & DMV correlation',
      specs: 'Requires ~20 GB VRAM or 32 GB RAM',
      pullCmd: 'ollama pull qwen2.5-coder:32b',
      recommended: true,
    },
    {
      id: 'llama3.3:70b',
      name: 'Llama 3.3 (70B)',
      tagline: 'Enterprise-grade reasoning for complex incident commander RCAs',
      specs: 'Requires ~42 GB VRAM (Dual GPU / Mac Studio)',
      pullCmd: 'ollama pull llama3.3:70b',
      recommended: false,
    },
    {
      id: 'deepseek-r1:14b',
      name: 'DeepSeek R1 Distill (14B)',
      tagline: 'Deep chain-of-thought diagnostics with low memory footprint',
      specs: 'Requires ~10 GB VRAM / 16 GB RAM',
      pullCmd: 'ollama pull deepseek-r1:14b',
      recommended: false,
    },
    {
      id: 'llama3.1:8b',
      name: 'Llama 3.1 (8B)',
      tagline: 'Ultra-fast lightweight model for development or laptops',
      specs: 'Requires ~6 GB VRAM / 8 GB RAM',
      pullCmd: 'ollama pull llama3.1:8b',
      recommended: false,
    },
  ];

  const dockerComposeContent = `version: '3.8'

services:
  # 1. AI DBA Command Center On-Premise Application
  ai-dba-command-center:
    image: node:20-alpine
    container_name: ai_dba_command_center
    restart: unless-stopped
    working_dir: /app
    volumes:
      - .:/app
    environment:
      - PORT=3000
      - LLM_PROVIDER=ollama
      - OLLAMA_BASE_URL=http://ollama-service:11434
      - OLLAMA_MODEL=qwen2.5-coder:32b
    ports:
      - "3000:3000"
    command: sh -c "npm install && npm run build && npm start"
    depends_on:
      - ollama-service
    networks:
      - private-dba-net

  # 2. Local Ollama LLM Service (100% Air-Gapped)
  ollama-service:
    image: ollama/ollama:latest
    container_name: ollama_dba_engine
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_models:/root/.ollama
    # If running with NVIDIA GPU acceleration:
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: all
    #           capabilities: [gpu]
    networks:
      - private-dba-net

networks:
  private-dba-net:
    driver: bridge
    # For strict air-gapped zero internet egress:
    # internal: true

volumes:
  ollama_models:
`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md shadow-emerald-500/10">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Local Server & Air-Gapped Ollama Settings
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Zero Data Egress
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Keep all SQL Server telemetry, query text, and database metadata inside your private network.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 border-b border-slate-800 bg-slate-950 flex space-x-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'config'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>LLM Provider & Ollama Connection</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'guide'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Local Server Setup Guide</span>
          </button>

          <button
            onClick={() => setActiveTab('docker')}
            className={`py-3 border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'docker'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Air-Gapped Docker Compose</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* TAB 1: CONFIGURATION */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              
              {/* Privacy Guarantee Banner */}
              <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-xl p-4 flex items-start space-x-3 text-xs text-emerald-200">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-emerald-300">
                    100% Private On-Premise Guarantee (Zero Egress)
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    When configured to use <strong>Ollama</strong>, all LLM reasoning, T-SQL script generation, wait stat correlations, and root cause analyses occur exclusively on your private hardware (via localhost or your internal LAN). No connection strings, query texts, or database metrics ever touch external public cloud APIs.
                  </p>
                </div>
              </div>

              {/* Provider Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Select Active AI Engine Provider
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  
                  {/* Local Ollama Option */}
                  <div 
                    onClick={() => setProvider('ollama')}
                    className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      provider === 'ollama'
                        ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`p-2 rounded-lg ${provider === 'ollama' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'}`}>
                          <Server className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">Ollama (Local / Air-Gapped)</div>
                          <div className="text-[11px] text-emerald-400 font-mono">100% Private • On-Premise</div>
                        </div>
                      </div>
                      <Radio className={`w-4 h-4 ${provider === 'ollama' ? 'text-emerald-400' : 'text-slate-600'}`} />
                    </div>
                    <p className="text-xs text-slate-400 mt-3">
                      Runs locally on your server or workstation using open-weight models (Qwen 2.5 Coder, Llama 3.3, DeepSeek R1). No telemetry leaves your firewall.
                    </p>
                  </div>

                  {/* Cloud Gemini Option */}
                  <div 
                    onClick={() => setProvider('gemini')}
                    className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      provider === 'gemini'
                        ? 'bg-blue-950/40 border-cyan-500 shadow-md shadow-blue-950'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`p-2 rounded-lg ${provider === 'gemini' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'}`}>
                          <Globe className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">Google Gemini Cloud API</div>
                          <div className="text-[11px] text-cyan-400 font-mono">gemini-3.8-flash</div>
                        </div>
                      </div>
                      <Radio className={`w-4 h-4 ${provider === 'gemini' ? 'text-cyan-400' : 'text-slate-600'}`} />
                    </div>
                    <p className="text-xs text-slate-400 mt-3">
                      High-throughput cloud reasoning via Gemini 3.8 Flash SDK. Requires internet access and valid GEMINI_API_KEY environment variable.
                    </p>
                  </div>

                </div>
              </div>

              {/* Ollama Connection Settings (If Ollama Selected) */}
              {provider === 'ollama' && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                      Local Ollama Endpoint & Model Selection
                    </h4>

                    {/* Live Test Status Badge */}
                    {testResult && (
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
                        testResult.online
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${testResult.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                        {testResult.online 
                          ? `Ollama Online (${testResult.latencyMs}ms, ${testResult.models?.length || 0} models)` 
                          : 'Ollama Unreachable'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* URL Input */}
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-xs text-slate-300 font-medium">Ollama Base URL</label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={ollamaUrl}
                          onChange={(e) => setOllamaUrl(e.target.value)}
                          placeholder="http://localhost:11434"
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={handleTestConnection}
                          disabled={isTesting}
                          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-emerald-400' : ''}`} />
                          <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Default: <code>http://localhost:11434</code> (or <code>http://host.docker.internal:11434</code> if running inside Docker).
                      </p>
                    </div>

                    {/* Model Select */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-300 font-medium">Active Model</label>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      >
                        {testResult?.models && testResult.models.length > 0 ? (
                          testResult.models.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))
                        ) : (
                          <>
                            <option value="qwen2.5-coder:32b">qwen2.5-coder:32b (Recommended)</option>
                            <option value="llama3.3:70b">llama3.3:70b</option>
                            <option value="deepseek-r1:14b">deepseek-r1:14b</option>
                            <option value="llama3.1:8b">llama3.1:8b</option>
                          </>
                        )}
                      </select>
                      <p className="text-[11px] text-slate-500">
                        Select an installed Ollama model
                      </p>
                    </div>
                  </div>

                  {/* Recommended Models Grid */}
                  <div className="space-y-2 pt-2">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Recommended Models for SQL Server Operations:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {recommendedModels.map((m) => (
                        <div 
                          key={m.id}
                          onClick={() => setSelectedModel(m.id)}
                          className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                            selectedModel === m.id
                              ? 'bg-emerald-950/30 border-emerald-500/80 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-xs flex items-center gap-1.5">
                              {m.name}
                              {m.recommended && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                                  Top Pick
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{m.tagline}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{m.specs}</div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(m.pullCmd, m.id);
                            }}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-300"
                            title="Copy pull command"
                          >
                            {copiedSnippet === m.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* Save & Apply Action */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="text-xs text-slate-400">
                  {saveSuccess && (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-4 h-4" /> Configuration applied successfully!
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={isSaving}
                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>{isSaving ? 'Applying...' : 'Apply & Save Configuration'}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: STEP-BY-STEP SETUP GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-6 text-xs text-slate-300">
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  How to Run AI DBA Command Center on Your Local Server (Windows / Linux)
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  Follow these 4 simple steps to run the complete agent stack inside your private data center or local workstation with zero cloud dependencies.
                </p>
              </div>

              {/* Step 1 */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-500/30">1</span>
                  <span className="font-bold text-white text-sm">Install Ollama on Your Local Host</span>
                </div>
                <p className="text-slate-400 ml-7">
                  Download and install Ollama for your operating system:
                </p>
                <div className="ml-7 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-300 flex items-center justify-between">
                  <span># Linux / macOS install script:<br />curl -fsSL https://ollama.com/install.sh | sh</span>
                  <button 
                    onClick={() => copyToClipboard('curl -fsSL https://ollama.com/install.sh | sh', 'step1')}
                    className="p-1 hover:text-white"
                  >
                    {copiedSnippet === 'step1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 ml-7">
                  For Windows Server, download the official installer directly from <a href="https://ollama.com/download/windows" target="_blank" rel="noreferrer" className="text-cyan-400 underline">ollama.com/download/windows</a>.
                </p>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-500/30">2</span>
                  <span className="font-bold text-white text-sm">Download the Recommended DBA Model</span>
                </div>
                <p className="text-slate-400 ml-7">
                  Pull <code>qwen2.5-coder:32b</code> (or <code>llama3.1:8b</code> if you have limited RAM/VRAM):
                </p>
                <div className="ml-7 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-300 flex items-center justify-between">
                  <span>ollama pull qwen2.5-coder:32b</span>
                  <button 
                    onClick={() => copyToClipboard('ollama pull qwen2.5-coder:32b', 'step2')}
                    className="p-1 hover:text-white"
                  >
                    {copiedSnippet === 'step2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-500/30">3</span>
                  <span className="font-bold text-white text-sm">Configure Environment Variables</span>
                </div>
                <p className="text-slate-400 ml-7">
                  Create a <code>.env</code> file in the application directory:
                </p>
                <div className="ml-7 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 flex items-center justify-between">
                  <pre className="text-emerald-300">{`LLM_PROVIDER="ollama"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="qwen2.5-coder:32b"
PORT=3000`}</pre>
                  <button 
                    onClick={() => copyToClipboard(`LLM_PROVIDER="ollama"\nOLLAMA_BASE_URL="http://localhost:11434"\nOLLAMA_MODEL="qwen2.5-coder:32b"\nPORT=3000`, 'step3')}
                    className="p-1 hover:text-white"
                  >
                    {copiedSnippet === 'step3' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step 4 */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-500/30">4</span>
                  <span className="font-bold text-white text-sm">Start the AI DBA Command Center</span>
                </div>
                <p className="text-slate-400 ml-7">
                  Build and start the application server:
                </p>
                <div className="ml-7 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-300 flex items-center justify-between">
                  <span>npm install && npm run build && npm start</span>
                  <button 
                    onClick={() => copyToClipboard('npm install && npm run build && npm start', 'step4')}
                    className="p-1 hover:text-white"
                  >
                    {copiedSnippet === 'step4' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-emerald-400 font-mono ml-7 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Your agent is now active at http://localhost:3000 with 100% private on-premise AI reasoning!
                </p>
              </div>

            </div>
          )}

          {/* TAB 3: DOCKER COMPOSE */}
          {activeTab === 'docker' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-sm">Air-Gapped Docker Compose Deployment</h4>
                  <p className="text-slate-400 text-xs">
                    Run the Command Center + Ollama together in an isolated private container network.
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(dockerComposeContent, 'docker')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 font-medium transition cursor-pointer"
                >
                  {copiedSnippet === 'docker' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSnippet === 'docker' ? 'Copied YAML!' : 'Copy docker-compose.yml'}</span>
                </button>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-96">
                <pre>{dockerComposeContent}</pre>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Start stack with: <strong className="text-white font-mono">docker compose up -d</strong></span>
                <span>Pull model inside container: <strong className="text-white font-mono">docker exec -it ollama_dba_engine ollama pull qwen2.5-coder:32b</strong></span>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
