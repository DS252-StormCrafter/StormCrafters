# System Architecture

---

## Overview
The system follows a **client-server model** with a **cloud-based backend** providing real-time data services.

---

## Components
1. **User App (React Native/Flutter)**  
   - Track vehicles in real-time.  
   - Display routes, schedules, seat availability.  
   - Notifications for arrivals & delays.

2. **Driver App (React Native/Flutter)**  
   - GPS location sharing.  
   - Update seat occupancy.  
   - Trip management.  

3. **Admin Portal (React/Vue)**  
   - Monitor vehicles & occupancy.  
   - Manage routes, schedules, drivers.  
   - Analytics dashboard.  

4. **Backend (Serverless, Cloud-hosted)**  
   - APIs for user/driver/admin communication.  
   - Authentication & authorization.  
   - Real-time data sync via WebSockets/Firebase RTDB.  

5. **Database (NoSQL – Firestore/Firebase RTDB)**  
   - Store user, driver, vehicle, route, reservation data.  

6. **External Services**  
   - Google Maps API (location services).  
   - Firebase Cloud Messaging (push notifications).  

---

## High-Level Architecture Diagram
```plaintext
 ┌─────────────┐        ┌─────────────┐
 │   User App  │◀──────▶│             │
 ├─────────────┤        │             │
 │ Driver App  │◀──────▶│   Backend   │──▶ NoSQL DB
 ├─────────────┤        │ (Cloud Fn)  │
 │ Admin Portal│◀──────▶│             │──▶ Maps API, Notifications
 └─────────────┘        └─────────────┘
