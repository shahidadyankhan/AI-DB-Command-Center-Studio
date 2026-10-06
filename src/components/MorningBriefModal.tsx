import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  TrendingUp, 
  Moon, 
  Wrench, 
  Bot, 
  Briefcase,
  RefreshCw
} from 'lucide-react';
import { MorningBriefing, RecommendationItem } from '../types/dba';

interface MorningBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  briefing: MorningBriefing;
  onRequestApproval: (rec: RecommendationItem) => void;
}

export const MorningBriefModal: React.FC<MorningBriefModalProps> = ({
  isOpen,
  onClose,
  briefing,
  onRequestApproval
}) => {
  const [activeBrief, setActiveBrief] = useState<MorningBriefing>(briefing);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setActiveBrief(briefing);
  }, [briefing]);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/dba/briefing', { method: 'POST' });
      const data = await res.json();
      setActiveBrief(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sun className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-bold text-white">
                  AI DBA Morning Operational Briefing
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                  Section 20 Standard
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Daily Proactive Assessment Generated: {activeBrief.generatedAt || 'Today 08:00 UTC'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer flex items-center space-x-1"
              title="Regenerate Briefing with Live Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content: 8 Specific Briefing Sections (Section 20 of Prompt) */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          
          {/* Executive Overview Banner */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 leading-relaxed">
            <span className="text-cyan-400 font-mono text-[11px] block font-bold mb-1">GLOBAL ESTATE SUMMARY:</span>
            {activeBrief.healthSummary}
          </div>

          {/* Grid of Status Categories */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1. Healthy Systems */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase font-mono">
                <CheckCircle2 className="w-4 h-4" />
                <span>🟢 Healthy Systems</span>
              </div>
              <ul className="space-y-2 text-slate-300 text-[11px]">
                {activeBrief.healthySystems?.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-1.5">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 2. Watch Items */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase font-mono">
                <AlertTriangle className="w-4 h-4" />
                <span>🟡 Watch (Emerging)</span>
              </div>
              <div className="space-y-2 text-[11px]">
                {activeBrief.watchItems?.map((w, idx) => (
                  <div key={idx} className="bg-slate-900 p-2 rounded border border-slate-800/80">
                    <strong className="text-amber-300 block">{w.server}: {w.issue}</strong>
                    <span className="text-slate-400">{w.trend}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Action Required */}
            <div className="bg-slate-950 border border-rose-900/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs uppercase font-mono">
                <Flame className="w-4 h-4" />
                <span>🔴 Action Required</span>
              </div>
              <div className="space-y-2 text-[11px]">
                {activeBrief.actionRequiredItems?.map((a, idx) => (
                  <div key={idx} className="bg-rose-950/30 p-2 rounded border border-rose-800/40">
                    <strong className="text-rose-200 block">{a.server}: {a.issue}</strong>
                    <p className="text-rose-300/80 text-[10px] mt-0.5">{a.recommendedAction}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Emerging Trends & Overnight Events */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 4. Emerging Trends */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center space-x-2 text-cyan-400 font-bold text-xs uppercase font-mono">
                <TrendingUp className="w-4 h-4" />
                <span>📈 Emerging Trends (Section 8)</span>
              </div>
              <ul className="space-y-2 text-slate-300 text-[11px]">
                {activeBrief.emergingTrends?.map((trend, idx) => (
                  <li key={idx} className="flex items-start space-x-1.5">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span>{trend}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 5. Overnight Events */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase font-mono">
                <Moon className="w-4 h-4" />
                <span>🚨 Overnight Events & Jobs</span>
              </div>
              <ul className="space-y-2 text-slate-300 text-[11px]">
                {activeBrief.overnightEvents?.map((evt, idx) => (
                  <li key={idx} className="flex items-start space-x-1.5">
                    <span className="text-indigo-400 font-bold">•</span>
                    <span>{evt}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Automation Opportunities & Management Attention */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 6. Automation Opportunities */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center space-x-2 text-purple-400 font-bold text-xs uppercase font-mono">
                <Bot className="w-4 h-4" />
                <span>🤖 Safe Automation Opportunities</span>
              </div>
              <ul className="space-y-2 text-slate-300 text-[11px]">
                {activeBrief.automationOpportunities?.map((auto, idx) => (
                  <li key={idx} className="flex items-start space-x-1.5">
                    <span className="text-purple-400 font-bold">•</span>
                    <span>{auto}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 7. Management Attention */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs uppercase font-mono">
                <Briefcase className="w-4 h-4" />
                <span>👔 Management Attention Required</span>
              </div>
              <ul className="space-y-2 text-slate-300 text-[11px]">
                {activeBrief.managementAttention?.map((mgmt, idx) => (
                  <li key={idx} className="flex items-start space-x-1.5">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>{mgmt}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
