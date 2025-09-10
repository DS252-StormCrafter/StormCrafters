# Product Requirements Document (PRD)
**Project:** Transvahan Cloud Shuttle System  
**Course:** DS252 – Introduction to Cloud Computing (Aug 2025)  
**Team:** StormCrafters

---

## 1. Purpose
To provide a **cloud-based platform** for IISc’s Transvahan shuttle service, enabling:
- Students, staff, and faculty to access **real-time shuttle tracking, seat availability, and route schedules**.
- Drivers to share GPS locations and update seat occupancy.
- Administrators to manage routes, vehicles, and system performance via a web portal.

---

## 2. Scope
- **Included:** Mobile app (with separate logins for users and drivers), Admin portal, cloud backend, authentication, real-time updates.
- **Excluded (Non-goals):**
  - Payment integration
  - Third-party ride-sharing
  - Large-scale public deployment beyond IISc

---

## 3. Stakeholders
- **Primary Users:** IISc students, staff, faculty.
- **Drivers:** Shuttle operators.
- **Admins:** IISc transport management.

---
## 4. User Stories

### Users
- As a **student**, I want to see the **next shuttle arrival time**, so I can plan my commute efficiently.  
- As a **staff member**, I want to check **seat availability in real-time**, so I know whether I can board.  
- As a **visitor**, I want to **register and sign in easily**, so I can use the service without IISc credentials.  

**Acceptance Criteria:**  
- Given valid login, when I open the app, then I should see all shuttle lines with next-arrival times (<20 min).  
- When I open the seat info, then I should see the **current occupancy in real-time**, updated immediately as passengers board or leave.  
- Given an unregistered visitor, when they sign up, then the app must validate phone/email and allow access.  
- Given a shuttle trip is ongoing, then the driver’s GPS must update the backend every ≤ 5s automatically.  
  
### Admins  
- As an **admin**, I want to **view shuttle usage reports**, so I can optimize schedules and resources.  
- As an **admin**, I want to **monitor driver activities** (logins, trips, seat updates, GPS status), so I can ensure compliance and service reliability.  

**Acceptance Criteria:**  
- Given the analytics dashboard, when I select a date range, then I must see usage stats for all routes.  
- Given the vehicle monitoring panel, when I select a vehicle, then I must see their recent activities (login history, trip records, seat updates, GPS sharing status).  


---
## 5. Assumptions
- Shuttle fleet limited (~6 routes, 4 seats per vehicle).
- Users will have smartphones with internet access.
- IISc network allows GPS + cloud communication.

---

## 6. Functional Requirements
### Unified App (Role-Based)
- **Authentication:** Single login (OAuth2, SSO, JWT). User profile contains **role = user/driver**.  
- **Users (default role):**
  - Real-time shuttle tracking (≤5s update).  
  - Accurate vacant seat count (calculated as `vehicle.capacity - occupancy`).  
  - Route info: maps, stops, schedules.  
  - Notifications: arrival alerts, delays, service changes.  
  - Post-ride feedback (ratings, comments).  

- **Drivers (role = driver):**
  - Secure login.  
  - Continuous GPS sharing (≤5s).  
  - Seat occupancy update buttons (+1 / –1).  
  - Route selection & trip start/stop.  
  - Admin alerts (maintenance, route changes).

### Admin Portal
- Dashboard: vehicles, seat availability, schedules.  
- Real-time maps.  
- Reports: usage, peak times, maintenance logs.  
- Manage users, drivers, routes, schedules.  
- Send system notifications. 

---

## 7. Non-Functional Requirements
- **Scalability:** 500 (approx.) concurrent users .
- **Reliability:** 99.9% uptime during operational hours (Mon–Sat, 9 am–7 pm).
- **Performance:** <5s latency for location/seat updates.
- **Security:** TLS encryption, GDPR compliance.
- **Accessibility:** WCAG 2.1.
- **Cross-platform:** Android, iOS, Web.

---

## 8. Proposed Architecture
- **Client apps:** React Native/Flutter (mobile), React (web).
- **Backend:** Serverless (AWS Lambda/Google Cloud Functions).
- **Database:** Firestore/Firebase Realtime DB (NoSQL, MongoDB).
- **Realtime sync:** WebSockets / Firebase RTDB.
- **Maps:** Google Maps API.
- **Auth:** OAuth2 / SSO.

