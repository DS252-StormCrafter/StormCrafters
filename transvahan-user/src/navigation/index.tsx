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
import RouteMapScreen from "../screens/RouteMapScreen";
import FeedbackScreen from "../screens/FeedbackScreen";
import SettingsScreen from "../screens/SettingsScreen";

import MapTab from "../screens/MapTab";
import ScheduleTab from "../screens/ScheduleTab";
import PlannerTab from "../screens/PlannerTab";

import DriverMapTab from "../screens/DriverMapTab";
import DriverOccupancyTab from "../screens/DriverOccupancyTab";
import DriverAlertsTab from "../screens/DriverAlertsTab";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/* -------------------- User Tabs -------------------- */
import UserAlertsTab from "../screens/UserAlertsTab";

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#2563eb",
        tabBarIcon: ({ color, size }) => {
          if (route.name === "Map") return <Ionicons name="map" size={size} color={color} />;
          if (route.name === "Schedules") return <Ionicons name="list" size={size} color={color} />;
          if (route.name === "Planner") return <Ionicons name="navigate" size={size} color={color} />;
          if (route.name === "Alerts") return <Ionicons name="alert-circle" size={size} color={color} />;
          return <Ionicons name="settings" size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Map" component={MapTab} />
      <Tab.Screen name="Schedules" component={ScheduleTab} />
      <Tab.Screen name="Planner" component={PlannerTab} />
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
          if (route.name === "DriverMap") return <Ionicons name="map" size={size} color={color} />;
          if (route.name === "Occupancy") return <Ionicons name="people" size={size} color={color} />;
          if (route.name === "Alerts") return <Ionicons name="alert-circle" size={size} color={color} />;
          return <Ionicons name="settings" size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={require("../screens/DriverDashboardTab").default} />
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
        {/* Always start from RoleSelect if no user */}
        {!user ? (
          <>
            <Stack.Screen name="RoleSelect" component={RoleSelect} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="DriverLogin" component={DriverLogin} />
          </>
        ) : isDriver ? (
          <>
            <Stack.Screen name="DriverTabs" component={DriverTabs} />
          </>
        ) : (
          <>
            <Stack.Screen name="HomeTabs" component={HomeTabs} />
            <Stack.Screen name="RouteMap" component={RouteMapScreen} />
            <Stack.Screen name="Feedback" component={FeedbackScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
