/**
 * location.service.ts — Lightweight live technician tracking
 *
 * Design (read before editing):
 * - This is the "$0, no map SDK" tracking layer. The technician app
 *   streams a GPS ping roughly every 60s (or sooner if it moves >50m)
 *   into the `technician_locations` table. The customer app subscribes to
 *   those INSERTs via Supabase Realtime and renders a live marker + an
 *   ETA/distance computed locally (haversine, no routing API).
 * - A module-scoped singleton holds the active `LocationSubscription` so
 *   `stopLocationSharing()` can be called from a DIFFERENT screen than
 *   where sharing started (it starts in JobDetails.handleStartJob and ends
 *   in ActiveService.handleComplete).
 * - All failures route through `logAndThrow` so the `Error.message`
 *   contract from src/services/errors.ts is preserved; routine events go
 *   through `logger`.
 * - Reuses the shared `supabase` client from ../lib/supabase — never
 *   create a second client.
 */

import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { logAndThrow } from './errors';
import { logger } from './logger';

export interface TechnicianLocation {
  id: string;
  jobId: string;
  technicianId: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  recordedAt: string;
}

// ---------------------------------------------------------------------------
// Module-scoped singleton (active sharing session)
// ---------------------------------------------------------------------------

let activeSubscription: Location.LocationSubscription | null = null;
let activeJobId: string | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapRow(row: any): TechnicianLocation {
  return {
    id: row.id,
    jobId: row.job_id,
    technicianId: row.technician_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    heading: row.heading == null ? null : Number(row.heading),
    recordedAt: row.recorded_at,
  };
}

// ---------------------------------------------------------------------------
// Start / stop sharing
// ---------------------------------------------------------------------------

/**
 * Begin foreground location sharing for a job. Requests permission, seeds one
 * immediate insert, then watches with a 60s / 50m throttle. Returns the
 * stop function so callers can tear down explicitly if needed.
 *
 * Idempotent-ish: calling it again while a session is active stops the old
 * one first, so re-entering JobDetails cannot leak a second watcher.
 */
export async function startLocationSharing(
  jobId: string,
  technicianId: string
): Promise<() => void> {
  if (activeSubscription) stopLocationSharing(); // guard double-start

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    logAndThrow('startLocationSharing', new Error('Location permission denied'));
  }

  const insert = async (pos: Location.LocationObject) => {
    const { error } = await supabase.from('technician_locations').insert({
      job_id: jobId,
      technician_id: technicianId,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      heading: pos.coords.heading ?? null,
      recorded_at: new Date().toISOString(),
    });
    if (error) logAndThrow('startLocationSharing.insert', error);
    logger.info('[location] inserted ping', { jobId });
  };

  // Immediate seed so the customer sees a marker without waiting 60s.
  try {
    const seed = await Location.getCurrentPositionAsync({
      accuracy: Location.LocationAccuracy.Balanced,
    });
    await insert(seed);
  } catch (err) {
    // A failed seed is non-fatal — the watch below will still stream.
    logger.warn('[location] seed position failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  activeSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.LocationAccuracy.Balanced,
      timeInterval: 60000,
      distanceInterval: 50,
    },
    insert
  );
  activeJobId = jobId;
  logger.info('[location] sharing started', { jobId, technicianId });

  return stopLocationSharing;
}

/**
 * Stop the active watch. Idempotent — safe to call when nothing is active,
 * and safe to call from any screen (JobDetails or ActiveService).
 */
export function stopLocationSharing(): void {
  if (activeSubscription) {
    activeSubscription.remove();
    activeSubscription = null;
    logger.info('[location] sharing stopped', { jobId: activeJobId });
  }
  activeJobId = null;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Latest known location for a job (newest row). Returns null if none yet. */
export async function getLastKnownLocation(
  jobId: string
): Promise<TechnicianLocation | null> {
  const { data, error } = await supabase
    .from('technician_locations')
    .select('*')
    .eq('job_id', jobId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) logAndThrow('getLastKnownLocation', error);
  return data ? mapRow(data) : null;
}

// ---------------------------------------------------------------------------
// Realtime subscription (mirrors subscribeToMessages in database.service.ts)
// ---------------------------------------------------------------------------

/**
 * Subscribe to technician location inserts for a job via Supabase Realtime.
 * `cb` fires with the newest TechnicianLocation on each INSERT. Returns an
 * unsubscribe function. Realtime INSERT payloads carry raw snake_case
 * column names, so mapRow handles the conversion.
 */
export function subscribeToTechnicianLocation(
  jobId: string,
  cb: (loc: TechnicianLocation) => void
): () => void {
  const channel = supabase
    .channel(`tech_loc:job_id=eq.${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'technician_locations',
        filter: `job_id=eq.${jobId}`,
      },
      (payload: any) => cb(mapRow(payload.new))
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Pure haversine ETA (no deps, unit-testable)
// ---------------------------------------------------------------------------

export interface EtaResult {
  distanceKm: number;
  etaMinutes: number;
}

/** Urban average speed used to turn straight-line distance into an ETA. */
const URBAN_KMH = 25;

/**
 * Great-circle distance (km) + a rough ETA (minutes) between two points.
 * Uses a straight-line haversine — no routing/traffic API, which is exactly
 * what keeps this feature free. Good enough for an "about X minutes" readout.
 */
export function computeEta(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): EtaResult {
  const R = 6371; // Earth radius in km
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const etaMinutes = (distanceKm / URBAN_KMH) * 60;
  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    etaMinutes: Math.ceil(etaMinutes),
  };
}
