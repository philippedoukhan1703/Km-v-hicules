import React, { useEffect, useState } from 'react';
import { FleetDatabase, Vehicle, Agent, Trip, MonthlyReport, TeamId } from './types.ts';
import { FleetService } from './services/fleetService.ts';
import { Navbar, ActiveNavTab } from './components/Navbar.tsx';
import { FleetView } from './components/FleetView.tsx';
import { MonthlyReleveView } from './components/MonthlyReleveView.tsx';
import { TripsHistoryView } from './components/TripsHistoryView.tsx';
import { QRStickersView } from './components/QRStickersView.tsx';
import { ConfigView } from './components/ConfigView.tsx';
import { QRScannerModal } from './components/QRScannerModal.tsx';
import { TripRecordModal } from './components/TripRecordModal.tsx';
import { IPhoneInstallBanner } from './components/IPhoneInstallBanner.tsx';
import {
  Calendar,
  AlertCircle,
  Camera,
  RefreshCw,
  ExternalLink,
  Zap,
  Info
} from 'lucide-react';

export default function App() {
  const [fleetData, setFleetData] = useState<FleetDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('fleet');
  const [selectedTeam, setSelectedTeam] = useState<TeamId | 'ALL'>('ALL');
  const [currentReportId, setCurrentReportId] = useState<string>('');

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedVehicleToRecord, setSelectedVehicleToRecord] = useState<Vehicle | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // Refresh handler
  const handleRefresh = async () => {
    await loadData();
  };
  const loadData = async () => {
    try {
      const data = await FleetService.getFleetData(true);
      setFleetData(data);
      if (data.monthlyReports.length > 0 && !currentReportId) {
        const active = data.monthlyReports.find(r => !r.cloture) || data.monthlyReports[0];
        setCurrentReportId(active.id);
      }
      return data;
    } catch (err) {
      console.error('Failed to load fleet data:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData().then(data => {
      if (!data) return;

      // Check URL query parameters for direct QR scan link (e.g. ?scan=ESC-KNG-01 or ?vehicle=veh-esc-01)
      const params = new URLSearchParams(window.location.search);
      let scanParam = params.get('scan') || params.get('vehicle');
      if (!scanParam && window.location.hash.includes('?')) {
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
        scanParam = hashParams.get('scan') || hashParams.get('vehicle');
      }

      if (scanParam) {
        const cleaned = decodeURIComponent(scanParam).trim().toLowerCase();
        const cleanedPlate = cleaned.replace(/[^a-z0-9]/g, '');
        const matched = data.vehicles.find(
          v =>
            v.id.toLowerCase() === cleaned ||
            v.code.toLowerCase() === cleaned ||
            v.immatriculation.toLowerCase() === cleaned ||
            v.immatriculation.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanedPlate
        );
        if (matched) {
          setSelectedVehicleToRecord(matched);
          setIsRecordModalOpen(true);
        }
      }
    });

    // Auto-refresh when tab gains focus or returns from camera
    const handleRecheck = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    window.addEventListener('focus', handleRecheck);
    document.addEventListener('visibilitychange', handleRecheck);
    return () => {
      window.removeEventListener('focus', handleRecheck);
      document.removeEventListener('visibilitychange', handleRecheck);
    };
  }, []);

  // When a vehicle is identified via QR camera scan or selection
  const handleVehicleIdentified = async (vehicle: Vehicle) => {
    setIsScannerOpen(false);
    // Reload fresh data from server to ensure latest collaborators and kms
    const fresh = await FleetService.getFleetData(true);
    if (fresh) {
      setFleetData(fresh);
      const updated = fresh.vehicles.find(v => v.id === vehicle.id) || vehicle;
      setSelectedVehicleToRecord(updated);
    } else {
      setSelectedVehicleToRecord(vehicle);
    }
    setIsRecordModalOpen(true);
  };

  // Direct click to record
  const handleOpenRecordForVehicle = async (vehicle: Vehicle) => {
    const fresh = await FleetService.getFleetData(true);
    if (fresh) {
      setFleetData(fresh);
      const updated = fresh.vehicles.find(v => v.id === vehicle.id) || vehicle;
      setSelectedVehicleToRecord(updated);
    } else {
      setSelectedVehicleToRecord(vehicle);
    }
    setIsRecordModalOpen(true);
  };

  // Save trip from record modal
  const handleSaveTrip = async (tripData: Omit<Trip, 'id' | 'createdAt' | 'kmParcourus' | 'statut'>) => {
    await FleetService.recordTrip(tripData);
    await loadData();
  };

  // Delete trip
  const handleDeleteTrip = async (id: string) => {
    await FleetService.deleteTrip(id);
    await loadData();
  };

  if (loading || !fleetData) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center animate-spin">
          <RefreshCw className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-300">
          Chargement de la flotte RTE Escaillon & Les Arcs...
        </p>
      </div>
    );
  }

  const activeReport = fleetData.monthlyReports.find(r => r.id === currentReportId) || fleetData.monthlyReports[0];
  const pendingCount = activeReport ? activeReport.records.filter(r => r.statutReleve === 'A_RELEVER').length : 0;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 selection:bg-sky-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        selectedTeam={selectedTeam}
        onSelectTeam={setSelectedTeam}
        onOpenScanner={() => setIsScannerOpen(true)}
        pendingRelevesCount={pendingCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24 sm:pb-10">
        {/* iPhone PWA Installation Prompt */}
        <IPhoneInstallBanner />

        {/* Relevé du 20 alert reminder banner */}
        <div className="no-print bg-sky-950 text-sky-100 border border-sky-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-sky-500/20 text-sky-300 rounded-lg shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white">Rituel du 20 du mois :</span>{' '}
              <span>
                Calcul automatique des consommations mensuelles du 21 au 20. Fichier Teams / SharePoint prêt à copier.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={() => setActiveTab('monthly')}
              className="text-xs font-semibold text-sky-300 hover:text-white underline decoration-sky-500 underline-offset-2"
            >
              Consulter le bilan du 20 →
            </button>
          </div>
        </div>

        {/* View Switcher */}
        {activeTab === 'fleet' && (
          <FleetView
            vehicles={fleetData.vehicles}
            selectedTeam={selectedTeam}
            onSelectVehicleToRecord={handleOpenRecordForVehicle}
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        )}

        {activeTab === 'monthly' && (
          <MonthlyReleveView
            reports={fleetData.monthlyReports}
            currentReportId={currentReportId}
            onSelectReport={setCurrentReportId}
            vehicles={fleetData.vehicles}
            agents={fleetData.agents}
            sharepointUrl={fleetData.sharepointUrl}
            selectedTeam={selectedTeam}
            onRefreshData={handleRefresh}
          />
        )}

        {activeTab === 'history' && (
          <TripsHistoryView
            trips={fleetData.trips}
            vehicles={fleetData.vehicles}
            agents={fleetData.agents}
            selectedTeam={selectedTeam}
            onDeleteTrip={handleDeleteTrip}
          />
        )}

        {activeTab === 'stickers' && (
          <QRStickersView
            vehicles={fleetData.vehicles}
            onSelectVehicleToRecord={handleOpenRecordForVehicle}
            selectedTeam={selectedTeam}
          />
        )}

        {activeTab === 'config' && (
          <ConfigView
            vehicles={fleetData.vehicles}
            agents={fleetData.agents}
            sharepointUrl={fleetData.sharepointUrl}
            onRefreshData={handleRefresh}
            selectedTeam={selectedTeam}
          />
        )}
      </main>

      {/* QR Scanner Modal (Camera & Fast Selection Fallback) */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        vehicles={fleetData.vehicles}
        onVehicleIdentified={handleVehicleIdentified}
        selectedTeam={selectedTeam}
      />

      {/* Trip Return & Mileage Recording Modal */}
      <TripRecordModal
        vehicle={selectedVehicleToRecord}
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setSelectedVehicleToRecord(null);
        }}
        agents={fleetData.agents}
        onSaveTrip={handleSaveTrip}
        onOpenAgentModal={() => {
          setIsRecordModalOpen(false);
          setActiveTab('config');
        }}
      />

      {/* Footer */}
      <footer className="no-print bg-white border-t border-slate-200 mt-12 py-6 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#0f2b48] flex items-center justify-center text-white text-[10px] font-bold">
              RTE
            </div>
            <span className="font-semibold text-slate-700">RTE France · Flotte Véhicules & Heures Engins</span>
            <span>-</span>
            <span>Bases ESCAILLON & LES ARCS</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Relevé mensuel rituel au 20</span>
            <span>·</span>
            <a
              href={fleetData.sharepointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-700 hover:text-sky-900 underline flex items-center gap-1"
            >
              <span>Accès SharePoint Teams</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
