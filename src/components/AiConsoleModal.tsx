import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Terminal, 
  Layers, 
  ArrowRight,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';
import { DbaAgentResponse, RecommendationItem } from '../types/dba';

interface AiConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  onRequestApproval: (rec: RecommendationItem) => void;
}

export const AiConsoleModal: React.FC<AiConsoleModalProps> = ({
  isOpen,
  onClose,
  initialPrompt,
  onRequestApproval
}) => {
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [selectedMode, setSelectedMode] = useState<string>('dba');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ role: 'user' | 'agent'; text?: string; response?: DbaAgentResponse }>>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const presetQueries = [
    'Show me unhealthy SQL Servers.',
    'Why is SQL-PROD-01 experiencing high blocking?',
    'Which databases are likely to have performance problems next month?',
    'Find queries causing the most CPU.',
    'Prepare an RCA for Incident INC-4092.',
    'What can I safely automate right now?',
    'What should I worry about tomorrow?',
  ];

  useEffect(() => {
    if (initialPrompt && isOpen) {
      setPrompt(initialPrompt);
      handleSendQuery(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  if (!isOpen) return null;

  const handleSendQuery = async (queryText?: string) => {
    const textToSend = queryText || prompt;
    if (!textToSend.trim() || isLoading) return;

    const userEntry = { role: 'user' as const, text: textToSend };
    setHistory(prev => [...prev, userEntry]);
    setPrompt('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/dba/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          mode: selectedMode,
        }),
      });

      const data: DbaAgentResponse = await res.json();
      setHistory(prev => [...prev, { role: 'agent', response: data }]);
    } catch (err: any) {
      console.error(err);
      setHistory(prev => [...prev, { role: 'agent', text: 'Error connecting to AI DBA Engine: ' + err.message }]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">
                  AI DBA Operational Intelligence Console
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Gemini 3.8 Flash • Section 28 Schema
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Natural Language Command Engine with Evidence-First Verification
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 font-mono focus:outline-none"
            >
              <option value="dba">Mode B: Senior DBA</option>
              <option value="executive">Mode A: Executive</option>
              <option value="incident">Mode C: Incident</option>
              <option value="performance">Mode D: Performance</option>
              <option value="predictive">Mode E: Predictive</option>
              <option value="change-review">Mode F: CAB Review</option>
            </select>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          
          {history.length === 0 && (
            <div className="py-8 text-center space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                <Terminal className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  Senior SQL Server DBA Agent Ready
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Ask natural language questions about your database estate. Responses strictly follow Section 28: Finding, Evidence, Analysis, Risk, Recommendations, Safety Gate, and Validation.
                </p>
              </div>

              {/* Preset Chips */}
              <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                {presetQueries.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendQuery(q)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] transition text-left cursor-pointer"
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {history.map((msg, idx) => (
            <div key={idx} className="space-y-2">
              {msg.role === 'user' ? (
                <div className="flex items-start justify-end space-x-2">
                  <div className="bg-cyan-600/30 border border-cyan-500/40 text-cyan-100 p-3 rounded-2xl max-w-xl text-xs">
                    {msg.text}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-2">
                  <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>

                  {msg.response ? (
                    /* Strict Section 28 Response Card */
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 max-w-4xl space-y-4 shadow-xl">
                      
                      {/* Top Finding & Confidence (Section 29) */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-white flex items-center gap-1.5">
                            <span className="text-base">🔎</span>
                            <span>Finding:</span>
                          </span>
                        </div>

                        {/* Confidence Metric */}
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                            msg.response.confidence?.level === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            msg.response.confidence?.level === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            Confidence: {msg.response.confidence?.level} ({msg.response.confidence?.pct}%)
                          </span>
                        </div>
                      </div>

                      {/* Finding Text */}
                      <p className="text-sm text-slate-100 font-semibold leading-relaxed">
                        {msg.response.finding}
                      </p>

                      {/* 📊 Evidence */}
                      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-850 space-y-1.5">
                        <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                          <span>📊</span>
                          <span>Observable Evidence (sys.dm_os_wait_stats, Query Store, DMVs):</span>
                        </span>
                        <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px]">
                          {msg.response.evidence?.map((ev, i) => (
                            <li key={i} className="font-mono text-cyan-200/90">{ev}</li>
                          ))}
                        </ul>
                      </div>

                      {/* 🧠 Analysis */}
                      <div className="space-y-1 text-xs">
                        <span className="font-bold text-slate-200 flex items-center gap-1.5">
                          <span>🧠</span>
                          <span>Correlation & Technical Reasoning:</span>
                        </span>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          {msg.response.analysis}
                        </p>
                      </div>

                      {/* ⚠️ Risk */}
                      {msg.response.risk && (
                        <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-rose-300 flex items-center gap-1.5">
                              <span>⚠️</span>
                              <span>Risk Score: {msg.response.risk.score}/100 ({msg.response.risk.level})</span>
                            </span>
                            <span className="text-[10px] font-mono text-rose-400">Risk Engine P4</span>
                          </div>
                          <p className="text-rose-200/90 text-[11px]">
                            {msg.response.risk.businessImpact}
                          </p>
                        </div>
                      )}

                      {/* 🎯 Recommendations */}
                      {msg.response.recommendations?.length > 0 && (
                        <div className="space-y-2">
                          <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                            <span>🎯</span>
                            <span>Prioritized Recommendations & Safety Gates:</span>
                          </span>

                          <div className="space-y-2">
                            {msg.response.recommendations.map((rec) => (
                              <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold text-white text-xs">{rec.title}</span>
                                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                                      rec.safetyLevel === 'RED' ? 'bg-rose-500 text-white' :
                                      rec.safetyLevel === 'AMBER' ? 'bg-amber-500 text-slate-950' :
                                      'bg-emerald-500 text-white'
                                    }`}>
                                      {rec.safetyLevel} GATE
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-cyan-400 font-mono">{rec.targetServer}</span>
                                </div>

                                <p className="text-slate-300 text-[11px]">{rec.why}</p>

                                <div className="text-[11px] text-emerald-400">
                                  <strong>Expected Benefit:</strong> {rec.expectedBenefit}
                                </div>

                                {rec.sqlScript && (
                                  <div className="bg-slate-950 p-2 rounded font-mono text-cyan-200 text-[11px]">
                                    {rec.sqlScript}
                                  </div>
                                )}

                                <div className="pt-2 flex justify-end">
                                  <button
                                    onClick={() => {
                                      onClose();
                                      onRequestApproval(rec);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs transition cursor-pointer flex items-center space-x-1"
                                  >
                                    <span>Execute with Safety Gate ({rec.safetyLevel})</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 🤖 Automation & 👤 Approval & ✅ Validation */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-850">
                          <strong className="text-slate-300 block mb-1">🤖 Automation:</strong>
                          <span className="text-slate-400">{msg.response.automation}</span>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-850">
                          <strong className="text-slate-300 block mb-1">👤 Approval:</strong>
                          <span className="text-amber-400">{msg.response.approval?.reason}</span>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-850">
                          <strong className="text-slate-300 block mb-1">✅ Validation:</strong>
                          <span className="text-emerald-400">{msg.response.validation}</span>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-slate-300 text-xs">
                      {msg.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono p-3 bg-slate-950 border border-slate-800 rounded-xl w-max">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>AI DBA Agent correlating live telemetry snapshot...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-900 flex items-center space-x-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendQuery()}
            placeholder="Ask AI DBA: 'Why is SQL-PROD-01 slow?' or 'Find queries causing the most CPU'..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => handleSendQuery()}
            disabled={isLoading || !prompt.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 shadow-md shadow-cyan-600/30"
          >
            <span>Execute</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
