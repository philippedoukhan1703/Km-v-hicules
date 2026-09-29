import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Vehicle, TeamId } from '../types.ts';
import { VehiclePlate } from './VehiclePlate.tsx';
import { X, Camera, RefreshCw, AlertCircle, Search, Car, HelpCircle, Smartphone, Upload } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  onVehicleIdentified: (vehicle: Vehicle) => void;
  selectedTeam: TeamId | 'ALL';
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  onVehicleIdentified,
  selectedTeam,
}) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'camera' | 'search'>('camera');
  const [searchQuery, setSearchQuery] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerContainerId = 'qr-reader-container';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    if (activeTab === 'camera') {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, activeTab]);

  const handleScanSuccess = (decodedText: string) => {
    if (navigator?.vibrate) {
      try { navigator.vibrate(25); } catch {}
    }

    let targetId = decodedText.trim();
    try {
      if (targetId.includes('?')) {
        const url = new URL(targetId, window.location.origin);
        const scanParam = url.searchParams.get('scan') || url.searchParams.get('vehicle');
        if (scanParam) {
          targetId = scanParam;
        }
      }
    } catch {
      // not a url
    }

    const matched = vehicles.find(
      v => v.id.toLowerCase() === targetId.toLowerCase() ||
           v.code.toLowerCase() === targetId.toLowerCase() ||
           v.immatriculation.replace(/-/g, '').toLowerCase() === targetId.replace(/-/g, '').toLowerCase()
    );

    if (matched) {
      stopScanner();
      onVehicleIdentified(matched);
    } else {
      setCameraError(`Code QR reconnu (${targetId}), mais aucun véhicule correspondant dans la flotte.`);
    }
  };

  const startScanner = async () => {
    setCameraError(null);
    setIsScanning(true);

    try {
      await new Promise(r => setTimeout(r, 120));
      const element = document.getElementById(scannerContainerId);
      if (!element) return;

      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 12,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {}
      );
    } catch (err: unknown) {
      console.warn('Camera scan not available:', err);
      setCameraError(
        'Accès caméra direct non autorisé. Sur iPhone, utilisez le bouton "Prendre en photo" ci-dessous ou l’appareil photo natif.'
      );
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  // Decode from file/photo taken by iPhone camera
  const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode('qr-file-decoder');
      const decoded = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      handleScanSuccess(decoded);
    } catch (err) {
      console.warn('Failed to decode QR code from photo:', err);
      setCameraError('Impossible de lire le QR code sur la photo. Rapprochez-vous du code ou choisissez le véhicule dans la liste.');
    }
  };

  if (!isOpen) return null;

  const filteredVehicles = vehicles.filter(v => {
    const matchesTeam = selectedTeam === 'ALL' || v.equipe === selectedTeam;
    if (!matchesTeam) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.immatriculation.toLowerCase().includes(q) ||
      v.modele.toLowerCase().includes(q) ||
      v.marque.toLowerCase().includes(q) ||
      v.code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92dvh] flex flex-col pb-[env(safe-area-inset-bottom,16px)]">
        {/* iOS Drag Handle on Mobile */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="bg-[#0f2b48] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="font-bold text-base leading-tight">Relever un Véhicule RTE</h2>
              <p className="text-[11px] text-sky-200">Scan QR Code ou sélection tactile</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden container for file decoding */}
        <div id="qr-file-decoder" className="hidden" />

        {/* Hidden iOS Camera file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileCapture}
          className="hidden"
        />

        {/* Tab switchers: Caméra vs Sélection manuelle */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1.5 shrink-0">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'camera'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-4 h-4 text-sky-600" />
            <span>Scanner Caméra</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'search'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-4 h-4 text-sky-600" />
            <span>Sélection ({vehicles.length})</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto flex-1">
          {/* Tab 1: Live Camera Scanner */}
          {activeTab === 'camera' && (
            <div className="p-4 flex flex-col items-center space-y-3">
              {/* iPhone native tip */}
              <div className="w-full bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-950 flex items-start gap-2.5">
                <Smartphone className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Astuce iPhone :</span>
                  <p className="text-[11px] text-sky-900 mt-0.5 leading-snug">
                    Vous pouvez scanner le QR Code directement avec l'application <strong>Appareil photo</strong> de votre iPhone ! Un bandeau Safari s’affiche pour ouvrir directement la fiche du véhicule.
                  </p>
                </div>
              </div>

              {/* Viewfinder box */}
              <div className="w-full max-w-xs relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 aspect-square flex items-center justify-center shadow-inner">
                <div id={scannerContainerId} className="w-full h-full" />

                {!isScanning && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mb-2 text-sky-400" />
                    <span className="text-xs">Activation de la caméra iPhone...</span>
                  </div>
                )}
              </div>

              {/* Native iOS Photo Capture button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-xs flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-colors shadow-xs"
              >
                <Camera className="w-4 h-4 text-sky-400" />
                <span>Prendre le QR Code en photo (iPhone)</span>
              </button>

              {cameraError && (
                <div className="w-full max-w-xs p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">Scanner flux direct non accessible</p>
                    <p className="mt-0.5 text-[11px]">{cameraError}</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setActiveTab('search')}
                className="text-xs font-semibold text-sky-700 hover:text-sky-900 underline decoration-sky-300 py-1"
              >
                Ou choisir manuellement le véhicule dans la liste →
              </button>
            </div>
          )}

          {/* Tab 2: Quick Search and Select Fallback */}
          {activeTab === 'search' && (
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher immatriculation, modèle, équipe..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 focus:bg-white"
                  autoFocus
                />
              </div>

              <div className="space-y-2 pr-1">
                {filteredVehicles.map(veh => (
                  <button
                    key={veh.id}
                    onClick={() => {
                      stopScanner();
                      onVehicleIdentified(veh);
                    }}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 transition-all flex items-center justify-between group active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-sky-100 group-hover:text-sky-700 transition-colors shrink-0">
                        <Car className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <VehiclePlate immatriculation={veh.immatriculation} size="sm" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            {veh.equipe}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 mt-1 line-clamp-1">
                          {veh.marque} {veh.modele}
                        </p>
                      </div>
                    </div>

                    <div className="text-right pl-2 shrink-0">
                      <span className="font-mono text-xs font-bold text-slate-900 block">
                        {veh.currentKm.toLocaleString('fr-FR')} km
                      </span>
                      <span className="text-[11px] text-sky-600 font-bold group-hover:underline">
                        Relever →
                      </span>
                    </div>
                  </button>
                ))}

                {filteredVehicles.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Aucun véhicule trouvé pour cette recherche.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

