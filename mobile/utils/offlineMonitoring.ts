import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";

// Offline support for site monitoring:
//  - "Saved sites": a copy of the site details + tree species list so a site can be opened without signal
//  - "Queued reports": progress reports filled in offline, uploaded once the phone is back online

const SAVED_SITES_KEY = "@plantscope_saved_monitoring_sites";
const TREE_SPECIES_KEY = "@plantscope_tree_species_cache";
const QUEUE_KEY = "@plantscope_queued_monitoring_reports";
const QUEUE_IMAGES_DIR = FileSystem.documentDirectory + "monitoring_report_images/";

export interface SavedSite {
  site_id: number;
  /** Row as shown in the monitoring list */
  summary: any;
  /** Full response of get_site_monitoring_details */
  detail: any;
  saved_at: string;
}

export interface QueuedReport {
  local_id: string;
  site_id: number;
  site_name: string;
  fields: {
    application_id?: number | null;
    visit_type: string;
    orientation_conducted: boolean;
    report_species: any[];
    description: string;
    polygon_coordinates: [number, number][];
  };
  proof_image_uri: string;
  agreement_image_uri?: string | null;
  created_at: string;
  last_error?: string;
}

// ── Saved sites ────────────────────────────────────────────────────────────

export async function getSavedSites(): Promise<Record<string, SavedSite>> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_SITES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function getSavedSite(siteId: number | string): Promise<SavedSite | null> {
  return (await getSavedSites())[String(siteId)] ?? null;
}

async function writeSavedSites(sites: Record<string, SavedSite>) {
  await AsyncStorage.setItem(SAVED_SITES_KEY, JSON.stringify(sites));
}

