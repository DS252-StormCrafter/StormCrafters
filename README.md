# How to Run the Stack

1. **Start the backend**
   - Copy `backend/.env.example` to `backend/.env`, fill in Firebase + JWT secrets, then run:
     ```bash
     cd backend
     npm install
     node src/server.js
     ```
   - The API + WebSocket server boots on `http://localhost:5001`.
2. **Expose the backend (optional but required for remote/mobile access)**
   - In a separate terminal run `ngrok http 5001` (or your chosen port). Note the forwarded HTTPS URL (e.g. `https://abcd.ngrok.io`).
   - Use that URL for any client that cannot hit `localhost` directly (see steps 3–4).
3. **Launch the admin portal**
   - Copy `admin-portal/.env.example` to `.env`, set `VITE_API_BASE` to either `http://localhost:5001` or `https://abcd.ngrok.io` then run:
     ```bash
     cd admin-portal
     npm install
     npm run dev
     ```
   - Vite serves the dashboard on `http://localhost:3001`; log in and you will see live data as long as the backend (or ngrok tunnel) stays running.
4. **Launch the Expo user app**
   - Copy `transvahan-user/.env.example` to `.env` and set `API_BASE_URL`/`WS_URL` to the backend base (ngrok URL recommended so real devices can connect).
   - Start Metro with:
     ```bash
     cd transvahan-user
     npm install
     npx expo start -c --tunnel
     ```
   - Scan the QR code in Expo Go (or run `npm run start -- --android/--ios`). The app consumes the same backend instance and mirrors whatever admin updates.

Keep the backend (or its ngrok tunnel) alive the whole time—both the admin portal and the mobile client stream data through it.
