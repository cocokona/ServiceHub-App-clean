import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Review } from '../types';
import { PINK, PINK_SOFT, MUTED, INK, SUCCESS } from '../theme/colors';

interface RatingModalProps {
  visible: boolean;
  technicianName?: string;
  existingReview?: Review | null;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (rating: number, comment: string) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet style rating modal. Pops over the tracking screen so the
 * rating step is impossible to miss. Shows read-only content when an
 * existing review is passed in.
 */
export default function RatingModal({
  visible,
  technicianName,
  existingReview,
  submitting = false,
  error = null,
  onSubmit,
  onClose,
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // Reset the form each time the modal opens (keep existing review for read-only view).
  useEffect(() => {
    if (visible) {
      setRating(existingReview?.rating ?? 0);
      setComment(existingReview?.comment ?? '');
    }
  }, [visible, existingReview]);

  const isReadOnly = !!existingReview;
  const shown = existingReview?.rating ?? rating;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Dimmed backdrop — tap to dismiss (except when read-only) */}
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' }}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close rating"
        />
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 22,
            paddingBottom: 32,
          }}
        >
          {/* Grabber */}
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#E2E8F0',
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />

          <Text style={{ fontSize: 18, fontWeight: '800', color: INK, marginBottom: 4 }}>
            {isReadOnly ? 'Your rating' : 'Rate your experience'}
          </Text>
          <Text style={{ fontSize: 13, color: MUTED, marginBottom: 18 }}>
            {isReadOnly
              ? 'Thanks for helping others choose the right technician.'
              : `How was your service with ${technicianName || 'your technician'}?`}
          </Text>

          {/* 1–5 star selector */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 18 }}>
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= shown;
              return (
                <TouchableOpacity
                  key={star}
                  onPress={() => !isReadOnly && setRating(star)}
                  disabled={isReadOnly}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
                >
                  <Ionicons
                    name={filled ? 'star' : 'star-outline'}
                    size={36}
                    color={filled ? '#F59E0B' : '#CBD5E1'}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Optional text review (hidden in read-only mode) */}
          {!isReadOnly && (
            <TextInput
              value={comment}
              onChangeText={setComment}
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
                marginBottom: 14,
                minHeight: 72,
              }}
            />
          )}

          {error && <Text style={{ fontSize: 12, color: '#EF4444', marginBottom: 10 }}>{error}</Text>}

          {isReadOnly ? (
            <TouchableOpacity
              onPress={onClose}
              style={{ backgroundColor: PINK, paddingVertical: 13, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Close</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => onSubmit(rating, comment)}
              disabled={submitting || rating < 1}
              style={{
                backgroundColor: submitting || rating < 1 ? PINK_SOFT : PINK,
                paddingVertical: 13,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                {submitting ? 'Submitting…' : 'Submit Review'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
