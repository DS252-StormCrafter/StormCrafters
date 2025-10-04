import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import SignupScreen from "../screens/SignupScreen";
import VerifyOtpScreen from "../screens/VerifyOTPScreen";
import LoginScreen from "../screens/LoginScreen";
import RouteMapScreen from "../screens/RouteMapScreen";
import FeedbackScreen from "../screens/FeedbackScreen";
import SettingsScreen from "../screens/SettingsScreen";

// 🆕 new main tabs
import MapTab from "../screens/MapTab";
import ScheduleTab from "../screens/ScheduleTab";
import PlannerTab from "../screens/PlannerTab";

import { useAuth } from "../auth/authContext";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#555",
        tabBarIcon: ({ color, size }) => {
          if (route.name === "Map") return <Ionicons name="map" size={size} color={color} />;
          if (route.name === "Schedules") return <Ionicons name="list" size={size} color={color} />;
          if (route.name === "Planner") return <Ionicons name="navigate" size={size} color={color} />;
          return <Ionicons name="ellipsis-horizontal" size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Map" component={MapTab} />
      <Tab.Screen name="Schedules" component={ScheduleTab} />
      <Tab.Screen name="Planner" component={PlannerTab} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const AppNav = () => {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // 🧭 Unauthenticated Flow
          <>
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        ) : (
          // 🚀 Authenticated Flow
          <>
            <Stack.Screen name="Home" component={HomeTabs} />
            <Stack.Screen name="RouteMap" component={RouteMapScreen} />
            <Stack.Screen name="Feedback" component={FeedbackScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNav;
