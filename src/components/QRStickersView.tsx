import React, { useEffect, useState, useMemo } from 'react';
import QRCode from 'qrcode';
import { Vehicle, TeamId } from '../types.ts';
import { VehiclePlate } from './VehiclePlate.tsx';
import {
  Printer,
  QrCode,
  ExternalLink,
  Check,
  Car,
  Search,
  CheckSquare,
  Square,
  Layers,
  Tag,
  FileText,
  Filter,
  Eye,
  Info,
  X
} from 'lucide-react';

interface QRStickersViewProps {
  vehicles: Vehicle[];
  onSelectVehicleToRecord: (vehicle: Vehicle) => void;
  selectedTeam: TeamId | 'ALL';
}

interface QRCardData {
  vehicle: Vehicle;
  dataUrl: string;
  scanUrl: string;
}

export type StickerFormat = 'CARDS' | 'MINI_TAGS';

export const QRStickersView: React.FC<QRStickersViewProps> = ({
  vehicles,
  onSelectVehicleToRecord,
  selectedTeam,
}) => {
  const [qrItems, setQrItems] = useState<QRCardData[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [stickerFormat, setStickerFormat] = useState<StickerFormat>('CARDS');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<TeamId | 'ALL'>(selectedTeam);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<string>>(new Set());
  const [singlePrintId, setSinglePrintId] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Sync team filter if prop changes
  useEffect(() => {
    setTeamFilter(selectedTeam);
  }, [selectedTeam]);

  // Generate QR codes for all vehicles
  useEffect(() => {
    let isMounted = true;
    const baseUrl = window.location.origin + window.location.pathname;

    async function generateCodes() {
      const items: QRCardData[] = [];
      for (const veh of vehicles) {
        const scanUrl = `${baseUrl}?scan=${encodeURIComponent(veh.code || veh.id)}`;
        try {
          const dataUrl = await QRCode.toDataURL(scanUrl, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 360,
            color: {
              dark: '#0f2b48',
              light: '#ffffff'
            }
          });
          items.push({ vehicle: veh, dataUrl, scanUrl });
        } catch (err) {
          console.error('Error generating QR for', veh.id, err);
        }
      }
      if (isMounted) {
        setQrItems(items);
        // By default, select all vehicles for print
        setSelectedVehicleIds(new Set(vehicles.map(v => v.id)));
      }
    }

    generateCodes();
    return () => {
      isMounted = false;
    };
  }, [vehicles]);

  // Filtered items based on team filter and search query
  const visibleItems = useMemo(() => {
    return qrItems.filter(item => {
      const v = item.vehicle;
      if (teamFilter !== 'ALL' && v.equipe !== teamFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const immat = v.immatriculation.toLowerCase();
        const code = v.code.toLowerCase();
        const model = `${v.marque} ${v.modele}`.toLowerCase();
        if (!immat.includes(q) && !code.includes(q) && !model.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [qrItems, teamFilter, searchQuery]);

  // Items to print (all selected, or single vehicle if requested)
  const itemsToPrint = useMemo(() => {
    if (singlePrintId) {
      return qrItems.filter(item => item.vehicle.id === singlePrintId);
    }
    return visibleItems.filter(item => selectedVehicleIds.has(item.vehicle.id));
  }, [qrItems, visibleItems, selectedVehicleIds, singlePrintId]);

  // Selection toggle
  const handleToggleSelect = (vehicleId: string) => {
    const next = new Set(selectedVehicleIds);
    if (next.has(vehicleId)) {
      next.delete(vehicleId);
    } else {
      next.add(vehicleId);
    }
    setSelectedVehicleIds(next);
  };

  const handleSelectAllVisible = () => {
    const next = new Set(selectedVehicleIds);
    visibleItems.forEach(item => next.add(item.vehicle.id));
    setSelectedVehicleIds(next);
  };

  const handleDeselectAllVisible = () => {
    const next = new Set(selectedVehicleIds);
    visibleItems.forEach(item => next.delete(item.vehicle.id));
    setSelectedVehicleIds(next);
  };

  // Print all selected
  const handlePrintSelected = () => {
    setSinglePrintId(null);
    setShowPrintPreview(true);
  };

  // Print a single vehicle
  const handlePrintSingle = (vehicleId: string) => {
    setSinglePrintId(vehicleId);
    setShowPrintPreview(true);
  };

  const handleCopyLink = (item: QRCardData) => {
    navigator.clipboard.writeText(item.scanUrl);
    setCopiedId(item.vehicle.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Print Controls - Hidden during print */}
      <div className="no-print bg-[#0f2b48] text-white rounded-2xl p-6 shadow-md border border-slate-700 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              <QrCode className="w-4 h-4" />
              <span>Impression & Signalétique Flotte RTE · GMR Var</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">Étiquettes & Fiches QR Code</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Imprimez les fiches pour le pare-soleil, le tableau de bord ou la pochette de bord de chaque véhicule.
              Les conducteurs scannent le QR Code au retour de prêt avec leur smartphone pour enregistrer leur kilométrage.
            </p>
          </div>

          {/* Main Print Action Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrintSelected}
              disabled={itemsToPrint.length === 0}
              className={`flex items-center gap-2 font-bold px-5 py-3 rounded-xl text-sm transition-all shadow-md active:scale-98 ${
                itemsToPrint.length > 0
                  ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 ring-2 ring-sky-300'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Printer className="w-5 h-5" />
              <span>Imprimer la sélection ({itemsToPrint.length})</span>
            </button>
          </div>
        </div>

        {/* Toolbar: Format Selector & Selection Controls */}
        <div className="pt-4 border-t border-slate-700/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Format Selector */}
          <div className="bg-[#091a2d] p-1 rounded-xl border border-slate-700 flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setStickerFormat('CARDS')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                stickerFormat === 'CARDS'
                  ? 'bg-sky-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Fiches Pare-soleil (A5/A6)</span>
            </button>
            <button
              type="button"
              onClick={() => setStickerFormat('MINI_TAGS')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                stickerFormat === 'MINI_TAGS'
                  ? 'bg-sky-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Mini-Stickers Adhésifs</span>
            </button>
          </div>

          {/* Search & Team Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filtrer immat, modèle, code..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#091a2d] text-white placeholder-slate-400 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <select
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value as any)}
              className="text-xs font-semibold bg-[#091a2d] text-white border border-slate-700 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">Toutes équipes</option>
              <option value="ESCAILLON">Escaillon</option>
              <option value="LES ARCS">Les Arcs</option>
            </select>
          </div>

          {/* Multi-Selection Checkbox Helpers */}
          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
              >
                Tout cocher
              </button>
              <button
                type="button"
                onClick={handleDeselectAllVisible}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
              >
                Tout décocher
              </button>
            </div>
            <span className="text-sky-300 font-mono text-[11px]">
              {selectedVehicleIds.size} / {vehicles.length} cochés
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINT-ONLY OFFICIAL HEADER */}
      {/* ========================================================================= */}
      <div className="print-only mb-6 border-b-2 border-slate-900 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#0f2b48] text-white flex items-center justify-center font-black text-sm">
              RTE
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-900 uppercase">
                Réseau de Transport d'Électricité · GMR Var
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Signalétique Véhicules & Planches QR Code · {stickerFormat === 'CARDS' ? 'Fiches Pare-soleil / Pochette' : 'Stickers Tableau de bord'}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Édition : <strong>{new Date().toLocaleDateString('fr-FR')}</strong></div>
            <div>Véhicules imprimés : <strong>{itemsToPrint.length}</strong></div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DISPLAY & PRINT CONTENT ACCORDING TO FORMAT */}
      {/* ========================================================================= */}

      {/* FORMAT 1: DETAILED CARDS (Fiches Pare-soleil / Pochette de bord) */}
      {stickerFormat === 'CARDS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
          {visibleItems.map(item => {
            const v = item.vehicle;
            const isEscaillon = v.equipe === 'ESCAILLON';
            const isSelected = selectedVehicleIds.has(v.id);
            const isHiddenBySingle = singlePrintId !== null && singlePrintId !== v.id;

            return (
              <div
                key={v.id}
                className={`bg-white rounded-2xl border-2 transition-all overflow-hidden ${
                  isSelected ? 'border-slate-300 shadow-sm' : 'border-slate-200 opacity-60'
                } ${
                  isHiddenBySingle ? 'print:hidden' : 'print:block'
                } print:border-2 print:border-slate-900 print:shadow-none print-break-inside-avoid print:opacity-100 print:rounded-xl`}
              >
                {/* Sticker Header resembling official utility sheet */}
                <div
                  className={`p-4 border-b ${
                    isEscaillon ? 'bg-[#0f2b48] text-white' : 'bg-[#1b4332] text-white'
                  } print:bg-slate-900 print:text-white`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Checkbox for selection */}
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(v.id)}
                        className="no-print p-0.5 rounded hover:bg-white/20 text-white"
                        title={isSelected ? 'Désélectionner pour l’impression' : 'Sélectionner pour l’impression'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-sky-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>

                      <span className="font-mono text-xs uppercase tracking-wider opacity-90">RTE Flotte</span>
                      <span className="opacity-50">·</span>
                      <span className="font-bold text-xs tracking-wide uppercase">
                        Équipe {v.equipe}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/15 uppercase tracking-widest font-bold">
                        {v.code}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-base leading-tight">{v.marque} {v.modele}</h3>
                      <p className="text-xs opacity-80 mt-0.5">
                        {v.type === 'VL' && 'Véhicule Léger'}
                        {v.type === 'UTILITAIRE' && 'Fourgon Atelier'}
                        {v.type === '4X4' && 'Tout-terrain 4x4 Pylônes'}
                        {v.type === 'ENGIN' && 'Nacelle / Engin Spécialisé'}
                        {v.hasHourMeter && ' · Compteur Horaire'}
                        {v.centreDeCout && ` · ${v.centreDeCout}`}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <VehiclePlate immatriculation={v.immatriculation} size="sm" />
                    </div>
                  </div>
                </div>

                {/* Main Sticker Body */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                  {/* QR Code Frame */}
                  <div className="shrink-0 bg-white p-2.5 border-2 border-slate-200 rounded-xl shadow-2xs flex flex-col items-center print:border-slate-800">
                    <img
                      src={item.dataUrl}
                      alt={`QR Code ${v.immatriculation}`}
                      className="w-36 h-36 object-contain"
                    />
                    <span className="text-[10px] font-mono font-bold text-slate-700 mt-1 uppercase">
                      Scan direct · {v.code}
                    </span>
                  </div>

                  {/* Instructions & Metadata */}
                  <div className="flex-1 w-full text-center sm:text-left">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                      <span>📱 Consigne au retour de mission</span>
                    </div>

                    <ol className="text-xs text-slate-700 mt-2.5 space-y-1.5 list-decimal list-inside text-left leading-relaxed">
                      <li>
                        <strong>Scannez ce QR Code</strong> avec l'appareil photo du smartphone RTE.
                      </li>
                      <li>
                        Indiquez votre nom et le <strong>kilométrage d'arrivée</strong>.
                      </li>
                      <li>
                        Le bilan du 20 du mois se synchronise <strong>automatiquement</strong>.
                      </li>
                    </ol>

                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Dernier index connu :</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {v.currentKm.toLocaleString('fr-FR')} km
                        </span>
                      </div>
                      {v.hasHourMeter && v.currentHours !== undefined && (
                        <div className="flex items-center justify-between">
                          <span>Compteur horaire :</span>
                          <span className="font-mono font-bold text-slate-900">
                            {v.currentHours} h
                          </span>
                        </div>
                      )}
                      {v.emplacement && (
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Stationnement habituel :</span>
                          <span className="font-medium text-slate-700">{v.emplacement}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Actions - Hidden during print */}
                <div className="no-print bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(item)}
                      className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors px-2 py-1 rounded hover:bg-slate-200/60"
                      title="Copier le lien direct de scan"
                    >
                      {copiedId === v.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">Lien copié !</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Lien</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => onSelectVehicleToRecord(v)}
                      className="text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-200/60"
                      title="Tester la saisie comme au retour de prêt"
                    >
                      <Car className="w-3.5 h-3.5" />
                      <span>Tester</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handlePrintSingle(v.id)}
                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-2xs"
                    title="Imprimer uniquement cette fiche A4"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimer cette fiche</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FORMAT 2: MINI STICKERS (Stickers Adhésifs pour Tableau de bord & Porte-clés) */}
      {stickerFormat === 'MINI_TAGS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:grid-cols-3 print:gap-3">
          {visibleItems.map(item => {
            const v = item.vehicle;
            const isEscaillon = v.equipe === 'ESCAILLON';
            const isSelected = selectedVehicleIds.has(v.id);
            const isHiddenBySingle = singlePrintId !== null && singlePrintId !== v.id;

            return (
              <div
                key={v.id}
                className={`bg-white rounded-xl border-2 transition-all overflow-hidden ${
                  isSelected ? 'border-slate-300 shadow-2xs' : 'border-slate-200 opacity-60'
                } ${
                  isHiddenBySingle ? 'print:hidden' : 'print:block'
                } print:border-2 print:border-slate-900 print:shadow-none print-break-inside-avoid print:opacity-100`}
              >
                {/* Header compact */}
                <div
                  className={`px-3 py-2 border-b flex items-center justify-between ${
                    isEscaillon ? 'bg-[#0f2b48] text-white' : 'bg-[#1b4332] text-white'
                  } print:bg-slate-900 print:text-white`}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(v.id)}
                      className="no-print p-0.5 rounded hover:bg-white/20 text-white"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-300" />
                      )}
                    </button>
                    <span className="font-black text-xs">RTE</span>
                    <span className="text-[10px] uppercase font-mono opacity-80">· {v.equipe}</span>
                  </div>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/20">
                    {v.code}
                  </span>
                </div>

                {/* Sticker Content */}
                <div className="p-3 flex items-center gap-3">
                  <div className="shrink-0 bg-white p-1 border border-slate-300 rounded shadow-2xs print:border-slate-800">
                    <img
                      src={item.dataUrl}
                      alt={`QR Code ${v.immatriculation}`}
                      className="w-20 h-20 object-contain"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-black text-xs text-slate-900 tracking-wider">
                      {v.immatriculation}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-700 truncate">
                      {v.marque} {v.modele}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                      {v.currentKm.toLocaleString('fr-FR')} km
                    </div>
                    <div className="text-[9px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded font-bold inline-block mt-1 print:border print:border-slate-400">
                      SCAN RETOUR PRÊT
                    </div>
                  </div>
                </div>

                {/* Print button on each mini-tag */}
                <div className="no-print px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">{v.type}</span>
                  <button
                    onClick={() => handlePrintSingle(v.id)}
                    className="text-sky-600 hover:text-sky-900 font-bold flex items-center gap-1"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Imprimer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info notice at the bottom */}
      <div className="no-print bg-sky-50 text-sky-950 p-4 rounded-xl border border-sky-200 flex items-start gap-3 text-xs">
        <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Conseils pour l'impression des étiquettes :</span>
          <p className="mt-0.5 text-sky-800">
            Pour un résultat optimal, utilisez du papier plastifié adhésif pour le tableau de bord, ou glissez la feuille découpée sous la pochette transparente de pare-soleil.
            Le QR Code utilise le niveau de correction d'erreur maximal (H) garantissant une lecture rapide même si l'étiquette est froissée ou salie.
          </p>
        </div>
      </div>

      {/* Print Preview A4 Modal */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-start p-2 sm:p-6 overflow-y-auto">
          {/* Top Control Bar */}
          <div className="sticky top-0 z-10 bg-slate-900 text-white rounded-xl px-6 py-3 shadow-xl mb-4 flex items-center justify-between w-full max-w-4xl border border-slate-700">
            <div className="flex items-center gap-3">
              <Printer className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="font-bold text-sm sm:text-base">Aperçu Avant Impression · Fiches QR Code</h3>
                <p className="text-[11px] text-slate-400">
                  {stickerFormat === 'CARDS' ? 'Fiches Pare-soleil / Pochette (A5/A6)' : 'Mini-Stickers Adhésifs'} · {itemsToPrint.length} fiches sélectionnées
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs px-4 py-2 rounded-lg transition-all shadow-md cursor-pointer"
                title="Lancer l'impression ou l'enregistrement en PDF"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer / Enregistrer en PDF</span>
              </button>

              <button
                onClick={() => {
                  setShowPrintPreview(false);
                  setSinglePrintId(null);
                }}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Fermer</span>
              </button>
            </div>
          </div>

          {/* A4 Paper Container */}
          <div className="bg-white text-slate-900 rounded-lg shadow-2xl p-8 sm:p-12 w-full max-w-[210mm] min-h-[297mm] mx-auto border border-slate-300 font-sans space-y-6">
            {/* Official Header */}
            <div className="border-b-2 border-slate-900 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded bg-[#0f2b48] text-white flex items-center justify-center font-black text-sm">
                    RTE
                  </div>
                  <div>
                    <h1 className="text-base font-black tracking-tight text-slate-900 uppercase">
                      Réseau de Transport d'Électricité · GMR Var
                    </h1>
                    <p className="text-xs text-slate-600 font-medium">
                      Signalétique Véhicules & Fiches QR Code · {stickerFormat === 'CARDS' ? 'Fiches Pare-soleil / Pochette' : 'Stickers Tableau de bord'}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>Édition : <strong>{new Date().toLocaleDateString('fr-FR')}</strong></div>
                  <div>Total fiches : <strong>{itemsToPrint.length}</strong></div>
                </div>
              </div>
            </div>

            {/* Grid of items */}
            {stickerFormat === 'CARDS' ? (
              <div className="grid grid-cols-2 gap-4">
                {itemsToPrint.map(item => {
                  const v = item.vehicle;
                  const isEscaillon = v.equipe === 'ESCAILLON';
                  return (
                    <div key={v.id} className="bg-white rounded-xl border-2 border-slate-900 overflow-hidden shadow-none">
                      <div className={`p-3 border-b ${isEscaillon ? 'bg-[#0f2b48]' : 'bg-[#1b4332]'} text-white`}>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs uppercase tracking-wider">RTE Flotte · Équipe {v.equipe}</span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/20 font-bold">{v.code}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div>
                            <h3 className="font-extrabold text-sm">{v.marque} {v.modele}</h3>
                            <p className="text-[10px] opacity-80">{v.type}</p>
                          </div>
                          <VehiclePlate immatriculation={v.immatriculation} size="sm" />
                        </div>
                      </div>

                      <div className="p-3 flex items-center gap-3">
                        <div className="shrink-0 bg-white p-2 border border-slate-300 rounded-lg flex flex-col items-center">
                          <img src={item.dataUrl} alt={`QR ${v.immatriculation}`} className="w-28 h-28 object-contain" />
                          <span className="text-[9px] font-mono font-bold text-slate-700 mt-0.5">{v.code}</span>
                        </div>
                        <div className="flex-1 text-xs text-slate-700 space-y-1">
                          <div className="font-bold text-slate-900 text-[11px]">📱 Consigne retour de mission :</div>
                          <ol className="list-decimal list-inside space-y-0.5 text-[10px]">
                            <li>Scannez le QR Code avec le smartphone.</li>
                            <li>Indiquez l'équipe, l'agent et les kilomètres d'arrivée.</li>
                          </ol>
                          <div className="pt-2 border-t text-[10px] text-slate-600 font-mono">
                            <div>Index M-1 : {v.currentKm.toLocaleString('fr-FR')} km</div>
                            {v.emplacement && <div>Park : {v.emplacement}</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {itemsToPrint.map(item => {
                  const v = item.vehicle;
                  const isEscaillon = v.equipe === 'ESCAILLON';
                  return (
                    <div key={v.id} className="bg-white rounded-xl border-2 border-slate-900 overflow-hidden shadow-none p-2.5">
                      <div className={`px-2 py-1 rounded mb-2 flex items-center justify-between text-white text-[11px] font-bold ${isEscaillon ? 'bg-[#0f2b48]' : 'bg-[#1b4332]'}`}>
                        <span>RTE · {v.equipe}</span>
                        <span className="font-mono">{v.code}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <img src={item.dataUrl} alt={`QR ${v.immatriculation}`} className="w-16 h-16 object-contain shrink-0" />
                        <div className="min-w-0">
                          <div className="font-mono font-black text-xs">{v.immatriculation}</div>
                          <div className="text-[10px] text-slate-700 truncate">{v.marque} {v.modele}</div>
                          <div className="text-[9px] text-sky-800 font-bold mt-1">SCAN RETOUR PRÊT</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
