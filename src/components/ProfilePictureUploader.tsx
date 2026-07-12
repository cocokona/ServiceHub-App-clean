/**
 * ProfilePictureUploader.tsx — Reusable profile photo picker + uploader
 *
 * A self-contained component that:
 *   1. Shows the current avatar (image, initial, or icon fallback) with an
 *      edit (camera) badge.
 *   2. On tap, presents a platform-native choice: Take Photo / Choose from
 *      Library / (Remove Photo) / Cancel.
 *   3. Requests camera / photo-library permission and guides the user to
 *      Settings if permanently denied.
 *   4. Crops to a square and resizes + compresses to 512×512 JPEG in-app via
 *      expo-image-manipulator, so the upload is small and fits the circular
 *      display area. No external crop/editor app is ever launched.
 *   5. Uploads to Supabase Storage and hands the public URL back via
 *      `onUploaded`. Shows an optimistic local preview during the upload.
 *
 * The component stays UI-only: it does NOT touch the database. The parent
 * screen is responsible for persisting the URL (via `updateProfile`) and
 * updating app state, which keeps the existing profile-save flow intact.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Linking,
  Platform,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';

import { uploadProfilePicture, removeProfilePicture } from '../services/profilePicture.service';
import { logger } from '../services/logger';
import PhotoGallerySheet from './PhotoGallerySheet';

const TARGET_SIZE = 512;

export interface ProfilePictureUploaderProps {
  /** Current avatar URL (public URL or local file URI). */
  uri?: string | null;
  /** User's display name — used for the initial fallback. */
  name?: string;
  /** Diameter of the avatar in points. */
  size?: number;
  /** 'circle' (default) or 'rounded' square. */
  shape?: 'circle' | 'rounded';
  /** Ionicons name shown when there is no image and no initial. When omitted,
   *  the user's initial is shown instead. */
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  /** Accent color for the badge / fallback. */
  editButtonColor?: string;
  /** Called after a successful upload with the public URL. May be async. */
  onUploaded: (publicUrl: string) => void | Promise<void>;
  /** Called when the user removes the photo. */
  onRemove?: () => void | Promise<void>;
  /** Disable interaction (e.g. while the profile is saving). */
  disabled?: boolean;
}

