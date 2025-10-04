import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert } from "react-native";
import axios from "axios";
import Constants from "expo-constants";
import { useAuth } from "../auth/authContext";

const API = Constants.expoConfig?.extra?.API_BASE_URL;

export default function FeedbackScreen({ route }: any) {
  const { token } = useAuth();
  const { vehicle_id } = route.params;
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");

  const submit = async () => {
    try {
      await axios.post(
        `${API}/feedback`,
        { vehicle_id, rating: Number(rating), comment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("✅ Feedback submitted");
      setRating("");
      setComment("");
    } catch (err: any) {
      Alert.alert("❌ Failed", err.response?.data?.error || "Error");
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>
        Feedback for {vehicle_id}
      </Text>
      <Text style={{ marginTop: 12 }}>Rating (1–5):</Text>
      <TextInput
        value={rating}
        onChangeText={setRating}
        keyboardType="numeric"
        style={{ borderWidth: 1, padding: 8, marginTop: 8 }}
      />
      <Text style={{ marginTop: 12 }}>Comments:</Text>
      <TextInput
        value={comment}
        onChangeText={setComment}
        style={{ borderWidth: 1, padding: 8, marginTop: 8 }}
      />
      <Button title="Submit Feedback" onPress={submit} />
    </View>
  );
}
