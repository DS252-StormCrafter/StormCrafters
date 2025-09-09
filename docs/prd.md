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
## 4. User Stories

### Users
- As a **student**, I want to see the **next shuttle arrival time**, so I can plan my commute efficiently.  
- As a **staff member**, I want to check **seat availability in real-time**, so I know whether I can board.  
- As a **visitor**, I want to **register and sign in easily**, so I can use the service without institutional credentials.  

**Acceptance Criteria:**  
- Given valid login, when I open the app, then I should see all shuttle lines with next-arrival times (<20 min).  
- Given a shuttle is full, when I open the seat info, then I should see a “Full” status.  
- Given an unregistered visitor, when they sign up, then the app must validate phone/email and allow access.  

### Drivers
- As a **driver**, I want to **update seat occupancy quickly**, so passengers always see accurate seat counts.  
- As a **driver**, I want my GPS location to be **shared automatically**, so I don’t need to update it manually.  

**Acceptance Criteria:**  
- Given I start a trip, when I press "Start", then my GPS must update the backend every ≤10s.  
- Given passengers board, when I press “+1”, then occupancy must increase immediately for users.  

### Admins
- As an **admin**, I want to **send service alerts (delays, route changes)** to users instantly, so they stay informed.  
- As an **admin**, I want to **view shuttle usage reports**, so I can optimize schedules and resources.  

**Acceptance Criteria:**  
- Given an emergency, when admin posts an alert, then users and drivers should receive a push notification within 5s.  
- Given the analytics dashboard, when I select a date range, then I must see usage stats for all routes.  

---
## 5. Assumptions
- Shuttle fleet limited (~6 routes, 4 seats per vehicle).
- Users will have smartphones with internet access.
- IISc network allows GPS + cloud communication.

---

## 6. Functional Requirements
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

## 7. Non-Functional Requirements
- **Scalability:** 500+ concurrent users.
- **Reliability:** 99.9% uptime.
- **Performance:** <2s latency for location/seat updates.
- **Security:** TLS encryption, GDPR compliance.
- **Accessibility:** WCAG 2.1.
- **Cross-platform:** Android, iOS, Web.

---

## 8. Proposed Architecture
- **Client apps:** React Native/Flutter (mobile), React (web).
- **Backend:** Serverless (AWS Lambda/Google Cloud Functions).
- **Database:** Firestore/Firebase Realtime DB (NoSQL).
- **Realtime sync:** WebSockets / Firebase RTDB.
- **Maps:** Google Maps API.
- **Notifications:** Firebase Cloud Messaging.
- **Auth:** OAuth2 / SSO.

---

## 9. Data Model (Sample)
```plaintext
User: id, name, email, role, reservations
Driver: id, name, vehicle_id, location, occupancy
Vehicle: id, route_id, location, occupancy, status
Route: id, name, stops, schedule, vehicles
Reservation: id, user_id, vehicle_id, trip_time, status
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
- Auto-scaling based on traffic.

## 12. Acceptance Criteria
- Users can track shuttles in real-time with ≤2s delay.
- Seat availability updates accurately.
- Driver app syncs GPS + occupancy reliably.
- Admin dashboard reflects live status.
- ≥80% positive feedback in testing survey.

## 13. Testing Plan
- Unit testing (backend APIs, mobile components).
- Integration testing (apps + backend).
- Load testing (simulate 500 users).
- Security testing (auth, data access).
- UAT (pilot with IISc students).

## 14. Milestones & Task Allocation

The following timeline ensures all four team members contribute consistently across all weeks while maintaining clear ownership of subsystems. Each milestone builds on the previous one, aligning with the acceptance criteria and testing plan.

---

### **Fri 12 Sep – Proposal Presentation**
- **All Members:** Prepare slides, present PRD, architecture, and roles.  

---

### **Fri 19 Sep – Backend + DB Setup**
- **Member 1 (Backend Lead):** Set up database schema, APIs.  
- **Member 2 (User App Lead):** Build mock UI screens, connect to dummy APIs.  
- **Member 3 (Driver App Lead):** Implement GPS mock tracking & seat update prototype.  
- **Member 4 (Admin & QA Lead):** Set up repo structure, CI/CD pipeline, initial testing framework.  

---

### **Fri 26 Sep – User App MVP (Tracking + Routes)**
- **Member 1:** Ensure backend supports live route queries + WebSockets.  
- **Member 2:** Implement real-time map & route viewer in user app.  
- **Member 3:** Start integrating driver GPS push to backend for real data.  
- **Member 4:** Test route display end-to-end, create test cases for user app.  

---

### **Fri 3 Oct – Driver App MVP (GPS + Seat Updates)**
- **Member 1:** Backend endpoints for GPS + seat occupancy.  
- **Member 2:** Consume occupancy data in user app.  
- **Member 3:** Build driver UI for GPS sharing + seat management.  
- **Member 4:** QA testing of GPS + occupancy workflows, logging bugs.  

---

### **Fri 10 Oct – Midterm Review (67% Features Complete)**
- **Member 1:** Backend stable, tested APIs.  
- **Member 2:** User app tracking + routes live.  
- **Member 3:** Driver app GPS + seat updates functional.  
- **Member 4:** Admin portal wireframe ready + midterm testing report.  
- **All Members:** Prepare and deliver review presentation.  

---

### **Fri 17 Oct – Admin Portal MVP**
- **Member 1:** Backend APIs for dashboard & reports.  
- **Member 2:** Add notifications module to user app.  
- **Member 3:** Add trip management to driver app.  
- **Member 4:** Build admin dashboard UI (routes, schedules).  

---

### **Fri 24 Oct – Notifications & Reservations**
- **Member 1:** Implement push notifications service.  
- **Member 2:** User app reservation workflow + QR code boarding.  
- **Member 3:** Driver app integrates reservation validation.  
- **Member 4:** Admin portal adds analytics & reporting; QA reservations.  

---

### **Fri 31 Oct – System Integration & Cloud Deployment**
- **Member 1:** Deploy backend + DB to cloud.  
- **Member 2:** Deploy user app beta build.  
- **Member 3:** Deploy driver app beta build.  
- **Member 4:** Deploy admin portal + run system integration tests.  

---

### **Fri 7 Nov – Final Submission**
- **Member 1:** Monitor backend performance + cloud scaling.  
- **Member 2:** Final polish of user app + bug fixes.  
- **Member 3:** Final polish of driver app + bug fixes.  
- **Member 4:** Final testing, prepare documentation, package submission.  
- **All Members:** Deliver final demo & report.  


