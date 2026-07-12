/**
 * profilePicture.service.ts — Profile picture storage (Supabase Storage)
 *
 * Uploads a user's profile picture to the `avatars` bucket and returns a
 * publicly-servable URL. The file is written to a per-user folder
 * (`<userId>/avatar.jpg`) with `upsert: true`, so re-uploading always
 * overwrites the previous picture — no orphaned objects and a stable path the
 * profile row can point at.
 *
 * SECURITY MODEL
 * - The `avatars` bucket is **public** for reads (so a plain
 *   `<Image source={{ uri }} />` can render it without a signed URL).
 * - Writes are gated by RLS (see migration 00011): a user may only
 *   insert/update/delete objects inside their own `<userId>/` folder. The
 *   anon key is safe client-side because RLS enforces ownership.
 *
 * This module knows nothing about UI or cropping — the caller is expected to
 * hand it an already-resized / compressed local file URI (the
 * ProfilePictureUploader component does that with expo-image-manipulator).
 */

import { supabase } from '../lib/supabase';
import { logger } from './logger';
import { logAndThrow } from './errors';

/** Storage bucket that holds profile pictures. */
export const AVATAR_BUCKET = 'avatars';

/** Target square dimension (px) the caller should resize to before upload. */
export const AVATAR_TARGET_SIZE = 512;

/**
 * Upload a (already resized/compressed) profile picture and return its public
 * URL.
 *
 * @param fileUri  Local file URI from expo-image-picker / image-manipulator.
 * @param contentType  MIME type of the file, e.g. 'image/jpeg'.
 * @returns Public URL with a cache-busting query so <Image> refreshes.
 */
export async function uploadProfilePicture(
  fileUri: string,
  contentType: string = 'image/jpeg'
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('You must be signed in to upload a profile picture.');
  }

  const userId = session.user.id;
  const ext = (contentType.split('/')[1] || 'jpg').replace('+xml', '');
  const path = `${userId}/avatar.${ext}`;

  // React Native has no real `File`/`Blob` from a file path, so we read the
  // local file into a Blob via fetch before handing it to Supabase Storage.
  let blob: Blob;
  try {
    const response = await fetch(fileUri);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    blob = await response.blob();
  } catch (err) {
    logger.error('[profilePicture] failed to read local image', {
      message: err instanceof Error ? err.message : String(err),
    });
    throw new Error('Could not read the selected image. Please try again.');
  }

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, {
      contentType,
      upsert: true,
      cacheControl: '3600',
    });

  if (error) {
    // RLS / quota / network — logAndThrow preserves the caller-facing message.
    logAndThrow('uploadProfilePicture', error);
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // Cache-bust so the <Image> element picks up the freshly overwritten file.
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
  logger.info('[profilePicture] uploaded', { path });
  return publicUrl;
}

/**
 * Best-effort removal of a user's avatar objects. The caller clears the
 * profile's `avatar_url` regardless; this just deletes the orphaned blobs.
 * Non-fatal: failures are logged, not thrown.
 */
export async function removeProfilePicture(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return;

  const userId = session.user.id;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .remove([
      `${userId}/avatar.jpg`,
      `${userId}/avatar.jpeg`,
      `${userId}/avatar.png`,
    ]);

  if (error) {
    logger.warn('[profilePicture] remove failed (non-fatal)', {
      code: (error as any)?.code,
      message: error.message,
    });
  }
}
