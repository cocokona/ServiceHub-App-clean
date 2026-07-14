import React, { useState, useEffect, useRef, createContext, useContext, useCallback, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AuthScreen from '../screens/AuthScreen';
import SelectRole from '../screens/SelectRole';
import CustomerHome from '../screens/customer/CustomerHome';
import ServiceDetails from '../screens/customer/ServiceDetails';
import ScheduleDetails from '../screens/customer/ScheduleDetails';
import Checkout from '../screens/customer/Checkout';
import Tracking from '../screens/customer/Tracking';
import SupportChat from '../screens/customer/SupportChat';
import TechnicianReviews from '../screens/customer/TechnicianReviews';
import TechnicianDashboard from '../screens/technician/TechnicianDashboard';
import JobDetails from '../screens/technician/JobDetails';
import ActiveService from '../screens/technician/ActiveService';
import ServiceCompletion from '../screens/technician/ServiceCompletion';
import { User, Job } from '../types';
import { initialJobs, storageKeys } from '../data';
import { PINK, PLACEHOLDER } from '../theme/colors';
import { fetchJobsByCustomer, fetchJobsByTechnician, fetchOrdersInProgress, updateJobStatus as persistJobStatus, ensureProfile } from '../services/database.service';
import { logger } from '../services/logger';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

export const AppContext = createContext<{
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  refreshJobs: () => Promise<void>;
  updateJobStatus: (jobId: string, updates: Partial<Job>) => void;
  /**
   * Service timer bookkeeping. A start timestamp is kept per job id so the
   * Active Service elapsed counter keeps counting in real time even when the
   * technician navigates away and back — the component only re-derives
   * `now - startedAt` instead of relying on a per-mount accumulator that dies
   * on unmount. The timestamp lives in a ref (not React state) on purpose: it
   * must have a stable identity so the ticking interval always reads the
   * latest value without resubscribing.
   */
  startServiceTimer: (jobId: string) => void;
  getServiceElapsed: (jobId: string) => number;
  clearServiceTimer: (jobId: string) => void;
  /**
   * Checklist completion state per job. Kept in a ref (not React state) so a
   * technician's ticked items survive navigating back from Active Service and
   * returning later. Local component state alone is discarded the moment the
   * screen unmounts — exactly the navigate-away-and-back cycle that was
   * dropping the checkmarks. Mirrors the service-timer timestamp pattern:
   * a stable ref identity that outlives any single screen mount.
   */
  getServiceChecklist: (jobId: string) => { text: string; completed: boolean }[] | undefined;
  setServiceChecklist: (jobId: string, items: { text: string; completed: boolean }[]) => void;
  logout: () => void;
}>({
  user: null,
  setUser: () => {},
  jobs: [],
  setJobs: () => {},
  refreshJobs: async () => {},
  updateJobStatus: () => {},
  startServiceTimer: () => {},
  getServiceElapsed: () => 0,
  clearServiceTimer: () => {},
  getServiceChecklist: () => undefined,
  setServiceChecklist: () => {},
  logout: () => {},
});

function CustomerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Orders') iconName = focused ? 'receipt' : 'receipt-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: PINK,
        tabBarInactiveTintColor: PLACEHOLDER,
      })}
    >
      <Tab.Screen name="Home" component={CustomerHome} />
      <Tab.Screen name="Orders" component={CustomerHome} initialParams={{ tab: 'orders' }} />
      <Tab.Screen name="Profile" component={CustomerHome} initialParams={{ tab: 'profile' }} />
    </Tab.Navigator>
  );
}

function TechnicianTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'briefcase';
          if (route.name === 'Jobs') iconName = focused ? 'briefcase' : 'briefcase-outline';
          else if (route.name === 'Pending') iconName = focused ? 'time' : 'time-outline';
          else if (route.name === 'Schedule') iconName = focused ? 'calendar' : 'calendar-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: PINK,
        tabBarInactiveTintColor: PLACEHOLDER,
      })}
    >
      <Tab.Screen name="Jobs" component={TechnicianDashboard} />
      <Tab.Screen name="Pending" component={TechnicianDashboard} initialParams={{ tab: 'pending' }} />
      <Tab.Screen name="Schedule" component={TechnicianDashboard} initialParams={{ tab: 'schedule' }} />
      <Tab.Screen name="Profile" component={TechnicianDashboard} initialParams={{ tab: 'profile' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [loading, setLoading] = useState(true);

  // Absolute start timestamps (epoch ms) keyed by job id, driving the
  // Active Service elapsed counter. Kept in a ref so the value survives
  // navigation/remounts and the ticking interval can read it without
  // resubscribing.
  const serviceStartTimesRef = useRef<Record<string, number>>({});

  // Checklist completion state per job, persisted across navigation. A ref (not
  // React state) so the identity is stable and the value survives the
  // unmount/remount cycle when a technician leaves Active Service and comes
  // back — without forcing a re-render of every context consumer.
  const serviceChecklistsRef = useRef<Record<string, { text: string; completed: boolean }[]>>({});

  useEffect(() => {
    AsyncStorage.getItem(storageKeys.user).then((val) => {
      if (val) {
        try { setUser(JSON.parse(val)); } catch {}
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user) AsyncStorage.setItem(storageKeys.user, JSON.stringify(user));
    else AsyncStorage.removeItem(storageKeys.user);
  }, [user]);

  const refreshJobs = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch confirmed/active jobs from jobs table
      const dbJobs = user.role === 'technician'
        ? await fetchJobsByTechnician(user.id)
        : await fetchJobsByCustomer(user.id);

      // Fetch pending orders from order_in_progress table
      const pendingOrders = await fetchOrdersInProgress(user.id);

      // Combine: pending orders first, then active jobs
      setJobs([...pendingOrders, ...dbJobs]);
    } catch (err) {
      // Supabase unavailable: keep the current jobs list and record the
      // failure. The previous implementation silently fell back to a
      // non-existent REST endpoint — that dead path is removed, and the
      // observable UI behavior (jobs list unchanged) is preserved.
      logger.warn('[AppNavigator] refreshJobs failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [user]);

  // When a user session is established, guarantee their profile row exists.
  // Accounts missing a profiles record (created before the signup trigger)
  // would otherwise fail every FK-dependent write. This runs once per session
  // and is idempotent, so it is safe on every user change.
  useEffect(() => {
    if (!user) return;
    ensureProfile().finally(() => refreshJobs());
  }, [user, refreshJobs]);

  const updateJobStatus = useCallback((jobId: string, updates: Partial<Job>) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, ...updates } : j))
    );
    // Persist to Supabase (replaces the old dead REST call). Fire-and-forget
    // to match the previous non-blocking behavior; local state is already
    // optimistic, so a delayed failure does not roll back the UI here.
    persistJobStatus(jobId, updates).catch(() => {});
  }, []);

  // --- Service elapsed-time tracking ---------------------------------------
  // Start (idempotent): only record the timestamp the first time a job is
  // started so re-entering Active Service never resets the running clock.
  const startServiceTimer = useCallback((jobId: string) => {
    if (jobId == null) return;
    if (serviceStartTimesRef.current[jobId] == null) {
      serviceStartTimesRef.current[jobId] = Date.now();
    }
  }, []);

  // Elapsed seconds since the job started, or 0 if it was never started.
  const getServiceElapsed = useCallback((jobId: string): number => {
    const start = jobId != null ? serviceStartTimesRef.current[jobId] : undefined;
    if (!start) return 0;
    return Math.floor((Date.now() - start) / 1000);
  }, []);

  // Clear the running timer (e.g. once a job is completed) so a later re-open
  // does not surface a stale, ever-growing counter.
  const clearServiceTimer = useCallback((jobId: string) => {
    if (jobId == null) return;
    delete serviceStartTimesRef.current[jobId];
  }, []);

  // Checklist store accessors — read the persisted progress for a job (or
  // undefined when we've never touched it) and write back the latest list.
  const getServiceChecklist = useCallback((jobId: string) => {
    return jobId != null ? serviceChecklistsRef.current[jobId] : undefined;
  }, []);

  const setServiceChecklist = useCallback(
    (jobId: string, items: { text: string; completed: boolean }[]) => {
      if (jobId == null) return;
      serviceChecklistsRef.current[jobId] = items;
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    AsyncStorage.removeItem(storageKeys.user);
  }, []);

  const contextValue = useMemo(() => ({
    user,
    setUser,
    jobs,
    setJobs,
    refreshJobs,
    updateJobStatus,
    startServiceTimer,
    getServiceElapsed,
    clearServiceTimer,
    getServiceChecklist,
    setServiceChecklist,
    logout,
  }), [user, setUser, jobs, setJobs, refreshJobs, updateJobStatus, startServiceTimer, getServiceElapsed, clearServiceTimer, getServiceChecklist, setServiceChecklist, logout]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFBFC' }}>
        <ActivityIndicator size="large" color={PINK} />
        <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '600' }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!user ? (
            <>
              <Stack.Screen name="Auth" component={AuthScreen} />
              <Stack.Screen name="SelectRole" component={SelectRole} />
            </>
          ) : user.role === 'customer' ? (
            <>
              <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
              <Stack.Screen name="ServiceDetails" component={ServiceDetails} />
              <Stack.Screen name="ScheduleDetails" component={ScheduleDetails} />
              <Stack.Screen name="Checkout" component={Checkout} />
              <Stack.Screen name="Tracking" component={Tracking} />
              <Stack.Screen name="SupportChat" component={SupportChat} />
              <Stack.Screen name="TechnicianReviews" component={TechnicianReviews} />
            </>
          ) : (
            <>
              <Stack.Screen name="TechnicianTabs" component={TechnicianTabs} />
              <Stack.Screen name="JobDetails" component={JobDetails} />
              <Stack.Screen name="ActiveService" component={ActiveService} />
              <Stack.Screen name="ServiceCompletion" component={ServiceCompletion} />
              <Stack.Screen name="SupportChat" component={SupportChat} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AppContext.Provider>
  );
}
