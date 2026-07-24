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
// Theme: the app defaults to dark. ThemeProvider's initial state is dark
// synchronously (see lib/theme.tsx), so the very first render is already
// correct — no flash, no imperative "paint dark then swap" dance needed.
import './global.css';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './lib/supabase';
import { DARK_VARS, LIGHT_VARS, ThemeProvider, useThemeColors } from './lib/theme';
import type { PreAuthStackParamList, RootStackParamList, TabParamList } from './navigation';

import LoginScreen from './screens/LoginScreen';
import ApplyScreen from './screens/ApplyScreen';
import DirectoryScreen from './screens/DirectoryScreen';
import MemberDetailScreen from './screens/MemberDetailScreen';
import DiscoverScreen from './screens/DiscoverScreen';
import MatchScreen from './screens/MatchScreen';
import ProfileScreen from './screens/ProfileScreen';
import JobBoardScreen from './screens/jobs/JobBoardScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const PreAuthStack = createNativeStackNavigator<PreAuthStackParamList>();

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
  const c = useThemeColors();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: c.bg },
        headerTitleStyle: { color: c.body },
        headerShadowVisible: false,
        tabBarActiveTintColor: c.accentLink,
        tabBarInactiveTintColor: c.faint,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.hairline },
        sceneContainerStyle: { backgroundColor: c.bg },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      {/* Most tabs draw their own heading (like the website), so their
          navigator header is off. Profile keeps the header. */}
      <Tab.Screen name="Directory" component={DirectoryScreen} options={{ headerShown: false }} />
      <Tab.Screen
        name="Jobs"
        component={JobBoardScreen}
        options={{ headerShown: false, tabBarLabel: 'Job Board' }}
      />
      <Tab.Screen
        name="Match"
        component={MatchScreen}
        options={{ headerShown: false, tabBarLabel: 'Weekly Match' }}
      />
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

// Split from App() so it can consume ThemeProvider's context — a component
// can't read a context it renders itself.
function AppShell() {
  const c = useThemeColors();
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

  // Give React Navigation matching colors so screen transitions don't flash a
  // default (white) background between our themed screens.
  const base = c.isDark ? DarkTheme : DefaultTheme;
  const navTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      background: c.bg,
      card: c.bg,
      text: c.body,
      border: c.hairline,
      primary: c.accentLink,
    },
  };

  // Root wrapper supplies the active theme's CSS variables to the whole tree,
  // so every `bg-background` / `text-body` / … resolves to the current theme
  // and re-resolves the instant it changes.
  const themeVars = c.isDark ? DARK_VARS : LIGHT_VARS;

  if (booting) {
    return <View className="flex-1 bg-background" style={[themeVars, { backgroundColor: c.bg }]} />;
  }

  return (
    <View className="flex-1" style={themeVars}>
      <SafeAreaProvider>
        <StatusBar style={c.isDark ? 'light' : 'dark'} />
        <NavigationContainer theme={navTheme}>
          {session ? (
            <Stack.Navigator
              screenOptions={{
                headerStyle: { backgroundColor: c.bg },
                headerTintColor: c.accentLink,
                headerTitleStyle: { color: c.body },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: c.bg },
              }}
            >
              <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
              <Stack.Screen
                name="MemberDetail"
                component={MemberDetailScreen}
                options={{ title: '' }}
              />
            </Stack.Navigator>
          ) : (
            <PreAuthStack.Navigator
              screenOptions={{
                headerStyle: { backgroundColor: c.bg },
                headerTintColor: c.accentLink,
                headerTitleStyle: { color: c.body },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: c.bg },
              }}
            >
              <PreAuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
              <PreAuthStack.Screen name="Apply" component={ApplyScreen} options={{ title: 'Apply to Join' }} />
            </PreAuthStack.Navigator>
          )}
        </NavigationContainer>
      </SafeAreaProvider>
    </View>
  );
}
