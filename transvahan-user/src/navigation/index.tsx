// transvahan-user/src/navigation/index.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/authContext";

import RoleSelect from "../screens/RoleSelect";
import SignupScreen from "../screens/SignupScreen";
import VerifyOtpScreen from "../screens/VerifyOTPScreen";
import LoginScreen from "../screens/LoginScreen";
import DriverLogin from "../screens/DriverLogin";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import RouteMapScreen from "../screens/RouteMapScreen";
import FeedbackScreen from "../screens/FeedbackScreen";
import SettingsScreen from "../screens/SettingsScreen";

import ScheduleTab from "../screens/ScheduleTab";

import DriverMapTab from "../screens/DriverMapTab";
import DriverOccupancyTab from "../screens/DriverOccupancyTab";
import DriverAlertsTab from "../screens/DriverAlertsTab";

/* Screens */
import RouteSelectorTab from "../screens/RouteSelectorTab";
import RouteDetailScreen from "../screens/RouteDetailScreen";
import UserAlertsTab from "../screens/UserAlertsTab";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();


/* -------------------- User Tabs -------------------- */
function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#2563eb",
        tabBarIcon: ({ color, size }) => {
          if (route.name === "Routes")
            return (
              <Ionicons name="map" size={size} color={color} />
            );
          if (route.name === "Schedules")
            return (
              <Ionicons name="list" size={size} color={color} />
            );
          if (route.name === "Alerts")
            return (
              <Ionicons
                name="alert-circle"
                size={size}
                color={color}
              />
            );
          return (
            <Ionicons
              name="settings"
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      {/* Routes tab now includes search + itinerary + route cards */}
      <Tab.Screen name="Routes" component={RouteSelectorTab} />
      <Tab.Screen name="Schedules" component={ScheduleTab} />
      <Tab.Screen name="Alerts" component={UserAlertsTab} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

/* -------------------- Driver Tabs -------------------- */
function DriverTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#16a34a",
        tabBarIcon: ({ color, size }) => {
          if (route.name === "DriverMap")
            return (
              <Ionicons name="map" size={size} color={color} />
            );
          if (route.name === "Occupancy")
            return (
              <Ionicons
                name="people"
                size={size}
                color={color}
              />
            );
          if (route.name === "Alerts")
            return (
              <Ionicons
                name="alert-circle"
                size={size}
                color={color}
              />
            );
          return (
            <Ionicons
              name="settings"
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={
          require("../screens/DriverDashboardTab").default
        }
      />
      <Tab.Screen name="Occupancy" component={DriverOccupancyTab} />
      <Tab.Screen name="Alerts" component={DriverAlertsTab} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

/* -------------------- Root Navigation -------------------- */
export default function AppNav() {
  const { user, isDriver } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen
              name="RoleSelect"
              component={RoleSelect}
            />
            <Stack.Screen
              name="Signup"
              component={SignupScreen}
            />
            <Stack.Screen
              name="VerifyOtp"
              component={VerifyOtpScreen}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
            />
            {/* ✅ NEW: User-only forgot/reset password flow */}
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
            />
            <Stack.Screen
              name="DriverLogin"
              component={DriverLogin}
            />
          </>
        ) : isDriver ? (
          <>
            <Stack.Screen
              name="DriverTabs"
              component={DriverTabs}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="HomeTabs"
              component={HomeTabs}
            />
            <Stack.Screen
              name="RouteMap"
              component={RouteMapScreen}
            />
            <Stack.Screen
              name="Feedback"
              component={FeedbackScreen}
            />
            <Stack.Screen
              name="RouteDetail"
              component={RouteDetailScreen}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}