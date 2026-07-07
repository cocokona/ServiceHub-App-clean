import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../navigation/AppNavigator';
import { signUp, signIn, resendConfirmation, refreshSession } from '../services/auth.service';
import { fetchServiceCategories, ServiceCategory } from '../services/database.service';

type AuthPhase = 'form' | 'confirming-email';

// Delight Experience palette
const PINK = '#FF4F8B';
const PINK_SOFT = '#FFE2EC';
const PINK_TINT = '#FFF1F6';
const PINK_DEEP = '#E03572';
const INK = '#0F172A';
const MUTED = '#64748B';

export default function AuthScreen({ navigation }: any) {
  const { setUser } = useContext(AppContext);
  const [phase, setPhase] = useState<AuthPhase>('form');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'customer' | 'technician'>('customer');
  const [workCategory, setWorkCategory] = useState<string>('all');
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    fetchServiceCategories().then(setServiceCategories);
  }, []);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async () => {
    setErrorMsg(null);

    if (!email || !password || (!isLogin && !name)) {
      setErrorMsg('Please fill in all required fields');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { user, error } = await signIn(email, password);

        if (error || !user) {
          // Handle email not confirmed error gracefully
          if (error?.toLowerCase().includes('email not confirmed')) {
            setErrorMsg('Please confirm your email before signing in. Check your inbox.');
            setPhase('confirming-email');
            setLoading(false);
            return;
          }
          setErrorMsg(error || 'Login failed');
          setLoading(false);
          return;
        }

        setUser(user);
      } else {
        const { user, error } = await signUp({
          email,
          password,
          name,
          role,
          workCategory,
        });

        if (error) {
          // Rate limit — give a helpful message
          if (error.toLowerCase().includes('rate limit')) {
            setErrorMsg(
              'Email sending is temporarily rate-limited. Please wait a minute and try again, or check your inbox — you may already have a confirmation email waiting.'
            );
            setPhase('confirming-email');
            setLoading(false);
            return;
          }
          if (
            error.toLowerCase().includes('already') ||
            error.toLowerCase().includes('registered') ||
            error.toLowerCase().includes('exists')
          ) {
            setErrorMsg('An account with this email already exists. Try signing in instead.');
            setLoading(false);
            return;
          }
          setErrorMsg(error);
          setLoading(false);
          return;
        }

        // Registration succeeded — switch to email confirmation view
        setPhase('confirming-email');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection failed. Please check your network.');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setErrorMsg(null);
    const { error } = await resendConfirmation(email);
    setResendLoading(false);

    if (error) {
      if (error.toLowerCase().includes('rate limit')) {
        setErrorMsg('Rate limited. Please wait about 60 seconds before requesting another email.');
        setResendCooldown(60);
      } else {
        setErrorMsg(error);
      }
    } else {
      setErrorMsg(null);
      Alert.alert('Email Sent', 'Confirmation email has been resent. Please check your inbox (and spam folder).');
      setResendCooldown(60);
    }
  };

  const handleTrySignIn = async () => {
    // Attempt to refresh session — user may have already confirmed via email link
    setLoading(true);
    const { user, error } = await refreshSession();
    if (user) {
      setUser(user);
    } else {
      // Not confirmed yet — try normal sign in to get a proper error
      const result = await signIn(email, password);
      if (result.user) {
        setUser(result.user);
      } else {
        setErrorMsg(result.error || 'Unable to sign in. Please confirm your email first.');
        setLoading(false);
      }
    }
  };

  // ─── Email Confirmation Pending View ───
  if (phase === 'confirming-email') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
            keyboardShouldPersistTaps="handled"
          >
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: PINK,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 20,
                shadowColor: PINK,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 6,
              }}
            >
              <Ionicons name="mail" size={32} color="#fff" />
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: INK, letterSpacing: -0.5 }}>
              Almost there! 💌
            </Text>
            <Text style={{ fontSize: 13, color: MUTED, fontWeight: '500', marginTop: 8, textAlign: 'center' }}>
              We sent a confirmation link to{'\n'}
              <Text style={{ fontWeight: '700', color: PINK }}>{email}</Text>
            </Text>
          </View>

          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: '#F1F5F9',
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 2,
            }}
          >
            {errorMsg && (
              <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#DC2626', flex: 1 }}>{errorMsg}</Text>
              </View>
            )}

            <Text style={{ fontSize: 13, color: MUTED, fontWeight: '500', lineHeight: 20, marginBottom: 20 }}>
              Tap the link in your email to activate your account. Don't see it? Peek inside your spam folder 📬
            </Text>

            {/* Resend button */}
            <TouchableOpacity
              onPress={handleResend}
              disabled={resendLoading || resendCooldown > 0}
              style={{
                backgroundColor: resendCooldown > 0 ? '#E2E8F0' : PINK,
                paddingVertical: 16,
                borderRadius: 999,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 6,
                marginBottom: 12,
                shadowColor: resendCooldown > 0 ? 'transparent' : PINK,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: resendCooldown > 0 ? 0 : 3,
              }}
            >
              {resendLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend the magic link'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Try sign in button */}
            <TouchableOpacity
              onPress={handleTrySignIn}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#E2E8F0' : PINK_TINT,
                paddingVertical: 16,
                borderRadius: 999,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 6,
                marginBottom: 12,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color={PINK} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color={PINK} />
                  <Text style={{ color: PINK, fontSize: 13, fontWeight: '700' }}>
                    I'm in — Take me home
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Back to login */}
            <TouchableOpacity
              onPress={() => { setPhase('form'); setIsLogin(true); setErrorMsg(null); }}
              style={{ alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ fontSize: 13, color: MUTED, fontWeight: '600' }}>
                ← Back to sign in
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
  }

  // ─── Welcome Magic — Login / Register Form ───
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Pastel Hero */}
          <View
            style={{
              marginHorizontal: -24,
              paddingTop: 36,
              paddingBottom: 44,
              paddingHorizontal: 24,
              alignItems: 'center',
              backgroundColor: '#FFE2EC',
              // Soft pastel gradient feel via overlay views
              position: 'relative',
              overflow: 'hidden',
              marginBottom: 28,
            }}
          >
            {/* Decorative pastel bubbles */}
            <View
              style={{
                position: 'absolute',
                top: -50,
                right: -40,
                width: 180,
                height: 180,
                borderRadius: 90,
                backgroundColor: '#FCD7E7',
                opacity: 0.7,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: -60,
                left: -50,
                width: 200,
                height: 200,
                borderRadius: 100,
                backgroundColor: '#E0EAFE',
                opacity: 0.6,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: 40,
                left: 30,
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#FEF3C7',
                opacity: 0.6,
              }}
            />

            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                backgroundColor: PINK,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
                shadowColor: PINK,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 6,
              }}
            >
              <Ionicons name="sparkles" size={26} color="#fff" />
            </View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.5 }}>
              ServiceHub Pro
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: MUTED,
                fontWeight: '600',
                marginTop: 6,
                textAlign: 'center',
                lineHeight: 18,
              }}
            >
              Home services, but make it delightful ✨
            </Text>
          </View>

          {/* Welcome copy */}
          <View style={{ marginBottom: 20, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: INK, letterSpacing: -0.4 }}>
              {isLogin ? 'Welcome back, friend!' : "Hey there! Let's get started"}
            </Text>
            <Text style={{ fontSize: 13, color: MUTED, fontWeight: '500', marginTop: 6, lineHeight: 19 }}>
              {isLogin
                ? "Your spotless home is waiting. Let's make it happen."
                : "Create an account in seconds. No fuss, no clutter."}
            </Text>
          </View>

          {/* Card */}
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: '#F1F5F9',
              padding: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.04,
              shadowRadius: 12,
              elevation: 1,
            }}
          >
            {/* Toggle */}
            <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 999, padding: 4, marginBottom: 20 }}>
              <TouchableOpacity
                onPress={() => { setIsLogin(true); setErrorMsg(null); }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: isLogin ? PINK : 'transparent',
                  alignItems: 'center',
                  shadowColor: isLogin ? PINK : 'transparent',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isLogin ? 0.25 : 0,
                  shadowRadius: 8,
                  elevation: isLogin ? 2 : 0,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: isLogin ? '#fff' : MUTED }}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setIsLogin(false); setErrorMsg(null); }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: !isLogin ? PINK : 'transparent',
                  alignItems: 'center',
                  shadowColor: !isLogin ? PINK : 'transparent',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: !isLogin ? 0.25 : 0,
                  shadowRadius: 8,
                  elevation: !isLogin ? 2 : 0,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: !isLogin ? '#fff' : MUTED }}>
                  Register
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error */}
            {errorMsg && (
              <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#DC2626', flex: 1 }}>{errorMsg}</Text>
              </View>
            )}

            {/* Name (Register) */}
            {!isLogin && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                  Full Name
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, backgroundColor: PINK_TINT, paddingHorizontal: 14 }}>
                  <Ionicons name="person-outline" size={16} color={PINK} />
                  <TextInput
                    placeholder="e.g. Alex Mercer"
                    value={name}
                    onChangeText={setName}
                    style={{ flex: 1, paddingVertical: 13, paddingLeft: 10, fontSize: 13, fontWeight: '600', color: INK }}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>
            )}

            {/* Email */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                Email
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, backgroundColor: PINK_TINT, paddingHorizontal: 14 }}>
                <Ionicons name="mail-outline" size={16} color={PINK} />
                <TextInput
                  placeholder="you@domain.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{ flex: 1, paddingVertical: 13, paddingLeft: 10, fontSize: 13, fontWeight: '600', color: INK }}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Password */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                Password
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, backgroundColor: PINK_TINT, paddingHorizontal: 14 }}>
                <Ionicons name="lock-closed-outline" size={16} color={PINK} />
                <TextInput
                  placeholder="At least 6 characters"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  style={{ flex: 1, paddingVertical: 13, paddingLeft: 10, fontSize: 13, fontWeight: '600', color: INK }}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Role selector (Register) */}
            {!isLogin && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                  I'm a...
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {(['customer', 'technician'] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setRole(r)}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: role === r ? PINK : '#E5E7EB',
                        backgroundColor: role === r ? PINK_SOFT : '#fff',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Ionicons name={r === 'customer' ? 'home' : 'construct'} size={18} color={role === r ? PINK : MUTED} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: role === r ? PINK : MUTED }}>
                        {r === 'customer' ? 'Customer' : 'Technician'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Work Category (Technician) */}
            {!isLogin && role === 'technician' && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                  Specialty
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setWorkCategory('all')}
                    style={{
                      paddingVertical: 9,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      borderWidth: 1.5,
                      borderColor: workCategory === 'all' ? PINK : '#E5E7EB',
                      backgroundColor: workCategory === 'all' ? PINK_SOFT : '#fff',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons name="apps" size={14} color={workCategory === 'all' ? PINK : MUTED} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: workCategory === 'all' ? PINK : MUTED }}>
                      All
                    </Text>
                  </TouchableOpacity>
                  {serviceCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => setWorkCategory(cat.key)}
                      style={{
                        paddingVertical: 9,
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        borderWidth: 1.5,
                        borderColor: workCategory === cat.key ? PINK : '#E5E7EB',
                        backgroundColor: workCategory === cat.key ? PINK_SOFT : '#fff',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Ionicons name={cat.icon} size={14} color={workCategory === cat.key ? PINK : MUTED} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: workCategory === cat.key ? PINK : MUTED }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ fontSize: 10, color: MUTED, fontWeight: '600', marginTop: 6 }}>
                  Filters which jobs show up on your dashboard.
                </Text>
              </View>
            )}

            {/* Submit — Let's Go pill button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
              style={{
                backgroundColor: loading ? PINK_SOFT : PINK,
                paddingVertical: 16,
                borderRadius: 999,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                marginTop: 8,
                shadowColor: loading ? 'transparent' : PINK,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: loading ? 0 : 0.3,
                shadowRadius: 16,
                elevation: loading ? 0 : 4,
              }}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color={PINK} />
                  <Text style={{ color: PINK, fontSize: 13, fontWeight: '800' }}>
                    Signing you in...
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                    {isLogin ? "Let's Go" : "Create my account"}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* New here? Create account */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 22, gap: 6 }}>
            <Text style={{ fontSize: 13, color: MUTED, fontWeight: '500' }}>
              {isLogin ? 'New here?' : 'Already with us?'}
            </Text>
            <TouchableOpacity onPress={() => { setIsLogin(!isLogin); setErrorMsg(null); }}>
              <Text style={{ fontSize: 13, color: PINK, fontWeight: '700' }}>
                {isLogin ? 'Create account' : 'Sign in'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Trust seal */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18, gap: 6 }}>
            <Ionicons name="shield-checkmark" size={12} color={PINK} />
            <Text style={{ fontSize: 10, color: MUTED, fontWeight: '600', letterSpacing: 0.3 }}>
              Secured with love · Your data is safe with us
            </Text>
          </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);
}
