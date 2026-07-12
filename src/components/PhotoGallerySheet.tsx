/**
 * PhotoGallerySheet.tsx — Fully in-app photo picker.
 *
 * Replaces the platform's external image-picker / document chooser (which on
 * Android launches a separate gallery/Photos app, and on crop-enabled flows
 * opens the system crop activity). Instead this component:
 *   - requests Photos permission via expo-media-library,
 *   - lists the user's own photos in a native FlatList grid rendered inside
 *     our app,
 *   - returns the chosen asset (uri + dimensions) to the caller.
 *
 * No external app is launched for selection. Cropping to a square is handled
 * separately by the caller (in-app, via expo-image-manipulator).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { logger } from '../services/logger';

// The legacy `Asset` returned by getAssetsAsync exposes plain `uri`/`width`/
// `height` fields; the top-level `MediaLibrary.Asset` is the newer class-based
// type, so we derive the element type directly from the API return value and
// add `localUri` (which the class-based type omits but the runtime provides).
type MediaAsset = Awaited<ReturnType<typeof MediaLibrary.getAssetsAsync>>['assets'][number] & {
  localUri?: string;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = 4;
const NUM_COLUMNS = 3;
const THUMB_SIZE = Math.floor(
  (SCREEN_WIDTH - GRID_PADDING * (NUM_COLUMNS + 1)) / NUM_COLUMNS
);
const PAGE_SIZE = 60;

export interface GalleryAsset {
  uri: string;
  width: number;
  height: number;
}

interface PhotoGallerySheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (asset: GalleryAsset) => void;
}

type LoadState = 'loading' | 'granted' | 'denied' | 'empty';

export default function PhotoGallerySheet({
  visible,
  onClose,
  onSelect,
}: PhotoGallerySheetProps) {
  const [permission, setPermission] = useState<MediaLibrary.PermissionResponse | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const loadPage = useCallback(async (after?: string) => {
    setLoading(true);
    try {
      const res = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: PAGE_SIZE,
        after,
        sortBy: ['creationTime', false],
      });
      setAssets((prev) => (after ? [...prev, ...res.assets] : res.assets));
      setEndCursor(res.endCursor);
      setHasNextPage(res.hasNextPage);
      setLoadState(res.assets.length === 0 && !after ? 'empty' : 'granted');
    } catch (err) {
      logger.warn('[PhotoGallerySheet] failed to load assets', {
        message: err instanceof Error ? err.message : String(err),
      });
      setLoadState('empty');
    } finally {
      setLoading(false);
    }
  }, []);

  const requestAndLoad = useCallback(async () => {
    setLoadState('loading');
    const perm = await MediaLibrary.requestPermissionsAsync();
    setPermission(perm);
    if (perm.status !== 'granted') {
      setLoadState('denied');
      return;
    }
    await loadPage();
  }, [loadPage]);

  // (Re)check permission and load whenever the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setAssets([]);
    setEndCursor(null);
    setHasNextPage(false);
    let active = true;
    (async () => {
      const perm = await MediaLibrary.getPermissionsAsync();
      if (!active) return;
      setPermission(perm);
      if (perm.status === 'granted') {
        setLoadState('loading');
        await loadPage();
      } else {
        await requestAndLoad();
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, loadPage, requestAndLoad]);

  // expo-image-manipulator can only decode file:// (or http(s)://) URIs on
  // native. On iOS, Asset.uri is a `ph://` Photos identifier that crashes the
  // native manipulator (hard app quit), so we must hand it the `localUri`
  // (a file:// copy that media-library provides) instead.
  const pickSourceUri = useCallback((asset: MediaAsset): string | null => {
    const candidate = asset.localUri || asset.uri;
    if (candidate && (candidate.startsWith('file://') || candidate.startsWith('http'))) {
      return candidate;
    }
    return null;
  }, []);

  const handleSelect = useCallback(
    (asset: MediaAsset) => {
      const src = pickSourceUri(asset);
      if (!src) {
        Alert.alert(
          'Could not load photo',
          'This photo is not available on the device. Please choose another.'
        );
        return;
      }
      onSelect({ uri: src, width: asset.width, height: asset.height });
      onClose();
    },
    [onSelect, onClose, pickSourceUri]
  );

  const handleLoadMore = useCallback(() => {
    if (loading || !hasNextPage || !endCursor) return;
    loadPage(endCursor);
  }, [loading, hasNextPage, endCursor, loadPage]);

  const insets = useSafeAreaInsets();

  const openSettings = () => Linking.openSettings();

  const renderItem = useCallback(
    ({ item }: { item: MediaAsset }) => (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleSelect(item)}
        style={styles.cell}
      >
        <Image
          source={{ uri: item.uri }}
          style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      </TouchableOpacity>
    ),
    [handleSelect]
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose a Photo</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {loadState === 'loading' && assets.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#FF4F8B" />
            </View>
          ) : loadState === 'denied' ? (
            <View style={styles.center}>
              <Text style={styles.message}>Photo access is needed to choose a profile picture.</Text>
              <TouchableOpacity style={styles.settingsButton} onPress={openSettings}>
                <Text style={styles.settingsButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          ) : loadState === 'empty' && !loading ? (
            <View style={styles.center}>
              <Text style={styles.message}>No photos found on this device.</Text>
            </View>
          ) : (
            <FlatList
              data={assets}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={NUM_COLUMNS}
              contentContainerStyle={styles.grid}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                loading && assets.length > 0 ? (
                  <View style={styles.footer}>
                    <ActivityIndicator color="#FF4F8B" />
                  </View>
                ) : null
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF4F8B',
  },
  body: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  message: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  settingsButton: {
    backgroundColor: '#FF4F8B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  settingsButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  grid: {
    padding: GRID_PADDING,
  },
  cell: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    margin: GRID_PADDING / 2,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
