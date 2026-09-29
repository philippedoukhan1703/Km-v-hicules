import { FleetDatabase, Trip, Vehicle, Agent, MonthlyReport, VehicleMonthlyRecord } from '../types.ts';
import { INITIAL_FLEET_DATA } from '../data/initialData.ts';

const LOCAL_STORAGE_KEY = 'rte_flotte_data_v8';

export class FleetService {
  private static cachedData: FleetDatabase | null = null;

  // Get current fleet data (from API if available, else localStorage, else initial)
  static async getFleetData(forceFresh = true): Promise<FleetDatabase> {
    try {
      const res = await fetch(`/api/fleet?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const data: FleetDatabase = await res.json();
        this.cachedData = data;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    } catch {
      // API call failed, fallback to local storage
    }

    const localRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw);
        this.cachedData = parsed;
        return parsed;
      } catch {
        // Fallback
      }
    }

    this.cachedData = JSON.parse(JSON.stringify(INITIAL_FLEET_DATA));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.cachedData));
    return this.cachedData!;
  }

  // Record a trip (loan return / odometer reading)
  static async recordTrip(tripInput: Omit<Trip, 'id' | 'createdAt' | 'kmParcourus' | 'statut'>): Promise<{ trip: Trip; vehicle: Vehicle }> {
    const kmParcourus = Math.max(0, tripInput.kmFin - tripInput.kmDepart);
    const heuresUtilisees = (tripInput.heuresFin !== undefined && tripInput.heuresDepart !== undefined)
      ? Math.max(0, tripInput.heuresFin - tripInput.heuresDepart)
      : undefined;

    const fullTrip: Trip = {
      ...tripInput,
      id: 'trp-' + Date.now(),
      kmParcourus,
      heuresUtilisees,
      statut: 'CLOTURE',
      createdAt: new Date().toISOString()
    };

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullTrip)
      });
      if (res.ok) {
        const json = await res.json();
        // Update local cache
        await this.getFleetData();
        return json;
      }
    } catch (e) {
      console.warn('API error when recording trip, persisting locally:', e);
    }

    // Local fallback
    const local = await this.getFleetData();
    local.trips.unshift(fullTrip);
    const veh = local.vehicles.find(v => v.id === fullTrip.vehicleId);
    if (veh) {
      if (fullTrip.kmFin > veh.currentKm) veh.currentKm = fullTrip.kmFin;
      if (fullTrip.heuresFin !== undefined && veh.hasHourMeter) veh.currentHours = fullTrip.heuresFin;
      if (fullTrip.anomalieSignalee && fullTrip.anomalieSignalee.trim()) {
        veh.notes = fullTrip.anomalieSignalee.trim();
      }
      veh.updatedAt = new Date().toISOString();
    }
    const report = local.monthlyReports.find(r => !r.cloture) || local.monthlyReports[0];
    if (report && veh) {
      const rec = report.records.find(r => r.vehicleId === veh.id);
      if (rec) {
        rec.kmActuel = veh.currentKm;
        rec.kmMois = Math.max(0, rec.kmActuel - rec.kmPrecedent);
        if (veh.currentHours !== undefined) {
          rec.heuresActuel = veh.currentHours;
          if (rec.heuresPrecedent !== undefined) {
            rec.heuresMois = Math.max(0, rec.heuresActuel - rec.heuresPrecedent);
          }
        }
        rec.nbTrajets = (rec.nbTrajets || 0) + 1;
        rec.dateDerniereSaisie = new Date().toISOString();
        rec.agentReleve = fullTrip.agentName;
        rec.statutReleve = 'VALIDE';
        if (fullTrip.anomalieSignalee && fullTrip.anomalieSignalee.trim()) {
          rec.observations = fullTrip.anomalieSignalee.trim();
        }
      }
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
    return { trip: fullTrip, vehicle: veh! };
  }

  // Resolve / clear an observation or anomaly for a vehicle
  static async resolveAnomaly(vehicleId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/resolve-anomaly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        this.cachedData = null;
        await this.getFleetData(true);
        return true;
      }
    } catch (e) {
      console.warn('API error when resolving anomaly, updating locally:', e);
    }

    // Local fallback
    const local = await this.getFleetData();
    const veh = local.vehicles.find(v => v.id === vehicleId);
    if (veh) {
      veh.notes = undefined;
      veh.updatedAt = new Date().toISOString();
    }
    local.trips.forEach(t => {
      if (t.vehicleId === vehicleId && t.anomalieSignalee) {
        t.anomalieSignalee = undefined;
      }
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
    this.cachedData = local;
    return true;
  }

  // Save/Update vehicle
  static async saveVehicle(vehicle: Vehicle): Promise<Vehicle> {
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicle)
      });
      if (res.ok) {
        const json = await res.json();
        this.cachedData = null;
        await this.getFleetData(true);
        return json.vehicle;
      }
    } catch (e) {
      console.warn('API saveVehicle fallback to localStorage:', e);
    }

    const local = await this.getFleetData(false);
    const idx = local.vehicles.findIndex(v => v.id === vehicle.id);
    if (idx >= 0) {
      local.vehicles[idx] = vehicle;
    } else {
      local.vehicles.push(vehicle);
    }
    local.monthlyReports.forEach(rep => {
      const rec = rep.records.find(r => r.vehicleId === vehicle.id);
      if (rec) {
        rec.immatriculation = vehicle.immatriculation;
        rec.modele = vehicle.modele;
        rec.equipe = vehicle.equipe;
        rec.type = vehicle.type;
        if (vehicle.structureEquipe) rec.structureEquipe = vehicle.structureEquipe;
        if (vehicle.centreDeCout) rec.centreDeCout = vehicle.centreDeCout;
      }
    });
    this.cachedData = local;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
    return vehicle;
  }

  // Delete vehicle
  static async deleteVehicle(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
      if (res.ok) {
        this.cachedData = null;
        await this.getFleetData(true);
        return true;
      }
    } catch {
      // Local fallback
    }

    const local = await this.getFleetData(false);
    local.vehicles = local.vehicles.filter(v => v.id !== id);
    this.cachedData = local;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
    return true;
  }

  // Save/Update agent
  static async saveAgent(agent: Agent): Promise<Agent> {
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent)
      });
      if (res.ok) {
        const json = await res.json();
        this.cachedData = null;
        await this.getFleetData(true);
        return json.agent;
      }
    } catch (e) {
      console.warn('API saveAgent fallback to localStorage:', e);
    }

    const local = await this.getFleetData(false);
    const idx = local.agents.findIndex(a => a.id === agent.id);
    if (idx >= 0) {
      local.agents[idx] = agent;
    } else {
      local.agents.push(agent);
    }
    this.cachedData = local;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
    return agent;
  }

  // Delete agent
  static async deleteAgent(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        this.cachedData = null;
        await this.getFleetData(true);
        return true;
      }
    } catch {
      // Local fallback
    }

    const local = await this.getFleetData(false);
    local.agents = local.agents.filter(a => a.id !== id);
    this.cachedData = local;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
    return true;
  }

  // Save SharePoint URL
  static async saveSharepointUrl(url: string): Promise<boolean> {
    try {
      const res = await fetch('/api/settings/sharepoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (res.ok) {
        this.cachedData = null;
        await this.getFleetData(true);
        return true;
      }
    } catch (e) {
      console.warn('API saveSharepointUrl fallback:', e);
    }

    const local = await this.getFleetData(false);
    local.sharepointUrl = url;
    this.cachedData = local;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
    return true;
  }

  // Record 20th manual reading
  static async recordMonthlyReading(reportId: string, vehicleId: string, kmActuel: number, heuresActuel?: number, agentReleve?: string, observations?: string) {
    try {
      const res = await fetch('/api/monthly-reports/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, vehicleId, kmActuel, heuresActuel, agentReleve, observations })
      });
      if (res.ok) {
        await this.getFleetData();
        return true;
      }
    } catch {
      // Local fallback
    }

    const local = await this.getFleetData();
    const rep = local.monthlyReports.find(r => r.id === reportId);
    if (rep) {
      const rec = rep.records.find(r => r.vehicleId === vehicleId);
      if (rec) {
        rec.kmActuel = kmActuel;
        rec.kmMois = Math.max(0, kmActuel - rec.kmPrecedent);
        if (heuresActuel !== undefined) {
          rec.heuresActuel = heuresActuel;
          if (rec.heuresPrecedent !== undefined) {
            rec.heuresMois = Math.max(0, heuresActuel - rec.heuresPrecedent);
          }
        }
        rec.agentReleve = agentReleve || 'Responsable';
        rec.observations = observations || '';
        rec.statutReleve = 'VALIDE';
        rec.dateDerniereSaisie = new Date().toISOString();
      }
    }
    const veh = local.vehicles.find(v => v.id === vehicleId);
    if (veh && kmActuel >= veh.currentKm) {
      veh.currentKm = kmActuel;
      if (heuresActuel !== undefined) veh.currentHours = heuresActuel;
      veh.updatedAt = new Date().toISOString();
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
    return true;
  }

  // Close monthly report and create next period
  static async closeMonthlyReport(reportId: string, validePar: string) {
    try {
      const res = await fetch('/api/monthly-reports/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, validePar })
      });
      if (res.ok) {
        await this.getFleetData();
        return true;
      }
    } catch {
      // Local fallback
    }

    // Local implementation
    const local = await this.getFleetData();
    const rep = local.monthlyReports.find(r => r.id === reportId);
    if (rep) {
      rep.cloture = true;
      rep.dateCloture = new Date().toISOString();
      rep.validePar = validePar;
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
    return true;
  }

  // Delete trip
  static async deleteTrip(id: string) {
    try {
      await fetch(`/api/trips/${id}`, { method: 'DELETE' });
    } catch {
      // local
    }
    const local = await this.getFleetData();
    local.trips = local.trips.filter(t => t.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
    return true;
  }

  // Reset to initial demo data
  static async resetToDemo(): Promise<FleetDatabase> {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(json.data));
        return json.data;
      }
    } catch {
      // local
    }
    const fresh = JSON.parse(JSON.stringify(INITIAL_FLEET_DATA));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }

  // Download full JSON backup file
  static downloadBackupFile(data: FleetDatabase) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RTE-Flotte-Sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Import backup file
  static async importBackup(backupData: FleetDatabase): Promise<FleetDatabase> {
    try {
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupData)
      });
      if (res.ok) {
        const json = await res.json();
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(json.data));
        this.cachedData = json.data;
        return json.data;
      }
    } catch {
      // Local fallback
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(backupData));
    this.cachedData = backupData;
    return backupData;
  }

  // Generate TSV text ready for 1-click clipboard paste into Excel / SharePoint
  static formatForSharepointClipboard(report: MonthlyReport): string {
    const headers = [
      'Désignation véhicule',
      'Immatriculation véhicule',
      'Structure équipe',
      'Centre de coût (N9KV0)',
      'Relevé kms en M-1',
      'Relevé au 20 M (si aucun km parcouru, reprendre le relevé de M-1)',
      'Kms parcourus en M',
      'Équipe',
      'Type',
      'Nb Trajets',
      'Statut',
      'Observations'
    ];

    const lines = report.records.map(r => [
      r.modele,
      r.immatriculation.replace(/-/g, ''),
      r.structureEquipe || 'SOSTGP3',
      r.centreDeCout || 'SOCAPA06',
      r.kmPrecedent,
      r.kmActuel,
      r.kmMois,
      r.equipe,
      r.type,
      r.nbTrajets,
      r.statutReleve,
      r.observations || ''
    ].join('\t'));

    return [headers.join('\t'), ...lines].join('\n');
  }
}
