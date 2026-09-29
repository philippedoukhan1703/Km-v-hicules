import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X, Smartphone, Check } from 'lucide-react';

export const IPhoneInstallBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);

  useEffect(() => {
    // Detect iOS
    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Check if already in standalone PWA mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    const dismissed = localStorage.getItem('rte_ios_prompt_dismissed');

    setIsIosDevice(isIos);
    if (isIos && !isStandalone && !dismissed) {
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('rte_ios_prompt_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="no-print bg-gradient-to-r from-sky-900 to-[#0f2b48] text-white p-3.5 rounded-2xl border border-sky-400/30 shadow-lg relative animate-in fade-in slide-in-from-top-2 duration-300">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-slate-300 hover:text-white rounded-full bg-white/10"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0 border border-sky-400/40 mt-0.5">
          <Smartphone className="w-5 h-5" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Installer l'application sur votre iPhone
            </h4>
            <span className="text-[10px] bg-sky-500 text-slate-950 font-black px-1.5 py-0.2 rounded font-mono">
              iOS
            </span>
          </div>

          <p className="text-[11px] text-sky-100 leading-snug">
            Pour un accès direct sur le terrain sans réouvrir Safari :
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[11px] text-sky-200 bg-black/20 p-2 rounded-xl">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="w-4 h-4 rounded-full bg-sky-400 text-slate-950 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
              <span>Touchez</span>
              <Share className="w-3.5 h-3.5 text-sky-300 inline" />
              <strong>Partager</strong>
              <span className="text-slate-400 text-[10px]">(en bas de Safari)</span>
            </div>

            <span className="hidden sm:inline text-sky-400">→</span>

            <div className="flex items-center gap-1.5 font-medium">
              <span className="w-4 h-4 rounded-full bg-sky-400 text-slate-950 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
              <span>Choisissez</span>
              <PlusSquare className="w-3.5 h-3.5 text-sky-300 inline" />
              <strong>"Sur l'écran d'accueil"</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
