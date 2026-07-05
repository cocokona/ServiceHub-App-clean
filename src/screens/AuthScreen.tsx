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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
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
                width: 72,
                height: 72,
                borderRadius: 20,
                backgroundColor: '#003d9b',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Ionicons name="mail" size={36} color="#fff" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#003d9b', letterSpacing: -0.5 }}>
              Check Your Email
            </Text>
            <Text style={{ fontSize: 13, color: '#666', fontWeight: '500', marginTop: 8, textAlign: 'center' }}>
              We sent a confirmation link to{'\n'}
              <Text style={{ fontWeight: '700', color: '#003d9b' }}>{email}</Text>
            </Text>
          </View>

          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#e0e2ec',
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            {errorMsg && (
              <View style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#dc2626', flex: 1 }}>{errorMsg}</Text>
              </View>
            )}

            <Text style={{ fontSize: 13, color: '#666', fontWeight: '500', lineHeight: 20, marginBottom: 20 }}>
              Click the confirmation link in your email to activate your account. If you don't see it, check your spam folder.
            </Text>

            {/* Resend button */}
            <TouchableOpacity
              onPress={handleResend}
              disabled={resendLoading || resendCooldown > 0}
              style={{
                backgroundColor: resendCooldown > 0 ? '#e2e8f0' : '#003d9b',
                paddingVertical: 14,
                borderRadius: 12,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 6,
                marginBottom: 12,
              }}
            >
              {resendLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Confirmation Email'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Try sign in button */}
            <TouchableOpacity
              onPress={handleTrySignIn}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#e2e8f0' : 'transparent',
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#003d9b',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 6,
                marginBottom: 12,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#003d9b" />
              ) : (
                <>
                  <Ionicons name="log-in" size={16} color="#003d9b" />
                  <Text style={{ color: '#003d9b', fontSize: 13, fontWeight: '700' }}>
                    I've Confirmed — Sign Me In
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Back to login */}
            <TouchableOpacity
              onPress={() => { setPhase('form'); setIsLogin(true); setErrorMsg(null); }}
              style={{ alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ fontSize: 13, color: '#666', fontWeight: '600' }}>
                ← Back to Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
  }

  // ─── Normal Login / Register Form ───
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: '#003d9b',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Ionicons name="construct" size={28} color="#fff" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#003d9b', letterSpacing: -0.5 }}>
            ServiceHub Pro
          </Text>
          <Text style={{ fontSize: 12, color: '#666', fontWeight: '600', marginTop: 4 }}>
            {isLogin ? 'Welcome back! Secure access port.' : 'Create your secure account.'}
          </Text>
        </View>

        {/* Card */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#e0e2ec',
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          {/* Toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => { setIsLogin(true); setErrorMsg(null); }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: isLogin ? '#fff' : 'transparent',
                shadowColor: isLogin ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isLogin ? 0.05 : 0,
                shadowRadius: 2,
                elevation: isLogin ? 1 : 0,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: isLogin ? '#003d9b' : '#666' }}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setIsLogin(false); setErrorMsg(null); }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: !isLogin ? '#fff' : 'transparent',
                shadowColor: !isLogin ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: !isLogin ? 0.05 : 0,
                shadowRadius: 2,
                elevation: !isLogin ? 1 : 0,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: !isLogin ? '#003d9b' : '#666' }}>
                Register
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error */}
          {errorMsg && (
            <View style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#dc2626', flex: 1 }}>{errorMsg}</Text>
            </View>
          )}

          {/* Name (Register) */}
          {!isLogin && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Full Name
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e2ec', borderRadius: 12, backgroundColor: '#f8fafc', paddingHorizontal: 12 }}>
                <Ionicons name="person-outline" size={16} color="#999" />
                <TextInput
                  placeholder="e.g. Alex Mercer"
                  value={name}
                  onChangeText={setName}
                  style={{ flex: 1, paddingVertical: 12, paddingLeft: 10, fontSize: 13, fontWeight: '600' }}
                  placeholderTextColor="#aaa"
                />
              </View>
            </View>
          )}

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Email Address
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e2ec', borderRadius: 12, backgroundColor: '#f8fafc', paddingHorizontal: 12 }}>
              <Ionicons name="mail-outline" size={16} color="#999" />
              <TextInput
                placeholder="you@domain.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ flex: 1, paddingVertical: 12, paddingLeft: 10, fontSize: 13, fontWeight: '600' }}
                placeholderTextColor="#aaa"
              />
            </View>
          </View>

          {/* Password */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Password
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e2ec', borderRadius: 12, backgroundColor: '#f8fafc', paddingHorizontal: 12 }}>
              <Ionicons name="lock-closed-outline" size={16} color="#999" />
              <TextInput
                placeholder="At least 6 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={{ flex: 1, paddingVertical: 12, paddingLeft: 10, fontSize: 13, fontWeight: '600' }}
                placeholderTextColor="#aaa"
              />
            </View>
          </View>

          {/* Role selector (Register) */}
          {!isLogin && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Account Role
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(['customer', 'technician'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRole(r)}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: role === r ? '#003d9b' : '#e0e2ec',
                      backgroundColor: role === r ? 'rgba(0,61,155,0.05)' : '#fff',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons name={r === 'customer' ? 'home' : 'construct'} size={18} color={role === r ? '#003d9b' : '#666'} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: role === r ? '#003d9b' : '#666' }}>
                      {r === 'customer' ? 'Customer' : 'Technician'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Work Category (Technician) */}
          {!isLogin && role === 'technician' && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Specialty Work Category
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setWorkCategory('all')}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: workCategory === 'all' ? '#003d9b' : '#e0e2ec',
                    backgroundColor: workCategory === 'all' ? 'rgba(0,61,155,0.05)' : '#fff',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons name="apps" size={14} color={workCategory === 'all' ? '#003d9b' : '#666'} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: workCategory === 'all' ? '#003d9b' : '#666' }}>
                    All
                  </Text>
                </TouchableOpacity>
                {serviceCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => setWorkCategory(cat.key)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: workCategory === cat.key ? '#003d9b' : '#e0e2ec',
                      backgroundColor: workCategory === cat.key ? 'rgba(0,61,155,0.05)' : '#fff',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons name={cat.icon} size={14} color={workCategory === cat.key ? '#003d9b' : '#666'} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: workCategory === cat.key ? '#003d9b' : '#666' }}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ fontSize: 10, color: '#999', fontWeight: '600', marginTop: 6 }}>
                This will filter dispatch job listings to your specialty.
              </Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#d8e2ff' : '#003d9b',
              paddingVertical: 14,
              borderRadius: 12,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              marginTop: 8,
            }}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Synchronizing...
                </Text>
              </>
            ) : (
              <>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {isLogin ? 'Sign In Securely' : 'Construct Account'}
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Trust seal */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24, gap: 6 }}>
          <Ionicons name="shield-checkmark" size={12} color="#006c47" />
          <Text style={{ fontSize: 10, color: '#999', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Supabase Auth . JWT . bcrypt . RLS Protected
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);
}
