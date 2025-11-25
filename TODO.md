# SmartGuard Dashboard Implementation Plan

## Phase 1: Core Dashboard Expansion
- [ ] Add sidebar navigation to Dashboard.tsx with menu items for all modules (Dashboard, Faculty, Students, Sessions, Door Control, Security, Reports, Settings)
- [ ] Implement routing in App.tsx for new pages
- [ ] Create placeholder components for each module page

## Phase 2: Real-Time Data Integration
- [ ] Update Dashboard.tsx to use Firestore onSnapshot for real-time updates on devices, logs, summary
- [ ] Add real-time listeners for accessLogs, devices, sessions collections

## Phase 3: Backend API Expansion
- [ ] Add endpoints in backend/src/index.ts for:
  - Users (faculty/students)
  - Sessions
  - Attendance logs
  - Reports generation
  - Door control commands
  - Settings
- [ ] Implement role-based access control in backend

## Phase 4: Module Implementation
- [ ] Faculty Management: View list, logs, clearance, deactivate
- [ ] Student Management: View list, attendance, add/remove
- [ ] Sessions: Overview, attendance per session, export
- [ ] Door Control: Lock/unlock, access modes, device management
- [ ] Security: Emergency unlock, unauthorized attempts, alerts
- [ ] Reports: Generate and export reports (PDF/CSV)
- [ ] Settings: Device registration, system config, admin roles

## Phase 5: Authentication & Roles
- [ ] Implement Firebase Auth custom claims for roles (admin, registrar, security)
- [ ] Update UI to show/hide modules based on role
- [ ] Add role management in Settings

## Phase 6: Analytics & Charts
- [ ] Add Chart.js or Recharts for access frequency, attendance rate, unauthorized attempts
- [ ] Implement data aggregation in backend or frontend

## Phase 7: Advanced Features
- [ ] Emergency override with notifications
- [ ] Auto-alert system for failed attempts
- [ ] File export functionality
- [ ] Backup data feature

## Phase 8: Testing & Refinement
- [ ] Test real-time updates
- [ ] Verify all endpoints
- [ ] Ensure responsive design
- [ ] Add error handling and loading states
