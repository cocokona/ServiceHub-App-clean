import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Job, Review } from '../../types';
import { trackingSteps, getStatusInfo, getStatusIndex } from '../../data';
import { fetchTechnicianPhone, fetchTechnicianById } from '../../services/database.service';
import { submitReview, fetchReviewForJob } from '../../services/review.service';
import { normalizePhoneForDial } from '../../services/validation';
import * as Location from 'expo-location';
import { subscribeToTechnicianLocation, computeEta } from '../../services/location.service';
import { openInMaps } from '../../services/mapLink.service';
import { logger } from '../../services/logger';
import { PINK, PINK_SOFT, PINK_TINT, INK, MUTED, SUCCESS, MAP_BG, ACCENT, BORDER_LIGHT } from '../../theme/colors';

export default function Tracking({ route, navigation }: any) {
  const { job } = route.params || {};
  if (!job) return null;

  const [technicianPhone, setTechnicianPhone] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

  // Real technician rating/review stats (replaces the old hardcoded defaults).
  const [techStats, setTechStats] = useState<{ rating: number; reviewsCount: number } | null>(null);

  // Post-completion rating flow state.
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Live-tracking state: technician ping + resolved destination + derived ETA.
  const [techLoc, setTechLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [dest, setDest] = useState<{ lat: number; lng: number } | null>(null);
  const [etaText, setEtaText] = useState('—');
  const [distText, setDistText] = useState('—');

  // Resolve the assigned technician's phone so the customer can call them
  // directly from the order view.
  useEffect(() => {
    let active = true;
    if (!job.technicianId) {
      setTechnicianPhone(null);
      return;
    }
    setPhoneLoading(true);
    fetchTechnicianPhone(job.technicianId)
      .then((phone) => {
        if (active) setTechnicianPhone(phone);
      })
      .finally(() => {
        if (active) setPhoneLoading(false);
      });
    return () => {
      active = false;
    };
  }, [job.technicianId]);

  // Resolve the customer's destination coordinates once (native geocode,
  // no API key). We need this to compute the live ETA/distance.
  useEffect(() => {
    let active = true;
    Location.geocodeAsync(`${job.address}, ${job.city}, ${job.zipCode}`)
      .then((res) => {
        if (active && res[0]) setDest({ lat: res[0].latitude, lng: res[0].longitude });
      })
      .catch((err) => logger.warn('[tracking] geocode failed', { error: String(err) }));
    return () => {
      active = false;
    };
  }, [job.address, job.city, job.zipCode]);

  // Subscribe to live technician location via Supabase Realtime.
  useEffect(() => {
    const unsub = subscribeToTechnicianLocation(job.id, (loc) => {
      setTechLoc({ lat: loc.latitude, lng: loc.longitude });
    });
    return unsub;
  }, [job.id]);

  // Recompute ETA/distance whenever either side updates.
  useEffect(() => {
    if (!techLoc || !dest) return;
    const { distanceKm, etaMinutes } = computeEta(techLoc.lat, techLoc.lng, dest.lat, dest.lng);
    setDistText(`${distanceKm.toFixed(1)} km`);
    setEtaText(etaMinutes <= 1 ? '<1 min' : `${etaMinutes} min`);
  }, [techLoc, dest]);

  const handleCallTechnician = () => {
    const dialable = normalizePhoneForDial(technicianPhone);
    if (!dialable) {
      Alert.alert('No Phone Number', 'This technician has not provided a phone number yet.');
      return;
    }
    Linking.openURL(`tel:${dialable}`);
  };

  // Load the technician's LIVE rating/review stats, and (if the order is
  // complete) whether the customer has already reviewed it. If a review exists
  // we prefill the form so we never show the rating UI twice.
  useEffect(() => {
    let active = true;
    if (!job.technicianId) {
      setTechStats(null);
      return;
    }
    Promise.all([
      fetchTechnicianById(job.technicianId),
      job.status === 'completed'
        ? fetchReviewForJob(job.id)
        : Promise.resolve(null),
    ])
      .then(([stats, existing]) => {
        if (!active) return;
        if (stats) setTechStats({ rating: stats.rating, reviewsCount: stats.reviewsCount });
        if (existing) {
          setExistingReview(existing);
          setRating(existing.rating);
          setReviewText(existing.comment || '');
        }
      })
      .catch((err) =>
        logger.warn('[tracking] failed to load review stats', { error: String(err) })
      );
    return () => {
      active = false;
    };
  }, [job.technicianId, job.id, job.status]);

  const handleSubmitReview = async () => {
    if (!job.technicianId) return;
    if (rating < 1) {
      setSubmitError('Please select a star rating.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitReview({
        jobId: job.id,
        technicianId: job.technicianId,
        rating,
        comment: reviewText,
      });
      // Refresh the technician's live stats so the card above updates
      // immediately after the DB trigger rolls up the new rating.
      const updated = await fetchTechnicianById(job.technicianId);
      if (updated) setTechStats({ rating: updated.rating, reviewsCount: updated.reviewsCount });
      setJustSubmitted(true);
    } catch (err: any) {
      setSubmitError(err?.message || 'Could not submit your review.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open the technician's CURRENT location in the native maps app.
  // Disabled until the first live ping arrives (mirrors disabled={!technicianPhone}).
  const handleOpenTechInMaps = () => {
    if (!techLoc) {
      Alert.alert('Not available yet', 'Technician location is still loading.');
      return;
    }
    openInMaps(techLoc.lat, techLoc.lng, { label: job.technicianName || 'Technician' });
  };

  const getStatusIndexFn = () => getStatusIndex(job.status);

  const statusIndex = getStatusIndexFn();

  const statusInfo = getStatusInfo(job.status);

  // ETA is now derived live from technician pings via computeEta
  // (see the Realtime subscription effect below), not from job.status.

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: INK, letterSpacing: -0.3 }}>{statusInfo.title}</Text>
          <Text style={{ fontSize: 12, color: MUTED, fontWeight: '500', marginTop: 2 }}>{statusInfo.subtitle}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Live Tracking Map — pastel blue panel */}
        <View
          style={{
            margin: 20,
            borderRadius: 24,
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: MAP_BG,
            height: 220,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 2,
          }}
        >
          {/* Decorative map illustration */}
          <View style={{ position: 'absolute', top: 20, left: 20, right: 20, bottom: 20 }}>
            {/* Soft route line */}
            <View
              style={{
                position: 'absolute',
                top: 60,
                left: 30,
                right: 30,
                height: 3,
                backgroundColor: PINK,
                opacity: 0.4,
                borderRadius: 2,
              }}
            />
            {/* Origin pin */}
            <View
              style={{
                position: 'absolute',
                top: 50,
                left: 20,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#fff',
                borderWidth: 3,
                borderColor: PINK,
              }}
            />
            {/* Destination pin */}
            <View
              style={{
                position: 'absolute',
                top: 50,
                right: 20,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: PINK,
              }}
            />
            <Ionicons
              name="home"
              size={11}
              color="#fff"
              style={{ position: 'absolute', top: 55, right: 25 }}
            />
          </View>

          {/* Pulsing technician avatar (centered) */}
          <View
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginLeft: -36,
              marginTop: -36,
            }}
          >
            {/* Pulse rings */}
            <View
              style={{
                position: 'absolute',
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: PINK,
                opacity: 0.15,
                top: -12,
                left: -12,
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: PINK,
                opacity: 0.25,
                top: -4,
                left: -4,
              }}
            />
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: PINK,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 4,
                borderColor: '#fff',
                shadowColor: PINK,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 5,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>
                {(job.technicianName || 'M')[0]}
              </Text>
            </View>
          </View>

          {/* LIVE TRACKING pill (top-left) */}
          <View
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              backgroundColor: PINK,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#fff',
              }}
            />
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>
              LIVE TRACKING
            </Text>
          </View>

          {/* ETA card (bottom-right) — live once the technician ping arrives */}
          {techLoc && (
            <View
              style={{
                position: 'absolute',
                bottom: 14,
                right: 14,
                backgroundColor: '#fff',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 14,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 3,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 9, color: MUTED, fontWeight: '800', letterSpacing: 0.6 }}>
                ETA
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: INK, marginTop: 2 }}>{etaText}</Text>
              <Text style={{ fontSize: 10, color: MUTED, fontWeight: '700', marginTop: 2 }}>{distText} away</Text>
            </View>
          )}
        </View>

        {/* Journey Progress — playful timeline */}
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: '#F1F5F9',
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 1,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
            Journey Progress
          </Text>
          {trackingSteps.map((step, i) => {
            const isDone = i < statusIndex;
            const isActive = i === statusIndex;
            const isPending = i > statusIndex;
            return (
              <View key={step.key} style={{ flexDirection: 'row', marginBottom: i < trackingSteps.length - 1 ? 14 : 0 }}>
                {/* Marker column */}
                <View style={{ alignItems: 'center', marginRight: 14 }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: isDone ? SUCCESS : isActive ? PINK : '#F1F5F9',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: isActive ? 3 : 0,
                      borderColor: isActive ? PINK_SOFT : 'transparent',
                    }}
                  >
                    {isDone ? (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    ) : isActive ? (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: '#fff',
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: '#CBD5E1',
                        }}
                      />
                    )}
                  </View>
                  {i < trackingSteps.length - 1 && (
                    <View
                      style={{
                        width: 2,
                        flex: 1,
                        minHeight: 28,
                        backgroundColor: isDone ? SUCCESS : '#F1F5F9',
                        opacity: isDone ? 1 : isPending ? 0.6 : 1,
                        marginTop: 4,
                      }}
                    />
                  )}
                </View>
                {/* Text column */}
                <View style={{ flex: 1, paddingTop: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '800',
                        color: isPending ? '#94A3B8' : INK,
                      }}
                    >
                      {step.title}
                    </Text>
                    {step.time && (
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '800',
                          color: isActive ? PINK : isDone ? SUCCESS : MUTED,
                        }}
                      >
                        {step.time}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      color: isPending ? '#94A3B8' : MUTED,
                      marginTop: 3,
                      lineHeight: 17,
                      fontWeight: '500',
                    }}
                  >
                    {step.subtitle}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Technician Card */}
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: '#F1F5F9',
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {job.technicianAvatar ? (
            <Image source={{ uri: job.technicianAvatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
          ) : (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: PINK_SOFT,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '800', color: PINK }}>
                {(job.technicianName || 'T')[0]}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: INK }}>{job.technicianName || 'Assigned Technician'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={{ fontSize: 11, color: MUTED, fontWeight: '600' }}>
                {techStats
                  ? `${techStats.rating} · ${techStats.reviewsCount} reviews`
                  : '— · — reviews'}
              </Text>
            </View>
            {phoneLoading ? (
              <Text style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>Loading contact…</Text>
            ) : technicianPhone ? (
              <Text style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{technicianPhone}</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={handleCallTechnician}
              disabled={!technicianPhone}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: technicianPhone ? PINK_TINT : '#F1F5F9',
                justifyContent: 'center',
                alignItems: 'center',
                opacity: technicianPhone ? 1 : 0.5,
              }}
            >
              <Ionicons name="call" size={16} color={technicianPhone ? PINK : MUTED} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('SupportChat', { job })}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: PINK,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: PINK,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Ionicons name="chatbubble" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleOpenTechInMaps}
              disabled={!techLoc}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: techLoc ? PINK_TINT : '#F1F5F9',
                justifyContent: 'center',
                alignItems: 'center',
                opacity: techLoc ? 1 : 0.5,
              }}
            >
              <Ionicons name="navigate" size={16} color={techLoc ? PINK : MUTED} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Rate your experience — shown after the order is completed */}
        {job.status === 'completed' && job.technicianId && (
          <View
            style={{
              marginHorizontal: 20,
              backgroundColor: '#fff',
              borderRadius: 20,
              padding: 18,
              borderWidth: 1,
              borderColor: '#F1F5F9',
              marginBottom: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 1,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: INK, marginBottom: 4 }}>
              {justSubmitted || existingReview ? 'Thanks for your feedback!' : 'Rate your experience'}
            </Text>
            <Text style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>
              {justSubmitted || existingReview
                ? 'Your rating helps others choose the right technician.'
                : `How was your service with ${job.technicianName || 'your technician'}?`}
            </Text>

            {/* Star selector (1–5) */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
              {[1, 2, 3, 4, 5].map((star) => {
                const shown = justSubmitted || existingReview ? existingReview?.rating ?? rating : rating;
                const filled = star <= shown;
                return (
                  <TouchableOpacity
                    key={star}
                    onPress={() => !justSubmitted && !existingReview && setRating(star)}
                    disabled={justSubmitted || !!existingReview}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={filled ? 'star' : 'star-outline'}
                      size={32}
                      color={filled ? '#F59E0B' : '#CBD5E1'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Optional text review (only before submission) */}
            {!justSubmitted && !existingReview && (
              <TextInput
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="Add a comment (optional)"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                maxLength={500}
                style={{
                  borderWidth: 1,
                  borderColor: '#F1F5F9',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 13,
                  color: INK,
                  textAlignVertical: 'top',
                  marginBottom: 12,
                  minHeight: 72,
                }}
              />
            )}

            {submitError && (
              <Text style={{ fontSize: 12, color: '#EF4444', marginBottom: 10 }}>{submitError}</Text>
            )}

            {/* Submit button (hidden once a review exists / was just submitted) */}
            {!justSubmitted && !existingReview && (
              <TouchableOpacity
                onPress={handleSubmitReview}
                disabled={submitting || rating < 1}
                style={{
                  backgroundColor: submitting || rating < 1 ? '#FFE2EC' : PINK,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {submitting ? 'Submitting…' : 'Submit Review'}
                </Text>
              </TouchableOpacity>
            )}

            {(justSubmitted || existingReview) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={16} color={SUCCESS} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: SUCCESS }}>
                  {existingReview && !justSubmitted ? 'You rated this order' : 'Review submitted'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Service Details */}
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: '#F1F5F9',
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>
            Service Details
          </Text>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="briefcase-outline" size={14} color={MUTED} />
              <Text style={{ fontSize: 13, color: INK, flex: 1, fontWeight: '600' }}>{job.serviceType}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="location-outline" size={14} color={MUTED} />
              <Text style={{ fontSize: 13, color: INK, flex: 1, fontWeight: '600' }}>{job.address}, {job.city}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="time-outline" size={14} color={MUTED} />
              <Text style={{ fontSize: 13, color: INK, flex: 1, fontWeight: '600' }}>{job.rooms} · {job.duration}h</Text>
            </View>
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: '#F1F5F9',
                marginTop: 6,
                paddingTop: 12,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: MUTED }}>Total</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: PINK }}>${job.totalPrice.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
