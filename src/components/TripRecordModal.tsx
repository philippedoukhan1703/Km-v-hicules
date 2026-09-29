import React, { useState, useEffect, useMemo } from 'react';
import { Vehicle, Agent, Trip } from '../types.ts';
import { VehiclePlate } from './VehiclePlate.tsx';
import {
  Check,
  X,
  Gauge,
  Fuel,
  MapPin,
  FileText,
  AlertTriangle,
  User,
  Clock,
  CheckCircle2,
  Plus,
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface TripRecordModalProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  trips?: Trip[];
  onSaveTrip: (tripData: Omit<Trip, 'id' | 'createdAt' | 'kmParcourus' | 'statut'>) => Promise<void>;
  onOpenAgentModal?: () => void;
  onResolveAnomaly?: (vehicleId: string) => Promise<void>;
}

const COMMON_MOTIFS = [
  'Dépannage / Incident réseau',
  'Visite de poste / Ligne électrique',
  'Travaux programmés / Chantier',
  'Maintenance périodique',
  'Liaison inter-bases (Escaillon - Les Arcs)',
  'Formation / Réunion technique',
  'Autre déplacement'
];

export const TripRecordModal: React.FC<TripRecordModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  agents,
  trips = [],
  onSaveTrip,
  onOpenAgentModal,
  onResolveAnomaly,
}) => {
  const currentKm = vehicle?.currentKm ?? 0;

  // Active anomaly on this vehicle if any
  const activeAnomaly = useMemo(() => {
    if (!vehicle) return null;
    const vehTrips = trips.filter(
      t => t.vehicleId === vehicle.id && t.anomalieSignalee && t.anomalieSignalee.trim().length > 0
    );
    if (vehTrips.length > 0) {
      vehTrips.sort(
        (a, b) => new Date(b.dateRetour || b.createdAt).getTime() - new Date(a.dateRetour || a.createdAt).getTime()
      );
      return {
        text: vehTrips[0].anomalieSignalee!,
        agentName: vehTrips[0].agentName,
        date: vehTrips[0].dateRetour || vehTrips[0].createdAt
      };
    }
    if (
      vehicle.notes &&
      (vehicle.notes.toLowerCase().includes('voyant') ||
        vehicle.notes.toLowerCase().includes('pneu') ||
        vehicle.notes.toLowerCase().includes('anomalie') ||
        vehicle.notes.toLowerCase().includes('alerte'))
    ) {
      return {
        text: vehicle.notes,
        agentName: 'Conducteur précédent',
        date: vehicle.updatedAt
      };
    }
    return null;
  }, [vehicle, trips]);

  // Entry mode: 'TOTAL_KM' (odometer total) or 'DISTANCE_TRIP' (km driven)
  const [inputMode, setInputMode] = useState<'TOTAL_KM' | 'DISTANCE_TRIP'>('TOTAL_KM');
  const [kmInputStr, setKmInputStr] = useState<string>('');
  const [deltaKmInputStr, setDeltaKmInputStr] = useState<string>('');

  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [motif, setMotif] = useState<string>(COMMON_MOTIFS[0]);
  const [destination, setDestination] = useState<string>('');
  const [heuresFinStr, setHeuresFinStr] = useState<string>('');
  const [carburantFin, setCarburantFin] = useState<string>('Plein');
  const [anomalieSignalee, setAnomalieSignalee] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ kmDelta: number; newKm: number; agentName: string } | null>(null);

  // Filter agents by team
  const primaryTeamAgents = vehicle ? agents.filter(a => a.active && a.equipe === vehicle.equipe) : [];
  const alternants = agents.filter(a => a.active && a.equipe === 'MIXTE');
  const otherTeamAgents = vehicle ? agents.filter(a => a.active && a.equipe !== vehicle.equipe && a.equipe !== 'MIXTE') : [];

  // Parse numeric values cleanly (supporting spaces, French dots/commas)
  const cleanNumber = (val: string): number | null => {
    if (!val || val.trim() === '') return null;
    const cleaned = val.replace(/\s/g, '').replace(/,/g, '.');
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  };

  // Calculate parsed final KM based on mode
  const parsedKmFin = useMemo((): number | null => {
    if (inputMode === 'TOTAL_KM') {
      return cleanNumber(kmInputStr);
    } else {
      const delta = cleanNumber(deltaKmInputStr);
      if (delta === null) return null;
      return currentKm + delta;
    }
  }, [inputMode, kmInputStr, deltaKmInputStr, currentKm]);

  // Distance calculated
  const kmDifference = parsedKmFin !== null ? parsedKmFin - currentKm : 0;
  const isKmValid = parsedKmFin !== null && parsedKmFin >= currentKm;

  // Detect if user in TOTAL_KM mode accidentally entered distance traveled instead of total odometer
  const isSuspectedDeltaInTotalMode = useMemo(() => {
    if (inputMode !== 'TOTAL_KM') return false;
    const typed = cleanNumber(kmInputStr);
    if (typed === null || typed <= 0) return false;
    return typed < currentKm && typed <= 2000 && currentKm > 5000;
  }, [inputMode, kmInputStr, currentKm]);

  // Selected agent object
  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  // Initialize form when opened or vehicle changes
  useEffect(() => {
    if (!vehicle || !isOpen) return;

    // Default to total current km
    setKmInputStr(String(vehicle.currentKm));
    setDeltaKmInputStr('');
    setInputMode('TOTAL_KM');
    setHeuresFinStr(vehicle.currentHours !== undefined ? String(vehicle.currentHours) : '');
    setSuccessData(null);
    setErrorMessage(null);
    setAnomalieSignalee('');
    setDestination('');

    // Par défaut, aucun conducteur n'est présélectionné : l'agent doit explicitement choisir son nom
    setSelectedAgentId('');
  }, [vehicle, isOpen]);

  if (!isOpen || !vehicle) return null;

  // Quick addition buttons
  const handleQuickAddKm = (addKm: number) => {
    if (navigator?.vibrate) {
      try { navigator.vibrate(15); } catch {}
    }

    if (inputMode === 'TOTAL_KM') {
      const current = cleanNumber(kmInputStr) ?? currentKm;
      const nextKm = Math.max(currentKm, current + addKm);
      setKmInputStr(String(nextKm));
    } else {
      const currentDelta = cleanNumber(deltaKmInputStr) ?? 0;
      setDeltaKmInputStr(String(currentDelta + addKm));
    }
  };

  // Convert suspected delta to total odometer
  const handleConvertDeltaToTotal = () => {
    const delta = cleanNumber(kmInputStr) || 0;
    const newTotal = currentKm + delta;
    setKmInputStr(String(newTotal));
    if (navigator?.vibrate) {
      try { navigator.vibrate(25); } catch {}
    }
  };

  // Save selection
  const handleAgentChange = (newId: string) => {
    setSelectedAgentId(newId);
    if (errorMessage && newId) {
      setErrorMessage(null);
    }
  };

  // Form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    // Validation checks with clear messages
    if (!selectedAgentId || !selectedAgent) {
      setErrorMessage("⚠️ Veuillez SÉLECTIONNER le conducteur dans la liste avant de valider.");
      return;
    }

    if (parsedKmFin === null) {
      setErrorMessage("Veuillez renseigner un kilométrage valide.");
      return;
    }

    if (parsedKmFin < currentKm) {
      setErrorMessage(
        `Le nouveau kilométrage (${parsedKmFin.toLocaleString('fr-FR')} km) ne peut pas être inférieur au départ (${currentKm.toLocaleString('fr-FR')} km).`
      );
      return;
    }

    if (navigator?.vibrate) {
      try { navigator.vibrate([20, 40, 20]); } catch {}
    }

    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const parsedHours = cleanNumber(heuresFinStr);

      const tripData: Omit<Trip, 'id' | 'createdAt' | 'kmParcourus' | 'statut'> = {
        vehicleId: vehicle.id,
        vehicleImmat: vehicle.immatriculation,
        vehicleName: `${vehicle.marque} ${vehicle.modele}`,
        equipe: vehicle.equipe,
        agentId: selectedAgent.id,
        agentName: `${selectedAgent.prenom} ${selectedAgent.nom}`,
        agentRole: selectedAgent.role,
        dateDepart: now,
        dateRetour: now,
        kmDepart: currentKm,
        kmFin: parsedKmFin,
        heuresDepart: vehicle.currentHours,
        heuresFin: parsedHours !== null ? parsedHours : undefined,
        motif: motif.trim() || 'Mission RTE',
        destination: destination.trim() || `Secteur ${vehicle.equipe}`,
        carburantFin: carburantFin || undefined,
        anomalieSignalee: anomalieSignalee.trim() || undefined,
        releveMode: 'QR_CODE'
      };

      await onSaveTrip(tripData);

      setSuccessData({
        kmDelta: kmDifference,
        newKm: parsedKmFin,
        agentName: `${selectedAgent.prenom} ${selectedAgent.nom}`
      });
    } catch (err: any) {
      console.error('Error saving trip:', err);
      setErrorMessage(
        err?.message || "Erreur lors de l'enregistrement. Vos données sont conservées, veuillez réessayer."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[96dvh] flex flex-col">
        {/* iOS Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="bg-[#0f2b48] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 shrink-0">
              <Gauge className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono tracking-wider text-sky-300 font-bold">Validation Smartphone</span>
                <span className="text-xs opacity-50">·</span>
                <span className="text-xs font-black uppercase text-white tracking-wide">Équipe {vehicle.equipe}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black mt-0.5 leading-snug truncate">
                {vehicle.marque} {vehicle.modele}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0 ml-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Vehicle plate & baseline reading header */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <VehiclePlate immatriculation={vehicle.immatriculation} size="md" />
            <span className="text-xs sm:text-sm text-slate-700 font-mono font-black hidden xs:inline">{vehicle.code}</span>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs text-slate-500 uppercase tracking-wider block font-bold">Index départ</span>
            <span className="font-mono text-sm sm:text-base font-black text-slate-950">
              {currentKm.toLocaleString('fr-FR')} km
            </span>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-4">
          {successData ? (
            /* SUCCESS CONFIRMATION SCREEN */
            <div className="py-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-950">Kilométrage validé avec succès !</h3>
                <p className="text-sm text-slate-600 mt-1.5 max-w-md mx-auto">
                  Le compteur de <strong>{vehicle.immatriculation}</strong> est maintenant mis à jour à :
                </p>
                <div className="mt-2.5 text-3xl sm:text-4xl font-mono font-black text-emerald-800 bg-emerald-50 border-2 border-emerald-300 py-3 px-6 rounded-2xl inline-block shadow-xs">
                  {successData.newKm.toLocaleString('fr-FR')} km
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-sm mx-auto grid grid-cols-2 gap-3 text-center">
                <div className="border-r border-slate-200 pr-3">
                  <span className="text-xs text-slate-500 block font-medium">Distance mission</span>
                  <span className="font-mono text-xl font-black text-slate-950">
                    +{successData.kmDelta} km
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block font-medium">Conducteur</span>
                  <span className="text-sm font-bold text-slate-900 truncate block mt-0.5">
                    {successData.agentName}
                  </span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto bg-[#0f2b48] hover:bg-[#163961] text-white px-8 py-4 rounded-2xl text-base font-black transition-all shadow-md active:scale-98"
                >
                  Fermer & Terminer
                </button>
              </div>
            </div>
          ) : (
            /* ENTRY FORM */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error banner if validation failed */}
              {errorMessage && (
                <div className="p-3.5 bg-red-50 border-2 border-red-300 rounded-2xl text-red-900 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-150">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-bold leading-snug">{errorMessage}</div>
                </div>
              )}

              {/* ACTIVE ANOMALY ALERT: Warn the driver about previous reported issue */}
              {activeAnomaly && (
                <div className="p-3.5 bg-amber-50 border-2 border-amber-400 rounded-2xl text-amber-950 space-y-2 shadow-2xs animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-black text-amber-900">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>⚠️ Observation en cours sur ce véhicule :</span>
                    </span>
                    {onResolveAnomaly && (
                      <button
                        type="button"
                        onClick={async () => {
                          await onResolveAnomaly(vehicle.id);
                        }}
                        className="text-[11px] text-emerald-800 hover:text-emerald-950 bg-white hover:bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-300 font-black transition-colors shadow-2xs"
                        title="Marquer comme résolue si vous avez vérifié / réparé"
                      >
                        ✓ Marquer résolue
                      </button>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-black leading-snug">« {activeAnomaly.text} »</p>
                  <div className="text-[11px] text-amber-800 flex items-center justify-between">
                    <span>Signalé par : <strong>{activeAnomaly.agentName}</strong></span>
                    <span>{new Date(activeAnomaly.date).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
              )}

              {/* 1. CONDUCTEUR */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-sky-600" />
                    <span>Conducteur de la mission</span>
                  </label>
                  {onOpenAgentModal && (
                    <button
                      type="button"
                      onClick={onOpenAgentModal}
                      className="text-xs font-bold text-sky-600 hover:text-sky-800"
                    >
                      + Ajouter agent
                    </button>
                  )}
                </div>

                <select
                  value={selectedAgentId}
                  onChange={e => handleAgentChange(e.target.value)}
                  required
                  className={`w-full text-sm sm:text-base font-bold border-2 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 shadow-2xs transition-colors ${
                    !selectedAgentId
                      ? 'border-amber-400 bg-amber-50/60 text-slate-800 focus:ring-amber-500'
                      : 'border-slate-300 bg-white text-slate-950 focus:ring-sky-500'
                  }`}
                >
                  <option value="" className="text-slate-500 font-bold">
                    -- SÉLECTIONNER LE CONDUCTEUR --
                  </option>

                  {primaryTeamAgents.length > 0 && (
                    <optgroup label={`Équipe ${vehicle.equipe} (${primaryTeamAgents.length} agents)`}>
                      {primaryTeamAgents.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.nom} {a.prenom} · {a.role === 'ADMINISTRATEUR' ? 'Admin' : a.role === 'COORDONNATEUR' ? 'Coord.' : a.role} ({a.equipe})
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {alternants.length > 0 && (
                    <optgroup label={`Alternants (${alternants.length} collaborateurs - Mixte)`}>
                      {alternants.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.nom} {a.prenom} · Alternant (Mixte)
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {otherTeamAgents.length > 0 && (
                    <optgroup label={`Prêt inter-bases / Autre équipe (${otherTeamAgents.length} agents)`}>
                      {otherTeamAgents.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.nom} {a.prenom} · {a.role} ({a.equipe})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* 2. MODE SWITCHER & BIG KM INPUT (Optimized for iPhone 16) */}
              <div className="bg-sky-50/80 border-2 border-sky-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                {/* Tabs to toggle mode */}
                <div className="flex bg-sky-200/60 p-1 rounded-xl text-xs sm:text-sm font-black w-full">
                  <button
                    type="button"
                    onClick={() => setInputMode('TOTAL_KM')}
                    className={`flex-1 py-2 px-2.5 rounded-lg transition-all text-center leading-tight ${
                      inputMode === 'TOTAL_KM'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    Index Compteur Total
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('DISTANCE_TRIP');
                      if (!deltaKmInputStr && kmInputStr) {
                        const diff = Math.max(0, (cleanNumber(kmInputStr) ?? currentKm) - currentKm);
                        if (diff > 0) setDeltaKmInputStr(String(diff));
                      }
                    }}
                    className={`flex-1 py-2 px-2.5 rounded-lg transition-all text-center leading-tight ${
                      inputMode === 'DISTANCE_TRIP'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    + Distance Parcourue (+km)
                  </button>
                </div>

                {/* Input according to mode */}
                {inputMode === 'TOTAL_KM' ? (
                  /* MODE A: TOTAL ODOMETER */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm font-bold text-slate-900">
                        Nouveau kilométrage total affiché :
                      </label>
                      <span className="text-xs font-mono font-bold text-slate-600">
                        Départ : {currentKm.toLocaleString('fr-FR')} km
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={kmInputStr}
                        onChange={e => setKmInputStr(e.target.value)}
                        placeholder={String(currentKm)}
                        className={`w-full text-3xl sm:text-4xl font-mono font-black tracking-tight px-4 py-3 sm:py-3.5 pr-14 rounded-2xl border-2 bg-white focus:outline-none focus:ring-2 ${
                          parsedKmFin !== null && parsedKmFin < currentKm
                            ? 'border-red-400 text-red-600 focus:ring-red-400'
                            : 'border-slate-300 text-slate-950 focus:ring-sky-500'
                        }`}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base sm:text-lg font-black text-slate-500 font-mono">
                        km
                      </span>
                    </div>

                    {/* SMART ASSISTANT: If user typed delta like 35 instead of 48035 */}
                    {isSuspectedDeltaInTotalMode && (
                      <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-xs sm:text-sm text-amber-950 space-y-2 animate-in fade-in duration-200">
                        <div className="font-bold flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Vous avez saisi {kmInputStr} km</span>
                        </div>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          S'agit-il des kilomètres roulés lors de votre trajet ? (Le compteur actuel est à {currentKm.toLocaleString('fr-FR')} km).
                        </p>
                        <button
                          type="button"
                          onClick={handleConvertDeltaToTotal}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 px-3.5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-2xs active:scale-98"
                        >
                          <Plus className="w-4 h-4" />
                          <span>
                            Appliquer +{kmInputStr} km (Nouveau total : {(currentKm + (cleanNumber(kmInputStr) || 0)).toLocaleString('fr-FR')} km)
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* MODE B: DISTANCE DRIVEN (+km) */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm font-bold text-slate-900">
                        Nombre de kilomètres parcourus :
                      </label>
                      <span className="text-xs font-mono font-bold text-slate-600">
                        Départ : {currentKm.toLocaleString('fr-FR')} km
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={deltaKmInputStr}
                        onChange={e => setDeltaKmInputStr(e.target.value)}
                        placeholder="Ex: 45"
                        className="w-full text-3xl sm:text-4xl font-mono font-black tracking-tight px-4 py-3 sm:py-3.5 pr-20 rounded-2xl border-2 border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-950"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base sm:text-lg font-black text-emerald-600 font-mono">
                        + km
                      </span>
                    </div>
                  </div>
                )}

                {/* Quick Add Buttons for phone thumb tapping */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs text-slate-600 font-bold uppercase tracking-wider block">
                    Ajout rapide au pouce :
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[10, 20, 50, 100, 200].map(add => (
                      <button
                        key={add}
                        type="button"
                        onClick={() => handleQuickAddKm(add)}
                        className="py-2.5 px-1 bg-white hover:bg-sky-100 active:bg-sky-200 text-slate-950 font-mono font-black text-xs sm:text-sm rounded-xl border-2 border-slate-300 shadow-2xs transition-colors text-center"
                      >
                        +{add}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Distance calculation display */}
                <div className="pt-2.5 border-t border-sky-200/90 flex items-center justify-between text-xs sm:text-sm gap-2">
                  <span className="text-slate-800 font-bold">Bilan calculé :</span>
                  {parsedKmFin !== null ? (
                    kmDifference >= 0 ? (
                      <span className="font-mono font-black text-sm sm:text-base text-emerald-900 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-xl shadow-2xs truncate">
                        +{kmDifference.toLocaleString('fr-FR')} km ({parsedKmFin.toLocaleString('fr-FR')} km)
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Inférieur au départ ({kmDifference} km)
                      </span>
                    )
                  ) : (
                    <span className="text-slate-400 font-medium">En attente de saisie</span>
                  )}
                </div>
              </div>

              {/* 3. COMPTEUR HORAIRE (Si engin/nacelle) */}
              {vehicle.hasHourMeter && (
                <div className="space-y-2 bg-amber-50/70 border-2 border-amber-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Compteur horaire engin (heures)</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-slate-600">
                      Précédent : {vehicle.currentHours ?? 0} h
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={heuresFinStr}
                      onChange={e => setHeuresFinStr(e.target.value)}
                      className="w-full text-2xl font-mono font-black px-4 py-2.5 pr-20 rounded-xl border-2 border-slate-300 bg-white text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={String(vehicle.currentHours ?? 0)}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 font-mono">
                      heures
                    </span>
                  </div>
                </div>
              )}

              {/* 4. MOTIF & DESTINATION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>Motif de la mission</span>
                  </label>
                  <select
                    value={motif}
                    onChange={e => setMotif(e.target.value)}
                    className="w-full text-xs sm:text-sm font-semibold border-2 border-slate-300 rounded-xl px-3 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {COMMON_MOTIFS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span>Destination / Poste électrique</span>
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    placeholder="Ex: Poste La Farlède, Ligne 400kV..."
                    className="w-full text-xs sm:text-sm font-semibold border-2 border-slate-300 rounded-xl px-3 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* 5. CARBURANT & OBSERVATION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1">
                    <Fuel className="w-4 h-4 text-slate-500" />
                    <span>Niveau carburant / batterie</span>
                  </label>
                  <select
                    value={carburantFin}
                    onChange={e => setCarburantFin(e.target.value)}
                    className="w-full text-xs sm:text-sm font-semibold border-2 border-slate-300 rounded-xl px-3 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="Plein">Plein (100%)</option>
                    <option value="3/4">3/4 réservoir</option>
                    <option value="1/2">1/2 réservoir</option>
                    <option value="1/4">1/4 réservoir (À ravitailler)</option>
                    <option value="Batterie 80%">Batterie &gt; 80%</option>
                    <option value="Batterie 50%">Batterie ~50%</option>
                    <option value="À brancher">À brancher sur borne</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Remarque / Anomalie (optionnel)</span>
                    </label>
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Génère une alerte d'équipe
                    </span>
                  </div>

                  <input
                    type="text"
                    value={anomalieSignalee}
                    onChange={e => setAnomalieSignalee(e.target.value)}
                    placeholder="Ex: Voyant moteur allumé, pneu sous-gonflé, choc..."
                    className="w-full text-xs sm:text-sm font-semibold border-2 border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />

                  {/* Quick observation tags */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold">Exemples :</span>
                    {[
                      'Voyant allumé',
                      'Pression pneu basse',
                      'Niveau lave-glace vide',
                      'Lavage effectué',
                      'Choc carrosserie'
                    ].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setAnomalieSignalee(tag);
                          if (navigator?.vibrate) try { navigator.vibrate(10); } catch {}
                        }}
                        className="text-[10px] font-bold bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 px-2 py-0.5 rounded-md border border-slate-200 transition-colors"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* STICKY FOOTER ACTION BAR: Always accessible on mobile screen */}
        {!successData && (
          <div className="p-4 bg-white border-t border-slate-200 shrink-0 shadow-lg space-y-2">
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className={`w-full flex items-center justify-center gap-2 py-4 px-4 text-base sm:text-lg font-black rounded-2xl text-white shadow-md transition-all active:scale-98 ${
                isSubmitting
                  ? 'bg-slate-400 cursor-not-allowed'
                  : !isKmValid || !selectedAgentId
                  ? 'bg-[#0f2b48] hover:bg-[#163961] opacity-90'
                  : 'bg-emerald-600 hover:bg-emerald-500 ring-2 ring-emerald-300'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Enregistrement en cours...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="truncate">
                    Valider le kilométrage
                    {parsedKmFin !== null && ` (${parsedKmFin.toLocaleString('fr-FR')} km)`}
                  </span>
                </>
              )}
            </button>

            {!selectedAgentId ? (
              <p className="text-xs font-bold text-center text-amber-800 bg-amber-50 py-1.5 px-3 rounded-lg border border-amber-300">
                👉 Veuillez SÉLECTIONNER le conducteur ci-dessus
              </p>
            ) : !isKmValid ? (
              <p className="text-xs font-semibold text-center text-slate-600">
                Saisissez un kilométrage supérieur ou égal à {currentKm.toLocaleString('fr-FR')} km.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