export default function ProfilePictureUploader({
  uri,
  name,
  size = 56,
  shape = 'circle',
  fallbackIcon = 'person',
  editButtonColor = '#FF4F8B',
  onUploaded,
  onRemove,
  disabled = false,
}: ProfilePictureUploaderProps) {
  const [uploading, setUploading] = useState(false);
  // Optimistic local preview (manipulated file) shown while uploading.
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  // In-app gallery visibility (replaces the external system picker).
  const [galleryVisible, setGalleryVisible] = useState(false);

  const resolvedUri = localPreview ?? uri ?? null;
  const borderRadius = shape === 'circle' ? size / 2 : Math.round(size * 0.18);
  const initial = (name || '?').trim().charAt(0).toUpperCase();

  // ---- Permission handling -------------------------------------------------
  // Only camera needs handling here; the in-app gallery manages its own
  // expo-media-library permission prompt internally.
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const res = await ImagePicker.requestCameraPermissionsAsync();
    if (res.status === 'granted') return true;

    if (res.status === 'denied') {
      Alert.alert(
        'Camera access needed',
        'Enable camera access in Settings to take a profile photo.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
    return false;
  }, []);

  // ---- In-app crop + resize + upload --------------------------------------
  // Cropping is done here (not by the picker) so we never launch the system
  // crop/editor activity, which on Android opens a separate external app.
  const processAndUpload = useCallback(
    async (uri: string, width: number, height: number) => {
      if (disabled || uploading) return;
      setUploading(true);
      try {
        const actions: Parameters<typeof manipulateAsync>[1] = [];
        const side = Math.min(width || 0, height || 0);
        if (side > 0) {
          // Center-square crop in the image's own pixel space.
          const originX = Math.floor((width - side) / 2);
          const originY = Math.floor((height - side) / 2);
          actions.push({ crop: { originX, originY, width: side, height: side } });
        }
        actions.push({ resize: { width: TARGET_SIZE, height: TARGET_SIZE } });

        // Resize + compress to a small square so the upload is fast and the
        // picture fits the circular display area exactly.
        const manipulated = await manipulateAsync(uri, actions, {
          compress: 0.8,
          format: SaveFormat.JPEG,
        });

        // Instant feedback before the network round-trip finishes.
        setLocalPreview(manipulated.uri);

        const publicUrl = await uploadProfilePicture(manipulated.uri, 'image/jpeg');
        await onUploaded(publicUrl);
        // Switch from the local preview to the final public URL.
        setLocalPreview(null);
      } catch (err) {
        setLocalPreview(null);
        const message =
          err instanceof Error ? err.message : 'Could not upload the photo.';
        logger.warn('[ProfilePictureUploader] upload failed', { message });
        Alert.alert('Upload failed', message);
      } finally {
        setUploading(false);
      }
    },
    [disabled, uploading, onUploaded]
  );

  // ---- Launch the in-app camera (no external crop) ------------------------
  const takePhoto = useCallback(async () => {
    if (disabled || uploading) return;

    const permitted = await ensurePermission();
    if (!permitted) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // crop happens in-app below
      quality: 0.9,
      exif: false,
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    await processAndUpload(asset.uri, asset.width, asset.height);
  }, [disabled, uploading, ensurePermission, processAndUpload]);

  const handleRemove = useCallback(async () => {
    if (disabled || uploading) return;
    Alert.alert('Remove photo', 'Remove your current profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setUploading(true);
          try {
            await removeProfilePicture();
            await onRemove?.();
          } catch (err) {
            logger.warn('[ProfilePictureUploader] remove failed', {
              message: err instanceof Error ? err.message : String(err),
            });
          } finally {
            setUploading(false);
          }
        },
      },
    ]);
  }, [disabled, uploading, onRemove]);

  // ---- Present the action sheet / alert ------------------------------------
  const presentOptions = useCallback(() => {
    if (disabled || uploading) return;

    const buttons: { label: string; action?: () => void; destructive?: boolean }[] = [
      { label: 'Take Photo', action: takePhoto },
      { label: 'Choose from Library', action: () => setGalleryVisible(true) },
    ];
    if (resolvedUri) {
      buttons.push({ label: 'Remove Photo', action: handleRemove, destructive: true });
    }
    buttons.push({ label: 'Cancel', action: undefined });

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: buttons.map((b) => b.label),
          cancelButtonIndex: buttons.length - 1,
          destructiveButtonIndex: resolvedUri ? 2 : undefined,
        },
        (btnIndex) => {
          const b = buttons[btnIndex];
          if (b?.action) b.action();
        }
      );
    } else {
      Alert.alert(
        'Profile Photo',
        'Choose an option',
        buttons.map((b, i) => ({
          text: b.label,
          style: b.destructive ? 'destructive' : i === buttons.length - 1 ? 'cancel' : 'default',
          onPress: b.action,
        }))
      );
    }
  }, [disabled, uploading, resolvedUri, takePhoto, handleRemove]);

  const badgeSize = Math.max(20, Math.round(size * 0.36));

  return (
    <View style={{ width: size, height: size }}>
      <TouchableOpacity
        activeOpacity={disabled ? 1 : 0.85}
        onPress={presentOptions}
        disabled={disabled}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: '#FFE2EC',
            borderColor: '#fff',
          },
        ]}
      >
        {resolvedUri ? (
          <Image
            source={{ uri: resolvedUri }}
            style={[{ width: size, height: size }, { borderRadius }]}
            contentFit="cover"
            cachePolicy={localPreview ? 'none' : 'memory-disk'}
          />
        ) : fallbackIcon ? (
          <Ionicons name={fallbackIcon} size={Math.round(size * 0.42)} color={editButtonColor} />
        ) : (
          <Text style={{ fontSize: Math.round(size * 0.4), fontWeight: '700', color: editButtonColor }}>
            {initial}
          </Text>
        )}

        {uploading && (
          <View style={[StyleSheet.absoluteFill, styles.uploadingOverlay]}>
            <ActivityIndicator color={editButtonColor} />
          </View>
        )}
      </TouchableOpacity>

      {!disabled && (
        <TouchableOpacity
          onPress={presentOptions}
          activeOpacity={0.8}
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: Math.round(badgeSize / 2),
              backgroundColor: editButtonColor,
              borderColor: '#fff',
              right: -2,
              bottom: -2,
            },
          ]}
        >
          <Ionicons name="camera" size={Math.round(badgeSize * 0.55)} color="#fff" />
        </TouchableOpacity>
      )}

      <PhotoGallerySheet
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        onSelect={(asset) => processAndUpload(asset.uri, asset.width, asset.height)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  uploadingOverlay: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
