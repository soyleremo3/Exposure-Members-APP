// App entry point.
//
// There is no public landing screen in this project — the app IS the member
// area. So the root is a plain swap: a session means tabs, no session means
// the login screen.
//
//   supabase.auth.getSession()  → restores a saved session on cold start
//   onAuthStateChange           → keeps `session` in sync afterwards
//
// That single piece of state drives everything. Signing out (the button in
// Profile, or a 401 caught in lib/api.ts) fires SIGNED_OUT, `session` goes
// null, and the login screen comes back on its own — no navigation.reset(),
// no navigationRef, nothing to keep in sync by hand.
//
// While the saved session is being read we render an empty cream screen for
// a frame or two rather than a full splash, so a logged-in member doesn't
// see the login form flash before their tabs appear.
import './global.css';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './lib/supabase';
import { BRAND_BLUE, BRAND_CREAM } from './lib/theme';
import type { RootStackParamList, TabParamList } from './navigation';

import LoginScreen from './screens/LoginScreen';
import DirectoryScreen from './screens/DirectoryScreen';
import MemberDetailScreen from './screens/MemberDetailScreen';
import DiscoverScreen from './screens/DiscoverScreen';
import MatchScreen from './screens/MatchScreen';
import ProfileScreen from './screens/ProfileScreen';
import JobBoardScreen from './screens/jobs/JobBoardScreen';
import JobDetailScreen from './screens/jobs/JobDetailScreen';
import JobComposeScreen from './screens/jobs/JobComposeScreen';
import JobApplicantsScreen from './screens/jobs/JobApplicantsScreen';
import JobReferScreen from './screens/jobs/JobReferScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Which Ionicon goes with which tab. Kept as one map so the tabBarIcon
// callback below stays a one-liner.
const TAB_ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Directory: 'people',
  Jobs: 'briefcase',
  Match: 'sparkles',
  Discover: 'compass',
  Profile: 'person-circle',
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: BRAND_CREAM },
        headerTitleStyle: { color: BRAND_BLUE },
        headerShadowVisible: false,
        tabBarActiveTintColor: BRAND_BLUE,
        tabBarInactiveTintColor: '#a1a1aa',
        tabBarStyle: { backgroundColor: BRAND_CREAM, borderTopColor: '#00000010' },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      {/* Directory draws its own "Member Directory" heading, the way the
          website does, so the navigator header would just repeat it. Other
          tabs still use the navigator header until they get the same
          treatment. */}
      <Tab.Screen
        name="Directory"
        component={DirectoryScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="Jobs" component={JobBoardScreen} options={{ title: 'Job Board' }} />
      {/* Match draws its own "1-on-1 Match" heading, like the website, so the
          navigator header is off — but the tab keeps the "Weekly Match" label
          (KARAR 2) that the header title used to provide. */}
      <Tab.Screen
        name="Match"
        component={MatchScreen}
        options={{ headerShown: false, tabBarLabel: 'Weekly Match' }}
      />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  // True until we've read whatever session is stored on the device.
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    // Cold start: read the persisted session (AsyncStorage) once.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });

    // Everything after that — login, logout, token refresh — comes through
    // here. SIGNED_OUT delivers a null session, which swaps in Login.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (booting) {
    return <View className="flex-1 bg-brand-cream" />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        {session ? (
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: BRAND_CREAM },
              headerTintColor: BRAND_BLUE,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: BRAND_CREAM },
            }}
          >
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="MemberDetail"
              component={MemberDetailScreen}
              options={{ title: '' }}
            />
            <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: '' }} />
            <Stack.Screen
              name="JobCompose"
              component={JobComposeScreen}
              options={{ title: 'New post' }}
            />
            <Stack.Screen
              name="JobApplicants"
              component={JobApplicantsScreen}
              options={{ title: 'Applicants' }}
            />
            <Stack.Screen
              name="JobRefer"
              component={JobReferScreen}
              options={{ title: 'Refer a member' }}
            />
          </Stack.Navigator>
        ) : (
          <LoginScreen />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
