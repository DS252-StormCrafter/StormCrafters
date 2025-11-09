# Transvahan – Modules Specification

This document defines the software modules for the Transvahan shuttle service system.  
It follows the SDLC process with modular decomposition, to guide development, testing, and integration.

---

## 1. User App (Mobile & Web)

**Purpose:**  
Enable IISc students, staff, and visitors to access shuttle services in real time.

**Responsibilities:**
- Authentication & account management  
- Display routes, schedules, and maps  
- Real-time vehicle tracking  
- Seat availability display  
- Optional booking/reservation system  
- Notifications & alerts  
- Feedback & support

**Key Components:**
- `AuthModule`: Handles login, signup, password reset (OAuth2/SSO/JWT).  
- `RouteModule`: Displays shuttle lines, stops, and schedules.  
- `TrackingModule`: Renders live GPS locations and ETAs.  
- `CapacityModule`: Shows available seats, refreshes in real-time.  
- `BookingModule` (optional): Seat reservations, QR generation, cancellation.  
- `NotificationModule`: Push notifications for arrivals, delays, emergencies.  
- `FeedbackModule`: Collects user feedback and FAQs.  

**Interfaces:**  
- Consumes APIs from Backend Gateway.  
- Sends feedback and reservation requests to backend.

---

## 2. Driver App (Mobile)

**Purpose:**  
Allow drivers to share GPS and manage vehicle occupancy.

**Responsibilities:**
- Secure driver authentication  
- Live GPS location sharing  
- Capacity management (add/remove passengers)  
- Trip start/end reporting  
- Route selection and updates  
- Receive notifications from Admin  

**Key Components:**
- `AuthModule`: Driver login and verification.  
- `GPSModule`: Sends vehicle location to backend every 10s.  
- `OccupancyModule`: Updates passenger count in real-time.  
- `TripModule`: Start/end trips, report issues.  
- `NotificationModule`: Receive alerts from Admin.  

**Interfaces:**  
- Sends GPS + occupancy to Backend Gateway.  
- Receives trip assignments and alerts.

---

## 3. Admin Portal (Web)

**Purpose:**  
Provide IISc transport management team with monitoring and control.

**Responsibilities:**
- Monitor vehicles, routes, occupancy, schedules  
- Analytics & reports (usage, peak times, vehicle performance)  
- Manage user & driver accounts  
- Manage routes, schedules, vehicle assignments  
- Send system-wide alerts/notifications  

**Key Components:**
- `DashboardModule`: Real-time map of fleet and occupancy.  
- `AnalyticsModule`: Reports on usage, performance, maintenance.  
- `UserDriverModule`: CRUD operations for accounts.  
- `ServiceModule`: Update routes, schedules, and assignments.  
- `NotificationModule`: Dispatch alerts to drivers/users.  

**Interfaces:**  
- Consumes backend APIs for analytics and monitoring.  
- Publishes notifications to drivers/users.

---

## 4. Backend Services (Cloud)

**Purpose:**  
Provide scalable, secure, real-time data synchronization across all clients.

**Responsibilities:**
- Handle user, driver, and admin authentication  
- Process GPS updates and distribute to clients  
- Manage route and schedule data  
- Handle reservations and seat availability  
- Generate analytics and reports  

**Key Microservices:**
- `AuthService`: OAuth2/JWT/SSO authentication.  
- `UserService`: Manage user accounts and roles.  
- `DriverService`: Manage driver accounts and trips.  
- `VehicleService`: Store & broadcast GPS and occupancy data.  
- `RouteService`: Routes, stops, schedules.  
- `ReservationService`: Booking and QR validation.  
- `NotificationService`: Push messages to clients.  
- `AnalyticsService`: Generate reports for Admin.  

**Technical Stack:**  
- Cloud Backend: AWS/GCP/Azure  
- Database: NoSQL (Firebase/DynamoDB)  
- Real-time updates: WebSockets / Firebase RTDB / AWS AppSync  
- APIs: REST + WebSocket endpoints  

---

## 5. Shared Modules

- **Data Models**: User, Driver, Vehicle, Route, Reservation  
- **Utilities**: Logging, Error Handling, Retry Logic  
- **Security**: Data encryption, access control, GDPR compliance  

---

## 6. Testing & Integration Hooks

- Unit tests for each module function  
- Integration tests across User ↔ Backend ↔ Driver ↔ Admin  
- Stress/load tests for real-time updates and scaling  
- Mock services for offline testing  

---

## 7. Dependencies

- Frontend: React Native (mobile), React (web)  
- Backend: Node.js / Python / Go  
- Maps: Google Maps API  
- Notifications: Firebase Cloud Messaging  
- Authentication: OAuth2, JWT, or SSO  

---

## 8. Future Extensions

- Route optimization (AI-based)  
- Predictive demand modeling  
- Offline-first capabilities for drivers  
- Integration with campus ID system  
