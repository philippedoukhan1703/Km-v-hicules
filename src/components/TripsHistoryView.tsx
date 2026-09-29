import React, { useState } from 'react';
import { Trip, TeamId, Vehicle, Agent, AgentRole } from '../types.ts';
import { VehiclePlate } from './VehiclePlate.tsx';
import {
  Search,
  Filter,
  Download,
  Trash2,
  Calendar,
  MapPin,
  FileText,
  User,
  QrCode,
  Gauge,
  Fuel,
  AlertCircle,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface TripsHistoryViewProps {
  trips: Trip[];
  vehicles: Vehicle[];
  agents: Agent[];
  selectedTeam: TeamId | 'ALL';
  onDeleteTrip: (id: string) => Promise<void>;
}

export const TripsHistoryView: React.FC<TripsHistoryViewProps> = ({
  trips,
  vehicles,
  agents,
  selectedTeam,
  onDeleteTrip,
}) => {
  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState<string>('ALL');
  const [agentFilter, setAgentFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<AgentRole | 'ALL'>('ALL');
  const [onlyWithAnomalies, setOnlyWithAnomalies] = useState<boolean>(false);
  const [sortField, setSortField] = useState<'date' | 'role' | 'driver' | 'kms'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const ROLE_HIERARCHY: Record<AgentRole, number> = {
    ADMINISTRATEUR: 1,
    COORDONNATEUR: 2,
    RESPONSABLE: 3,
    ADJOINT: 4,
    TECHNICIEN: 5,
    ALTERNANT: 6
  };

  const handleSort = (field: 'date' | 'role' | 'driver' | 'kms') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'kms' || field === 'date' ? 'desc' : 'asc');
    }
  };

  // Filter & sort trips
  const filteredTrips = trips
    .filter(t => {
      if (selectedTeam !== 'ALL' && t.equipe !== selectedTeam) return false;
      if (vehicleFilter !== 'ALL' && t.vehicleId !== vehicleFilter) return false;
      if (agentFilter !== 'ALL' && t.agentId !== agentFilter) return false;
      if (roleFilter !== 'ALL' && t.agentRole !== roleFilter) return false;
      if (onlyWithAnomalies && (!t.anomalieSignalee || !t.anomalieSignalee.trim())) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        t.agentName.toLowerCase().includes(q) ||
        t.vehicleImmat.toLowerCase().includes(q) ||
        t.vehicleName.toLowerCase().includes(q) ||
        t.motif.toLowerCase().includes(q) ||
        t.destination.toLowerCase().includes(q) ||
        (t.anomalieSignalee && t.anomalieSignalee.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'role') {
        const weightA = ROLE_HIERARCHY[a.agentRole] ?? 99;
        const weightB = ROLE_HIERARCHY[b.agentRole] ?? 99;
        cmp = weightA - weightB;
        if (cmp === 0) cmp = a.agentName.localeCompare(b.agentName, 'fr');
      } else if (sortField === 'driver') {
        cmp = a.agentName.localeCompare(b.agentName, 'fr');
      } else if (sortField === 'kms') {
        cmp = (a.kmParcourus || 0) - (b.kmParcourus || 0);
      } else {
        const timeA = new Date(a.dateRetour || a.dateDepart).getTime();
        const timeB = new Date(b.dateRetour || b.dateDepart).getTime();
        cmp = timeA - timeB;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

  const totalKms = filteredTrips.reduce((acc, t) => acc + (t.kmParcourus || 0), 0);

  const handleExportCsv = () => {
    const headers = [
      'ID Trajet',
      'Date & Heure',
      'Équipe',
      'Immatriculation',
      'Véhicule',
      'Conducteur',
      'Rôle',
      'Km Départ',
      'Km Fin',
      'Kms Parcourus',
      'Heures Utilisation',
      'Motif',
      'Destination',
      'Carburant',
      'Anomalie',
      'Mode Relevé'
    ];

    const rows = filteredTrips.map(t => [
      t.id,
      t.dateRetour ? new Date(t.dateRetour).toLocaleString('fr-FR') : '',
      t.equipe,
      t.vehicleImmat,
      `"${t.vehicleName.replace(/"/g, '""')}"`,
      `"${t.agentName.replace(/"/g, '""')}"`,
      t.agentRole,
      t.kmDepart,
      t.kmFin,
      t.kmParcourus,
      t.heuresUtilisees ?? '',
      `"${t.motif.replace(/"/g, '""')}"`,
      `"${t.destination.replace(/"/g, '""')}"`,
      t.carburantFin ?? '',
      `"${(t.anomalieSignalee || '').replace(/"/g, '""')}"`,
      t.releveMode
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RTE-Historique-Trajets-${selectedTeam}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string, tripInfo: string) => {
    if (window.confirm(`Confirmez-vous la suppression de ce trajet (${tripInfo}) ?`)) {
      await onDeleteTrip(id);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header and Controls */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Historique des Prêts & Trajets</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Journal complet des sorties de véhicules avec relevés kilométriques certifiés par QR Code.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-slate-500 uppercase block">Total sélection</span>
              <span className="font-mono font-black text-slate-900 text-base">
                {totalKms.toLocaleString('fr-FR')} km
              </span>
            </div>

            <button
              type="button"
              onClick={() => setOnlyWithAnomalies(!onlyWithAnomalies)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all border ${
                onlyWithAnomalies
                  ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{onlyWithAnomalies ? 'Afficher tous' : 'Avec observations'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg transition-colors border border-slate-300"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter CSV</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Conducteur, motif, destination, plaque..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Vehicle selector */}
          <select
            value={vehicleFilter}
            onChange={e => setVehicleFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
          >
            <option value="ALL">Tous les véhicules ({vehicles.length})</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.immatriculation} · {v.marque} {v.modele} ({v.equipe})
              </option>
            ))}
          </select>

          {/* Role selector */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as any)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
          >
            <option value="ALL">Tous les rôles</option>
            <option value="ADMINISTRATEUR">🛡️ Administrateur</option>
            <option value="COORDONNATEUR">Coordonnateurs</option>
            <option value="RESPONSABLE">Responsables</option>
            <option value="ADJOINT">Adjoints</option>
            <option value="TECHNICIEN">Techniciens</option>
            <option value="ALTERNANT">Alternants</option>
          </select>

          {/* Agent selector */}
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
          >
            <option value="ALL">Tous les conducteurs ({agents.length})</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.nom} {a.prenom} ({a.role} - {a.equipe})
              </option>
            ))}
          </select>

          {/* Sort selector */}
          <select
            value={`${sortField}-${sortOrder}`}
            onChange={e => {
              const [field, order] = e.target.value.split('-');
              setSortField(field as any);
              setSortOrder(order as any);
            }}
            className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="date-desc">📅 Date : Récent → Ancien</option>
            <option value="date-asc">📅 Date : Ancien → Récent</option>
            <option value="role-asc">👑 Rôle : Hiérarchie</option>
            <option value="kms-desc">⚡ Distance : Max → Min</option>
            <option value="kms-asc">⚡ Distance : Min → Max</option>
            <option value="driver-asc">👤 Conducteur : A → Z</option>
          </select>
        </div>
      </div>

      {/* Trips Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th
                  className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  onClick={() => handleSort('date')}
                  title="Trier par date"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Date & Heure</span>
                    {sortField === 'date' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Équipe</th>
                <th className="py-3 px-4">Véhicule</th>
                <th
                  className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  onClick={() => handleSort('role')}
                  title="Trier par rôle ou conducteur"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Conducteur & Rôle</span>
                    {sortField === 'role' || sortField === 'driver' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Mission & Destination</th>
                <th className="py-3 px-4 text-right">Compteur Fin</th>
                <th
                  className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/70 transition-colors"
                  onClick={() => handleSort('kms')}
                  title="Trier par distance"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Distance</span>
                    {sortField === 'kms' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Énergie</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTrips.map(trip => {
                const tripDate = new Date(trip.dateRetour || trip.dateDepart);
                const isEscaillon = trip.equipe === 'ESCAILLON';

                return (
                  <tr key={trip.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Date & Mode */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">
                        {tripDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{tripDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {trip.releveMode === 'QR_CODE' && (
                          <span className="text-[10px] text-sky-600 font-mono flex items-center gap-0.5 ml-1" title="Validé par scan QR Code">
                            <QrCode className="w-3 h-3" />
                            <span>QR</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Équipe */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                        isEscaillon ? 'bg-sky-50 text-sky-800' : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {trip.equipe}
                      </span>
                    </td>

                    {/* Véhicule */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <VehiclePlate immatriculation={trip.vehicleImmat} size="sm" />
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium mt-1 line-clamp-1">
                        {trip.vehicleName}
                      </div>
                    </td>

                    {/* Conducteur */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{trip.agentName}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {trip.agentRole === 'ADMINISTRATEUR' ? 'Administrateur de la base (Technicien)' : trip.agentRole === 'COORDONNATEUR' ? 'Coordonnateur' : trip.agentRole === 'RESPONSABLE' ? 'Responsable d’équipe' : trip.agentRole === 'ADJOINT' ? 'Adjoint' : trip.agentRole === 'ALTERNANT' ? 'Alternant' : 'Technicien'}
                      </div>
                    </td>

                    {/* Motif & Destination */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-slate-800 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{trip.motif}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-sky-500 shrink-0" />
                        <span className="line-clamp-1">{trip.destination}</span>
                      </div>
                      {trip.anomalieSignalee && (
                        <div className="text-xs font-bold text-amber-950 bg-amber-100/90 border border-amber-300 px-2 py-1 rounded-lg mt-1.5 flex items-center gap-1.5 shadow-2xs">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                          <span>{trip.anomalieSignalee}</span>
                        </div>
                      )}
                    </td>

                    {/* Compteur Fin */}
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-slate-700">
                      <div>{trip.kmFin.toLocaleString('fr-FR')} km</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        départ {trip.kmDepart.toLocaleString('fr-FR')}
                      </div>
                    </td>

                    {/* Kms parcourus */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs inline-block">
                        +{trip.kmParcourus.toLocaleString('fr-FR')} km
                      </span>
                      {trip.heuresUtilisees !== undefined && (
                        <div className="text-[10px] text-amber-700 font-mono mt-0.5">
                          +{trip.heuresUtilisees} h engin
                        </div>
                      )}
                    </td>

                    {/* Carburant */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {trip.carburantFin ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-medium">
                          <Fuel className="w-3 h-3 text-slate-500" />
                          <span>{trip.carburantFin}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Delete Action */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(trip.id, `${trip.vehicleImmat} - ${trip.agentName}`)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Supprimer ce trajet"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredTrips.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    Aucun trajet ne correspond aux critères de filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>{filteredTrips.length} trajets enregistrés</span>
          <span className="font-mono font-semibold text-slate-700">
            Total : {totalKms.toLocaleString('fr-FR')} km
          </span>
        </div>
      </div>
    </div>
  );
};
