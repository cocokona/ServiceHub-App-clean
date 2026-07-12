import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { PINK, INK, MUTED, CANVAS } from '../../theme/colors';
import { Review } from '../../types';
import {
  fetchTechnicianReviews,
  fetchTechnicianStats,
} from '../../services/review.service';
import { logger } from '../../services/logger';

interface TechnicianReviewsParams {
  technicianId: string;
  technicianName?: string;
  technicianAvatar?: string;
}

/** Render 5 stars with `rating` of them filled. */
function StarRow({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={size}
          color={star <= rating ? '#F59E0B' : '#CBD5E1'}
        />
      ))}
    </View>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function TechnicianReviews({ route, navigation }: any) {
  const params: TechnicianReviewsParams = route?.params || {};
  const technicianId = params.technicianId;
  const technicianName = params.technicianName || 'Technician';
  const technicianAvatar = params.technicianAvatar;

  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!technicianId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [list, stats] = await Promise.all([
        fetchTechnicianReviews(technicianId),
        fetchTechnicianStats(technicianId),
      ]);
      setReviews(list);
      setAverageRating(stats.averageRating);
      setReviewCount(stats.reviewCount);
    } catch (err) {
      logger.warn('[TechnicianReviews] failed to load', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [technicianId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CANVAS }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#F1F5F9',
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginRight: 12 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 18, fontWeight: '800', color: INK, letterSpacing: -0.3 }}
          >
            {technicianName}
          </Text>
          <Text style={{ fontSize: 12, color: MUTED, fontWeight: '500', marginTop: 2 }}>
            All reviews
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary card: average rating + total count */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: '#F1F5F9',
            marginBottom: 16,
          }}
        >
          {technicianAvatar ? (
            <Image
              source={{ uri: technicianAvatar }}
              style={{ width: 52, height: 52, borderRadius: 26, marginRight: 14 }}
            />
          ) : (
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: '#FFE2EC',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 14,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: PINK }}>
                {technicianName[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: INK }}>
                {averageRating ? averageRating.toFixed(1) : '—'}
              </Text>
              <StarRow rating={Math.round(averageRating)} size={15} />
            </View>
            <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
              {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={PINK} />
          </View>
        ) : reviews.length === 0 ? (
          <View
            style={{
              paddingVertical: 48,
              paddingHorizontal: 24,
              alignItems: 'center',
              backgroundColor: '#fff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#F1F5F9',
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={36} color="#CBD5E1" />
            <Text style={{ fontSize: 14, fontWeight: '700', color: INK, marginTop: 12 }}>
              No reviews yet
            </Text>
            <Text style={{ fontSize: 12, color: MUTED, marginTop: 4, textAlign: 'center' }}>
              {technicianName} hasn’t received any reviews so far.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {reviews.map((review) => (
              <View
                key={review.id}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#F1F5F9',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <StarRow rating={review.rating} size={15} />
                  <Text style={{ fontSize: 11, color: MUTED }}>
                    {formatDate(review.createdAt)}
                  </Text>
                </View>
                {review.comment ? (
                  <Text
                    style={{
                      fontSize: 14,
                      color: '#334155',
                      lineHeight: 20,
                    }}
                  >
                    {review.comment}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 13, fontStyle: 'italic', color: MUTED }}>
                    Rated {review.rating} stars (no written review)
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
