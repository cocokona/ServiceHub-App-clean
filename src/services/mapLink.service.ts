/**
 * mapLink.service.ts — Native maps deep links (no map SDK, no API key)
 *
 * Instead of embedding a map + paying for tiles/routing, we hand off
 * navigation to the phone's OWN maps app via a URL deep link:
 *   - iOS  → Apple Maps  (https://maps.apple.com/?daddr=lat,lng)
 *   - Android → geo: scheme (written now; repo is iOS-only today)
 *
 * This is the "free + simple" path the tracking feature is built on. The
 * exception-handling shape mirrors the existing tel: deep link used in
 * Tracking.tsx / JobDetails.tsx (guard → Alert → canOpenURL → try/catch).
 */

import { Linking, Alert, Platform } from 'react-native';
import { logger } from './logger';

export interface MapUrlOptions {
  /** Human-readable label for the destination (e.g. a name). */
  label?: string;
}

/**
 * Build a native maps deep link for a coordinate.
 * Coords are rounded to 6 decimals (~0.1m) — plenty and URL-safe.
 * The label is encodeURIComponent-ed so it can't break the query string.
 */
export function buildMapUrl(
  lat: number,
  lng: number,
  opts: MapUrlOptions = {}
): string {
  const la = lat.toFixed(6);
  const lo = lng.toFixed(6);
  const label = opts.label ? encodeURIComponent(opts.label) : '';

  if (Platform.OS === 'ios') {
    // Apple Maps: daddr = destination, so tapping opens turn-by-turn
    // navigation straight to the point — exactly the "native nav, no SDK" goal.
    const q = label ? `&q=${label}` : '';
    return `https://maps.apple.com/?daddr=${la},${lo}${q}`;
  }

  // Android (future work — there is no android/ project yet, but keep it
  // correct so it works the moment one is added). geo: gives a pin;
  // for full turn-by-turn parity later, switch to
  // https://www.google.com/maps/dir/?api=1&destination=lat,lng
  const q = label ? `(${opts.label})` : '';
  return `geo:${la},${lo}?q=${la},${lo}${q}`;
}

/**
 * Open a coordinate in the device's native maps app. Mirrors the existing
 * tel: pattern: guard → canOpenURL → try/catch → Alert on failure.
 */
export async function openInMaps(
  lat: number,
  lng: number,
  opts: MapUrlOptions = {}
): Promise<void> {
  const url = buildMapUrl(lat, lng, opts);
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert(
        'Cannot open Maps',
        'No maps application is available on this device.'
      );
      return;
    }
    await Linking.openURL(url);
  } catch (err) {
    logger.warn('[mapLink] open failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    Alert.alert(
      'Unable to open Maps',
      'Please try again or open your maps app manually.'
    );
  }
}
