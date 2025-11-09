import React, { useEffect, useState } from "react";
import { fetchVehicles, updateVehicleCapacity } from "../services/admin";

type Vehicle = {
  id: string;
  vehicle_id?: string;
  plateNo?: string;
  status?: string;
  occupancy?: number;
  capacity?: number;
  demand_high?: boolean;
};

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ [id: string]: number }>({});
  const [saving, setSaving] = useState<string | null>(null);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await fetchVehicles();
      setVehicles(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error("Failed to fetch vehicles:", err);
      setVehicles([]);
      setError(
        err?.response?.data?.error || err?.message || "Failed to fetch vehicles"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const handleCapacityChange = (id: string, value: string) => {
    const num = parseInt(value, 10);
    setEditing((prev) => ({ ...prev, [id]: isNaN(num) ? 0 : num }));
  };

  const handleSaveCapacity = async (id: string) => {
    const newCap = editing[id];
    if (!newCap || newCap < 1) {
      alert("Please enter a valid capacity (>=1)");
      return;
    }
    try {
      setSaving(id);
      await updateVehicleCapacity(id, newCap);
      alert("Capacity updated successfully!");
      await loadVehicles();
    } catch (err: any) {
      console.error("Update capacity error:", err);
      alert(err?.response?.data?.error || "Failed to update capacity");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <h2>Vehicles</h2>
      <div className="card">
        {error && <p style={{ color: "#ef4444" }}>Error: {error}</p>}
        {loading ? (
          <p>Loading…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Plate</th>
                <th>Status</th>
                <th>Occupancy</th>
                <th>Capacity</th>
                <th>Demand</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(vehicles || []).map((v) => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{v.vehicle_id ?? v.plateNo ?? "—"}</td>
                  <td>{v.status ?? "—"}</td>
                  <td>{typeof v.occupancy === "number" ? v.occupancy : "—"}</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={
                        editing[v.id] !== undefined
                          ? editing[v.id]
                          : v.capacity ?? ""
                      }
                      onChange={(e) =>
                        handleCapacityChange(v.id, e.target.value)
                      }
                      style={{
                        width: 70,
                        textAlign: "center",
                        padding: "4px 6px",
                        border: "1px solid #ccc",
                        borderRadius: 4,
                      }}
                    />
                  </td>
                  <td>{v.demand_high ? "✅" : "—"}</td>
                  <td>
                    <button
                      className="btn xs primary"
                      disabled={saving === v.id}
                      onClick={() => handleSaveCapacity(v.id)}
                    >
                      {saving === v.id ? "Saving…" : "💾 Save"}
                    </button>
                  </td>
                </tr>
              ))}
              {!vehicles?.length && !error && (
                <tr>
                  <td colSpan={7}>No vehicles found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
