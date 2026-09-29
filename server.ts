import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { INITIAL_FLEET_DATA } from './src/data/initialData.ts';
import { FleetDatabase, Trip, Vehicle, Agent, MonthlyReport, VehicleMonthlyRecord } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'fleet.json');
const BACKUP_FILE = path.resolve(DATA_DIR, 'fleet-backup.json');

// Ensure data directory and file exist
function getFleetData(): FleetDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_FLEET_DATA, null, 2), 'utf-8');
      fs.writeFileSync(BACKUP_FILE, JSON.stringify(INITIAL_FLEET_DATA, null, 2), 'utf-8');
      return JSON.parse(JSON.stringify(INITIAL_FLEET_DATA));
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading fleet database file, trying backup:', err);
    try {
      if (fs.existsSync(BACKUP_FILE)) {
        const rawBackup = fs.readFileSync(BACKUP_FILE, 'utf-8');
        return JSON.parse(rawBackup);
      }
    } catch {}
    return JSON.parse(JSON.stringify(INITIAL_FLEET_DATA));
  }
}

function saveFleetData(data: FleetDatabase) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    data.lastSyncAt = new Date().toISOString();
    const payload = JSON.stringify(data, null, 2);

    // Atomic write to prevent file corruption
    const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, payload, 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);

    // Also update rolling backup
    fs.writeFileSync(BACKUP_FILE, payload, 'utf-8');
  } catch (err) {
    console.error('Error saving fleet database file:', err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Prevent caching of API requests, especially important for iOS Safari
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Get full fleet database
  app.get('/api/fleet', (req, res) => {
    const data = getFleetData();
    res.json(data);
  });

  // Reset to default seed data
  app.post('/api/reset', (req, res) => {
    saveFleetData(INITIAL_FLEET_DATA);
    res.json({ success: true, message: 'Données réinitialisées avec succès', data: INITIAL_FLEET_DATA });
  });

  // Download full JSON backup
  app.get('/api/backup/download', (req, res) => {
    const data = getFleetData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="RTE-Flotte-Sauvegarde-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(data, null, 2));
  });

  // Import JSON backup
  app.post('/api/backup/import', (req, res) => {
    const backupData = req.body;
    if (!backupData || !Array.isArray(backupData.vehicles) || !Array.isArray(backupData.agents)) {
      return res.status(400).json({ error: 'Format de fichier de sauvegarde invalide' });
    }
    saveFleetData(backupData);
    res.json({ success: true, message: 'Sauvegarde restaurée avec succès', data: backupData });
  });

  // Save/Update vehicle
  app.post('/api/vehicles', (req, res) => {
    const data = getFleetData();
    const vehicle: Vehicle = req.body;
    if (!vehicle.id) {
      vehicle.id = 'veh-' + Date.now();
    }
    vehicle.updatedAt = new Date().toISOString();
    if (!vehicle.createdAt) {
      vehicle.createdAt = new Date().toISOString();
    }

    const idx = data.vehicles.findIndex(v => v.id === vehicle.id);
    if (idx >= 0) {
      data.vehicles[idx] = vehicle;
    } else {
      data.vehicles.push(vehicle);
    }

    // Sync changes to monthly reports
    data.monthlyReports.forEach(rep => {
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

    saveFleetData(data);
    res.json({ success: true, vehicle });
  });

  // Save SharePoint URL setting
  app.post('/api/settings/sharepoint', (req, res) => {
    const { url } = req.body;
    const data = getFleetData();
    data.sharepointUrl = url || '';
    saveFleetData(data);
    res.json({ success: true, sharepointUrl: data.sharepointUrl });
  });

  // Delete vehicle
  app.delete('/api/vehicles/:id', (req, res) => {
    const data = getFleetData();
    data.vehicles = data.vehicles.filter(v => v.id !== req.params.id);
    saveFleetData(data);
    res.json({ success: true });
  });

  // Save/Update agent
  app.post('/api/agents', (req, res) => {
    const data = getFleetData();
    const agent: Agent = req.body;
    if (!agent.id) {
      agent.id = 'agt-' + Date.now();
    }
    const idx = data.agents.findIndex(a => a.id === agent.id);
    if (idx >= 0) {
      data.agents[idx] = agent;
    } else {
      data.agents.push(agent);
    }
    saveFleetData(data);
    res.json({ success: true, agent });
  });

  // Delete agent
  app.delete('/api/agents/:id', (req, res) => {
    const data = getFleetData();
    data.agents = data.agents.filter(a => a.id !== req.params.id);
    saveFleetData(data);
    res.json({ success: true });
  });

  // Record a trip (loan return / new mileage recorded)
  app.post('/api/trips', (req, res) => {
    const data = getFleetData();
    const newTrip: Trip = req.body;

    if (!newTrip.id) {
      newTrip.id = 'trp-' + Date.now();
    }
    if (!newTrip.createdAt) {
      newTrip.createdAt = new Date().toISOString();
    }
    newTrip.statut = 'CLOTURE';
    newTrip.kmParcourus = Math.max(0, newTrip.kmFin - newTrip.kmDepart);

    if (newTrip.heuresFin !== undefined && newTrip.heuresDepart !== undefined) {
      newTrip.heuresUtilisees = Math.max(0, newTrip.heuresFin - newTrip.heuresDepart);
    }

    // Add to trips list (at beginning)
    data.trips.unshift(newTrip);

    // Update corresponding vehicle's current km and hours
    const vehicle = data.vehicles.find(v => v.id === newTrip.vehicleId);
    if (vehicle) {
      if (newTrip.kmFin >= vehicle.currentKm || newTrip.kmFin > 0) {
        vehicle.currentKm = newTrip.kmFin;
      }
      if (newTrip.heuresFin !== undefined && vehicle.hasHourMeter) {
        vehicle.currentHours = newTrip.heuresFin;
      }
      vehicle.status = 'DISPONIBLE';
      if (newTrip.anomalieSignalee && newTrip.anomalieSignalee.trim()) {
        vehicle.notes = newTrip.anomalieSignalee.trim();
      }
      vehicle.updatedAt = new Date().toISOString();
    }

    // Update active monthly report if applicable
    const activeReport = data.monthlyReports.find(r => !r.cloture) || data.monthlyReports[0];
    if (activeReport && vehicle) {
      const rec = activeReport.records.find(r => r.vehicleId === vehicle.id);
      if (rec) {
        rec.kmActuel = vehicle.currentKm;
        rec.kmMois = Math.max(0, rec.kmActuel - rec.kmPrecedent);
        if (vehicle.currentHours !== undefined) {
          rec.heuresActuel = vehicle.currentHours;
          if (rec.heuresPrecedent !== undefined) {
            rec.heuresMois = Math.max(0, rec.heuresActuel - rec.heuresPrecedent);
          }
        }
        rec.nbTrajets = (rec.nbTrajets || 0) + 1;
        rec.dateDerniereSaisie = new Date().toISOString();
        rec.agentReleve = newTrip.agentName;
        rec.statutReleve = 'VALIDE';
        if (newTrip.anomalieSignalee && newTrip.anomalieSignalee.trim()) {
          rec.observations = newTrip.anomalieSignalee.trim();
        }
      }
    }

    saveFleetData(data);
    res.json({ success: true, trip: newTrip, vehicle });
  });

  // Resolve / clear an anomaly or observation for a vehicle
  app.post('/api/vehicles/:id/resolve-anomaly', (req, res) => {
    const data = getFleetData();
    const vehicle = data.vehicles.find(v => v.id === req.params.id);
    if (!vehicle) {
      return res.status(404).json({ error: 'Véhicule non trouvé' });
    }

    vehicle.notes = undefined;
    vehicle.updatedAt = new Date().toISOString();

    // Mark the latest trip anomaly for this vehicle as resolved
    data.trips.forEach(t => {
      if (t.vehicleId === vehicle.id && t.anomalieSignalee) {
        t.anomalieSignalee = undefined;
      }
    });

    saveFleetData(data);
    res.json({ success: true, vehicle });
  });

  // Update trip
  app.put('/api/trips/:id', (req, res) => {
    const data = getFleetData();
    const idx = data.trips.findIndex(t => t.id === req.params.id);
    if (idx >= 0) {
      data.trips[idx] = { ...data.trips[idx], ...req.body };
      saveFleetData(data);
      res.json({ success: true, trip: data.trips[idx] });
    } else {
      res.status(404).json({ error: 'Trajet non trouvé' });
    }
  });

  // Delete trip
  app.delete('/api/trips/:id', (req, res) => {
    const data = getFleetData();
    data.trips = data.trips.filter(t => t.id !== req.params.id);
    saveFleetData(data);
    res.json({ success: true });
  });

  // Record 20th manual reading for a vehicle
  app.post('/api/monthly-reports/record', (req, res) => {
    const { reportId, vehicleId, kmActuel, heuresActuel, agentReleve, observations } = req.body;
    const data = getFleetData();
    const report = data.monthlyReports.find(r => r.id === reportId);
    if (!report) {
      return res.status(404).json({ error: 'Bilan mensuel non trouvé' });
    }
    const rec = report.records.find(r => r.vehicleId === vehicleId);
    if (!rec) {
      return res.status(404).json({ error: 'Véhicule non trouvé dans ce relevé' });
    }

    rec.kmActuel = Number(kmActuel);
    rec.kmMois = Math.max(0, rec.kmActuel - rec.kmPrecedent);
    if (heuresActuel !== undefined) {
      rec.heuresActuel = Number(heuresActuel);
      if (rec.heuresPrecedent !== undefined) {
        rec.heuresMois = Math.max(0, rec.heuresActuel - rec.heuresPrecedent);
      }
    }
    rec.agentReleve = agentReleve || 'Responsable';
    rec.observations = observations || '';
    rec.statutReleve = 'VALIDE';
    rec.dateDerniereSaisie = new Date().toISOString();

    // Also update vehicle's current km if higher
    const veh = data.vehicles.find(v => v.id === vehicleId);
    if (veh && rec.kmActuel >= veh.currentKm) {
      veh.currentKm = rec.kmActuel;
      if (rec.heuresActuel !== undefined) {
        veh.currentHours = rec.heuresActuel;
      }
      veh.updatedAt = new Date().toISOString();
    }

    saveFleetData(data);
    res.json({ success: true, record: rec, report });
  });

  // Close 20th report and create next period
  app.post('/api/monthly-reports/close', (req, res) => {
    const { reportId, validePar } = req.body;
    const data = getFleetData();
    const report = data.monthlyReports.find(r => r.id === reportId);
    if (!report) {
      return res.status(404).json({ error: 'Rapport non trouvé' });
    }

    report.cloture = true;
    report.dateCloture = new Date().toISOString();
    report.validePar = validePar || 'Responsable Flotte';

    // Create next month report if not already present
    const curDate = new Date(report.dateReleve);
    const nextMonthDate = new Date(curDate);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const nextYear = nextMonthDate.getFullYear();
    const nextMonth = nextMonthDate.getMonth() + 1;
    const nextReportId = `releve-${nextYear}-${String(nextMonth).padStart(2, '0')}`;

    if (!data.monthlyReports.some(r => r.id === nextReportId)) {
      const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      const nextMonthName = monthNames[nextMonth - 1];

      const nextRecords: VehicleMonthlyRecord[] = data.vehicles.map(v => {
        const prevRec = report.records.find(r => r.vehicleId === v.id);
        const kmPrecedent = prevRec ? prevRec.kmActuel : v.currentKm;
        const heuresPrecedent = prevRec ? prevRec.heuresActuel : v.currentHours;

        return {
          vehicleId: v.id,
          immatriculation: v.immatriculation,
          modele: v.modele,
          equipe: v.equipe,
          type: v.type,
          kmPrecedent,
          kmActuel: v.currentKm,
          kmMois: Math.max(0, v.currentKm - kmPrecedent),
          heuresPrecedent,
          heuresActuel: v.currentHours,
          heuresMois: v.currentHours !== undefined && heuresPrecedent !== undefined ? Math.max(0, v.currentHours - heuresPrecedent) : undefined,
          nbTrajets: 0,
          statutReleve: 'A_RELEVER',
          observations: ''
        };
      });

      const prev20 = `${report.dateReleve.slice(8, 10)}/${report.dateReleve.slice(5, 7)}`;
      const next20 = `20/${String(nextMonth).padStart(2, '0')}`;

      const newReport: MonthlyReport = {
        id: nextReportId,
        annee: nextYear,
        mois: nextMonth,
        nomPeriode: `${nextMonthName} ${nextYear} - Relevé officiel au 20/${String(nextMonth).padStart(2, '0')}/${nextYear} (${prev20} au ${next20})`,
        dateReleve: `${nextYear}-${String(nextMonth).padStart(2, '0')}-20`,
        dateDebutPeriode: `${report.dateReleve.slice(0, 8)}21`,
        dateFinPeriode: `${nextYear}-${String(nextMonth).padStart(2, '0')}-20`,
        cloture: false,
        records: nextRecords
      };

      data.monthlyReports.unshift(newReport);
    }

    saveFleetData(data);
    res.json({ success: true, report, monthlyReports: data.monthlyReports });
  });

  // Export CSV for SharePoint Teams
  app.get('/api/export/csv', (req, res) => {
    const data = getFleetData();
    const reportId = req.query.reportId as string;
    const report = (reportId ? data.monthlyReports.find(r => r.id === reportId) : null) || data.monthlyReports[0];

    if (!report) {
      return res.status(404).send('Rapport non disponible');
    }

    const header = [
      'Désignation véhicule',
      'Immatriculation véhicule',
      'Structure équipe',
      'Centre de coût (N9KV0)',
      'Relevé kms en Août 2026',
      'Relevé au 20 Septembre 2026 (si aucun km parcouru, reprendre le relevé de M-1)',
      'Kms parcourus en M 2026',
      'Équipe',
      'Type',
      'Nb Trajets',
      'Statut Relevé',
      'Observations'
    ].join(';');

    const rows = report.records.map(r => [
      `"${r.modele.replace(/"/g, '""')}"`,
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
      `"${(r.observations || '').replace(/"/g, '""')}"`
    ].join(';'));

    const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="RTE-Releve-20-${report.id}.csv"`);
    res.send(csvContent);
  });

  // Vite Integration
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RTE Flotte server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal error starting server:', err);
});
