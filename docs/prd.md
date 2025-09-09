# Product Requirements Document (PRD)
**Project:** Transvahan Cloud Shuttle System  
**Course:** DS252 – Introduction to Cloud Computing (Aug 2025)  
**Team:** StormCrafters

---

## 1. Purpose
To provide a **cloud-based platform** for IISc’s Transvahan shuttle service, enabling:
- Students, staff, and faculty to access **real-time shuttle tracking, seat availability, and route schedules**.
- Drivers to update GPS locations and seat occupancy.
- Administrators to manage routes, vehicles, and system performance via a web portal.

---

## 2. Scope
- **Included:** User app, Driver app, Admin portal, cloud backend, authentication, real-time updates.
- **Excluded (Non-goals):**
  - Payment integration
  - Third-party ride-sharing
  - Large-scale public deployment beyond IISc

---

## 3. Stakeholders
- **Primary Users:** IISc students, staff, faculty.
- **Drivers:** Shuttle operators.
- **Admins:** IISc transport management.
- **Sponsor:** IISc Administration.

---

## 4. Assumptions
- Shuttle fleet limited (~6 routes, 4 seats per vehicle).
- Users will have smartphones with internet access.
- IISc network allows GPS + cloud communication.

---

## 5. Functional Requirements
### User App
- Registration/authentication (OAuth2, SSO, or JWT).
- Real-time vehicle tracking (updates ≤ 10s).
- Route info: maps, stops, schedule (20-min frequency).
- Seat availability (4 max).
- Notifications: arrival, delays, service changes.
- Optional: reservations (QR-based boarding).

### Driver App
- Secure login.
- Continuous GPS sharing.
- Update seat occupancy.
- Route selection & trip start/stop.
- Receive admin alerts.

### Admin Portal
- Dashboard: vehicles, occupancy, schedules.
- Real-time maps.
- Reports: usage, peak times, maintenance logs.
- Manage users, drivers, routes, schedules.
- Send system notifications.

---

## 6. Non-Functional Requirements
- **Scalability:** 500+ concurrent users.
- **Reliability:** 99.9% uptime.
- **Performance:** <2s latency for location/seat updates.
- **Security:** TLS encryption, GDPR compliance.
- **Accessibility:** WCAG 2.1.
- **Cross-platform:** Android, iOS, Web.

---

## 7. Proposed Architecture
- **Client apps:** React Native/Flutter (mobile), React (web).
- **Backend:** Serverless (AWS Lambda/Google Cloud Functions).
- **Database:** Firestore/Firebase Realtime DB (NoSQL).
- **Realtime sync:** WebSockets / Firebase RTDB.
- **Maps:** Google Maps API.
- **Notifications:** Firebase Cloud Messaging.
- **Auth:** OAuth2 / SSO.

---

## 8. Data Model (Sample)
```plaintext
User: id, name, email, role, reservations
Driver: id, name, vehicle_id, location, occupancy
Vehicle: id, route_id, location, occupancy, status
Route: id, name, stops, schedule, vehicles
Reservation: id, user_id, vehicle_id, trip_time, status
```
