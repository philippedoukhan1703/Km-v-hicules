import React, { useState } from 'react';
import { Vehicle, Agent, TeamId, VehicleType, FuelType, AgentRole, VehicleStatus } from '../types.ts';
import { VehiclePlate } from './VehiclePlate.tsx';
import { FleetService } from '../services/fleetService.ts';
import {
  Car,
  Users,
  Settings,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  ExternalLink,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Download,
  Upload,
  Database,
  HardDrive,
  Server,
  Save,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter
} from 'lucide-react';

interface ConfigViewProps {
  vehicles: Vehicle[];
  agents: Agent[];
  sharepointUrl: string;
  onRefreshData: () => Promise<void>;
  selectedTeam: TeamId | 'ALL';
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  vehicles,
  agents,
  sharepointUrl,
  onRefreshData,
  selectedTeam,
}) => {
  const [activeTab, setActiveTab] = useState<'vehicles' | 'agents' | 'settings'>('vehicles');

  // Vehicle form modal state
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Agent form modal state
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  // Settings state
  const [spUrl, setSpUrl] = useState(sharepointUrl);
  const [isResetting, setIsResetting] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [isSavingAgent, setIsSavingAgent] = useState(false);
  const [isSavingSp, setIsSavingSp] = useState(false);
  const fileBackupInputRef = React.useRef<HTMLInputElement | null>(null);

  // Agent filtering & sorting state
  const [agentRoleFilter, setAgentRoleFilter] = useState<AgentRole | 'ALL'>('ALL');
  const [agentTeamFilter, setAgentTeamFilter] = useState<TeamId | 'MIXTE' | 'ALL'>('ALL');
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [agentSortField, setAgentSortField] = useState<'role' | 'nom' | 'equipe' | 'matricule' | 'active'>('role');
  const [agentSortOrder, setAgentSortOrder] = useState<'asc' | 'desc'>('asc');

  const ROLE_HIERARCHY: Record<AgentRole, number> = {
    ADMINISTRATEUR: 1,
    COORDONNATEUR: 2,
    RESPONSABLE: 3,
    ADJOINT: 4,
    TECHNICIEN: 5,
    ALTERNANT: 6
  };

  const ROLE_DISPLAY_NAMES: Record<AgentRole, string> = {
    ADMINISTRATEUR: 'Administrateur (Technicien)',
    COORDONNATEUR: 'Coordonnateur',
    RESPONSABLE: 'Responsable',
    ADJOINT: 'Adjoint',
    TECHNICIEN: 'Technicien',
    ALTERNANT: 'Alternant'
  };

  const handleSortAgent = (field: 'role' | 'nom' | 'equipe' | 'matricule' | 'active') => {
    if (agentSortField === field) {
      setAgentSortOrder(agentSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setAgentSortField(field);
      setAgentSortOrder('asc');
    }
  };

  const roleCounts: Record<AgentRole | 'ALL', number> = {
    ALL: agents.length,
    ADMINISTRATEUR: agents.filter(a => a.role === 'ADMINISTRATEUR').length,
    COORDONNATEUR: agents.filter(a => a.role === 'COORDONNATEUR').length,
    RESPONSABLE: agents.filter(a => a.role === 'RESPONSABLE').length,
    ADJOINT: agents.filter(a => a.role === 'ADJOINT').length,
    TECHNICIEN: agents.filter(a => a.role === 'TECHNICIEN').length,
    ALTERNANT: agents.filter(a => a.role === 'ALTERNANT').length,
  };

  const processedAgents = agents
    .filter(a => {
      if (agentRoleFilter !== 'ALL' && a.role !== agentRoleFilter) return false;
      if (agentTeamFilter !== 'ALL' && a.equipe !== agentTeamFilter) return false;
      if (agentSearchQuery.trim()) {
        const q = agentSearchQuery.toLowerCase().trim();
        const fullName = `${a.nom} ${a.prenom}`.toLowerCase();
        const revName = `${a.prenom} ${a.nom}`.toLowerCase();
        const matricule = (a.matricule || '').toLowerCase();
        const email = (a.email || '').toLowerCase();
        const roleName = (ROLE_DISPLAY_NAMES[a.role] || '').toLowerCase();
        if (!fullName.includes(q) && !revName.includes(q) && !matricule.includes(q) && !email.includes(q) && !roleName.includes(q)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (agentSortField === 'role') {
        const weightA = ROLE_HIERARCHY[a.role] ?? 99;
        const weightB = ROLE_HIERARCHY[b.role] ?? 99;
        cmp = weightA - weightB;
        if (cmp === 0) {
          cmp = a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
        }
      } else if (agentSortField === 'nom') {
        cmp = a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
        if (cmp === 0) {
          cmp = (a.prenom || '').localeCompare(b.prenom || '', 'fr');
        }
      } else if (agentSortField === 'equipe') {
        cmp = a.equipe.localeCompare(b.equipe);
        if (cmp === 0) {
          cmp = a.nom.localeCompare(b.nom, 'fr');
        }
      } else if (agentSortField === 'matricule') {
        cmp = (a.matricule || '').localeCompare(b.matricule || '');
      } else if (agentSortField === 'active') {
        cmp = a.active === b.active ? 0 : a.active ? -1 : 1;
      }
      return agentSortOrder === 'asc' ? cmp : -cmp;
    });

  const cleanNumber = (val: FormDataEntryValue | null, fallback = 0): number => {
    if (!val) return fallback;
    const str = String(val).replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? fallback : num;
  };

  // Handle vehicle save
  const handleSaveVehicle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSavingVehicle(true);
    const formData = new FormData(e.currentTarget);

    try {
      const vehicleData: Vehicle = {
        ...(editingVehicle || {}),
        id: editingVehicle?.id || 'veh-' + Date.now(),
        code: (formData.get('code') as string).toUpperCase().trim(),
        immatriculation: (formData.get('immatriculation') as string).toUpperCase().trim(),
        marque: formData.get('marque') as string,
        modele: formData.get('modele') as string,
        type: formData.get('type') as VehicleType,
        equipe: formData.get('equipe') as TeamId,
        structureEquipe: (formData.get('structureEquipe') as string)?.trim() || editingVehicle?.structureEquipe || 'SOSTGP3',
        centreDeCout: (formData.get('centreDeCout') as string)?.trim() || editingVehicle?.centreDeCout || 'SOCAPA06',
        currentKm: cleanNumber(formData.get('currentKm'), editingVehicle?.currentKm ?? 0),
        currentHours: formData.get('currentHours') ? cleanNumber(formData.get('currentHours'), 0) : undefined,
        hasHourMeter: formData.get('hasHourMeter') === 'on',
        status: (formData.get('status') as VehicleStatus) || editingVehicle?.status || 'DISPONIBLE',
        fuelType: formData.get('fuelType') as FuelType,
        emplacement: (formData.get('emplacement') as string) || '',
        notes: (formData.get('notes') as string) || editingVehicle?.notes || '',
        createdAt: editingVehicle?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await FleetService.saveVehicle(vehicleData);
      await onRefreshData();
      setIsVehicleModalOpen(false);
      setEditingVehicle(null);
      setToastMessage(`Véhicule ${vehicleData.immatriculation} enregistré avec succès !`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Error saving vehicle:', err);
    } finally {
      setIsSavingVehicle(false);
    }
  };

  // Handle agent save
  const handleSaveAgent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSavingAgent(true);
    const formData = new FormData(e.currentTarget);

    try {
      const agentData: Agent = {
        ...(editingAgent || {}),
        id: editingAgent?.id || 'agt-' + Date.now(),
        nom: (formData.get('nom') as string).toUpperCase().trim(),
        prenom: (formData.get('prenom') as string).trim(),
        role: formData.get('role') as AgentRole,
        equipe: formData.get('equipe') as (TeamId | 'MIXTE'),
        matricule: (formData.get('matricule') as string)?.trim() || '',
        telephone: (formData.get('telephone') as string)?.trim() || '',
        email: (formData.get('email') as string)?.trim() || '',
        active: formData.get('active') === 'on'
      };

      await FleetService.saveAgent(agentData);
      await onRefreshData();
      setIsAgentModalOpen(false);
      setEditingAgent(null);
      setToastMessage(`Agent ${agentData.prenom} ${agentData.nom} enregistré avec succès !`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Error saving agent:', err);
    } finally {
      setIsSavingAgent(false);
    }
  };

  // Handle SharePoint URL save
  const handleSaveSharepoint = async () => {
    setIsSavingSp(true);
    try {
      await FleetService.saveSharepointUrl(spUrl);
      await onRefreshData();
      setToastMessage('Lien SharePoint enregistré avec succès !');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Error saving SharePoint URL:', err);
    } finally {
      setIsSavingSp(false);
    }
  };

  // Delete vehicle
  const handleDeleteVehicle = async (v: Vehicle) => {
    if (window.confirm(`Confirmez-vous la suppression du véhicule ${v.immatriculation} (${v.marque} ${v.modele}) ?`)) {
      await FleetService.deleteVehicle(v.id);
      await onRefreshData();
    }
  };

  // Delete agent
  const handleDeleteAgent = async (a: Agent) => {
    if (window.confirm(`Confirmez-vous la suppression de l'agent ${a.prenom} ${a.nom} ?`)) {
      await FleetService.deleteAgent(a.id);
      await onRefreshData();
    }
  };

  // Reset demo
  const handleResetDemo = async () => {
    if (window.confirm('Voulez-vous réinitialiser toutes les données de la flotte avec les données types RTE Escaillon & Les Arcs ?')) {
      setIsResetting(true);
      await FleetService.resetToDemo();
      await onRefreshData();
      setIsResetting(false);
    }
  };

  const handleExportBackup = async () => {
    const data = await FleetService.getFleetData();
    FleetService.downloadBackupFile(data);
    setBackupMessage('Fichier de sauvegarde téléchargé avec succès.');
    setTimeout(() => setBackupMessage(null), 3000);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        await FleetService.importBackup(json);
        await onRefreshData();
        setBackupMessage('Sauvegarde restaurée avec succès.');
        setTimeout(() => setBackupMessage(null), 3000);
      } catch (err) {
        alert('Format de fichier de sauvegarde invalide.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'vehicles'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>Véhicules & Engins ({vehicles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'agents'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Agents & Conducteurs ({agents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'settings'
              ? 'border-sky-600 text-sky-700'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Lien SharePoint & Système</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: VEHICLES */}
      {activeTab === 'vehicles' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Parc de Véhicules & Engins RTE</h3>
              <p className="text-xs text-slate-500">
                Véhicules affectés aux bases d'Escaillon et des Arcs. Chaque véhicule dispose de son QR Code dédié.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingVehicle(null);
                setIsVehicleModalOpen(true);
              }}
              className="flex items-center gap-2 bg-[#0f2b48] hover:bg-[#163961] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-2xs self-start"
            >
              <Plus className="w-4 h-4" />
              <span>Déclarer un véhicule</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vehicles.map(v => (
              <div
                key={v.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <VehiclePlate immatriculation={v.immatriculation} size="sm" />
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                      v.equipe === 'ESCAILLON'
                        ? 'bg-sky-50 text-sky-800'
                        : 'bg-emerald-50 text-emerald-800'
                    }`}>
                      Équipe {v.equipe}
                    </span>
                  </div>

                  <div className="mt-3">
                    <h4 className="font-bold text-slate-900 text-sm">{v.marque} {v.modele}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Code : <span className="font-mono text-slate-700 font-semibold">{v.code}</span> · {v.type} · {v.fuelType}
                    </p>
                    {v.emplacement && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        📍 {v.emplacement}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Index actuel</span>
                    <span className="font-mono font-bold text-slate-800">
                      {v.currentKm.toLocaleString('fr-FR')} km
                    </span>
                    {v.hasHourMeter && v.currentHours !== undefined && (
                      <span className="text-amber-700 font-mono text-[11px] ml-1.5 font-bold">
                        · {v.currentHours} h
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingVehicle(v);
                        setIsVehicleModalOpen(true);
                      }}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                      title="Modifier"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteVehicle(v)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: AGENTS */}
      {activeTab === 'agents' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Agents & Conducteurs RTE</h3>
              <p className="text-xs text-slate-500">
                Gestion des collaborateurs habilités. Rôles : <strong>Administrateur</strong>, <strong>Coordonnateur</strong>, <strong>Responsable</strong>, <strong>Adjoint</strong>, <strong>Technicien</strong> et <strong>Alternant</strong>.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingAgent(null);
                setIsAgentModalOpen(true);
              }}
              className="flex items-center gap-2 bg-[#0f2b48] hover:bg-[#163961] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-2xs self-start"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un agent</span>
            </button>
          </div>

          {/* Quick Role Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setAgentRoleFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                agentRoleFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>Tous les rôles</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${agentRoleFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {roleCounts.ALL}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAgentRoleFilter('ADMINISTRATEUR')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                agentRoleFilter === 'ADMINISTRATEUR'
                  ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                  : 'bg-indigo-50/80 text-indigo-900 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              <span>🛡️ Admin</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${agentRoleFilter === 'ADMINISTRATEUR' ? 'bg-indigo-700 text-white' : 'bg-indigo-200 text-indigo-800'}`}>
                {roleCounts.ADMINISTRATEUR}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAgentRoleFilter('COORDONNATEUR')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                agentRoleFilter === 'COORDONNATEUR'
                  ? 'bg-teal-600 text-white shadow-xs ring-2 ring-teal-300'
                  : 'bg-teal-50/80 text-teal-900 hover:bg-teal-100 border border-teal-200'
              }`}
            >
              <span>Coordonnateurs</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${agentRoleFilter === 'COORDONNATEUR' ? 'bg-teal-700 text-white' : 'bg-teal-200 text-teal-800'}`}>
                {roleCounts.COORDONNATEUR}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAgentRoleFilter('RESPONSABLE')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                agentRoleFilter === 'RESPONSABLE'
                  ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-300'
                  : 'bg-amber-50/80 text-amber-900 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span>Responsables</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${agentRoleFilter === 'RESPONSABLE' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-800'}`}>
                {roleCounts.RESPONSABLE}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAgentRoleFilter('ADJOINT')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                agentRoleFilter === 'ADJOINT'
                  ? 'bg-sky-600 text-white shadow-xs ring-2 ring-sky-300'
                  : 'bg-sky-50/80 text-sky-900 hover:bg-sky-100 border border-sky-200'
              }`}
            >
              <span>Adjoints</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${agentRoleFilter === 'ADJOINT' ? 'bg-sky-700 text-white' : 'bg-sky-200 text-sky-800'}`}>
                {roleCounts.ADJOINT}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAgentRoleFilter('TECHNICIEN')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                agentRoleFilter === 'TECHNICIEN'
                  ? 'bg-slate-700 text-white shadow-xs ring-2 ring-slate-400'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <span>Techniciens</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${agentRoleFilter === 'TECHNICIEN' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {roleCounts.TECHNICIEN}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAgentRoleFilter('ALTERNANT')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                agentRoleFilter === 'ALTERNANT'
                  ? 'bg-purple-600 text-white shadow-xs ring-2 ring-purple-300'
                  : 'bg-purple-50/80 text-purple-900 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <span>Alternants</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${agentRoleFilter === 'ALTERNANT' ? 'bg-purple-700 text-white' : 'bg-purple-200 text-purple-800'}`}>
                {roleCounts.ALTERNANT}
              </span>
            </button>
          </div>

          {/* Controls Bar: Search, Team filter, and Sort selector */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={agentSearchQuery}
                  onChange={e => setAgentSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom, prénom, matricule..."
                  className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800"
                />
                {agentSearchQuery && (
                  <button
                    onClick={() => setAgentSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Team Filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={agentTeamFilter}
                  onChange={e => setAgentTeamFilter(e.target.value as any)}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                >
                  <option value="ALL">Toutes les équipes</option>
                  <option value="ESCAILLON">Équipe ESCAILLON</option>
                  <option value="LES ARCS">Équipe LES ARCS</option>
                  <option value="MIXTE">MIXTE (Inter-bases)</option>
                </select>
              </div>
            </div>

            {/* Quick Sort Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500 hidden sm:inline">Trier par :</span>
              <select
                value={`${agentSortField}-${agentSortOrder}`}
                onChange={e => {
                  const [field, order] = e.target.value.split('-');
                  setAgentSortField(field as any);
                  setAgentSortOrder(order as any);
                }}
                className="text-xs font-semibold border border-slate-300 rounded-lg px-2.5 py-2 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="role-asc">👑 Rôle : Hiérarchie (Admin → Alternant)</option>
                <option value="role-desc">👥 Rôle : Hiérarchie inverse</option>
                <option value="nom-asc">🔤 Nom : A → Z</option>
                <option value="nom-desc">🔤 Nom : Z → A</option>
                <option value="equipe-asc">📍 Équipe (A → Z)</option>
                <option value="matricule-asc">🔢 Matricule</option>
                <option value="active-asc">⚡ Statut (Actifs en premier)</option>
              </select>

              {(agentRoleFilter !== 'ALL' || agentTeamFilter !== 'ALL' || agentSearchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setAgentRoleFilter('ALL');
                    setAgentTeamFilter('ALL');
                    setAgentSearchQuery('');
                  }}
                  className="text-xs text-sky-600 hover:text-sky-800 font-medium px-2 py-1 rounded hover:bg-sky-50 transition-colors shrink-0"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 select-none">
                  <tr>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSortAgent('nom')}
                      title="Cliquer pour trier par Nom"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Agent (Nom & Prénom)</span>
                        {agentSortField === 'nom' ? (
                          agentSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSortAgent('role')}
                      title="Cliquer pour trier par Rôle"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Rôle</span>
                        {agentSortField === 'role' ? (
                          agentSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSortAgent('equipe')}
                      title="Cliquer pour trier par Équipe"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Équipe</span>
                        {agentSortField === 'equipe' ? (
                          agentSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSortAgent('matricule')}
                      title="Cliquer pour trier par Matricule"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Matricule</span>
                        {agentSortField === 'matricule' ? (
                          agentSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-4">Email</th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSortAgent('active')}
                      title="Cliquer pour trier par Statut"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Statut</span>
                        {agentSortField === 'active' ? (
                          agentSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-sky-600" /> : <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedAgents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users className="w-8 h-8 text-slate-300" />
                          <span className="font-semibold text-sm">Aucun agent ne correspond aux critères</span>
                          <span className="text-xs text-slate-400">Modifiez la recherche ou réinitialisez les filtres de rôles/équipes.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setAgentRoleFilter('ALL');
                              setAgentTeamFilter('ALL');
                              setAgentSearchQuery('');
                            }}
                            className="mt-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-3 py-1.5 rounded-lg border border-slate-300 transition-colors"
                          >
                            Effacer les filtres
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    processedAgents.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {a.nom} {a.prenom}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            a.role === 'ADMINISTRATEUR'
                              ? 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                              : a.role === 'COORDONNATEUR'
                              ? 'bg-teal-50 text-teal-900 border border-teal-200'
                              : a.role === 'RESPONSABLE'
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : a.role === 'ADJOINT'
                              ? 'bg-sky-50 text-sky-900 border border-sky-200'
                              : a.role === 'ALTERNANT'
                              ? 'bg-purple-50 text-purple-900 border border-purple-200'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {a.role === 'ADMINISTRATEUR' ? 'Admin (Technicien)' : a.role === 'COORDONNATEUR' ? 'Coordonnateur' : a.role === 'RESPONSABLE' ? 'Responsable' : a.role === 'ADJOINT' ? 'Adjoint' : a.role === 'ALTERNANT' ? 'Alternant' : 'Technicien'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {a.equipe}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {a.matricule || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {a.email || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[11px] font-semibold ${a.active ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {a.active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingAgent(a);
                                setIsAgentModalOpen(true);
                              }}
                              className="p-1 text-slate-600 hover:text-slate-900 rounded"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAgent(a)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer counter */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-500">
              <span>
                Affichage de <strong className="text-slate-800 font-semibold">{processedAgents.length}</strong> sur <strong className="text-slate-800 font-semibold">{agents.length}</strong> agents
                {agentRoleFilter !== 'ALL' && <span> · Rôle filtré : <strong className="text-slate-800 font-semibold">{ROLE_DISPLAY_NAMES[agentRoleFilter]}</strong></span>}
                {agentTeamFilter !== 'ALL' && <span> · Équipe : <strong className="text-slate-800 font-semibold">{agentTeamFilter}</strong></span>}
              </span>
              <span>Tri actif : <strong className="text-slate-700 font-medium">{agentSortField === 'role' ? 'Rôle (hiérarchie)' : agentSortField === 'nom' ? 'Nom' : agentSortField === 'equipe' ? 'Équipe' : agentSortField}</strong> ({agentSortOrder === 'asc' ? 'croissant' : 'décroissant'})</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS & SHAREPOINT */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Paramètres & Lien SharePoint Teams</h3>
            <p className="text-xs text-slate-500 mt-1">
              Configuration de la synchronisation avec le classeur officiel RTE "kms véhicules et heures engins".
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <label className="text-xs font-semibold text-slate-700 block">
              URL du classeur SharePoint / Teams RTE
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={spUrl}
                onChange={e => setSpUrl(e.target.value)}
                placeholder="https://rtefrance.sharepoint.com/:x:/r/..."
                className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveSharepoint}
                  disabled={isSavingSp}
                  className="flex items-center justify-center gap-1.5 bg-[#0f2b48] hover:bg-[#163961] disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors shadow-2xs"
                >
                  {isSavingSp ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isSavingSp ? 'Sauvegarde...' : 'Enregistrer le lien'}</span>
                </button>
                <a
                  href={spUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors shrink-0"
                >
                  <span>Tester</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Lien direct vers le site RTE : <code>sites/kmsvhiculesetheuresengins</code>
            </p>
          </div>

          {/* Persistence & Multi-Device Storage Status Card */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Database className="w-4 h-4" />
                <span>Persistance des données & Synchronisation Serveur</span>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Actif & Persistant</span>
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Toutes les données saisies (nouveaux kilomètres, scans QR Code, prêts, véhicules et agents) sont <strong>enregistrées en temps réel de manière permanente</strong> à la fois sur le serveur et dans le stockage local de l'appareil.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 text-[10px] uppercase font-mono block">1. Serveur Disque</span>
                <span className="font-bold text-white mt-0.5 block">data/fleet.json</span>
                <span className="text-[11px] text-slate-400">Écriture atomique sécurisée</span>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 text-[10px] uppercase font-mono block">2. Copie Miroir</span>
                <span className="font-bold text-white mt-0.5 block">fleet-backup.json</span>
                <span className="text-[11px] text-slate-400">Sauvegarde automatique</span>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 text-[10px] uppercase font-mono block">3. Cache Mobile iPhone</span>
                <span className="font-bold text-white mt-0.5 block">Stockage Local (Offline)</span>
                <span className="text-[11px] text-slate-400">Opérationnel sans réseau</span>
              </div>
            </div>

            {/* Backup export and import buttons */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold px-3.5 py-2 rounded-lg transition-colors shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger la sauvegarde complète (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => fileBackupInputRef.current?.click()}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors border border-white/20"
              >
                <Upload className="w-4 h-4" />
                <span>Restaurer une sauvegarde (.json)</span>
              </button>

              <input
                ref={fileBackupInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </div>

            {backupMessage && (
              <div className="p-2.5 bg-emerald-950/90 text-emerald-200 border border-emerald-800 rounded-lg text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{backupMessage}</span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-5">
            <h4 className="text-sm font-bold text-slate-900 mb-1">Réinitialisation des données de test</h4>
            <p className="text-xs text-slate-500 mb-3">
              Permet de rétablir les véhicules, agents et historiques types pour les bases d'Escaillon et des Arcs.
            </p>
            <button
              onClick={handleResetDemo}
              disabled={isResetting}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-slate-600" />
              <span>{isResetting ? 'Réinitialisation...' : 'Restaurer la flotte de démonstration RTE'}</span>
            </button>
          </div>
        </div>
      )}

      {/* VEHICLE MODAL */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {editingVehicle ? 'Modifier le véhicule' : 'Déclarer un nouveau véhicule'}
              </h3>
              <button onClick={() => setIsVehicleModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              key={editingVehicle?.id || 'new-vehicle'}
              onSubmit={handleSaveVehicle}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Immatriculation</label>
                  <input
                    name="immatriculation"
                    required
                    defaultValue={editingVehicle?.immatriculation || ''}
                    placeholder="GF-418-RT"
                    className="w-full text-xs font-mono font-bold uppercase border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Code QR interne</label>
                  <input
                    name="code"
                    required
                    defaultValue={editingVehicle?.code || 'ESC-01'}
                    placeholder="ESC-01"
                    className="w-full text-xs font-mono uppercase border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Marque</label>
                  <input
                    name="marque"
                    required
                    defaultValue={editingVehicle?.marque || 'Renault'}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Modèle</label>
                  <input
                    name="modele"
                    required
                    defaultValue={editingVehicle?.modele || 'Kangoo Van E-Tech'}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Équipe affectée</label>
                  <select
                    name="equipe"
                    defaultValue={editingVehicle?.equipe || 'ESCAILLON'}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 font-semibold"
                  >
                    <option value="ESCAILLON">ESCAILLON (Toulon)</option>
                    <option value="LES ARCS">LES ARCS (Draguignan)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Type d'engin</label>
                  <select
                    name="type"
                    defaultValue={editingVehicle?.type || 'VL'}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  >
                    <option value="VL">Véhicule Léger (VL)</option>
                    <option value="UTILITAIRE">Fourgon / Atelier</option>
                    <option value="4X4">Tout-terrain 4x4 Pylônes</option>
                    <option value="ENGIN">Engin Nacelle / Grue</option>
                  </select>
                </div>
              </div>

              {/* Centre de coût (N9KV0) et Structure équipe */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Centre de coût (N9KV0)</label>
                  <input
                    name="centreDeCout"
                    defaultValue={editingVehicle?.centreDeCout || 'SOCAPA06'}
                    placeholder="SOCAPA06"
                    className="w-full text-xs font-mono font-bold uppercase border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Structure équipe</label>
                  <input
                    name="structureEquipe"
                    defaultValue={editingVehicle?.structureEquipe || 'SOSTGP3'}
                    placeholder="SOSTGP3"
                    className="w-full text-xs font-mono font-bold uppercase border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Kilométrage actuel (km)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="currentKm"
                    required
                    defaultValue={editingVehicle?.currentKm ?? 0}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Énergie / Carburant</label>
                  <select
                    name="fuelType"
                    defaultValue={editingVehicle?.fuelType || 'DIESEL'}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  >
                    <option value="ELECTRIQUE">Électrique</option>
                    <option value="DIESEL">Diesel</option>
                    <option value="HYBRIDE">Hybride</option>
                    <option value="ESSENCE">Essence</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Statut opérationnel</label>
                  <select
                    name="status"
                    defaultValue={editingVehicle?.status || 'DISPONIBLE'}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 font-medium"
                  >
                    <option value="DISPONIBLE">DISPONIBLE (Sur base)</option>
                    <option value="EN_PRET">EN PRÊT (En mission)</option>
                    <option value="MAINTENANCE">MAINTENANCE (Indisponible)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Heures compteur (si engin)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="currentHours"
                    defaultValue={editingVehicle?.currentHours || ''}
                    placeholder="Ex: 120"
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <input
                  type="checkbox"
                  id="hasHourMeter"
                  name="hasHourMeter"
                  defaultChecked={editingVehicle?.hasHourMeter || false}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="hasHourMeter" className="text-xs font-semibold text-slate-800">
                  Équipé d'un compteur horaire (pour engin nacelle / grue)
                </label>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Emplacement sur base</label>
                <input
                  name="emplacement"
                  defaultValue={editingVehicle?.emplacement || ''}
                  placeholder="Base Escaillon - Place 04"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Remarques / Notes internes</label>
                <input
                  name="notes"
                  defaultValue={editingVehicle?.notes || ''}
                  placeholder="Remarques éventuelles sur les équipements..."
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingVehicle}
                  className="bg-[#0f2b48] hover:bg-[#163961] disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  {isSavingVehicle && <RotateCcw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSavingVehicle ? 'Enregistrement...' : 'Enregistrer le véhicule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AGENT MODAL */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {editingAgent ? 'Modifier l’agent' : 'Déclarer un agent RTE'}
              </h3>
              <button onClick={() => setIsAgentModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              key={editingAgent?.id || 'new-agent'}
              onSubmit={handleSaveAgent}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Nom</label>
                  <input
                    name="nom"
                    required
                    defaultValue={editingAgent?.nom || ''}
                    placeholder="DUPONT"
                    className="w-full text-xs uppercase font-bold border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Prénom</label>
                  <input
                    name="prenom"
                    required
                    defaultValue={editingAgent?.prenom || ''}
                    placeholder="Sophie"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Rôle</label>
                  <select
                    name="role"
                    defaultValue={editingAgent?.role || 'TECHNICIEN'}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  >
                    <option value="ADMINISTRATEUR">Administrateur de la base (Technicien)</option>
                    <option value="COORDONNATEUR">Coordonnateur</option>
                    <option value="RESPONSABLE">Responsable d'Équipe</option>
                    <option value="ADJOINT">Adjoint</option>
                    <option value="TECHNICIEN">Technicien</option>
                    <option value="ALTERNANT">Alternant</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Équipe</label>
                  <select
                    name="equipe"
                    defaultValue={editingAgent?.equipe || 'ESCAILLON'}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  >
                    <option value="ESCAILLON">ESCAILLON</option>
                    <option value="LES ARCS">LES ARCS</option>
                    <option value="MIXTE">MIXTE (Inter-sites)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Matricule RTE</label>
                <input
                  name="matricule"
                  defaultValue={editingAgent?.matricule || ''}
                  placeholder="RTE-9481"
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email RTE</label>
                <input
                  name="email"
                  type="email"
                  defaultValue={editingAgent?.email || ''}
                  placeholder="prenom.nom@rte-france.com"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Téléphone</label>
                <input
                  name="telephone"
                  defaultValue={editingAgent?.telephone || ''}
                  placeholder="06 12 34 56 78"
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="active"
                  name="active"
                  defaultChecked={editingAgent ? editingAgent.active !== false : true}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <label htmlFor="active" className="text-xs text-slate-700 font-medium">
                  Agent actif (disponible pour les prêts)
                </label>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAgentModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingAgent}
                  className="bg-[#0f2b48] hover:bg-[#163961] disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  {isSavingAgent && <RotateCcw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSavingAgent ? 'Enregistrement...' : 'Enregistrer l’agent'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
