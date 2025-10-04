import React, { useEffect, useState } from "react";
import { fetchReports } from "../services/admin";

export default function Reports() {
  const [report, setReport] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchReports();
        setReport(res.data);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  return (
    <div>
      <h2>Reports</h2>
      <div className="card">
        {report ? (
          <div>
            <p><strong>Peak usage:</strong> {report.peakUsage}</p>
            <p><strong>Active drivers:</strong> {report.activeDrivers}</p>
            <p><strong>Total users:</strong> {report.totalUsers}</p>
          </div>
        ) : <p>No report available</p>}
      </div>
    </div>
  );
}