async function fetchJson(path: string) {
  const token = await SecureStore.getItemAsync("token");
  const res = await fetch(`${api}/api/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/** List-row shape built from saved details, used when a site was saved from its detail screen. */
export function summaryFromDetail(detail: any) {
  const reports: any[] = detail?.progress_reports ?? [];
  const latest = reports.find((r) => r.status === "accepted")?.submitted_at ?? null;
  return {
    site_id: detail.site.site_id,
    site_name: detail.site.name,
    reforestation_area_name: detail.site.reforestation_area_name,
    barangay_name: detail.site.barangay_name,
    latest_report_date: latest,
    days_since_last_report: latest ? Math.floor((Date.now() - new Date(latest).getTime()) / 86400000) : null,
    total_reports: reports.length,
    needs_initial: detail.current_application?.status === "accepted",
    monitoring_status: detail.site.monitoring_status ?? "under_monitoring",
  };
}

/** Download a site's details (and the species list) and keep them on the phone. */
export async function saveSiteOffline(siteId: number, summary?: any): Promise<SavedSite> {
  const detail = await fetchJson(`get_site_monitoring_details/${siteId}/`);
  try {
    await cacheTreeSpecies(await fetchJson("get_tree_species_list/"));
  } catch {
    // species list is a nice-to-have; keep the old cache if this fails
  }
  const sites = await getSavedSites();
  const entry: SavedSite = {
    site_id: siteId,
    summary: summary ?? sites[String(siteId)]?.summary ?? summaryFromDetail(detail),
    detail,
    saved_at: new Date().toISOString(),
  };
  sites[String(siteId)] = entry;
  await writeSavedSites(sites);
  return entry;
}

/** Refresh the copy of a site that's already saved (no-op if it isn't saved). */
export async function updateSavedSiteDetail(siteId: number, detail: any) {
  const sites = await getSavedSites();
  const existing = sites[String(siteId)];
  if (!existing) return;
  sites[String(siteId)] = { ...existing, detail, saved_at: new Date().toISOString() };
  await writeSavedSites(sites);
}

export async function updateSavedSiteSummaries(rows: any[]) {
  const sites = await getSavedSites();
  let changed = false;
  for (const row of rows) {
    const existing = sites[String(row.site_id)];
    if (existing) {
      existing.summary = row;
      changed = true;
    }
  }
  if (changed) await writeSavedSites(sites);
}

export async function removeSavedSite(siteId: number) {
  const sites = await getSavedSites();
  delete sites[String(siteId)];
  await writeSavedSites(sites);
}

// ── Tree species ──────────────────────────────────────────────────────────

export async function cacheTreeSpecies(list: any[]) {
  if (Array.isArray(list)) await AsyncStorage.setItem(TREE_SPECIES_KEY, JSON.stringify(list));
}

export async function getCachedTreeSpecies(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(TREE_SPECIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Queued reports ────────────────────────────────────────────────────────

export async function getQueuedReports(): Promise<QueuedReport[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedReport[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Photos picked from the camera live in a cache folder that can be cleared, so copy them first. */
async function keepImage(uri: string, name: string): Promise<string> {
  const dir = await FileSystem.getInfoAsync(QUEUE_IMAGES_DIR);
  if (!dir.exists) await FileSystem.makeDirectoryAsync(QUEUE_IMAGES_DIR, { intermediates: true });
  const dest = QUEUE_IMAGES_DIR + name;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function queueReport(report: Omit<QueuedReport, "local_id" | "created_at">): Promise<QueuedReport> {
  const local_id = `rep-${Date.now()}`;
  const queued: QueuedReport = {
    ...report,
    local_id,
    created_at: new Date().toISOString(),
    proof_image_uri: await keepImage(report.proof_image_uri, `${local_id}_proof.jpg`),
    agreement_image_uri: report.agreement_image_uri ? await keepImage(report.agreement_image_uri, `${local_id}_agreement.jpg`) : null,
  };
  const queue = await getQueuedReports();
  queue.push(queued);
  await writeQueue(queue);
  return queued;
}

export async function removeQueuedReport(localId: string) {
  const queue = await getQueuedReports();
  const item = queue.find((q) => q.local_id === localId);
  if (item) {
    for (const uri of [item.proof_image_uri, item.agreement_image_uri]) {
      if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  }
  await writeQueue(queue.filter((q) => q.local_id !== localId));
}

export function buildReportFormData(r: QueuedReport) {
  const fd = new FormData();
  fd.append("site_id", String(r.site_id));
  if (r.fields.application_id) fd.append("application_id", String(r.fields.application_id));
  fd.append("visit_type", r.fields.visit_type);
  fd.append("orientation_conducted", String(r.fields.orientation_conducted));
  fd.append("report_species", JSON.stringify(r.fields.report_species));
  fd.append("description", r.fields.description);
  fd.append("polygon_coordinates", JSON.stringify(r.fields.polygon_coordinates));
  fd.append("proof_image", { uri: r.proof_image_uri, name: "proof.jpg", type: "image/jpeg" } as any);
  if (r.agreement_image_uri) {
    fd.append("agreement_image", { uri: r.agreement_image_uri, name: "agreement.jpg", type: "image/jpeg" } as any);
  }
  return fd;
}

let syncing = false;

/**
 * Upload every queued report. Reports the server accepts are removed; the rest
 * stay in the queue with the server's error so the inspector can see why.
 */
export async function syncQueuedReports(): Promise<{ uploaded: number; failed: number }> {
  if (syncing) return { uploaded: 0, failed: 0 };
  syncing = true;
  let uploaded = 0;
  let failed = 0;
  try {
    const token = await SecureStore.getItemAsync("token");
    if (!token) return { uploaded, failed };
    for (const report of await getQueuedReports()) {
      try {
        const res = await fetch(`${api}/api/create_progress_report/`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: buildReportFormData(report),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
        await removeQueuedReport(report.local_id);
        uploaded++;
      } catch (err: any) {
        failed++;
        const queue = await getQueuedReports();
        const item = queue.find((q) => q.local_id === report.local_id);
        if (item) {
          item.last_error = err?.message || "Upload failed";
          await writeQueue(queue);
        }
      }
    }
  } finally {
    syncing = false;
  }
  return { uploaded, failed };
}
