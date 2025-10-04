import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import axios from "axios";
import Constants from "expo-constants";
import { useAuth } from "../auth/authContext";

const API = Constants.expoConfig?.extra?.API_BASE_URL;

export function useAlerts() {
  const lastShown = useRef<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API}/alerts`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (data.length > 0) {
          const latest = data[0];
          if (latest.createdAt !== lastShown.current) {
            lastShown.current = latest.createdAt;
            Alert.alert("⚠️ Shuttle Alert", latest.message);
          }
        }
      } catch (err) {
        console.warn("Alerts fetch failed:", err);
      }
    }, 10000); // every 10s

    return () => clearInterval(interval);
  }, [token]);
}
