import React, { useEffect, useState } from "react";
import { fetchDrivers, createDriver, deleteDriver, updateDriver } from "../services/admin";
import { useAuth } from "../context/AuthContext";
import { setAuthToken } from "../services/admin";

type Driver = { id: string; name: string; email: string };

export default function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    if (token) setAuthToken(token);
    load();
    // eslint-disable-next-line
  }, [token]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetchDrivers();
      setDrivers(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) return alert("Fill all fields");
    await createDriver(form);
    setForm({ name: "", email: "", password: "" });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete driver?")) return;
    await deleteDriver(id);
    await load();
  };

  return (
    <div>
      <h2>Manage Drivers</h2>

      <div className="card form-row">
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="btn" onClick={handleCreate}>Add Driver</button>
      </div>

      <div className="card">
        <h3>Drivers</h3>
        {loading ? <p>Loading…</p> : (
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.email}</td>
                  <td>
                    <button className="btn" onClick={() => handleDelete(d.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
