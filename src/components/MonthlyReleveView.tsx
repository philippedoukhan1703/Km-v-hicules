import React, { useState } from 'react';
import { MonthlyReport, VehicleMonthlyRecord, TeamId, Vehicle, Agent } from '../types.ts';
import { VehiclePlate } from './VehiclePlate.tsx';
import { FleetService } from '../services/fleetService.ts';
import {
  Calendar,
  Download,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Unlock,
  TrendingUp,
  FileSpreadsheet,
  Clock,
  Printer,
  FileText,
  ClipboardList,
  CheckCircle2,
  X,
  ShieldCheck,
  Users,
  ChevronRight,
  Building
} from 'lucide-react';

interface MonthlyReleveViewProps {
  reports: MonthlyReport[];
  currentReportId: string;
  onSelectReport: (reportId: string) => void;
  vehicles: Vehicle[];
  agents: Agent[];
  sharepointUrl: string;
  selectedTeam: TeamId | 'ALL';
  onRefreshData: () => Promise<void>;
}

export type PrintReportType = 'OFFICIAL_SUMMARY' | 'PARKING_CHECKLIST';

export const MonthlyReleveView: React.FC<MonthlyReleveViewProps> = ({
  reports,
  currentReportId,
  onSelectReport,
  vehicles,
  agents,
  sharepointUrl,
  selectedTeam,
  onRefreshData,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [editingRecord, setEditingRecord] = useState<{
    record: VehicleMonthlyRecord;
    kmActuel: number;
    heuresActuel?: number;
    observations: string;
    agentReleve: string;
  } | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isClosingReport, setIsClosingReport] = useState(false);

  // Print states
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [activePrintType, setActivePrintType] = useState<PrintReportType>('OFFICIAL_SUMMARY');
  const [printTeamScope, setPrintTeamScope] = useState<TeamId | 'ALL'>(selectedTeam);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const activeReport = reports.find(r => r.id === currentReportId) || reports[0];

  if (!activeReport) {
    return (
      <div className="text-center py-12 text-slate-500">
        Aucun relevé mensuel disponible.
      </div>
    );
  }

  // Filter records by team for normal display
  const filteredRecords = activeReport.records.filter(r => {
    if (selectedTeam === 'ALL') return true;
    return r.equipe === selectedTeam;
  });

  // Filter records specifically for print scope
  const printRecords = activeReport.records.filter(r => {
    if (printTeamScope === 'ALL') return true;
    return r.equipe === printTeamScope;
  });

  // Calculate totals
  const totalKmsMonth = filteredRecords.reduce((acc, r) => acc + (r.kmMois || 0), 0);
  const totalHoursMonth = filteredRecords.reduce((acc, r) => acc + (r.heuresMois || 0), 0);
  const totalMissionsMonth = filteredRecords.reduce((acc, r) => acc + (r.nbTrajets || 0), 0);
  const validatedCount = filteredRecords.filter(r => r.statutReleve === 'VALIDE').length;

  const escaillonKms = activeReport.records
    .filter(r => r.equipe === 'ESCAILLON')
    .reduce((acc, r) => acc + (r.kmMois || 0), 0);

  const lesArcsKms = activeReport.records
    .filter(r => r.equipe === 'LES ARCS')
    .reduce((acc, r) => acc + (r.kmMois || 0), 0);

  // Copy table TSV for direct paste into SharePoint Teams Excel
  const handleCopyForSharepoint = () => {
    const tsvText = FleetService.formatForSharepointClipboard(activeReport);
    navigator.clipboard.writeText(tsvText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Download CSV
  const handleDownloadCsv = () => {
    window.location.href = `/api/export/csv?reportId=${encodeURIComponent(activeReport.id)}`;
  };

  // Trigger print preview modal
  const handleLaunchPrint = (type: PrintReportType) => {
    setActivePrintType(type);
    setPrintTeamScope(selectedTeam);
    setIsPrintModalOpen(false);
    setShowPrintPreview(true);
  };

  // Save manual edit for a vehicle in this monthly record
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setIsSubmittingEdit(true);

    try {
      await FleetService.recordMonthlyReading(
        activeReport.id,
        editingRecord.record.vehicleId,
        editingRecord.kmActuel,
        editingRecord.heuresActuel,
        editingRecord.agentReleve,
        editingRecord.observations
      );
      await onRefreshData();
      setEditingRecord(null);
    } catch (err) {
      console.error('Error saving manual reading:', err);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Close report
  const handleCloseReport = async () => {
    const confirm = window.confirm(
      `Confirmez-vous la clôture officielle du relevé du 20 pour la période ${activeReport.nomPeriode} ?\nCette action initialisera le mois suivant.`
    );
    if (!confirm) return;

    setIsClosingReport(true);
    try {
      await FleetService.closeMonthlyReport(activeReport.id, 'Responsable Flotte RTE');
      await onRefreshData();
    } catch (err) {
      console.error('Error closing report:', err);
    } finally {
      setIsClosingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: SharePoint Link & Ritual 20th Deadline */}
      <div className="no-print bg-gradient-to-r from-[#0f2b48] to-[#163961] text-white rounded-2xl p-6 shadow-sm border border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
            <Calendar className="w-4 h-4" />
            <span>Rituel Mensuel RTE · Relevé de Flotte au 20 du mois</span>
          </div>

          <h2 className="text-2xl font-black tracking-tight">{activeReport.nomPeriode}</h2>

          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Période de calcul officielle : du{' '}
            <strong className="text-white font-mono">{activeReport.dateDebutPeriode}</strong> au{' '}
            <strong className="text-white font-mono">{activeReport.dateFinPeriode}</strong>.
            Tous les kilomètres et heures enregistrés lors des retours de prêts ou par relevé direct sont consolidés ci-dessous pour intégration dans Teams / SharePoint.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{validatedCount} sur {filteredRecords.length} véhicules relevés</span>
            </span>
            <span className="text-slate-400">·</span>
            {activeReport.cloture ? (
              <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                <Lock className="w-3.5 h-3.5" /> Clôturé le {new Date(activeReport.dateCloture || '').toLocaleDateString('fr-FR')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                <Unlock className="w-3.5 h-3.5" /> Relevé actif en cours
              </span>
            )}
          </div>
        </div>

        {/* SharePoint / Teams & Print Action Hub */}
        <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/15 flex flex-col gap-2.5 shrink-0 min-w-[300px]">
          <div className="flex items-center justify-between text-xs text-sky-200 font-medium">
            <span className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Exports & Impression Officielle</span>
            </span>
            <span className="text-[10px] bg-sky-500/20 px-1.5 py-0.5 rounded text-sky-300 font-mono">GMR Var</span>
          </div>

          {/* Exporter en PDF Button */}
          <button
            onClick={() => handleLaunchPrint('OFFICIAL_SUMMARY')}
            className="flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs py-2 px-3 rounded-lg transition-all shadow-xs"
            title="Exporter le bilan mensuel officiel en PDF (format A4)"
          >
            <FileText className="w-4 h-4 text-slate-950" />
            <span>Exporter en PDF (Bilan A4)</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {/* Direct Print Button */}
            <button
              onClick={() => {
                setPrintTeamScope(selectedTeam);
                setIsPrintModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition-all shadow-xs"
              title="Imprimer le relevé officiel ou la feuille de tournée terrain"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>Imprimer le relevé</span>
            </button>

            {/* SharePoint Link */}
            <a
              href={sharepointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 px-3 rounded-lg transition-colors shadow-xs"
            >
              <span>Teams / Excel</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
            <button
              onClick={handleCopyForSharepoint}
              className="flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium py-1.5 px-2.5 rounded transition-colors"
              title="Copier toutes les colonnes pour un collage direct (Ctrl+V) dans le tableau Excel Teams"
            >
              {copySuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-200">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier (Excel)</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadCsv}
              className="flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium py-1.5 px-2.5 rounded transition-colors"
              title="Télécharger le fichier CSV exportable"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards - Hidden during print */}
      <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Kilomètres */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Kms Mois Flotte</span>
            <TrendingUp className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-slate-900">
              {totalKmsMonth.toLocaleString('fr-FR')}
            </span>
            <span className="text-xs font-semibold text-slate-500">km</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Total période du 21 au 20
          </div>
        </div>

        {/* Répartition ESCAILLON */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Équipe ESCAILLON</span>
            <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">Toulon</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-slate-900">
              {escaillonKms.toLocaleString('fr-FR')}
            </span>
            <span className="text-xs font-semibold text-slate-500">km</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {activeReport.records.filter(r => r.equipe === 'ESCAILLON').length} véhicules affectés
          </div>
        </div>

        {/* Répartition LES ARCS */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Équipe LES ARCS</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Draguignan</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-slate-900">
              {lesArcsKms.toLocaleString('fr-FR')}
            </span>
            <span className="text-xs font-semibold text-slate-500">km</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {activeReport.records.filter(r => r.equipe === 'LES ARCS').length} véhicules affectés
          </div>
        </div>

        {/* Heures engins & Missions */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Heures Engins & Missions</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-slate-900">
              {totalHoursMonth} h
            </span>
            <span className="text-xs font-semibold text-slate-500">· {totalMissionsMonth} sorties</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Nacelles, camions grues & treuils
          </div>
        </div>
      </div>

      {/* Main Table: Consolidated Vehicle Readings (Screen Display) */}
      <div className="no-print bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-700">Choisir le mois :</label>
            <select
              value={activeReport.id}
              onChange={e => onSelectReport(e.target.value)}
              className="text-xs font-medium border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {reports.map(r => (
                <option key={r.id} value={r.id}>
                  {r.nomPeriode} {r.cloture ? '(Clôturé)' : '(Actif)'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleLaunchPrint('OFFICIAL_SUMMARY')}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-500 transition-colors shadow-2xs"
              title="Exporter en PDF (Bilan Officiel A4)"
            >
              <FileText className="w-3.5 h-3.5 text-slate-950" />
              <span>Exporter en PDF</span>
            </button>

            <button
              onClick={() => {
                setPrintTeamScope(selectedTeam);
                setIsPrintModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 transition-colors shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Imprimer</span>
            </button>

            {!activeReport.cloture && (
              <button
                onClick={handleCloseReport}
                disabled={isClosingReport}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-2xs"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>{isClosingReport ? 'Clôture...' : 'Clôturer le relevé du 20'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 min-w-[110px] whitespace-nowrap">Équipe</th>
                <th className="py-3 px-4 min-w-[180px] whitespace-nowrap">Immatriculation</th>
                <th className="py-3 px-4 min-w-[240px]">Désignation véhicule</th>
                <th className="py-3 px-4 text-right min-w-[160px] whitespace-nowrap">Index M-1</th>
                <th className="py-3 px-4 text-right min-w-[210px] whitespace-nowrap">
                  <div>Index M au 20</div>
                  <div className="text-[10px] font-normal text-slate-500">(si 0 km, reprise de M-1)</div>
                </th>
                <th className="py-3 px-4 text-right min-w-[170px] whitespace-nowrap">Kms parcourus en M</th>
                <th className="py-3 px-4 text-right min-w-[120px] whitespace-nowrap">Heures Engin</th>
                <th className="py-3 px-4 text-center min-w-[90px] whitespace-nowrap">Trajets</th>
                <th className="py-3 px-4 min-w-[120px] whitespace-nowrap">Statut</th>
                <th className="py-3 px-4 text-right min-w-[100px] whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map(r => {
                const hasHours = r.heuresActuel !== undefined;

                return (
                  <tr key={r.vehicleId} className="hover:bg-slate-50/80 transition-colors">
                    {/* Équipe */}
                    <td className="py-3.5 px-4 font-semibold text-slate-800 min-w-[110px] whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                        r.equipe === 'ESCAILLON'
                          ? 'bg-sky-50 text-sky-800'
                          : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {r.equipe}
                      </span>
                    </td>

                    {/* Immatriculation */}
                    <td className="py-3.5 px-4 min-w-[180px] whitespace-nowrap">
                      <VehiclePlate immatriculation={r.immatriculation} size="sm" />
                    </td>

                    {/* Modèle & Type */}
                    <td className="py-3.5 px-4 min-w-[240px]">
                      <div className="font-semibold text-slate-900">{r.modele}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                        {r.centreDeCout && (
                          <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                            {r.centreDeCout}
                          </span>
                        )}
                        {r.structureEquipe && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {r.structureEquipe}
                          </span>
                        )}
                        {r.observations && <span className="text-slate-500 italic">· {r.observations}</span>}
                      </div>
                    </td>

                    {/* Index 20 M-1 */}
                    <td className="py-3.5 px-4 text-right font-mono text-slate-500 min-w-[150px] whitespace-nowrap">
                      {r.kmPrecedent.toLocaleString('fr-FR')} km
                    </td>

                    {/* Index 20 M */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 min-w-[150px] whitespace-nowrap">
                      {r.kmActuel.toLocaleString('fr-FR')} km
                    </td>

                    {/* Total Kms du mois (Delta) */}
                    <td className="py-3.5 px-4 text-right min-w-[170px] whitespace-nowrap">
                      <span className="font-mono font-black text-sm text-sky-800 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200/90 inline-block shadow-2xs whitespace-nowrap">
                        +{r.kmMois.toLocaleString('fr-FR')} km
                      </span>
                    </td>

                    {/* Heures Engin */}
                    <td className="py-3.5 px-4 text-right font-mono">
                      {hasHours ? (
                        <div>
                          <span className="font-bold text-amber-700">+{r.heuresMois ?? 0} h</span>
                          <span className="text-[10px] text-slate-400 block font-normal">
                            ({r.heuresActuel} h total)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Nb Trajets */}
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                      {r.nbTrajets}
                    </td>

                    {/* Statut */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {r.statutReleve === 'VALIDE' ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Relevé</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-[11px]">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>À relever</span>
                        </div>
                      )}
                      {r.dateDerniereSaisie && (
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {new Date(r.dateDerniereSaisie).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          setEditingRecord({
                            record: r,
                            kmActuel: r.kmActuel,
                            heuresActuel: r.heuresActuel,
                            observations: r.observations || '',
                            agentReleve: r.agentReleve || ''
                          })
                        }
                        className="text-xs font-semibold text-sky-600 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded transition-colors"
                      >
                        Saisir / Ajuster
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINT-ONLY VIEW 1: OFFICIAL CONSOLIDATED REPORT (BILAN OFFICIEL) */}
      {/* ========================================================================= */}
      {activePrintType === 'OFFICIAL_SUMMARY' && (
        <div className="print-only print-a4-page bg-white font-sans text-slate-900">
          {/* Header officiel RTE */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-[#0f2b48] text-white flex items-center justify-center font-black text-sm">
                  RTE
                </div>
                <div>
                  <h1 className="text-lg font-black tracking-tight uppercase">
                    Réseau de Transport d'Électricité · GMR Var
                  </h1>
                  <p className="text-xs font-semibold text-slate-700">
                    Bilan Officiel des Consommations Flotte & Heures Engins au 20 du mois
                  </p>
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="font-bold text-sm">{activeReport.nomPeriode}</div>
                <div className="text-slate-600">Du {activeReport.dateDebutPeriode} au {activeReport.dateFinPeriode}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Édité le {new Date().toLocaleDateString('fr-FR')}</div>
              </div>
            </div>
          </div>

          {/* Synthèse des indicateurs */}
          <div className="grid grid-cols-4 gap-3 mb-4 text-xs">
            <div className="p-2.5 border border-slate-300 rounded bg-slate-50">
              <div className="text-slate-500 font-medium">Total Kms Période</div>
              <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                {printRecords.reduce((acc, r) => acc + (r.kmMois || 0), 0).toLocaleString('fr-FR')} km
              </div>
            </div>
            <div className="p-2.5 border border-slate-300 rounded bg-slate-50">
              <div className="text-slate-500 font-medium">Heures Engins Période</div>
              <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                {printRecords.reduce((acc, r) => acc + (r.heuresMois || 0), 0)} h
              </div>
            </div>
            <div className="p-2.5 border border-slate-300 rounded bg-slate-50">
              <div className="text-slate-500 font-medium">Véhicules Imprimés</div>
              <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                {printRecords.length} véhicules
              </div>
            </div>
            <div className="p-2.5 border border-slate-300 rounded bg-slate-50">
              <div className="text-slate-500 font-medium">Périmètre Équipe</div>
              <div className="text-base font-black text-slate-900 mt-0.5">
                {printTeamScope === 'ALL' ? 'Escaillon & Les Arcs' : `Équipe ${printTeamScope}`}
              </div>
            </div>
          </div>

          {/* Tableau imprimable officiel */}
          <table className="w-full text-left text-[11px] border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100 text-slate-800 border-b border-slate-400 font-bold">
                <th className="py-2 px-2.5 border-r border-slate-300">Équipe</th>
                <th className="py-2 px-2.5 border-r border-slate-300">Immat.</th>
                <th className="py-2 px-2.5 border-r border-slate-300">Modèle / Marque</th>
                <th className="py-2 px-2.5 border-r border-slate-300 text-right">Index M-1</th>
                <th className="py-2 px-2.5 border-r border-slate-300 text-right">Index au 20</th>
                <th className="py-2 px-2.5 border-r border-slate-300 text-right">Kms Mois</th>
                <th className="py-2 px-2.5 border-r border-slate-300 text-right">Heures</th>
                <th className="py-2 px-2.5 border-r border-slate-300">Relevé par</th>
                <th className="py-2 px-2.5">Statut</th>
              </tr>
            </thead>
            <tbody>
              {printRecords.map((r, idx) => (
                <tr key={r.vehicleId} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="py-1.5 px-2.5 border-r border-b border-slate-300 font-bold">{r.equipe}</td>
                  <td className="py-1.5 px-2.5 border-r border-b border-slate-300 font-mono font-bold">{r.immatriculation}</td>
                  <td className="py-1.5 px-2.5 border-r border-b border-slate-300">{r.modele}</td>
                  <td className="py-1.5 px-2.5 border-r border-b border-slate-300 text-right font-mono">{r.kmPrecedent.toLocaleString('fr-FR')}</td>
                  <td className="py-1.5 px-2.5 border-r border-b border-slate-300 text-right font-mono font-bold">{r.kmActuel.toLocaleString('fr-FR')}</td>
                  <td className="py-1.5 px-2.5 border-r border-b border-slate-300 text-right font-mono font-black text-slate-900">+{r.kmMois.toLocaleString('fr-FR')}</td>
                  <td className="py-1.5 px-2.5 border-r border-b border-slate-300 text-right font-mono">
                    {r.heuresActuel !== undefined ? `+${r.heuresMois || 0} h` : '-'}
                  </td>
                  <td className="py-1.5 px-2.5 border-r border-b border-slate-300 text-[10px] text-slate-600">{r.agentReleve || '-'}</td>
                  <td className="py-1.5 px-2.5 border-b border-slate-300 font-bold text-[10px] text-emerald-800">
                    {r.statutReleve === 'VALIDE' ? 'VALIDÉ' : 'EN ATTENTE'}
                  </td>
                </tr>
              ))}
              {/* Totaux row */}
              <tr className="bg-slate-200 font-black border-t-2 border-slate-500 text-slate-950">
                <td colSpan={3} className="py-2 px-2.5 text-right uppercase">TOTAL GÉNÉRAL PÉRIODE :</td>
                <td className="py-2 px-2.5 text-right font-mono">
                  {printRecords.reduce((acc, r) => acc + r.kmPrecedent, 0).toLocaleString('fr-FR')}
                </td>
                <td className="py-2 px-2.5 text-right font-mono">
                  {printRecords.reduce((acc, r) => acc + r.kmActuel, 0).toLocaleString('fr-FR')}
                </td>
                <td className="py-2 px-2.5 text-right font-mono text-sm">
                  +{printRecords.reduce((acc, r) => acc + (r.kmMois || 0), 0).toLocaleString('fr-FR')} km
                </td>
                <td className="py-2 px-2.5 text-right font-mono">
                  +{printRecords.reduce((acc, r) => acc + (r.heuresMois || 0), 0)} h
                </td>
                <td colSpan={2} className="py-2 px-2.5 text-[10px] text-slate-600 font-normal">
                  Données certifiées conformes
                </td>
              </tr>
            </tbody>
          </table>

          {/* Cadre de signatures officielles RTE */}
          <div className="mt-8 pt-4 border-t-2 border-slate-400 print-break-inside-avoid">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
              Cadre d'Approbation & Visas Officiels RTE (GMR Var)
            </h3>
            <div className="grid grid-cols-3 gap-6 text-xs">
              <div className="border border-slate-300 rounded p-3 h-28 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-slate-900">Responsable d'Équipe</div>
                  <div className="text-[11px] text-slate-600">GENDRE Ludovic</div>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-200 pt-1">
                  Date & Signature :
                </div>
              </div>

              <div className="border border-slate-300 rounded p-3 h-28 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-slate-900">Admin. de la Base (Technicien)</div>
                  <div className="text-[11px] text-slate-600">DOUKHAN Philippe</div>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-200 pt-1">
                  Date & Visa de saisie :
                </div>
              </div>

              <div className="border border-slate-300 rounded p-3 h-28 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-slate-900">Adjoints d'Équipe</div>
                  <div className="text-[11px] text-slate-600">THUAN J. (Esc.) / DUGAS J. (Arcs)</div>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-200 pt-1">
                  Visa de contrôle :
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINT-ONLY VIEW 2: PARKING TOUR CHECKLIST (FEUILLE DE TOURNÉE VIERGE) */}
      {/* ========================================================================= */}
      {activePrintType === 'PARKING_CHECKLIST' && (
        <div className="print-only font-sans text-slate-900">
          {/* Header Tournée */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-[#0f2b48] text-white flex items-center justify-center font-black text-sm">
                  RTE
                </div>
                <div>
                  <h1 className="text-lg font-black tracking-tight uppercase">
                    RTE · GMR Var · Feuille de Tournée Physique du 20
                  </h1>
                  <p className="text-xs font-semibold text-slate-700">
                    Fiche d'émargement et relevé sur site des compteurs kilométriques et horaires
                  </p>
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="font-bold text-sm">{activeReport.nomPeriode}</div>
                <div className="text-slate-600">Tournée du 20 · Date : ________________</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Agent releveur : ________________</div>
              </div>
            </div>
          </div>

          <div className="mb-3 p-2 bg-slate-50 border border-slate-300 rounded text-[11px] text-slate-700">
            <strong>Consignes de relevé :</strong> Parcourir le parking le 20 du mois. Noter l'index kilométrique relevé au tableau de bord (et l'index horaire pour les engins et nacelles). Noter toute anomalie (voyant allumé, révision, choc carrosserie). Remettre cette feuille signée à <strong>Philippe DOUKHAN</strong> pour synchronisation dans l'application.
          </div>

          {/* Tableau de relevé terrain avec cases vierges */}
          <table className="w-full text-left text-[11px] border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100 text-slate-800 border-b border-slate-400 font-bold">
                <th className="py-2 px-2 border-r border-slate-300 w-16">Code</th>
                <th className="py-2 px-2 border-r border-slate-300 w-24">Immat.</th>
                <th className="py-2 px-2 border-r border-slate-300">Véhicule & Emplacement</th>
                <th className="py-2 px-2 border-r border-slate-300 text-right w-24">Index M-1</th>
                <th className="py-2 px-2 border-r border-slate-300 w-32 bg-amber-50 text-slate-900 font-black">
                  INDEX AU 20 (Km)
                </th>
                <th className="py-2 px-2 border-r border-slate-300 w-24">Index Heures</th>
                <th className="py-2 px-2 border-r border-slate-300 w-28">Visa / Agent</th>
                <th className="py-2 px-2">Observations / Anomalies</th>
              </tr>
            </thead>
            <tbody>
              {printRecords.map((r, idx) => {
                const veh = vehicles.find(v => v.id === r.vehicleId);
                return (
                  <tr key={r.vehicleId} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                    <td className="py-2 px-2 border-r border-b border-slate-300 font-mono font-bold">{veh?.code || '-'}</td>
                    <td className="py-2 px-2 border-r border-b border-slate-300 font-mono font-bold text-xs">{r.immatriculation}</td>
                    <td className="py-2 px-2 border-r border-b border-slate-300">
                      <div className="font-semibold">{r.modele}</div>
                      <div className="text-[10px] text-slate-500">
                        {r.equipe} {veh?.emplacement ? `· Park : ${veh.emplacement}` : ''}
                      </div>
                    </td>
                    <td className="py-2 px-2 border-r border-b border-slate-300 text-right font-mono text-slate-600">
                      {r.kmPrecedent.toLocaleString('fr-FR')} km
                    </td>
                    {/* Case vide pour écrire au stylo l'index au 20 */}
                    <td className="py-2 px-2 border-r border-b border-slate-300 bg-white border-2 border-slate-400">
                      <div className="h-6 flex items-center justify-end font-mono text-xs font-bold text-slate-900 pr-1">
                        {/* Empty box for manual pen writing */}
                      </div>
                    </td>
                    {/* Case vide pour heures */}
                    <td className="py-2 px-2 border-r border-b border-slate-300 text-right">
                      {r.heuresActuel !== undefined ? (
                        <div className="h-6 text-[10px] text-slate-400 text-right pt-1">
                          Préc: {r.heuresActuel} h
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 border-r border-b border-slate-300">
                      <div className="h-6" />
                    </td>
                    <td className="py-2 px-2 border-b border-slate-300">
                      <div className="h-6" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Bloc de fin de tournée */}
          <div className="mt-8 pt-4 border-t-2 border-slate-400 print-break-inside-avoid">
            <div className="grid grid-cols-2 gap-6 text-xs">
              <div className="border border-slate-300 rounded p-3 h-28 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-slate-900">Agent ayant effectué la tournée parking</div>
                  <div className="text-[11px] text-slate-500">Nom & Prénom : ______________________</div>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-200 pt-1">
                  Signature du releveur :
                </div>
              </div>

              <div className="border border-slate-300 rounded p-3 h-28 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-slate-900">Réception & Saisie Administrateur</div>
                  <div className="text-[11px] text-slate-500">Philippe DOUKHAN (Technicien / Admin de base)</div>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-200 pt-1">
                  Date de saisie dans l'outil & Visa :
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINT SELECTION MODAL */}
      {/* ========================================================================= */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Impression des Relevés du 20</h3>
                  <p className="text-xs text-slate-500">Sélectionnez le type de document et le périmètre</p>
                </div>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scope selection */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1.5">Périmètre de l'équipe à imprimer :</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPrintTeamScope('ALL')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    printTeamScope === 'ALL'
                      ? 'bg-sky-500 text-slate-950 border-sky-500 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Toutes les équipes ({activeReport.records.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintTeamScope('ESCAILLON')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    printTeamScope === 'ESCAILLON'
                      ? 'bg-sky-500 text-slate-950 border-sky-500 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  ESCAILLON ({activeReport.records.filter(r => r.equipe === 'ESCAILLON').length})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintTeamScope('LES ARCS')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    printTeamScope === 'LES ARCS'
                      ? 'bg-sky-500 text-slate-950 border-sky-500 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  LES ARCS ({activeReport.records.filter(r => r.equipe === 'LES ARCS').length})
                </button>
              </div>
            </div>

            {/* Type selector cards */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-800 block">Choisissez le modèle de document :</label>

              {/* Option 1: Official report */}
              <div
                onClick={() => handleLaunchPrint('OFFICIAL_SUMMARY')}
                className="group p-4 rounded-xl border-2 border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 cursor-pointer transition-all flex items-start justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-sky-100 text-sky-700 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-950">
                      Bilan Mensuel Officiel Consolidé
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Tableau complet avec tous les index (M-1 et M), consommations mensuelles, heures d'engins, et bloc officiel de signatures (Responsable, Admin de base, Adjoints).
                    </p>
                    <span className="inline-block mt-2 text-[10px] font-bold text-sky-700 bg-sky-100/70 px-2 py-0.5 rounded">
                      Idéal : Réunion d'équipe, Audit & Classeur d'archivage
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-sky-600 transition-colors shrink-0 mt-1" />
              </div>

              {/* Option 2: Parking checklist */}
              <div
                onClick={() => handleLaunchPrint('PARKING_CHECKLIST')}
                className="group p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 cursor-pointer transition-all flex items-start justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-950">
                      Feuille de Tournée Terrain & Émargement Parking
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Grille de relevé avec cases vierges à remplir au stylo lors de la tournée physique sur le parking le 20 du mois. Colonnes Index, Date, Nom & Observations.
                    </p>
                    <span className="inline-block mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                      Idéal : Tournée de relevé physique le 20 du mois
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0 mt-1" />
              </div>
            </div>

            <div className="pt-2 text-center text-[11px] text-slate-500">
              Le format d'impression est calibré automatiquement pour le papier A4 portrait ou paysage.
            </div>
          </div>
        </div>
      )}

      {/* Edit Single Vehicle Reading Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-lg text-slate-950">Relevé officiel au 20</h3>
                <p className="text-xs font-semibold text-slate-600">{editingRecord.record.modele} ({editingRecord.record.equipe})</p>
              </div>
              <VehiclePlate immatriculation={editingRecord.record.immatriculation} size="md" />
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-sm font-black text-slate-900 block mb-1.5">
                  Kilométrage officiel au 20 (Compteur)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min={editingRecord.record.kmPrecedent}
                    value={editingRecord.kmActuel}
                    onChange={e => setEditingRecord({ ...editingRecord, kmActuel: Number(e.target.value) })}
                    className="w-full font-mono text-2xl sm:text-3xl font-black border-2 border-slate-300 rounded-2xl px-4 py-3 pr-14 bg-white text-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 font-mono">
                    km
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-600 mt-1.5 block">
                  Index précédent (20 M-1) : <strong className="font-mono text-slate-900">{editingRecord.record.kmPrecedent.toLocaleString('fr-FR')} km</strong> ·
                  Delta calculé : <strong className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">+{Math.max(0, editingRecord.kmActuel - editingRecord.record.kmPrecedent)} km</strong>
                </span>
              </div>

              {editingRecord.heuresActuel !== undefined && (
                <div>
                  <label className="text-sm font-black text-slate-900 block mb-1.5">
                    Compteur horaire engin (heures moteur)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={editingRecord.heuresActuel}
                      onChange={e => setEditingRecord({ ...editingRecord, heuresActuel: Number(e.target.value) })}
                      className="w-full font-mono text-xl sm:text-2xl font-black border-2 border-slate-300 rounded-2xl px-4 py-2.5 pr-14 bg-white text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                      heures
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Agent ayant effectué le relevé
                </label>
                <select
                  value={editingRecord.agentReleve}
                  onChange={e => setEditingRecord({ ...editingRecord, agentReleve: e.target.value })}
                  required
                  className="w-full text-xs font-semibold border-2 border-slate-300 rounded-lg px-3 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">-- SÉLECTIONNER LE CONDUCTEUR --</option>
                  {agents.map(a => (
                    <option key={a.id} value={`${a.prenom} ${a.nom}`}>
                      {a.nom} {a.prenom} ({a.role} - {a.equipe})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Observations / Remarques pour Teams
                </label>
                <input
                  type="text"
                  value={editingRecord.observations}
                  onChange={e => setEditingRecord({ ...editingRecord, observations: e.target.value })}
                  placeholder="Ex: Véhicule resté au poste, entretien fait..."
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="bg-[#0f2b48] hover:bg-[#163961] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-2xs"
                >
                  {isSubmittingEdit ? 'Enregistrement...' : 'Valider ce relevé'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Preview A4 Modal */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-start p-2 sm:p-6 overflow-y-auto">
          {/* Top Control Bar */}
          <div className="sticky top-0 z-10 bg-slate-900 text-white rounded-xl px-6 py-3 shadow-xl mb-4 flex items-center justify-between w-full max-w-4xl border border-slate-700">
            <div className="flex items-center gap-3">
              <Printer className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="font-bold text-sm sm:text-base">Aperçu Avant Impression (Format A4)</h3>
                <p className="text-[11px] text-slate-400">
                  {activePrintType === 'OFFICIAL_SUMMARY' ? 'Bilan Mensuel Officiel Consolidé' : 'Feuille de Tournée Parking'} · Périmètre : {printTeamScope === 'ALL' ? 'Toutes les équipes' : printTeamScope}
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
                onClick={() => setShowPrintPreview(false)}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Fermer</span>
              </button>
            </div>
          </div>

          {/* A4 Paper Container */}
          <div className="bg-white text-slate-900 rounded-lg shadow-2xl p-8 sm:p-12 w-full max-w-[210mm] min-h-[297mm] mx-auto border border-slate-300 font-sans">
            {activePrintType === 'OFFICIAL_SUMMARY' ? (
              <div>
                {/* Header officiel RTE */}
                <div className="border-b-2 border-slate-900 pb-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-[#0f2b48] text-white flex items-center justify-center font-black text-sm">
                        RTE
                      </div>
                      <div>
                        <h1 className="text-lg font-black tracking-tight uppercase">
                          Réseau de Transport d'Électricité · GMR Var
                        </h1>
                        <p className="text-xs font-semibold text-slate-700">
                          Bilan Officiel des Consommations Flotte & Heures Engins au 20 du mois
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold text-sm">{activeReport.nomPeriode}</div>
                      <div className="text-slate-600">Du {activeReport.dateDebutPeriode} au {activeReport.dateFinPeriode}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Édité le {new Date().toLocaleDateString('fr-FR')}</div>
                    </div>
                  </div>
                </div>

                {/* Synthèse des indicateurs */}
                <div className="grid grid-cols-4 gap-3 mb-4 text-xs">
                  <div className="p-2.5 border border-slate-300 rounded bg-slate-50">
                    <div className="text-slate-500 font-medium">Total Kms Période</div>
                    <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                      {printRecords.reduce((acc, r) => acc + (r.kmMois || 0), 0).toLocaleString('fr-FR')} km
                    </div>
                  </div>
                  <div className="p-2.5 border border-slate-300 rounded bg-slate-50">
                    <div className="text-slate-500 font-medium">Heures Engins Période</div>
                    <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                      {printRecords.reduce((acc, r) => acc + (r.heuresMois || 0), 0)} h
                    </div>
                  </div>
                  <div className="p-2.5 border border-slate-300 rounded bg-slate-50">
                    <div className="text-slate-500 font-medium">Véhicules Imprimés</div>
                    <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                      {printRecords.length} véhicules
                    </div>
                  </div>
                  <div className="p-2.5 border border-slate-300 rounded bg-slate-50">
                    <div className="text-slate-500 font-medium">Périmètre Équipe</div>
                    <div className="text-base font-black text-slate-900 mt-0.5">
                      {printTeamScope === 'ALL' ? 'Escaillon & Les Arcs' : `Équipe ${printTeamScope}`}
                    </div>
                  </div>
                </div>

                {/* Tableau imprimable officiel */}
                <table className="w-full text-left text-[11px] border-collapse border border-slate-400">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-400 font-bold">
                      <th className="py-2 px-2.5 border-r border-slate-300">Équipe</th>
                      <th className="py-2 px-2.5 border-r border-slate-300">Immat.</th>
                      <th className="py-2 px-2.5 border-r border-slate-300">Modèle / Marque</th>
                      <th className="py-2 px-2.5 border-r border-slate-300 text-right">Index M-1</th>
                      <th className="py-2 px-2.5 border-r border-slate-300 text-right">Index au 20</th>
                      <th className="py-2 px-2.5 border-r border-slate-300 text-right">Kms Mois</th>
                      <th className="py-2 px-2.5 border-r border-slate-300 text-right">Heures</th>
                      <th className="py-2 px-2.5 border-r border-slate-300">Relevé par</th>
                      <th className="py-2 px-2.5">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printRecords.map((r, idx) => (
                      <tr key={r.vehicleId} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="py-1.5 px-2.5 border-r border-b border-slate-300 font-bold">{r.equipe}</td>
                        <td className="py-1.5 px-2.5 border-r border-b border-slate-300 font-mono font-bold">{r.immatriculation}</td>
                        <td className="py-1.5 px-2.5 border-r border-b border-slate-300">{r.modele}</td>
                        <td className="py-1.5 px-2.5 border-r border-b border-slate-300 text-right font-mono">{r.kmPrecedent.toLocaleString('fr-FR')}</td>
                        <td className="py-1.5 px-2.5 border-r border-b border-slate-300 text-right font-mono font-bold">{r.kmActuel.toLocaleString('fr-FR')}</td>
                        <td className="py-1.5 px-2.5 border-r border-b border-slate-300 text-right font-mono font-black text-slate-900">+{r.kmMois.toLocaleString('fr-FR')}</td>
                        <td className="py-1.5 px-2.5 border-r border-b border-slate-300 text-right font-mono">
                          {r.heuresActuel !== undefined ? `+${r.heuresMois || 0} h` : '-'}
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-b border-slate-300 text-[10px] text-slate-600">{r.agentReleve || '-'}</td>
                        <td className="py-1.5 px-2.5 border-b border-slate-300 font-bold text-[10px] text-emerald-800">
                          {r.statutReleve === 'VALIDE' ? 'VALIDÉ' : 'EN ATTENTE'}
                        </td>
                      </tr>
                    ))}
                    {/* Totaux row */}
                    <tr className="bg-slate-200 font-black border-t-2 border-slate-500 text-slate-950">
                      <td colSpan={3} className="py-2 px-2.5 text-right uppercase">TOTAL GÉNÉRAL PÉRIODE :</td>
                      <td className="py-2 px-2.5 text-right font-mono">
                        {printRecords.reduce((acc, r) => acc + r.kmPrecedent, 0).toLocaleString('fr-FR')}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono">
                        {printRecords.reduce((acc, r) => acc + r.kmActuel, 0).toLocaleString('fr-FR')}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-sm">
                        +{printRecords.reduce((acc, r) => acc + (r.kmMois || 0), 0).toLocaleString('fr-FR')} km
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono">
                        +{printRecords.reduce((acc, r) => acc + (r.heuresMois || 0), 0)} h
                      </td>
                      <td colSpan={2} className="py-2 px-2.5 text-[10px] text-slate-600 font-normal">
                        Données certifiées conformes
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Cadre de signatures officielles RTE */}
                <div className="mt-8 pt-4 border-t-2 border-slate-400">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                    Cadre d'Approbation & Visas Officiels RTE (GMR Var)
                  </h3>
                  <div className="grid grid-cols-3 gap-6 text-xs">
                    <div className="border border-slate-300 rounded p-3 h-28 flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-slate-900">Responsable d'Équipe</div>
                        <div className="text-[11px] text-slate-600">GENDRE Ludovic</div>
                      </div>
                      <div className="text-[10px] text-slate-400 border-t border-slate-200 pt-1">
                        Date & Signature :
                      </div>
                    </div>

                    <div className="border border-slate-300 rounded p-3 h-28 flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-slate-900">Admin. de la Base (Technicien)</div>
                        <div className="text-[11px] text-slate-600">DOUKHAN Philippe</div>
                      </div>
                      <div className="text-[10px] text-slate-400 border-t border-slate-200 pt-1">
                        Date & Visa de saisie :
                      </div>
                    </div>

                    <div className="border border-slate-300 rounded p-3 h-28 flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-slate-900">Adjoints d'Équipe</div>
                        <div className="text-[11px] text-slate-600">THUAN J. (Esc.) / DUGAS J. (Arcs)</div>
                      </div>
                      <div className="text-[10px] text-slate-400 border-t border-slate-200 pt-1">
                        Visa de contrôle :
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {/* Header Tournée */}
                <div className="border-b-2 border-slate-900 pb-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-[#0f2b48] text-white flex items-center justify-center font-black text-sm">
                        RTE
                      </div>
                      <div>
                        <h1 className="text-lg font-black tracking-tight uppercase">
                          RTE · GMR Var · Feuille de Tournée Physique du 20
                        </h1>
                        <p className="text-xs font-semibold text-slate-700">
                          Fiche d'émargement et relevé sur site des compteurs kilométriques et horaires
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold text-sm">{activeReport.nomPeriode}</div>
                      <div className="text-slate-600">Tournée du 20 · Date : ________________</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Agent releveur : ________________</div>
                    </div>
                  </div>
                </div>

                <div className="mb-3 p-2 bg-slate-50 border border-slate-300 rounded text-[11px] text-slate-700">
                  <strong>Consignes de relevé :</strong> Parcourir le parking le 20 du mois. Noter l'index kilométrique relevé au tableau de bord (et l'index horaire pour les engins et nacelles). Noter toute anomalie (voyant allumé, révision, choc carrosserie). Remettre cette feuille signée à <strong>Philippe DOUKHAN</strong> pour synchronisation dans l'application.
                </div>

                {/* Tableau de relevé terrain avec cases vierges */}
                <table className="w-full text-left text-[11px] border-collapse border border-slate-400">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-400 font-bold">
                      <th className="py-2 px-2 border-r border-slate-300 w-16">Code</th>
                      <th className="py-2 px-2 border-r border-slate-300 w-24">Immat.</th>
                      <th className="py-2 px-2 border-r border-slate-300">Véhicule & Emplacement</th>
                      <th className="py-2 px-2 border-r border-slate-300 text-right w-24">Index M-1</th>
                      <th className="py-2 px-2 border-r border-slate-300 w-32 bg-amber-50 text-slate-900 font-black">
                        INDEX AU 20 (Km)
                      </th>
                      <th className="py-2 px-2 border-r border-slate-300 w-24">Index Heures</th>
                      <th className="py-2 px-2 border-r border-slate-300 w-28">Visa / Agent</th>
                      <th className="py-2 px-2">Observations / Anomalies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printRecords.map((r, idx) => {
                      const veh = vehicles.find(v => v.id === r.vehicleId);
                      return (
                        <tr key={r.vehicleId} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                          <td className="py-2 px-2 border-r border-b border-slate-300 font-mono font-bold">{veh?.code || '-'}</td>
                          <td className="py-2 px-2 border-r border-b border-slate-300 font-mono font-bold text-xs">{r.immatriculation}</td>
                          <td className="py-2 px-2 border-r border-b border-slate-300">
                            <div className="font-semibold">{r.modele}</div>
                            <div className="text-[10px] text-slate-500">
                              {r.equipe} {veh?.emplacement ? `· Park : ${veh.emplacement}` : ''}
                            </div>
                          </td>
                          <td className="py-2 px-2 border-r border-b border-slate-300 text-right font-mono text-slate-600">
                            {r.kmPrecedent.toLocaleString('fr-FR')} km
                          </td>
                          <td className="py-2 px-2 border-r border-b border-slate-300 bg-white border-2 border-slate-400">
                            <div className="h-6 flex items-center justify-end font-mono text-xs font-bold text-slate-900 pr-1"></div>
                          </td>
                          <td className="py-2 px-2 border-r border-b border-slate-300 text-right">
                            {r.heuresActuel !== undefined ? (
                              <div className="h-6 text-[10px] text-slate-400 text-right pt-1">
                                Préc: {r.heuresActuel} h
                              </div>
                            ) : (
                              <span className="text-slate-300 text-[10px]">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2 border-r border-b border-slate-300"><div className="h-6" /></td>
                          <td className="py-2 px-2 border-b border-slate-300"><div className="h-6" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Bloc de fin de tournée */}
                <div className="mt-8 pt-4 border-t-2 border-slate-400">
                  <div className="grid grid-cols-2 gap-6 text-xs">
                    <div className="border border-slate-300 rounded p-3 h-28 flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-slate-900">Agent ayant effectué la tournée parking</div>
                        <div className="text-[11px] text-slate-500">Nom & Prénom : ______________________</div>
                      </div>
                      <div className="text-[10px] text-slate-400 border-t border-slate-200 pt-1">
                        Signature du releveur :
                      </div>
                    </div>

                    <div className="border border-slate-300 rounded p-3 h-28 flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-slate-900">Réception & Saisie Administrateur</div>
                        <div className="text-[11px] text-slate-500">Philippe DOUKHAN (Technicien / Admin de base)</div>
                      </div>
                      <div className="text-[10px] text-slate-400 border-t border-slate-200 pt-1">
                        Date de saisie dans l'outil & Visa :
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
