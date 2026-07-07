import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Job } from '../../types';
import { trackingSteps, getStatusInfo, getStatusIndex, getEta, defaultTechnicianRating, defaultReviewsCount } from '../../data';
import { PINK, PINK_SOFT, PINK_TINT, INK, MUTED, SUCCESS, MAP_BG, ACCENT, BORDER_LIGHT } from '../../theme/colors';

export default function Tracking({ route, navigation }: any) {
  const { job } = route.params || {};
  if (!job) return null;

  const getStatusIndexFn = () => getStatusIndex(job.status);

  const statusIndex = getStatusIndexFn();

  const statusInfo = getStatusInfo(job.status);

  const eta = getEta(job.status);

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

          {/* ETA card (bottom-right) */}
          {eta && (
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
              <Text style={{ fontSize: 18, fontWeight: '800', color: INK, marginTop: 2 }}>{eta}</Text>
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
              <Text style={{ fontSize: 11, color: MUTED, fontWeight: '600' }}>{defaultTechnicianRating} · {defaultReviewsCount} reviews</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: PINK_TINT,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="call" size={16} color={PINK} />
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
          </View>
        </View>

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
