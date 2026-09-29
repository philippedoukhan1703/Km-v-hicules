import React from 'react';
import { TeamId } from '../types.ts';
import {
  Car,
  Calendar,
  History,
  QrCode,
  Settings,
  Camera,
  Layers,
  Sparkles,
  Zap,
  ShieldCheck,
  Printer
} from 'lucide-react';

export type ActiveNavTab = 'fleet' | 'monthly' | 'history' | 'stickers' | 'config';

interface NavbarProps {
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  selectedTeam: TeamId | 'ALL';
  onSelectTeam: (team: TeamId | 'ALL') => void;
  onOpenScanner: () => void;
  pendingRelevesCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  selectedTeam,
  onSelectTeam,
  onOpenScanner,
  pendingRelevesCount = 0,
}) => {
  return (
    <>
      {/* Top Bar for Desktop and Mobile Header */}
      <header className="no-print bg-[#0f2b48] text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
            {/* RTE Brand */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-sky-500 flex items-center justify-center text-slate-950 font-black shadow-xs">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-slate-950" />
              </div>

              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-black text-sm sm:text-base tracking-tight text-white">RTE Flotte</span>
                  <span className="text-[9px] sm:text-[10px] uppercase font-mono tracking-wider text-sky-400 bg-sky-950/80 px-1.5 py-0.2 rounded border border-sky-800/60">
                    GMR Var
                  </span>
                </div>
                <p className="text-[10px] text-sky-200/70 hidden sm:block">
                  Kms Véhicules & Heures Engins · Escaillon & Les Arcs
                </p>
              </div>
            </div>

            {/* Team Switcher Filter Buttons */}
            <div className="flex items-center bg-[#091a2d] p-1 rounded-xl border border-slate-700/80 text-xs">
              <button
                onClick={() => onSelectTeam('ALL')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedTeam === 'ALL'
                    ? 'bg-sky-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Toutes
              </button>
              <button
                onClick={() => onSelectTeam('ESCAILLON')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedTeam === 'ESCAILLON'
                    ? 'bg-sky-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                ESCAILLON
              </button>
              <button
                onClick={() => onSelectTeam('LES ARCS')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedTeam === 'LES ARCS'
                    ? 'bg-sky-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                LES ARCS
              </button>
            </div>

            {/* Desktop Scanner Button & Admin Tag */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#091a2d] border border-indigo-900/60 text-indigo-200 text-xs">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Admin base : <strong className="text-white font-semibold">Philippe DOUKHAN</strong> <span className="text-indigo-300 text-[11px]">(Technicien)</span></span>
              </div>

              <button
                onClick={onOpenScanner}
                className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs sm:text-sm font-bold px-3.5 sm:px-4 py-2 rounded-xl transition-all shadow-sm active:scale-98"
              >
                <Camera className="w-4 h-4" />
                <span>Scanner QR</span>
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Sub-Bar */}
        <nav className="hidden sm:block bg-[#0b2138] border-t border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2 no-scrollbar text-xs">
              <button
                onClick={() => onSelectTab('fleet')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'fleet'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>Parc Véhicules</span>
              </button>

              <button
                onClick={() => onSelectTab('monthly')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors relative ${
                  activeTab === 'monthly'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Relevé du 20 & SharePoint</span>
                {pendingRelevesCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                )}
              </button>

              <button
                onClick={() => onSelectTab('history')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'history'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Historique Prêts</span>
              </button>

              <button
                onClick={() => onSelectTab('stickers')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'stickers'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer QR Codes</span>
              </button>

              <button
                onClick={() => onSelectTab('config')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'config'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configuration</span>
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* iOS iPhone Bottom Tab Bar */}
      <div className="no-print fixed bottom-0 inset-x-0 bg-[#0f2b48]/95 backdrop-blur-lg border-t border-slate-800 z-40 pb-[env(safe-area-inset-bottom,12px)] sm:hidden shadow-2xl">
        <div className="grid grid-cols-5 items-center h-14 px-1">
          {/* 1. Véhicules */}
          <button
            onClick={() => onSelectTab('fleet')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'fleet' ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Car className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Flotte</span>
          </button>

          {/* 2. Relevé 20 */}
          <button
            onClick={() => onSelectTab('monthly')}
            className={`flex flex-col items-center justify-center h-full transition-colors relative ${
              activeTab === 'monthly' ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Calendar className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Relevé 20</span>
            {pendingRelevesCount > 0 && (
              <span className="absolute top-2 right-4 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          {/* 3. Central Scanner QR button */}
          <button
            onClick={onOpenScanner}
            className="flex flex-col items-center justify-center -mt-4"
          >
            <div className="w-12 h-12 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center shadow-lg border-2 border-[#0f2b48] active:scale-95 transition-transform">
              <Camera className="w-6 h-6" />
            </div>
            <span className="text-[9px] font-bold text-sky-300 mt-0.5">Scanner</span>
          </button>

          {/* 4. Historique */}
          <button
            onClick={() => onSelectTab('history')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'history' ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <History className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Trajets</span>
          </button>

          {/* 5. Paramètres / QR */}
          <button
            onClick={() => onSelectTab('config')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'config' || activeTab === 'stickers' ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Settings className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Réglages</span>
          </button>
        </div>
      </div>
    </>
  );
};
