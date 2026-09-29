import React, { useState } from 'react';
import { Vehicle, Trip, TeamId } from '../types.ts';
import { VehiclePlate } from './VehiclePlate.tsx';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Wrench, ArrowRight, ShieldCheck } from 'lucide-react';

interface ActiveAlertsBannerProps {
  vehicles: Vehicle[];
  trips: Trip[];
  selectedTeam: TeamId | 'ALL';
  onSelectVehicle: (vehicle: Vehicle) => void;
  onResolveAnomaly: (vehicleId: string) => Promise<void>;
}

export interface ActiveAlertItem {
  vehicle: Vehicle;
  text: string;
  agentName: string;
  date: string;
  tripId?: string;
}

export const ActiveAlertsBanner: React.FC<ActiveAlertsBannerProps> = ({
  vehicles,
  trips,
  selectedTeam,
  onSelectVehicle,
  onResolveAnomaly,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Compute active anomalies for vehicles
  const activeAlerts: ActiveAlertItem[] = React.useMemo(() => {
    const list: ActiveAlertItem[] = [];

    // Filter vehicles by team if needed
    const filteredVehicles = selectedTeam === 'ALL'
      ? vehicles
      : vehicles.filter(v => v.equipe === selectedTeam);

    filteredVehicles.forEach(veh => {
      // 1. Look for latest trip with anomalieSignalee
      const vehTrips = trips.filter(t => t.vehicleId === veh.id && t.anomalieSignalee && t.anomalieSignalee.trim().length > 0);
      if (vehTrips.length > 0) {
        // Sort descending by date
        vehTrips.sort((a, b) => new Date(b.dateRetour || b.createdAt).getTime() - new Date(a.dateRetour || a.createdAt).getTime());
        const latestTrip = vehTrips[0];
        list.push({
          vehicle: veh,
          text: latestTrip.anomalieSignalee!,
          agentName: latestTrip.agentName,
          date: latestTrip.dateRetour || latestTrip.createdAt,
          tripId: latestTrip.id
        });
      } else if (veh.notes && veh.notes.trim().length > 0) {
        // Check if notes contains an anomaly keyword
        const n = veh.notes.toLowerCase();
        const isAnomalyKeyword = n.includes('voyant') || n.includes('pneu') || n.includes('choc') ||
          n.includes('fuite') || n.includes('panne') || n.includes('anomalie') || n.includes('probl') ||
          n.includes('lave-glace') || n.includes('bruit') || n.includes('révision') || n.includes('alerte');

        if (isAnomalyKeyword) {
          list.push({
            vehicle: veh,
            text: veh.notes,
            agentName: 'Conducteur / Relevé',
            date: veh.updatedAt
          });
        }
      }
    });

    return list;
  }, [vehicles, trips, selectedTeam]);

  const handleResolve = async (vehId: string) => {
    setResolvingId(vehId);
    try {
      await onResolveAnomaly(vehId);
    } finally {
      setResolvingId(null);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  if (activeAlerts.length === 0) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span><strong>Flotte 100% opérationnelle</strong> : Aucune observation ni anomalie en attente sur ce secteur.</span>
        </div>
        <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider hidden sm:inline">
          {selectedTeam === 'ALL' ? 'Toutes bases' : `Base ${selectedTeam}`}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 shadow-sm animate-in fade-in duration-200">
      {/* Header bar of the alert */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs shrink-0 animate-pulse">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-amber-950">
                {activeAlerts.length} {activeAlerts.length > 1 ? 'observations / anomalies signalées' : 'observation signalée'}
              </h3>
              <span className="bg-amber-200 text-amber-900 font-mono font-black text-xs px-2 py-0.5 rounded-full">
                {activeAlerts.length}
              </span>
            </div>
            <p className="text-xs text-amber-800 font-medium hidden sm:block">
              Signalements saisis par les agents lors des derniers trajets (suivi d'état du parc)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs font-bold text-amber-900 hover:text-amber-950 bg-amber-100 hover:bg-amber-200/80 py-1.5 px-3 rounded-lg transition-colors shrink-0"
        >
          <span>{isExpanded ? 'Masquer' : 'Afficher'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded list of active anomalies */}
      {isExpanded && (
        <div className="mt-3.5 space-y-2.5 pt-3 border-t border-amber-200">
          {activeAlerts.map(alert => (
            <div
              key={alert.vehicle.id}
              className="bg-white rounded-xl p-3 border border-amber-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-400 transition-colors"
            >
              {/* Vehicle identification & anomaly text */}
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <VehiclePlate immatriculation={alert.vehicle.immatriculation} size="sm" />
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {alert.vehicle.marque} {alert.vehicle.modele}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      alert.vehicle.equipe === 'ESCAILLON'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {alert.vehicle.equipe}
                  </span>
                </div>

                {/* The Observation Message */}
                <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-2 text-xs sm:text-sm font-bold text-amber-950 flex items-start gap-2">
                  <Wrench className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">« {alert.text} »</span>
                </div>

                {/* Metadata */}
                <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2">
                  <span>Signalé par : <strong className="text-slate-700">{alert.agentName}</strong></span>
                  <span>·</span>
                  <span>Le {formatDate(alert.date)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => onSelectVehicle(alert.vehicle)}
                  className="flex items-center gap-1.5 bg-[#0f2b48] hover:bg-[#163961] text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-2xs active:scale-95"
                  title="Ouvrir le relevé de ce véhicule"
                >
                  <span>Relever</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  disabled={resolvingId === alert.vehicle.id}
                  onClick={() => handleResolve(alert.vehicle.id)}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-2xs active:scale-95 disabled:opacity-50"
                  title="Marquer l'anomalie comme résolue / réparée"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{resolvingId === alert.vehicle.id ? 'Traitement...' : 'Marquer traitée'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
