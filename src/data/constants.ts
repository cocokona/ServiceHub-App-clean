/**
 * constants.ts — Backward-compatibility shim
 *
 * @deprecated Import from '../data' (or './data' relative to src/) instead.
 * This file re-exports the new data-loader-based values so existing
 * imports continue to work during the migration.
 *
 * All data now lives in JSON files under src/data/files/ and is loaded
 * through src/data/loader.ts with proper error handling.
 */

import {
  imageUrls as IMAGE_URLS,
  recommendedTechnicians as RECOMMENDED_TECHNICIANS,
  initialMessages as INITIAL_MESSAGES,
  initialJobs as INITIAL_JOBS,
} from './loader';

export {
  IMAGE_URLS,
  RECOMMENDED_TECHNICIANS,
  INITIAL_MESSAGES,
  INITIAL_JOBS,
};
