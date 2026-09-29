export type TeamId = 'ESCAILLON' | 'LES ARCS';

export type VehicleType = 'VL' | 'UTILITAIRE' | '4X4' | 'ENGIN';

export type FuelType = 'ELECTRIQUE' | 'DIESEL' | 'ESSENCE' | 'HYBRIDE';

export type VehicleStatus = 'DISPONIBLE' | 'EN_PRET' | 'MAINTENANCE';

export type AgentRole = 'ADMINISTRATEUR' | 'COORDONNATEUR' | 'RESPONSABLE' | 'ADJOINT' | 'TECHNICIEN' | 'ALTERNANT';

export type TripStatus = 'EN_COURS' | 'CLOTURE';

export interface Vehicle {
  id: string;
  code: string;
  immatriculation: string;
  marque: string;
  modele: string;
  type: VehicleType;
  equipe: TeamId;
  structureEquipe?: string;
  centreDeCout?: string;
  currentKm: number;
  currentHours?: number;
  hasHourMeter: boolean;
  status: VehicleStatus;
  fuelType: FuelType;
  emplacement?: string;
  notes?: string;
  activeLoanId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  nom: string;
  prenom: string;
  role: AgentRole;
  fonctionDetaillee?: string;
  isAdmin?: boolean;
  equipe: TeamId | 'MIXTE';
  matricule?: string;
  telephone?: string;
  email?: string;
  active: boolean;
}

export interface Trip {
  id: string;
  vehicleId: string;
  vehicleImmat: string;
  vehicleName: string;
  equipe: TeamId;
  agentId: string;
  agentName: string;
  agentRole: AgentRole;
  dateDepart: string; // ISO string
  dateRetour?: string; // ISO string
  kmDepart: number;
  kmFin: number;
  kmParcourus: number;
  heuresDepart?: number;
  heuresFin?: number;
  heuresUtilisees?: number;
  motif: string;
  destination: string;
  carburantFin?: string;
  anomalieSignalee?: string;
  statut: TripStatus;
  releveMode: 'QR_CODE' | 'MANUEL';
  createdAt: string;
}

export interface VehicleMonthlyRecord {
  vehicleId: string;
  immatriculation: string;
  modele: string;
  equipe: TeamId;
  type: VehicleType;
  structureEquipe?: string;
  centreDeCout?: string;
  kmPrecedent: number; // Index au 20 du mois M-1
  kmActuel: number;    // Index au 20 du mois M
  kmMois: number;      // Delta (kmActuel - kmPrecedent)
  heuresPrecedent?: number;
  heuresActuel?: number;
  heuresMois?: number;
  nbTrajets: number;
  statutReleve: 'VALIDE' | 'ESTIME' | 'A_RELEVER';
  dateDerniereSaisie?: string;
  agentReleve?: string;
  observations?: string;
}

export interface MonthlyReport {
  id: string; // e.g. "releve-2026-09"
  annee: number;
  mois: number; // 1-12
  nomPeriode: string; // ex: "Relevé au 20 Septembre 2026 (21/08 - 20/09)"
  dateReleve: string; // ex: "2026-09-20"
  dateDebutPeriode: string;
  dateFinPeriode: string;
  cloture: boolean;
  dateCloture?: string;
  validePar?: string;
  records: VehicleMonthlyRecord[];
}

export interface FleetDatabase {
  vehicles: Vehicle[];
  agents: Agent[];
  trips: Trip[];
  monthlyReports: MonthlyReport[];
  sharepointUrl: string;
  lastSyncAt?: string;
}

export interface VehicleAnomaly {
  vehicleId: string;
  vehicleImmat: string;
  vehicleName: string;
  equipe: TeamId;
  text: string;
  agentName: string;
  date: string;
  tripId?: string;
}
