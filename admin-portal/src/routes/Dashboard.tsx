import React, { useEffect, useState } from "react";
import { fetchReports } from "../services/admin";

export default function Dashboard() {
  const [stats, setStats] = useState<{peakUsage?:string,activeDrivers?:number,totalUsers?:number}>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchReports();
        setStats(res.data || {});
      } catch (err) {
        // ignore for now or set default
      }
    })();
  }, []);

  return (
    <div>
      <h2>Overview</h2>
      <div className="grid">
        <div className="card">
          <h3>Peak Usage</h3>
          <p>{stats.peakUsage ?? "—"}</p>
        </div>
        <div className="card">
          <h3>Active Drivers</h3>
          <p>{stats.activeDrivers ?? "—"}</p>
        </div>
        <div className="card">
          <h3>Total Users</h3>
          <p>{stats.totalUsers ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}
