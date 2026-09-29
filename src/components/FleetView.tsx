import React, { useState, useMemo } from 'react';
import { Vehicle, TeamId, Trip } from '../types.ts';
import { VehiclePlate } from './VehiclePlate.tsx';
import { ActiveAlertsBanner } from './ActiveAlertsBanner.tsx';
import {
  Car,
  Gauge,
  Clock,
  Fuel,
  QrCode,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Wrench,
  Check
} from 'lucide-react';

interface FleetViewProps {
  vehicles: Vehicle[];
  trips: Trip[];
  selectedTeam: TeamId | 'ALL';
  onSelectVehicleToRecord: (vehicle: Vehicle) => void;
  onOpenScanner: () => void;
  onResolveAnomaly: (vehicleId: string) => Promise<void>;
}

export const FleetView: React.FC<FleetViewProps> = ({
  vehicles,
  trips,
  selectedTeam,
  onSelectVehicleToRecord,
  onOpenScanner,
  onResolveAnomaly,
}) => {
  const [onlyAnomalies, setOnlyAnomalies] = useState<boolean>(false);

  // Map of latest anomaly per vehicle
  const anomaliesByVehicleId = useMemo(() => {
    const map = new Map<string, { text: string; agentName: string; date: string }>();

    vehicles.forEach(veh => {
      const vehTrips = trips.filter(
        t => t.vehicleId === veh.id && t.anomalieSignalee && t.anomalieSignalee.trim().length > 0
      );

      if (vehTrips.length > 0) {
        vehTrips.sort(
          (a, b) => new Date(b.dateRetour || b.createdAt).getTime() - new Date(a.dateRetour || a.createdAt).getTime()
        );
        map.set(veh.id, {
          text: vehTrips[0].anomalieSignalee!,
          agentName: vehTrips[0].agentName,
          date: vehTrips[0].dateRetour || vehTrips[0].createdAt
        });
      } else if (veh.notes && veh.notes.trim().length > 0) {
        const n = veh.notes.toLowerCase();
        const isAnomalyKeyword =
          n.includes('voyant') ||
          n.includes('pneu') ||
          n.includes('choc') ||
          n.includes('fuite') ||
          n.includes('panne') ||
          n.includes('anomalie') ||
          n.includes('probl') ||
          n.includes('lave-glace') ||
          n.includes('bruit') ||
          n.includes('révision') ||
          n.includes('alerte');

        if (isAnomalyKeyword) {
          map.set(veh.id, {
            text: veh.notes,
            agentName: 'Conducteur',
            date: veh.updatedAt
          });
        }
      }
    });

    return map;
  }, [vehicles, trips]);

  const totalAnomaliesCount = anomaliesByVehicleId.size;

  const filteredVehicles = vehicles.filter(v => {
    if (selectedTeam !== 'ALL' && v.equipe !== selectedTeam) return false;
    if (onlyAnomalies && !anomaliesByVehicleId.has(v.id)) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* 1. TOP ACTIVE ALERTS BANNER (Always visible if any observations exist) */}
      <ActiveAlertsBanner
        vehicles={vehicles}
        trips={trips}
        selectedTeam={selectedTeam}
        onSelectVehicle={onSelectVehicleToRecord}
        onResolveAnomaly={onResolveAnomaly}
      />

      {/* 2. Top Header and Quick Actions */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-sky-700 uppercase tracking-wider mb-1">
            <span>RTE Flotte Opérationnelle</span>
            <span>·</span>
            <span>Var Ouest & Var Est</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Véhicules & Engins de Service</h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Suivi kilométrique en temps réel et signalement d'anomalies. Cliquez sur un véhicule ou utilisez le scan QR Code.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Quick filter by anomaly */}
          {totalAnomaliesCount > 0 && (
            <button
              type="button"
              onClick={() => setOnlyAnomalies(!onlyAnomalies)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl border-2 transition-all shadow-2xs ${
                onlyAnomalies
                  ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{onlyAnomalies ? 'Afficher tous les véhicules' : `Avec alertes (${totalAnomaliesCount})`}</span>
            </button>
          )}

          <button
            onClick={onOpenScanner}
            className="flex items-center gap-2 bg-[#0f2b48] hover:bg-[#163961] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-2xs active:scale-95"
          >
            <QrCode className="w-4 h-4 text-sky-400" />
            <span>Scanner QR Code</span>
          </button>
        </div>
      </div>

      {/* 3. Grid of Vehicles */}
      {filteredVehicles.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 text-center text-slate-500 space-y-2">
          <p className="font-bold text-base text-slate-800">Aucun véhicule ne correspond à ce filtre.</p>
          {onlyAnomalies && (
            <button
              onClick={() => setOnlyAnomalies(false)}
              className="text-xs font-bold text-sky-600 hover:text-sky-800 underline"
            >
              Réafficher tous les véhicules
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVehicles.map(vehicle => {
            const isEscaillon = vehicle.equipe === 'ESCAILLON';
            const anomaly = anomaliesByVehicleId.get(vehicle.id);

            return (
              <div
                key={vehicle.id}
                className={`bg-white rounded-2xl border-2 transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  anomaly
                    ? 'border-amber-400 hover:border-amber-500 ring-2 ring-amber-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Card Header with license plate and team */}
                <div className="p-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                  <VehiclePlate immatriculation={vehicle.immatriculation} size="md" />
                  <div className="flex items-center gap-1.5">
                    {anomaly && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1 shadow-2xs animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        Alerte
                      </span>
                    )}
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded tracking-wide ${
                        isEscaillon
                          ? 'bg-sky-50 text-sky-800'
                          : 'bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      {vehicle.equipe}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3 flex-1">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      {vehicle.type} · {vehicle.marque}
                    </span>
                    <h3 className="font-black text-slate-900 text-base leading-snug">
                      {vehicle.modele}
                    </h3>
                  </div>

                  {/* Meter Reading Displays */}
                  <div className="bg-slate-50/90 rounded-2xl p-3.5 border-2 border-slate-200/80 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider block font-bold">
                        Compteur Kilométrique
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <Gauge className="w-5 h-5 text-sky-600 self-center shrink-0" />
                        <span className="font-mono text-xl sm:text-2xl font-black text-slate-950">
                          {vehicle.currentKm.toLocaleString('fr-FR')}
                        </span>
                        <span className="text-sm font-black text-slate-500">km</span>
                      </div>
                    </div>

                    {vehicle.hasHourMeter && vehicle.currentHours !== undefined && (
                      <div className="text-right border-l border-slate-200 pl-3 shrink-0">
                        <span className="text-xs text-amber-800 uppercase tracking-wider block font-bold">
                          Compteur Horaire
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5 justify-end">
                          <Clock className="w-4 h-4 text-amber-600 self-center shrink-0" />
                          <span className="font-mono text-lg sm:text-xl font-black text-amber-950">
                            {vehicle.currentHours}
                          </span>
                          <span className="text-xs font-bold text-amber-700">h</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* HIGH VISIBILITY ANOMALY / OBSERVATION ALERT BLOCK */}
                  {anomaly && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 text-amber-950 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-black text-amber-900">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Observation signalée :</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onResolveAnomaly(vehicle.id);
                          }}
                          className="text-[11px] text-emerald-800 hover:text-emerald-950 bg-white hover:bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-300 font-black transition-colors shadow-2xs flex items-center gap-1"
                          title="Marquer cette observation comme traitée"
                        >
                          <Check className="w-3 h-3" />
                          <span>Résolue</span>
                        </button>
                      </div>

                      <p className="text-xs sm:text-sm font-bold text-amber-950 leading-snug">
                        « {anomaly.text} »
                      </p>

                      <div className="text-[10px] text-amber-800 font-medium flex items-center justify-between pt-0.5">
                        <span>Par : <strong>{anomaly.agentName}</strong></span>
                        <span>{new Date(anomaly.date).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  )}

                  {/* Location / Energy / Notes */}
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Fuel className="w-3.5 h-3.5 text-slate-400" />
                      <span>Motorisation : <strong className="text-slate-800">{vehicle.fuelType}</strong></span>
                    </div>
                    {vehicle.emplacement && (
                      <div className="flex items-center gap-1.5 text-slate-500 line-clamp-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{vehicle.emplacement}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Disponible</span>
                  </span>

                  <button
                    onClick={() => onSelectVehicleToRecord(vehicle)}
                    className="flex items-center gap-1.5 bg-[#0f2b48] hover:bg-[#163961] text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-2xs active:scale-95"
                  >
                    <span>Relever les kms</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
