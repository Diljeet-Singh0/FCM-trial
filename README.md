# Real-Time Ride-Request Simulation with FCM

## Architecture Diagram

  [UserApp - Device 1]
        |
        | POST /send-request { targetUserId: 'driver-1' }
        ↓
  [Backend - Node.js / Render]
        |
        | admin.messaging().send({ token: tokenStore['driver-1'], ... })
        ↓
  [FCM - Google Servers]
        |
        | Push Notification (high priority)
        ↓
  [DriverApp - Device 2]
   foreground → onMessage() updates UI
   background → setBackgroundMessageHandler() shows Notifee notification
   killed     → FCM system tray notification (no handler needed)

## Test Instructions

1. **Start backend locally**: `cd backend && node index.js`
2. **Install UserApp on Device 1**:
   - `cd UserApp`
   - Replace `android/app/google-services.json` with your real one.
   - `npx react-native run-android`
3. **Install DriverApp on Device 2**:
   - `cd DriverApp`
   - Replace `android/app/google-services.json` with the same real one.
   - `npx react-native run-android`
4. **Check Registration**:
   - Hit `/health` endpoint to confirm both `user-1` and `driver-1` registered their tokens.
5. **Testing**:
   - On Device 1, tap "**Send Ride Request**".
   - Device 2 receives the notification (updates UI directly if active, heads-up in background, or system tray if killed).
# FCM-trial
