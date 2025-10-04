import React, { useEffect, useState } from "react";
import { fetchNotifications } from "../services/admin";

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchNotifications();
        setItems(res.data || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);
  const send = () => {
    if (!msg) return;
    // local UI push only – server side creation endpoint can be added later.
    setItems([{ id: Date.now(), message: msg, time: "Now" }, ...items]);
    setMsg("");
  };
  return (
    <div>
      <h2>System Notifications</h2>
      <div className="card form-row">
        <input placeholder="Notification message" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <button className="btn" onClick={send}>Send</button>
      </div>
      <div className="card">
        <ul>
          {items.map(i => (<li key={i.id}><strong>{i.message}</strong> <em>({i.time})</em></li>))}
        </ul>
      </div>
    </div>
  );
}
