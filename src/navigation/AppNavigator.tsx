import React, { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
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
import TechnicianDashboard from '../screens/technician/TechnicianDashboard';
import JobDetails from '../screens/technician/JobDetails';
import ActiveService from '../screens/technician/ActiveService';
import ServiceCompletion from '../screens/technician/ServiceCompletion';
import { User, Job } from '../types';
import { INITIAL_JOBS } from '../data/constants';
import { apiGet, apiPost, apiPut } from '../api/client';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

export const AppContext = createContext<{
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  refreshJobs: () => Promise<void>;
  updateJobStatus: (jobId: string, updates: Partial<Job>) => void;
  logout: () => void;
}>({
  user: null,
  setUser: () => {},
  jobs: [],
  setJobs: () => {},
  refreshJobs: async () => {},
  updateJobStatus: () => {},
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
        tabBarActiveTintColor: '#003d9b',
        tabBarInactiveTintColor: 'gray',
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
          else if (route.name === 'Schedule') iconName = focused ? 'calendar' : 'calendar-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#003d9b',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Jobs" component={TechnicianDashboard} />
      <Tab.Screen name="Schedule" component={TechnicianDashboard} initialParams={{ tab: 'schedule' }} />
      <Tab.Screen name="Profile" component={TechnicianDashboard} initialParams={{ tab: 'profile' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('sh_user').then((val) => {
      if (val) {
        try { setUser(JSON.parse(val)); } catch {}
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user) AsyncStorage.setItem('sh_user', JSON.stringify(user));
    else AsyncStorage.removeItem('sh_user');
  }, [user]);

  const refreshJobs = useCallback(async () => {
    try {
      const data = await apiGet('/api/jobs');
      if (Array.isArray(data)) setJobs(data);
    } catch {}
  }, []);

  const updateJobStatus = useCallback((jobId: string, updates: Partial<Job>) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, ...updates } : j))
    );
    apiPut(`/api/jobs/${jobId}`, updates).catch(() => {});
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    AsyncStorage.removeItem('sh_user');
  }, []);

  const contextValue = useMemo(() => ({
    user,
    setUser,
    jobs,
    setJobs,
    refreshJobs,
    updateJobStatus,
    logout,
  }), [user, setUser, jobs, setJobs, refreshJobs, updateJobStatus, logout]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#003d9b" />
        <Text style={{ marginTop: 12, color: '#666', fontWeight: '600' }}>Loading...</Text>
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
            </>
          ) : (
            <>
              <Stack.Screen name="TechnicianTabs" component={TechnicianTabs} />
              <Stack.Screen name="JobDetails" component={JobDetails} />
              <Stack.Screen name="ActiveService" component={ActiveService} />
              <Stack.Screen name="ServiceCompletion" component={ServiceCompletion} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AppContext.Provider>
  );
}
