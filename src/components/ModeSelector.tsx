import React from 'react';
import { 
  Briefcase, 
  Terminal, 
  Flame, 
  Gauge, 
  LineChart, 
  GitPullRequest,
  HardDrive,
  Zap
} from 'lucide-react';
import { OperatingMode } from '../types/dba';

interface ModeSelectorProps {
  currentMode: OperatingMode;
  onSelectMode: (mode: OperatingMode) => void;
  activeIncidentCount: number;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onSelectMode,
  activeIncidentCount
}) => {
  const modes: Array<{
    id: OperatingMode;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    badge?: string;
    badgeColor?: string;
  }> = [
    {
      id: 'executive',
      label: 'Mode A: Executive',
      sublabel: 'Estate Health & Risk',
      icon: <Briefcase className="w-4 h-4" />,
    },
    {
      id: 'dba',
      label: 'Mode B: Senior DBA',
      sublabel: 'DMVs, Blocking & Waits',
      icon: <Terminal className="w-4 h-4" />,
    },
    {
      id: 'incident',
      label: 'Mode C: Incident',
      sublabel: 'Triage & Containment',
      icon: <Flame className="w-4 h-4" />,
      badge: activeIncidentCount > 0 ? `${activeIncidentCount} P1` : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'storage-anomalies',
      label: 'Storage Anomaly Engine',
      sublabel: 'Baselines & 80/90/100%',
      icon: <HardDrive className="w-4 h-4" />,
      badge: '+207% Spike',
      badgeColor: 'bg-rose-500/30 text-rose-300 border border-rose-500/40',
    },
    {
      id: 'query-regressions',
      label: 'Query Regression Checker',
      sublabel: 'Workloads & Plan Diffs',
      icon: <Zap className="w-4 h-4" />,
      badge: '+1994% Plan',
      badgeColor: 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40',
    },
    {
      id: 'performance',
      label: 'Mode D: Performance',
      sublabel: 'CPU, IO, Memory & Plans',
      icon: <Gauge className="w-4 h-4" />,
    },
    {
      id: 'predictive',
      label: 'Mode E: Predictive',
      sublabel: 'Capacity & Bottlenecks',
      icon: <LineChart className="w-4 h-4" />,
      badge: '61d Alert',
      badgeColor: 'bg-amber-500/30 text-amber-300 border border-amber-500/40',
    },
    {
      id: 'change-review',
      label: 'Mode F: Change Review',
      sublabel: 'Strict CAB & Rollback',
      icon: <GitPullRequest className="w-4 h-4" />,
    },
  ];

  return (
    <div className="bg-slate-950/80 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
        <div className="flex items-center space-x-1.5 min-w-max">
          {modes.map((m) => {
            const isActive = currentMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onSelectMode(m.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-left transition relative cursor-pointer ${
                  isActive
                    ? 'bg-cyan-950/70 border border-cyan-500/50 text-cyan-200 shadow-md shadow-cyan-950'
                    : 'bg-slate-900/60 border border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <div className={`${isActive ? 'text-cyan-400' : 'text-slate-400'}`}>
                  {m.icon}
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                    <span>{m.label}</span>
                    {m.badge && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${m.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal leading-tight">
                    {m.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
