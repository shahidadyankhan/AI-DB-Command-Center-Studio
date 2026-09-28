import React from 'react';
import { 
  History, 
  X, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Award, 
  TrendingUp, 
  DollarSign, 
  FileText 
} from 'lucide-react';
import { AuditLogEntry } from '../types/dba';

interface AuditLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs: AuditLogEntry[];
}

export const AuditLogDrawer: React.FC<AuditLogDrawerProps> = ({
  isOpen,
  onClose,
  auditLogs
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-2xl h-full flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-slate-800 text-cyan-400 border border-slate-700">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">
                  Enterprise Auditability & Agent Observability
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Section 25 & 26
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cryptographic immutable execution log with before/after state verification.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 26: AI DBA Value Score Banner */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-slate-200 flex items-center gap-1.5 font-mono">
              <Award className="w-4 h-4 text-amber-400" />
              <span>AI DBA VALUE SCORE (Section 26 KPI Engine)</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold font-mono">
              96.4 Index
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Hours Saved YTD</span>
              <strong className="text-cyan-400">184.5 Hours</strong>
            </div>
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Prevented Incidents</span>
              <strong className="text-emerald-400">12 Outages</strong>
            </div>
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-slate-400 block text-[10px]">MTTR Reduction</span>
              <strong className="text-purple-400">-76% MTTR</strong>
            </div>
          </div>
        </div>

        {/* Audit Log Timeline (Section 25) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
            <span>Audit Trail Entries ({auditLogs.length})</span>
            <span>Immutable Traceability</span>
          </div>

          <div className="space-y-3">
            {auditLogs.map((entry) => (
              <div key={entry.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-white text-xs">{entry.id}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                      {entry.safetyLevel}
                    </span>
                    <span className="text-emerald-400 font-mono text-[10px] font-bold">
                      {entry.status}
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono text-[10px]">{entry.timestamp}</span>
                </div>

                <div className="text-sm font-bold text-cyan-300 font-mono">
                  {entry.action}
                </div>

                <div className="text-slate-300 text-[11px]">
                  <strong>Reason:</strong> {entry.reason}
                </div>

                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-850 font-mono text-[10px] space-y-1">
                  <div>
                    <span className="text-slate-500">Target:</span> {entry.server} • {entry.database}
                  </div>
                  <div>
                    <span className="text-slate-500">Approved By:</span> {entry.approvalBy}
                  </div>
                  <div className="text-rose-300">
                    <span className="text-slate-500">Before:</span> {entry.beforeState}
                  </div>
                  <div className="text-emerald-300">
                    <span className="text-slate-500">After:</span> {entry.afterState}
                  </div>
                  <div className="text-cyan-300">
                    <span className="text-slate-500">Validation:</span> {entry.validation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
