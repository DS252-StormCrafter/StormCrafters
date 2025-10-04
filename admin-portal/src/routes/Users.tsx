import React, { useEffect, useState } from "react";
import { fetchUsers } from "../services/admin";

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchUsers();
        setUsers(res.data || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);
  return (
    <div>
      <h2>Users</h2>
      <div className="card">
        <table className="table">
          <thead><tr><th>ID</th><th>Name</th><th>Email</th></tr></thead>
          <tbody>
            {users.map((u: any) => (<tr key={u.email}><td>{u.email}</td><td>{u.name}</td><td>{u.email}</td></tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
