import React, { useEffect, useState } from "react";
import { fetchVehicles } from "../services/admin";

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchVehicles();
        setVehicles(res.data || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);
  return (
    <div>
      <h2>Vehicles</h2>
      <div className="card">
        <table className="table">
          <thead><tr><th>ID</th><th>Plate</th><th>Status</th><th>Occupancy</th><th>Capacity</th></tr></thead>
          <tbody>
            {vehicles.map(v => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td>{v.vehicle_id ?? v.plateNo ?? "—"}</td>
                <td>{v.status}</td>
                <td>{v.occupancy}</td>
                <td>{v.capacity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
