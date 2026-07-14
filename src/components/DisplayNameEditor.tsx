/**
 * DisplayNameEditor.tsx — Inline display-name editor.
 *
 * A self-contained profile control that lets a user change the name shown
 * across the whole app. It owns the full name-change lifecycle so the two
 * profile screens (customer + technician) stay consistent:
 *
 *   1. Live validation via `validateDisplayName` (the single source of truth
 *      shared with the service layer) — shows length/character errors inline
 *      as the user types, with a char counter.
 *   2. On Save, the DATABASE is updated first (`updateDisplayName` awaits the
 *      Supabase write). The local UI is only updated afterwards, so the
 *      server remains the source of truth.
 *   3. Cross-app sync: on success we hand the refreshed `User` to `onSaved`
 *      (the AppContext `setUser`), which instantly re-renders every screen
 *      that reads `user.name` and persists it to AsyncStorage.
 *   4. Feedback: friendly inline validation errors, an `Alert` for DB
 *      failures, and a green confirmation banner on success.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { User } from '../types';
import { updateDisplayName } from '../services/auth.service';
import { validateDisplayName, DISPLAY_NAME_MAX } from '../services/validation';

interface DisplayNameEditorProps {
  /** Current authenticated user (provides the initial name + id). */
  user: User | null;
  /** Called with the refreshed user after a successful DB update, so the
   *  caller can push it into app-wide state for instant cross-screen sync. */
  onSaved: (user: User) => void;
}

const CARD = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  padding: 20,
  borderWidth: 1,
  borderColor: '#F1F5F9',
  marginBottom: 16,
} as const;

export default function DisplayNameEditor({ user, onSaved }: DisplayNameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(user?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const trimmedLength = draft.trim().length;
  const valid = validateDisplayName(draft).isValid;

  const startEdit = () => {
    setDraft(user?.name ?? '');
    setError(null);
    setJustSaved(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(user?.name ?? '');
    setError(null);
  };

  const handleChange = (text: string) => {
    setDraft(text);
    // Live feedback: only surface an error once the field is non-empty,
    // so a freshly-opened editor (prefilled with the valid current name)
    // does not flash a warning.
    const result = validateDisplayName(text);
    setError(text.length === 0 || result.isValid ? null : result.error ?? null);
  };

  const handleSave = async () => {
    const result = validateDisplayName(draft);
    if (!result.isValid) {
      setError(result.error ?? 'Please enter a valid name.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Database is the source of truth — update it BEFORE touching the UI.
      const res = await updateDisplayName(draft);
      if (res.error || !res.user) {
        Alert.alert('Update failed', res.error ?? 'Could not update your name.');
        return;
      }
      // Reflect the change app-wide (context + AsyncStorage) and re-render
      // every screen that shows the user's name.
      onSaved(res.user);
      setJustSaved(true);
      setEditing(false);
    } catch (e: any) {
      Alert.alert(
        'Update failed',
        e?.message ?? 'Could not update your name. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <View style={CARD}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: '#64748B',
            marginBottom: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Display Name
        </Text>
        <TextInput
          value={draft}
          onChangeText={handleChange}
          placeholder="Your name"
          maxLength={DISPLAY_NAME_MAX}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={valid && !saving ? handleSave : undefined}
          style={{
            borderWidth: 1,
            borderColor: error ? '#FECACA' : '#F1F5F9',
            borderRadius: 12,
            padding: 12,
            fontSize: 14,
            color: '#0F172A',
          }}
        />
        {error ? (
          <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>
            {error}
          </Text>
        ) : (
          <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 6 }}>
            {trimmedLength} / {DISPLAY_NAME_MAX}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TouchableOpacity
            onPress={cancelEdit}
            disabled={saving}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#F1F5F9',
              alignItems: 'center',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!valid || saving}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              backgroundColor: '#FF4F8B',
              alignItems: 'center',
              opacity: !valid || saving ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={CARD}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Display Name
        </Text>
        <TouchableOpacity
          onPress={startEdit}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Ionicons name="create-outline" size={14} color="#FF4F8B" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#FF4F8B' }}>
            Edit
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="person-outline" size={16} color="#64748B" />
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#0F172A' }}>
          {user?.name || 'No name set'}
        </Text>
      </View>

      {justSaved && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 10,
            backgroundColor: '#F0FDF4',
            borderRadius: 10,
            paddingVertical: 8,
            paddingHorizontal: 10,
          }}
        >
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#10B981' }}>
            Display name updated
          </Text>
        </View>
      )}
    </View>
  );
}
