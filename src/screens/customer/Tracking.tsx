import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Job, Review } from '../../types';
import { trackingSteps, getStatusInfo, getStatusIndex, getRejectionReasonLabel } from '../../data';
import { fetchTechnicianPhone, fetchTechnicianById, fetchOrderRejectionReason, setOrderInProgressStatus } from '../../services/database.service';
import { submitReview, fetchReviewForJob } from '../../services/review.service';
import { normalizePhoneForDial } from '../../services/validation';
import RatingModal from '../../components/RatingModal';
import * as Location from 'expo-location';
import { subscribeToTechnicianLocation, computeEta } from '../../services/location.service';
import { openInMaps } from '../../services/mapLink.service';
import { logger } from '../../services/logger';
import { PINK, PINK_SOFT, PINK_TINT, INK, MUTED, SUCCESS, ACCENT, BORDER_LIGHT } from '../../theme/colors';

export default function Tracking({ route, navigation }: any) {
  const { job } = route.params || {};
  if (!job) return null;

  // Rejection reason surfaced to the customer when a technician declines their
  // still-pending order. Seeded from the job snapshot, then refreshed from the
  // server so the notice appears even if the in-memory job is stale.
  const [rejectionReason, setRejectionReason] = useState<string | null>(
    job.rejectionReason ?? null
  );

  // The order's live status. We keep it in local state so a technician's
  // rejection (status -> 'rejected') and the customer's subsequent choice
  // (status -> 'pending' re-open, or 'cancelled') are reflected in this view
  // immediately without waiting for a remount. Seeded from the route snapshot.
  const [orderStatus, setOrderStatus] = useState<string>(job.status || 'pending');

  // The customer-facing rejection dialog. Auto-opens when the order is already
  // in the 'rejected' state on mount (e.g. the customer opens the order after a
  // technician declined it). Can also be re-opened from the banner.
  const [rejectionDialogVisible, setRejectionDialogVisible] = useState<boolean>(
    job.status === 'rejected'
  );
  const [rejectionActionLoading, setRejectionActionLoading] = useState(false);

  // Once the customer dismisses the rejection dialog with "Decide later" (or
  // closes it via the back-drop), we don't re-pop it within the same screen
  // session. Acting on either button changes the order status, which naturally
  // takes the dialog out of scope, so this flag only guards the idle dismiss.
  const rejectionNagDismissed = useRef(false);

  const [technicianPhone, setTechnicianPhone] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

  // Real technician rating/review stats (replaces the old hardcoded defaults).
  const [techStats, setTechStats] = useState<{ rating: number; reviewsCount: number } | null>(null);

  // Post-completion rating flow state. The rating UI itself lives in the
  // RatingModal component; here we only track whether a review already exists
  // and whether the modal is open.
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // Keep the rejection notice fresh: if the order is still pending, re-read
  // the latest decline reason from the server (the technician may have rejected
  // it after this job snapshot was captured). No-op once the order is accepted
  // or rejected.
  useEffect(() => {
    if (orderStatus !== 'pending') return;
    let active = true;
    fetchOrderRejectionReason(job.id)
      .then((reason) => {
        if (active) setRejectionReason(reason);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [job.id, orderStatus]);

  // Auto-present the rejection dialog the moment a decline is detected — on
  // mount (status already 'rejected', or a pending order carrying a reason from
  // a refreshed snapshot) or right after the server lookup above populates the
  // reason for a still-pending order. The customer should not have to first
  // hunt for the banner link. A "Decide later" dismissal (tracked in
  // rejectionNagDismissed) stops it from re-popping within the same session.
  useEffect(() => {
    if (rejectionNagDismissed.current) return;
    const hasRejection =
      orderStatus === 'rejected' || (orderStatus === 'pending' && !!rejectionReason);
    if (hasRejection) {
      setRejectionDialogVisible(true);
    }
  }, [orderStatus, rejectionReason]);

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
  // complete) whether the customer has already reviewed it. If the order is
  // completed and not yet reviewed, we auto-present the rating modal so this
  // important step is impossible to miss.
  useEffect(() => {
    let active = true;
    if (!job.technicianId) {
      setTechStats(null);
      return;
    }
    Promise.all([
      fetchTechnicianById(job.technicianId),
      orderStatus === 'completed'
        ? fetchReviewForJob(job.id)
        : Promise.resolve(null),
    ])
      .then(([stats, existing]) => {
        if (!active) return;
        if (stats) setTechStats({ rating: stats.rating, reviewsCount: stats.reviewsCount });
        if (existing) {
          setExistingReview(existing);
        } else if (orderStatus === 'completed') {
          // Completed but not yet rated — pop the modal automatically.
          setRatingModalVisible(true);
        }
      })
      .catch((err) =>
        logger.warn('[tracking] failed to load review stats', { error: String(err) })
      );
    return () => {
      active = false;
    };
  }, [job.technicianId, job.id, job.status]);

  const handleSubmitReview = async (ratingValue: number, comment: string) => {
    if (!job.technicianId) return;
    if (ratingValue < 1) {
      setSubmitError('Please select a star rating.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitReview({
        jobId: job.id,
        technicianId: job.technicianId,
        rating: ratingValue,
        comment,
      });
      // Refresh the technician's live stats so the card above updates
      // immediately after the DB trigger rolls up the new rating.
      const updated = await fetchTechnicianById(job.technicianId);
      if (updated) setTechStats({ rating: updated.rating, reviewsCount: updated.reviewsCount });
      // Re-fetch the saved review (with its DB-generated id/timestamps) so the
      // modal/button flip to the read-only "Your rating" state.
      const saved = await fetchReviewForJob(job.id);
      if (saved) setExistingReview(saved);
      setRatingModalVisible(false);
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

  // --- Rejection dialog actions ---------------------------------------------
  // The customer chose to re-open the order to the technician pool (request a
  // different technician). We flip the order back to 'pending' server-side
  // (which also clears the stale decline reason) and reflect it locally.
  const handleRequestDifferentTechnician = async () => {
    setRejectionActionLoading(true);
    try {
      await setOrderInProgressStatus(job.id, 'pending');
      setOrderStatus('pending');
      setRejectionReason(null);
      setRejectionDialogVisible(false);
      Alert.alert(
        'Order re-opened',
        "We'll match you with a different technician.",
      );
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Could not re-open order', err?.message || 'Please try again.');
    } finally {
      setRejectionActionLoading(false);
    }
  };

  // The customer chose to cancel the order for a full refund.
  const handleCancelOrder = async () => {
    setRejectionActionLoading(true);
    try {
      await setOrderInProgressStatus(job.id, 'cancelled');
      setOrderStatus('cancelled');
      setRejectionDialogVisible(false);
      Alert.alert(
        'Order cancelled',
        'Your order has been cancelled. A full refund will be issued to your original payment method.',
      );
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Could not cancel order', err?.message || 'Please try again.');
    } finally {
      setRejectionActionLoading(false);
    }
  };

  // Resolve the current journey step from the order status. When the order is
  // completed we push the index *past* the final step so the whole timeline
  // renders as finished (every node green) instead of leaving "In Service"
  // highlighted as the active step. This is defensive against any drift in the
  // `statusIndex` data mapping.
  const rawStatusIndex = getStatusIndex(orderStatus);
  const statusIndex =
    orderStatus === 'completed'
      ? trackingSteps.length
      : Math.min(rawStatusIndex, Math.max(trackingSteps.length - 1, 0));

  const statusInfo = getStatusInfo(orderStatus);

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

        {/* Rejection notice — shown to the customer when a technician has
            declined their order (status 'rejected'), or for a still-pending
            order that carries a fresh decline reason. When the order is
            'rejected' we also surface a clear link to the action dialog. */}
        {orderStatus === 'rejected' || (orderStatus === 'pending' && rejectionReason) ? (
          <View
            style={{
              marginHorizontal: 20,
              backgroundColor: '#FEF2F2',
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: '#FECACA',
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Ionicons name="information-circle" size={18} color="#EF4444" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#B91C1C' }}>
                A technician was unable to take this order
              </Text>
              {rejectionReason ? (
                <Text style={{ fontSize: 12, color: '#7F1D1D', marginTop: 2, lineHeight: 17 }}>
                  Reason: {getRejectionReasonLabel(rejectionReason) || rejectionReason}
                </Text>
              ) : null}
              {orderStatus === 'rejected' ? (
                <TouchableOpacity
                  onPress={() => setRejectionDialogVisible(true)}
                  style={{ marginTop: 8, alignSelf: 'flex-start' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#EF4444', textDecorationLine: 'underline' }}>
                    Choose what to do →
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

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

        {/* Rate / view rating — always-visible entry point to the rating modal.
            For completed, unrated orders the modal also pops automatically. */}
        {orderStatus === 'completed' && job.technicianId && (
          <TouchableOpacity
            onPress={() => setRatingModalVisible(true)}
            style={{
              marginHorizontal: 20,
              marginBottom: 16,
              backgroundColor: existingReview ? '#F8FAFC' : PINK_SOFT,
              borderRadius: 14,
              paddingVertical: 13,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              borderWidth: existingReview ? 1 : 0,
              borderColor: '#F1F5F9',
            }}
            accessibilityRole="button"
            accessibilityLabel={existingReview ? 'View your rating' : 'Rate your technician'}
          >
            <Ionicons
              name={existingReview ? 'checkmark-circle' : 'star'}
              size={16}
              color={existingReview ? SUCCESS : PINK}
            />
            <Text style={{ color: existingReview ? SUCCESS : PINK, fontWeight: '700', fontSize: 13 }}>
              {existingReview ? 'Your rating' : 'Rate your technician'}
            </Text>
          </TouchableOpacity>
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

      <RatingModal
        visible={ratingModalVisible}
        technicianName={job.technicianName}
        existingReview={existingReview}
        submitting={submitting}
        error={submitError}
        onSubmit={handleSubmitReview}
        onClose={() => {
          setRatingModalVisible(false);
          setSubmitError(null);
        }}
      />

      {/* Rejection action dialog — shown when the order is 'rejected'. Offers
          the customer two clear, easy-to-act-on choices. */}
      <Modal
        visible={rejectionDialogVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          rejectionNagDismissed.current = true;
          setRejectionDialogVisible(false);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 22,
              paddingBottom: 34,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#FEF2F2',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <Ionicons name="alert-circle" size={26} color="#EF4444" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: INK, textAlign: 'center' }}>
                Your order was declined
              </Text>
              <Text style={{ fontSize: 13, color: MUTED, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
                {rejectionReason
                  ? `Reason: ${getRejectionReasonLabel(rejectionReason) || rejectionReason}\n`
                  : ''}What would you like to do?
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleRequestDifferentTechnician}
              disabled={rejectionActionLoading}
              style={{
                backgroundColor: PINK,
                paddingVertical: 15,
                borderRadius: 14,
                alignItems: 'center',
                marginBottom: 10,
                opacity: rejectionActionLoading ? 0.6 : 1,
              }}
              accessibilityRole="button"
              accessibilityLabel="Request a different technician"
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                Request a different technician
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCancelOrder}
              disabled={rejectionActionLoading}
              style={{
                backgroundColor: '#F1F5F9',
                paddingVertical: 15,
                borderRadius: 14,
                alignItems: 'center',
                opacity: rejectionActionLoading ? 0.6 : 1,
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel order and get a full refund"
            >
              <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: 15 }}>
                Cancel order &amp; get full refund
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                rejectionNagDismissed.current = true;
                setRejectionDialogVisible(false);
              }}
              style={{ alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ color: MUTED, fontSize: 13 }}>Decide later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
