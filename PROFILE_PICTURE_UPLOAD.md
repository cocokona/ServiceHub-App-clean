# Profile Picture Upload Feature

Adds the ability for **both customers and technicians** to set a profile photo
from the Profile tab — by picking from the device gallery **or** taking a new
photo with the camera. The chosen image is cropped to a square, resized to
512×512, compressed, and uploaded to Supabase Storage, then saved to the
user's `profiles.avatar_url`.

## What changed

### New files
- `src/services/profilePicture.service.ts` — uploads to the `avatars` storage
  bucket into a per-user folder (`<userId>/avatar.jpeg`), `upsert` so re-uploads
  overwrite cleanly; returns a cache-busted public URL. Best-effort `removeProfilePicture`.
- `src/components/ProfilePictureUploader.tsx` — self-contained, reusable UI:
  avatar circle + camera badge, action sheet (Take Photo / Choose from Library /
  Remove / Cancel). **Gallery selection is fully in-app** via `PhotoGallerySheet`
  (no external picker/crop app). Square crop + resize/compress happen in-app
  via `expo-image-manipulator`; optimistic local preview, upload spinner, error
  alerts.
- `src/components/PhotoGallerySheet.tsx` — **new, fully in-app photo picker**.
  Uses `expo-media-library.getAssetsAsync` to list the user's own photos in a
  native grid rendered inside the app, with pagination and permission handling.
  Returns the selected asset (`uri` + dimensions) to the caller. Replaces the
  platform's external image chooser, which on Android launched a separate
  gallery/Photos app (and, with `allowsEditing`, the system crop activity).
- `supabase/migrations/00013_avatar_storage.sql` — creates the public `avatars`
  bucket and RLS policies so a user can only read/write their own `<userId>/`
  folder.
- `src/services/__tests__/profilePicture.service.test.ts` — service unit tests
  (mocked Supabase + fetch). All 94 tests pass.

### Modified files
- `src/types/index.ts` — `User.avatarUrl` added.
- `src/services/auth.service.ts` — `mapToUser` reads `avatar_url`; `updateProfile`
  accepts `avatarUrl`.
- `src/screens/customer/CustomerHome.tsx` — Profile header uses the uploader;
  persists via `updateProfile` + `setUser`.
- `src/screens/technician/TechnicianDashboard.tsx` — same, with the `construct`
  fallback icon.
- `app.json` — `expo-image-picker` plugin (camera/photos/microphone usage
  strings) and a new `expo-media-library` plugin (photos usage string) so
  permissions are injected into the native project at prebuild.
- `src/services/index.ts`, `src/components/index.ts` — barrel exports.

## Why the external-app behavior was removed
The previous version called `ImagePicker.launchImageLibraryAsync({ allowsEditing: true })`.
On Android that fires the system `com.android.camera.action.CROP` intent (a
separate app/activity) which opens the photo in the system viewer and often
never returns the cropped result — i.e. the photo "opens in another app."
Fix: selection now happens inside our own `PhotoGallerySheet`, and cropping is
done in-app with `expo-image-manipulator`. Nothing external is launched for
selection or cropping. (The camera still uses the standard device capture
intent, which is the accepted, expected behavior for taking a photo.)

## Fix: hard crash (app quits) when picking from the in-app gallery
On **iOS**, `expo-media-library` reports `Asset.uri` as a `ph://` (Photos
framework) identifier. Feeding that to `expo-image-manipulator` makes the native
image decoder hard-crash the app (it just quits, with no JS error). The fix in
`PhotoGallerySheet.handleSelect` is to pass `Asset.localUri` (a `file://` copy
that media-library provides) to the uploader instead. A guard rejects any asset
whose URI isn't `file://`/`http(s)://` with a friendly alert rather than
crashing, so only on-device photos are accepted.

> If the app hard-crashes **as soon as the gallery opens** (before any photos
> appear), that's a different cause: `expo-media-library` is a new native module,
> so a dev build must be **rebuilt** (`expo prebuild` / `eas build --profile
> development` / `expo run:ios|android`) before it can be invoked. Expo Go
> already includes it.

## Setup / deployment checklist
1. **Install deps** (already done): `expo-image-picker`, `expo-image-manipulator`,
   and `expo-media-library` were added via `npx expo install`.
2. **Run the migration** `00013_avatar_storage.sql` against Supabase (SQL editor
   or `supabase db push`) so the `avatars` bucket + RLS exist. Without it,
   uploads fail with an RLS/storage error.
3. **Rebuild the native app** (`expo prebuild` / `expo run:ios|android`) so the
   new permission strings and plugin config are baked into the native project.
   Permission prompts will not appear until the app is rebuilt.

## ⚠️ iOS TCC crash — `NSPhotoLibraryUsageDescription` (fixed)
**Symptom:** tapping "Choose from Library" hard-crashed the app with a TCC
privacy termination: *"This app has crashed because it attempted to access
privacy-sensitive data without a usage description. The app's Info.plist must
contain an NSPhotoLibraryUsageDescription key…"*

**Root cause:** Expo **config plugins only run at `prebuild` time**. The
`expo-image-picker` and `expo-media-library` plugins were added to `app.json`
*after* the last `expo prebuild`, so the generated `ios/<app>/Info.plist` never
received the privacy keys — even though `npx expo install` had already linked
the native modules (which is why `ExpoMediaLibrary.framework` loaded). Accessing
the photo library without the usage string is a hard OS crash on iOS, not a
JS error.

**Fix applied:**
- `ios/servicehubmobile/Info.plist` — directly added `NSPhotoLibraryUsageDescription`,
  `NSPhotoLibraryAddUsageDescription`, `NSCameraUsageDescription`,
  `NSMicrophoneUsageDescription` (immediate relief; no full prebuild required).
- `app.json` — added an explicit `ios.infoPlist` block with the same four keys
  (and `android.permissions` for future Android prebuilds) so a clean
  `expo prebuild` regenerates them regardless of plugin behavior.

**To apply:** rebuild the native app. Either:
- just rebuild now — the patched `Info.plist` is already on disk, **or**
- for a clean slate: `npx expo prebuild --clean && expo run:ios`.
A standard `expo run:ios` reuses the existing `ios/` folder and will pick up the
patched plist; it will NOT silently drop the keys.


## Security notes
- Bucket is **public for reads**; writes are scoped by RLS to the owner's folder
  using `auth.uid()`. Only the anon key is used client-side — consistent with the
  project's existing RLS-everything rule.
- Only the profile picture blob leaves the device; no other PII is uploaded.
- File size capped at 5 MB; MIME restricted to jpeg/png/webp via bucket config.

## UX / performance
- Image is downscaled to 512×512 JPEG (quality 0.8) before upload → small
  payload, fits the circular avatar exactly, low data/battery cost.
- Optimistic local preview shows instantly; the public URL replaces it on
  success (with cache-busting) so the new photo appears immediately.
- Platform-native: iOS uses `ActionSheetIOS`; Android uses a centered `Alert`.