---

## 9. Data Model (Sample)
```plaintext
User: id, name, email
Vehicle: id, vehicle_id, route_id, location, occupancy, status
Route: id, name, stops, schedule, vehicles
```
## 10. Security & Privacy
- Encrypted communication (TLS/SSL).
- Role-based access (User, Driver, Admin).
- Minimal data storage (no sensitive personal data).
- Cloud IAM policies.

## 11. Deployment and Operations
- Cloud provider: AWS/Azure/GCP.
- CI/CD pipeline: GitHub Actions + Cloud deploy.
- Monitoring: CloudWatch/Stackdriver.
- Network-based trust: devices on IIScWLAN, Eduroam, or IISc VPN may auto-authenticate without login.

## 12. Acceptance Criteria
- Users can track shuttles in real-time with ≤5s delay.
- Seat availability updates accurately.
- Driver app syncs GPS + occupancy reliably.
- Admin dashboard reflects live status.
- ≥80% positive feedback in testing survey.
  
## 13. Testing Plan
- Unit testing (backend APIs, mobile components).
- Integration testing (apps + backend).
- Load testing (simulate 500 users).
- Security testing (auth, data access).
- UAT (pilot with IISc students, including in-app feedback collection).

## Project Timeline & Task Allocation

### **Fri 12 Sep – Proposal Presentation**
- **All Members:** Prepare slides & present PRD, architecture, and role distribution.

---

### **Fri 19 Sep – Backend + DB Setup**
- **Member 1 (Backend Lead):** Set up database schema (Firestore), define APIs (auth, GPS, seats).
- **Member 2 (User App Lead):** Build mock UI (login, shuttle list, routes), connect to dummy APIs.
- **Member 3 (Driver App Lead):** Prototype GPS sharing & seat update screen.
- **Member 4 (Admin & QA Lead):** Set up repo structure, CI/CD pipeline, initial testing framework.

---

### **Fri 26 Sep – User App MVP (Tracking + Routes)**
- **Member 1:** Backend live route queries via WebSockets.
- **Member 2:** Implement real-time map view + next-shuttle timings.
- **Member 3:** Integrate driver GPS push to backend.
- **Member 4:** End-to-end testing of tracking feature, document test cases.

---

### **Fri 3 Oct – Driver App MVP (GPS + Seat Updates)**
- **Member 1:** Backend endpoints for GPS + occupancy sync.
- **Member 2:** Show live occupancy in user app.
- **Member 3:** Driver UI for GPS sharing, seat updates, trip start/stop.
- **Member 4:** QA testing of GPS + occupancy workflows, bug logging.

---

### **Fri 10 Oct – Midterm Review (67% Features Complete)**
- **Member 1:** Backend stable, APIs functional.
- **Member 2:** User login MVP (tracking + routes).
- **Member 3:** Driver login MVP (GPS + occupancy).
- **Member 4:** Admin portal wireframe, midterm testing report.
- **All Members:** Midterm presentation & demo.

---

### **Fri 17 Oct – Admin Portal MVP**
- **Member 1:** Backend APIs for dashboard & reports.
- **Member 2:** Notifications module (arrival/delay alerts) in user login.
- **Member 3:** Trip management controls in driver login.
- **Member 4:** Admin dashboard (routes, occupancy, driver activity monitor).

---

### **Fri 24 Oct – Notifications & Reservations**
- **Member 1:** Push notifications backend.
- **Member 2:** User app reservation workflow + feedback screen (ratings, comments).
- **Member 3:** Reservation validation in driver login.
- **Member 4:** Analytics & reporting in admin portal; QA feedback flow.

---

### **Fri 31 Oct – System Integration & Cloud Deployment**
- **Member 1:** Deploy backend + DB to cloud.
- **Member 2:** Deploy beta user login build.
- **Member 3:** Deploy beta driver login build.
- **Member 4:** Deploy admin portal, run integration testing.
- **All Members:** Cross-app end-to-end testing.

---

### **Fri 7 Nov – Final Submission**
- **Member 1:** Backend monitoring, auto-scaling validation.
- **Member 2:** Final polish of user login + bug fixes.
- **Member 3:** Final polish of driver login + bug fixes.
- **Member 4:** QA sign-off, documentation, final submission package.
- **All Members:** Final demo & report submission.
  


