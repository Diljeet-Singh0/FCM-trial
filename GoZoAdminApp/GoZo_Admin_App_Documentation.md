# GoZo Admin App — Complete Technical Documentation

> **Purpose:** Training guide and viva preparation reference for the GoZo Admin App (Phase 1).  
> **Audience:** GoZo engineering team and college-level viva examination.

---

# Section 1: Project Overview

## 1.1 What is GoZo?

GoZo is an **industrial logistics application** that connects factory owners with auto/truck drivers for local goods transport.

**The problem it solves:**  
Factory owners need to move goods (raw materials, finished products) from their factory to a transport company (a trucking depot or freight company). Finding a reliable, on-demand vehicle for this short trip has traditionally required phone calls, personal contacts, and manual negotiation. GoZo digitises this entire process.

**How it works — the three-app system:**

| App | Users | Role |
|---|---|---|
| **UserApp** | Factory owners / businesses | Book rides, track delivery in real time, view ride history |
| **DriverApp** | Auto/truck drivers | Receive ride requests, navigate to pickup/drop, update ride status |
| **GoZo Admin App** | GoZo internal operations staff | Monitor all rides, track drivers, manage earnings and debt, receive alerts |

**Backend infrastructure:**
- **Server:** Node.js / Express, hosted on **Render** (cloud platform)
- **Database:** **Supabase** (managed PostgreSQL) — stores all rides, users, drivers, payments
- **Push Notifications:** Firebase Cloud Messaging (FCM)

---

## 1.2 What is the GoZo Admin App?

The GoZo Admin App is a **React Native mobile application** built exclusively for GoZo's internal operations team (approximately 3 staff members). It is the operations control panel for the entire GoZo platform.

**Key facts about the Admin App:**

- **Who uses it:** GoZo's internal operations staff only — not available to the public
- **Distribution:** Installed via APK directly on staff phones — **not on the Google Play Store**
- **Purpose:** Monitor all rides in real time, track driver availability, manage driver earnings and debt settlement, receive instant push notification alerts for new bookings
- **Phase 1 scope (current):** Ride management and driver monitoring
- **Phase 2 scope (future):** Company and driver CRUD operations — creating, editing, and deleting driver/company records
- **Long-term goal:** Fully replace the existing web admin portal

**What the Admin App can do right now (Phase 1):**
1. View all rides (quick bookings) with status and date filters
2. View all scheduled rides with filters
3. View detailed ride information — customer, driver, route, price, status timeline
4. Assign available drivers to pending scheduled rides
5. Monitor all drivers — online/offline status, KYC documents, bank details
6. View driver earnings, GoZo commission, and outstanding debt
7. Log cash payments received from drivers (reducing their debt)
8. Receive real-time FCM push notifications for new bookings
9. Test push notification delivery
10. Delete individual rides or clear all rides (danger zone)

---

## 1.3 How All Four Components Interact

### Full Ride Lifecycle — Step by Step

```
STEP 1: Factory owner opens UserApp and books a ride
        UserApp ──POST /ride-requests──► Node.js Backend
                                                │
                                                ▼
                                         Supabase (PostgreSQL)
                                         Saves new ride record
                                         status = 'pending'

STEP 2: Backend notifies all drivers
        Backend ──FCM Push──► DriverApp (all online drivers receive alert)
        Backend ──FCM Push──► Admin App  (staff receive "New Ride" alert)

STEP 3: A driver accepts the ride
        DriverApp ──PATCH /ride-requests/:id/accept──► Backend
        Backend updates status = 'matched' in Supabase
        Backend sends FCM to UserApp ("Driver is on the way")

STEP 4: Driver updates status through the journey
        Driver taps "Arrived"     → Backend: status = 'arrived'
        Driver taps "Picked Up"   → Backend: status = 'picked_up'
        Driver taps "Delivered"   → Backend: status = 'completed'
        Each update → Backend notifies UserApp via FCM → live tracking updates

STEP 5: Ride completes → Backend calculates commission
        accepted_price (user paid) = driver_earning + gozo_cut
        This breakdown is stored in Supabase and visible in Admin App
        Admin can see: Driver Earned / GoZo Commission / Outstanding Debt

STEP 6: Admin logs cash payment from driver
        Admin App ──POST /admin/drivers/:id/payments──► Backend
        Backend records payment, reduces driver's outstanding debt
```

### Component Interaction Diagram

```
┌─────────────┐     HTTP REST      ┌──────────────────────┐
│   UserApp   │◄──────────────────►│                      │
└─────────────┘                    │   Node.js Backend    │
                                   │   (Render Cloud)     │
┌─────────────┐     HTTP REST      │                      │◄──► Supabase
│  DriverApp  │◄──────────────────►│  - Business logic    │     (PostgreSQL)
└─────────────┘                    │  - FCM dispatch      │
                                   │  - Auth & validation │
┌─────────────┐     HTTP REST      │                      │
│ Admin App   │◄──────────────────►│                      │
└─────────────┘                    └──────────────────────┘
       ▲                                      │
       │                                      │ FCM
       │         Firebase Cloud Messaging     ▼
       └──────────────────────────────── FCM Server
```

**Critical rule:** The Admin App **never connects to Supabase directly**. All requests go through the Node.js backend. This keeps credentials secure and business logic centralised.

---

*Next: Section 2 — Tech Stack*

---

# Section 2: Tech Stack

The full dependency list from `package.json`:

```json
"dependencies": {
  "@notifee/react-native": "^9.1.8",
  "@react-native-async-storage/async-storage": "^2.2.0",
  "@react-native-community/datetimepicker": "^9.1.0",
  "@react-native-firebase/app": "^24.0.0",
  "@react-native-firebase/messaging": "^24.0.0",
  "@react-navigation/bottom-tabs": "^7.18.8",
  "@react-navigation/native": "^7.3.8",
  "@react-navigation/native-stack": "^7.17.10",
  "react": "19.2.3",
  "react-native": "0.85.2",
  "react-native-safe-area-context": "^5.5.2",
  "react-native-screens": "^4.25.0"
}
```

---

## 2.1 React Native CLI

**What it is:**  
React Native is a framework developed by Meta (Facebook) that allows you to build native Android and iOS applications using JavaScript/TypeScript. Unlike a web app wrapped in a browser (like Cordova), React Native compiles to actual native UI components — a `<View>` becomes an Android `ViewGroup`, a `<Text>` becomes a `TextView`.

The **CLI** (Command Line Interface) flavour means the project is set up and managed with bare native files (`android/` and `ios/` folders), giving full access to native code.

**Why CLI over Expo:**  
- Firebase (`@react-native-firebase/messaging`) and Notifee require **native code linking** — they have Java/Kotlin code that must be compiled into the Android APK. Expo's managed workflow does not allow this by default.
- The UserApp and DriverApp also use React Native CLI, so the entire GoZo codebase stays consistent.
- CLI gives full control over the `AndroidManifest.xml`, Gradle files, and native permissions needed for FCM.

**How used in the Admin App:**  
Every screen is built with React Native's core components:
```tsx
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
```
- `FlatList` — renders the scrollable list of rides and drivers efficiently
- `TouchableOpacity` — all tappable buttons (Login, Filter chips, Call button)
- `ActivityIndicator` — loading spinner shown while API calls are in progress
- `ScrollView` — used in detail screens (RideDetailScreen, DriverDetailScreen) for long content
- `Modal` — the payment recording modal in DriverDetailScreen
- `TextInput` — login password field, search bar, payment amount entry

---

## 2.2 TypeScript

**What it is:**  
TypeScript is a superset of JavaScript that adds **static type checking**. You declare what type of data a variable or function expects, and TypeScript catches mismatches before the code runs.

**Why used:**  
Prevents entire categories of bugs. For example, without TypeScript you could accidentally pass a number where a string is expected and not know until runtime. With TypeScript, the editor flags the error immediately.

**How used in the Admin App:**  
All files use the `.tsx` extension. Interfaces are defined in `src/api.ts` for every major data shape:

```typescript
// src/api.ts
export interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle_number: string;
  vehicle_type: string;
  status: 'offline' | 'available' | 'in_ride';  // union type — only 3 valid values
  gozo_phone?: string;       // optional fields use ?
  aadhaar_number?: string;
  bank_account_number?: string;
}

export interface Ride {
  id: string;
  status: string;
  goods_type: string;
  weight_kg: number;
  pickup_address: string;
  drop_address: string;
  price_inr?: number;
  driver?: Driver | null;    // driver can be a Driver object, null, or absent
}

export interface DriverEarningsSummary {
  totalDriverEarning: number;
  totalAccepted: number;
  totalGozoCut: number;
  totalPaid: number;
  outstandingDebt: number;
}
```

Function return types are also typed:
```typescript
export const fetchRides = async (
  status?: string,
  date?: string
): Promise<{ success: boolean; rides: Ride[]; error?: string }> => { ... }
```
This guarantees that every caller of `fetchRides` knows exactly what they will receive.

---

## 2.3 React Navigation (`@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`)

**What it is:**  
React Navigation is the standard navigation library for React Native. It manages moving between screens, passing data between them, and the back-stack (going back to previous screens).

**Why used:**  
It is the most widely used, well-maintained navigation solution for React Native. It supports both bottom tab bars and stack-based navigation out of the box.

**Two navigators used:**

**1. Bottom Tab Navigator** (`@react-navigation/bottom-tabs`)  
Creates the 4-tab bar at the bottom of the screen. Defined in `src/navigation/AppNavigator.tsx`:
```tsx
const Tab = createBottomTabNavigator();

<Tab.Navigator>
  <Tab.Screen name="Rides"     component={RidesStack} />
  <Tab.Screen name="Scheduled" component={ScheduledStack} />
  <Tab.Screen name="Drivers"   component={DriversStack} />
  <Tab.Screen name="Settings"  component={SettingsStack} />
</Tab.Navigator>
```
Each tab has an emoji icon (🚗, 📅, 👤, ⚙️) and a label.

**2. Stack Navigator** (`@react-navigation/native-stack`)  
Each tab contains its own Stack Navigator so that tapping a ride or driver card can push a detail screen on top without losing the tab bar. Example — Rides tab:
```tsx
function RidesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RidesHome"  component={RidesScreen} />
      <Stack.Screen name="RideDetail" component={RideDetailScreen} />
    </Stack.Navigator>
  );
}
```
The same pattern is repeated for `ScheduledStack` and `DriversStack`.

**NavigationRef for programmatic navigation:**  
`src/navigation/navigationRef.ts` exports a global `navigate()` function used to jump to a screen from outside a component (e.g., when a push notification is tapped):
```typescript
export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
```
This is called in `App.tsx` when a notification tap event is received.

---

## 2.4 `@react-native-firebase/app` and `@react-native-firebase/messaging`

**What it is:**  
The official Firebase SDK for React Native, maintained by Invertase. `@react-native-firebase/app` is the core module; `@react-native-firebase/messaging` adds Firebase Cloud Messaging (FCM) support.

**Why used:**  
FCM is Google's free, reliable push notification infrastructure. It can deliver notifications even when the app is completely closed (killed state). This is essential for the Admin App because staff must be alerted immediately when a new ride is booked, even if they are not actively looking at the app.

**How used in the Admin App (`App.tsx`):**

```tsx
import messaging from '@react-native-firebase/messaging';

// 1. Request permission from the user (required on Android 13+)
const authStatus = await messaging().requestPermission();

// 2. Get the device's unique FCM token
const token = await messaging().getToken();

// 3. Send the token to the backend so it knows where to send notifications
await registerAdminFcmToken(token);

// 4. Listen for token refreshes (token can change, backend must be updated)
messaging().onTokenRefresh(async (newToken) => {
  await registerAdminFcmToken(newToken);
});

// 5. Handle messages when app is in FOREGROUND
const unsubscribe = messaging().onMessage(async (remoteMessage) => {
  // display with Notifee (see 2.5)
});
```

Background and killed-state notifications are handled automatically by the Firebase native SDK — the Android system shows the notification without any JavaScript code running.

---

## 2.5 `@notifee/react-native`

**What it is:**  
Notifee is a local notification display and management library for React Native, also maintained by Invertase (the same team as React Native Firebase).

**Why needed separately from Firebase:**  
When the app is in the **foreground** (open and visible), Firebase does NOT automatically display a notification banner. The `onMessage` handler fires silently — it is up to the developer to show something. Notifee fills this gap by rendering a proper OS-level notification banner.

**How used in the Admin App (`App.tsx`):**

```tsx
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';

// 1. Create an Android notification channel (required on Android 8+)
await notifee.createChannel({
  id: 'gozo_admin_alerts',
  name: 'GoZo Admin Alerts',
  importance: AndroidImportance.HIGH,  // HIGH = heads-up banner + sound
});

// 2. Display a notification when a foreground FCM message arrives
await notifee.displayNotification({
  title: remoteMessage.notification?.title || 'GoZo Operations Alert',
  body:  remoteMessage.notification?.body  || 'New operational update',
  android: {
    channelId: 'gozo_admin_alerts',
    importance: AndroidImportance.HIGH,
    pressAction: { id: 'default' },
  },
  data: remoteMessage.data,  // ride ID / type passed through for deep linking
});

// 3. Handle tap on the Notifee notification (foreground deep link)
notifee.onForegroundEvent(({ type, detail }) => {
  if (type === EventType.PRESS) {
    handleNotificationTap(detail.notification?.data);
  }
});

// 4. Handle tap when app was in KILLED state
notifee.getInitialNotification().then((initialNotification) => {
  if (initialNotification) {
    setTimeout(() => handleNotificationTap(initialNotification.notification.data), 1500);
  }
});
```

---

## 2.6 `@react-native-async-storage/async-storage`

**What it is:**  
AsyncStorage is a simple, asynchronous, persistent key-value storage system for React Native. It works like `localStorage` in a web browser, but it is asynchronous (returns Promises) and persists across app restarts.

**Why used:**  
When the admin logs in, the session must persist. If the app is closed and reopened, the admin should not have to log in again. AsyncStorage stores the session flag and token locally on the device.

**How used in the Admin App:**

```typescript
// On successful login (src/api.ts — loginAdmin function):
await AsyncStorage.setItem('gozo_admin_token', data.token);
await AsyncStorage.setItem('gozo_admin_logged_in', 'true');

// On app startup (App.tsx) — check if already logged in:
const loggedIn = await AsyncStorage.getItem('gozo_admin_logged_in');
const token    = await AsyncStorage.getItem('gozo_admin_token');
if (loggedIn === 'true' && token) {
  setIsLoggedIn(true);  // skip login screen
}

// On logout (SettingsScreen.tsx):
await AsyncStorage.removeItem('gozo_admin_token');
await AsyncStorage.removeItem('gozo_admin_logged_in');
```

Two keys are stored:
- `gozo_admin_logged_in` — string `'true'` to flag an active session
- `gozo_admin_token` — the auth token sent with every API request as `x-admin-token` header

---

## 2.7 `fetch` API (built-in)

**What it is:**  
`fetch` is a built-in JavaScript/browser API for making HTTP requests. It returns Promises and supports JSON natively. It is available in React Native without installing any extra package.

**Why used:**  
No external HTTP library (like Axios) is needed. `fetch` is sufficient for this app's straightforward REST API calls.

**How used in the Admin App (`src/api.ts`):**

All API functions follow the same pattern:
```typescript
// Helper to build auth headers (reads token from AsyncStorage)
const getHeaders = async () => {
  const token = await AsyncStorage.getItem('gozo_admin_token');
  return {
    'Content-Type': 'application/json',
    'x-admin-token': token || '',
  };
};

// Example GET request — fetch rides with optional filters
export const fetchRides = async (status?: string, date?: string) => {
  const headers = await getHeaders();
  let url = `${API_BASE_URL}/admin/rides`;
  const params = new URLSearchParams();
  if (status && status !== 'All') params.append('status', status.toLowerCase());
  if (date) params.append('date', date);
  if (params.toString()) url += `?${params.toString()}`;

  const response = await fetch(url, { headers });
  const data = await response.json();
  return { success: data.success, rides: data.rides ?? [] };
};

// Example POST request — record a driver payment
const response = await fetch(`${API_BASE_URL}/admin/drivers/${driverId}/payments`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ amount, notes }),
});
```

---

## 2.8 `@react-native-community/datetimepicker`

**What it is:**  
A native date/time picker component for React Native that uses the operating system's built-in date picker UI (Android calendar picker on Android, iOS spinner on iOS).

**Why used:**  
The Rides and Scheduled Rides screens allow filtering by date. A native date picker gives a familiar, polished UI without building a custom calendar.

**How used** (`src/components/DatePickerButton.tsx`):  
A `DatePickerButton` component wraps the `DateTimePicker`. Tapping the button opens the OS date picker. The selected date is passed up via an `onChange` callback to the parent screen (`RidesScreen`, `ScheduledRidesScreen`), which then appends it as a query parameter in the API call (e.g., `?date=2026-07-18`).

---

## 2.9 `react-native-safe-area-context` and `react-native-screens`

**`react-native-safe-area-context`:**  
Provides the `SafeAreaProvider` and `SafeAreaView` components that automatically add padding to avoid content being hidden behind the phone's notch, status bar, or bottom navigation gestures.  
Used in `App.tsx`: `<SafeAreaProvider>` wraps the entire app. Every screen uses `<SafeAreaView>` as its root container.

**`react-native-screens`:**  
A performance optimisation for React Navigation. Instead of keeping all screens in memory as React components, `react-native-screens` uses native OS screen containers, reducing memory usage and improving animation smoothness. It is a peer dependency required by `@react-navigation/native-stack`.

---

*Next: Section 3 — Project Structure*

---

# Section 3: Project Structure

## 3.1 Folder and File Structure

```
GoZoAdminApp/
│
├── android/                    — Android native project (Gradle, AndroidManifest, FCM config)
├── ios/                        — iOS native project (not used; app targets Android only)
│
├── src/                        — All application source code lives here
│   ├── screens/                — One file per full screen in the app
│   │   ├── LoginScreen.tsx         — Admin login screen (password entry)
│   │   ├── RidesScreen.tsx         — List of all quick-booking rides with filters
│   │   ├── RideDetailScreen.tsx    — Full detail view for a single ride
│   │   ├── ScheduledRidesScreen.tsx    — List of all scheduled rides with filters
│   │   ├── ScheduledRideDetailScreen.tsx — Full detail + driver assignment for a scheduled ride
│   │   ├── DriversScreen.tsx       — List of all drivers with online/offline status
│   │   ├── DriverDetailScreen.tsx  — Driver profile, KYC, earnings, debt, payment logging
│   │   └── SettingsScreen.tsx      — Logout, test notification, delete all rides
│   │
│   ├── components/             — Reusable UI pieces shared across multiple screens
│   │   ├── FilterChips.tsx         — Horizontal scrollable filter chips (e.g. All/Pending/Completed)
│   │   ├── DatePickerButton.tsx    — OS-native date picker button for date filtering
│   │   ├── RideCard.tsx            — Card showing a single ride summary in a list
│   │   ├── ScheduledRideCard.tsx   — Card showing a single scheduled ride summary in a list
│   │   ├── DriverCard.tsx          — Card showing a driver name, vehicle, and status badge
│   │   ├── StatusBadge.tsx         — Coloured badge that displays a ride/driver status label
│   │   └── StatusTimeline.tsx      — Visual vertical timeline of ride status progression
│   │
│   ├── navigation/             — Navigation setup and references
│   │   ├── AppNavigator.tsx        — Defines the Bottom Tab + nested Stack navigators
│   │   └── navigationRef.ts        — Global navigation reference for notification deep linking
│   │
│   ├── api.ts                  — All API functions + TypeScript interfaces for data models
│   ├── config.ts               — API base URL and admin password constants
│   └── theme.ts                — App-wide colour palette, spacing, and border radius values
│
├── App.tsx                     — Root component; handles auth state, FCM setup, notification routing
├── index.js                    — Android/iOS entry point; registers the App component
├── app.json                    — App name: "GoZoAdmin"
├── package.json                — All npm dependencies and scripts
├── tsconfig.json               — TypeScript compiler configuration
├── babel.config.js             — Babel transpiler config (uses @react-native/babel-preset)
├── metro.config.js             — Metro bundler configuration
├── jest.config.js              — Jest test runner configuration
├── .eslintrc.js                — ESLint rules (extends @react-native community config)
└── .prettierrc.js              — Prettier code formatting rules
```

---

## 3.2 Screen Files — Detail

### `LoginScreen.tsx`
- **Path:** `src/screens/LoginScreen.tsx`
- **What it shows:** A full-screen login page with the GoZo logo, a password input field, show/hide toggle, and a Login button.
- **Data displayed:** No data fetched — purely a form UI.
- **User actions:**
  - Type password into the `TextInput`
  - Toggle password visibility (Show/Hide)
  - Tap **Login** → calls `loginAdmin(password)` from `api.ts` → on success, calls `onLoginSuccess()` prop which sets `isLoggedIn = true` in `App.tsx` → `AppNavigator` mounts
  - On wrong password: backend returns `{ success: false }` → error message shown in red

---

### `RidesScreen.tsx`
- **Path:** `src/screens/RidesScreen.tsx`
- **What it shows:** A scrollable list of all quick-booking ride requests, newest first.
- **Data displayed:** For each ride — booking ID, date/time, status badge, pickup address, drop address, goods type, weight, and estimated freight (₹).
- **Filter options:** `All | Pending | Matched | Picked_Up | Completed | Cancelled`
- **User actions:**
  - Select a status filter chip → re-fetches rides from backend with that status
  - Pick a date from the `DatePickerButton` → re-fetches for that date only
  - Pull down to refresh the list
  - Tap a ride card → navigates to `RideDetailScreen` passing `{ requestId: item.id }`
- **Auto-refresh:** Uses `navigation.addListener('focus', ...)` to reload whenever the tab is tapped.

---

### `RideDetailScreen.tsx`
- **Path:** `src/screens/RideDetailScreen.tsx`
- **What it shows:** Full details of one ride in cards — booking ID, status, pickup/drop route, goods type, weight, price, customer info, driver info, and a status timeline.
- **Data displayed:** Calls `fetchRideDetail(requestId)` on mount.
- **User actions:**
  - Tap **‹ Back** → returns to rides list
  - Tap **Call** next to customer or driver → opens the phone dialler via `Linking.openURL('tel:...')`
  - Tap **Delete Ride** → confirmation `Alert` → calls `deleteRide(requestId)` → navigates back on success

---

### `ScheduledRidesScreen.tsx`
- **Path:** `src/screens/ScheduledRidesScreen.tsx`
- **What it shows:** A scrollable list of pre-scheduled ride requests.
- **Data displayed:** For each scheduled ride — booking ID, scheduled time, status badge, pickup/drop locations, goods description, customer name.
- **Filter options:** `All | Pending | Assigned | Completed | Cancelled`
- **User actions:** Same filter/date/refresh/tap pattern as `RidesScreen`.

---

### `ScheduledRideDetailScreen.tsx`
- **Path:** `src/screens/ScheduledRideDetailScreen.tsx`
- **What it shows:** Full detail of one scheduled ride. Uniquely, if the ride status is `pending`, it shows a driver assignment panel with a list of all currently `available` drivers to select and assign.
- **User actions:**
  - Tap a driver from the list → selects them (highlighted with green border)
  - Tap **Assign Transporter** → calls `assignDriverToScheduledRide(rideId, driverId)` → backend updates DB, notifies driver via FCM → screen reloads
  - Tap **Call** for customer or driver
  - Tap **Delete Ride** → confirmation → `deleteScheduledRide(rideId)`

---

### `DriversScreen.tsx`
- **Path:** `src/screens/DriversScreen.tsx`
- **What it shows:** A list of all registered drivers with their name, vehicle number, phone, and current status (available / in_ride / offline).
- **Filter options:** `All | Online | Offline`  
  (Online = `available` or `in_ride`; Offline = `offline`)
- **Search:** A text search bar at the top filters by driver name, phone, or vehicle number — **client-side filtering** (no extra API call).
- **User actions:**
  - Type in search bar → instantly filters the displayed list
  - Select filter chip → filters by online/offline status
  - Pull to refresh → re-fetches all drivers
  - Tap driver card → navigates to `DriverDetailScreen` passing the full driver object as a param

---

### `DriverDetailScreen.tsx`
- **Path:** `src/screens/DriverDetailScreen.tsx`
- **What it shows:** Two-tab view for a single driver:
  - **Profile tab:** Basic info, KYC documents (Aadhaar, PAN, DL), vehicle details, bank details. All fields are editable inline.
  - **Earnings tab:** Financial summary (Driver Earned / GoZo Commission / Total Paid / Outstanding Debt), payment history, and completed trip history.
- **User actions:**
  - Switch between Profile and Earnings tabs
  - Tap **Edit Profile** → all fields become `TextInput` for inline editing → **Save** → calls `updateDriverProfile(driverId, fields)` → backend updates Supabase
  - Tap **Call Driver** → opens phone dialler
  - Tap **+ Record Payment** → modal opens → enter amount and notes → **Record** → calls `recordDriverPayment(driverId, amount, notes)` → earnings reload
  - Tap **Retry** if earnings fetch failed

---

### `SettingsScreen.tsx`
- **Path:** `src/screens/SettingsScreen.tsx`
- **What it shows:** Admin identity card, FCM diagnostic tools, app info, danger zone, and logout.
- **User actions:**
  - Tap **Test Push Notification** → calls `triggerTestNotification()` → backend fires an FCM message back to this device
  - Tap **Delete All Rides** → double confirmation `Alert` → calls `clearAllRides()` → all ride data deleted from Supabase
  - Tap **Logout** → confirmation → `AsyncStorage.removeItem` for both keys → `onLogout()` → `LoginScreen` appears

---

## 3.3 Component Files — Detail

| File | Purpose |
|---|---|
| `FilterChips.tsx` | Horizontal scrolling row of pill-shaped buttons. Active chip has green background; inactive is dark. Accepts `options[]`, `selected`, and `onSelect` props. |
| `DatePickerButton.tsx` | A button that shows the selected date label (`All Dates`, `Today`, `Yesterday`, or a formatted date). On press, opens the OS native `DateTimePicker`. Has a `✕ Clear` button to reset. |
| `RideCard.tsx` | Touchable card showing ride ID, time, status badge, pickup/drop route (with green/red dots and a line), goods type, weight, price, and assigned driver name if present. |
| `ScheduledRideCard.tsx` | Similar to `RideCard` but for scheduled rides — shows scheduled time instead of created time, goods description instead of weight/price. |
| `DriverCard.tsx` | Simple card with driver name, vehicle number, phone, and a `StatusBadge` for their current status. |
| `StatusBadge.tsx` | A small coloured badge that maps raw status strings to human-readable labels and theme colours. E.g. `'matched'` → `'Assigned'` in blue; `'completed'` → `'Delivered'` in green. |
| `StatusTimeline.tsx` | A vertical timeline showing the progression of ride statuses. Completed steps show the timestamp in green; future steps show "Pending" in grey. |

---

## 3.4 Navigation Structure

The exact navigation tree as defined in `src/navigation/AppNavigator.tsx`:

```
NavigationContainer  (ref={navigationRef} — allows programmatic navigation from notifications)
│
└── Bottom Tab Navigator  (4 tabs, emoji icons, COLORS.primary active tint)
    │
    ├── Tab: "Rides"  🚗
    │   └── Stack Navigator (headerShown: false)
    │       ├── Screen: "RidesHome"   → RidesScreen.tsx
    │       └── Screen: "RideDetail"  → RideDetailScreen.tsx
    │
    ├── Tab: "Scheduled"  📅
    │   └── Stack Navigator (headerShown: false)
    │       ├── Screen: "ScheduledHome"       → ScheduledRidesScreen.tsx
    │       └── Screen: "ScheduledRideDetail" → ScheduledRideDetailScreen.tsx
    │
    ├── Tab: "Drivers"  👤
    │   └── Stack Navigator (headerShown: false)
    │       ├── Screen: "DriversHome"  → DriversScreen.tsx
    │       └── Screen: "DriverDetail" → DriverDetailScreen.tsx
    │
    └── Tab: "Settings"  ⚙️
        └── Stack Navigator (headerShown: false)
            └── Screen: "SettingsHome" → SettingsScreen.tsx
                                         (receives onLogout prop injected here)
```

**Navigation from a push notification tap:**
```
Notification tapped  →  handleNotificationTap(data)  →  navigate('Rides', {
                                                           screen: 'RideDetail',
                                                           params: { requestId }
                                                         })
```
This uses `navigationRef.navigate()` (from `navigationRef.ts`) which works outside of any React component.

---

## 3.5 Constants and Configuration

All app-wide constants are defined in **`src/config.ts`**:

```typescript
// src/config.ts
export const API_BASE_URL = 'https://fcm-backend-lj2h.onrender.com';
export const ADMIN_PASSWORD = 'GoZo_2026';
export const ADMIN_TOKEN = 'admin-jwt-token-placeholder';
```

> **Note:** `ADMIN_PASSWORD` is defined here but the actual validation happens on the **backend**, not in the app. The app sends the entered PIN to `POST /admin/auth`; the backend checks it and returns a token. The constant in `config.ts` appears to be a reference/placeholder only.

**Theme constants** — defined in **`src/theme.ts`**:

```typescript
export const COLORS = {
  primary: '#10B981',      // GoZo Green
  background: '#0F172A',   // Dark Slate (dark mode)
  card: '#1E293B',
  border: '#334155',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  white: '#FFFFFF',
  // Status colours
  pending: '#F59E0B',      // Amber
  assigned: '#3B82F6',     // Blue
  pickedUp: '#8B5CF6',     // Purple
  completed: '#10B981',    // Green
  cancelled: '#EF4444',    // Red
  offline: '#64748B',      // Slate grey
};

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const BORDER_RADIUS = { sm: 4, md: 8, lg: 12, xl: 20, round: 9999 };
```

**AsyncStorage keys** (session persistence):
- `'gozo_admin_logged_in'` → `'true'` when logged in
- `'gozo_admin_token'` → JWT token string from backend

---

*Next: Section 4 — Authentication Flow*

---

# Section 4: Authentication Flow

## 4.1 How Login Works — Step by Step

### App Startup Decision

Every time the app opens, `App.tsx` runs **before** showing any screen. It checks whether the admin is already logged in by reading two keys from AsyncStorage:

```tsx
// App.tsx — useEffect runs once on mount ([] dependency = runs only once)
useEffect(() => {
  const checkLoginState = async () => {
    try {
      const loggedIn = await AsyncStorage.getItem('gozo_admin_logged_in'); // 'true' or null
      const token    = await AsyncStorage.getItem('gozo_admin_token');      // JWT string or null

      if (loggedIn === 'true' && token) {
        setIsLoggedIn(true);   // BOTH keys exist → skip login screen
      } else {
        setIsLoggedIn(false);  // Missing either key → show login screen
      }
    } catch (e) {
      setIsLoggedIn(false);    // Storage read error → show login screen (safe default)
    }
  };
  checkLoginState();
}, []);
```

While this check runs, `isLoggedIn` is `null` (its initial state). The app renders a **loading spinner** during this time:

```tsx
if (isLoggedIn === null) {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}
```

Once the check completes, the app renders either:
- `<LoginScreen onLoginSuccess={() => setIsLoggedIn(true)} />` — if not logged in
- `<AppNavigator onLogout={() => setIsLoggedIn(false)} />` — if already logged in

---

### The Login Form — `LoginScreen.tsx` Walkthrough

**State variables in the login screen:**
```tsx
const [password, setPassword]       = useState('');         // what user typed
const [showPassword, setShowPassword] = useState(false);    // show/hide toggle
const [loading, setLoading]         = useState(false);      // button spinner
const [error, setError]             = useState<string | null>(null); // error message
```

**The `handleLogin` function — complete annotated walkthrough:**

```tsx
const handleLogin = async () => {
  // Step 1: Guard — do nothing if input is empty
  if (!password.trim()) {
    setError('Please enter the password');
    return;
  }

  // Step 2: Clear any previous error, show spinner on button
  setError(null);
  setLoading(true);

  try {
    // Step 3: Call the backend auth endpoint (POST /admin/auth)
    // loginAdmin sends the password as { pin: password } in the request body
    const res = await loginAdmin(password.trim());

    if (res.success) {
      // Step 4a: Backend returned a token → login succeeded
      // At this point, loginAdmin() has already saved the token to AsyncStorage
      // Now call the prop that tells App.tsx to switch to AppNavigator
      onLoginSuccess();
    } else {
      // Step 4b: Backend rejected the password
      setError(res.error || 'Incorrect password');
    }
  } catch (err: any) {
    // Step 5: Network error (backend unreachable, no internet)
    setError(err.message || 'An unexpected error occurred');
  } finally {
    // Step 6: Always hide the spinner, whether success or failure
    setLoading(false);
  }
};
```

**The `loginAdmin` API function — `src/api.ts`:**

```typescript
export const loginAdmin = async (password: string) => {
  try {
    // POST to the backend with the PIN
    const response = await fetch(`${API_BASE_URL}/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: password }),
    });

    const data = await response.json();

    if (data.success && data.token) {
      // Backend validated the PIN and returned a token
      // Save BOTH values to AsyncStorage for session persistence
      await AsyncStorage.setItem('gozo_admin_token', data.token);
      await AsyncStorage.setItem('gozo_admin_logged_in', 'true');
      return { success: true, token: data.token };
    }

    // Backend said authentication failed
    return { success: false, error: data.error || 'Authentication failed' };

  } catch (error: any) {
    // fetch() threw — network issue, server down, etc.
    return { success: false, error: error.message };
  }
};
```

**Key insight:** The actual password validation happens **on the backend**, not in the app code. The app only sends what the user typed; the backend compares it to its own stored secret and issues a token. The app never "knows" what the correct password is at runtime.

---

### What the UI Looks Like During Login

| State | What the user sees |
|---|---|
| Fresh / logged out | GoZo logo, "Admin Control Panel", password field, Login button |
| Typing password | Text is hidden (`secureTextEntry`), "Show" button to reveal |
| Tapped Login, waiting | Login button shows `ActivityIndicator` spinner, button is disabled |
| Wrong password | Red error text appears below input: `"Incorrect password"` |
| Correct password | `AppNavigator` mounts, bottom tab bar appears instantly |

---

## 4.2 Session Persistence

**What is stored in AsyncStorage after login:**

| AsyncStorage Key | Value stored | Purpose |
|---|---|---|
| `'gozo_admin_logged_in'` | String `'true'` | Flag checked on app startup to decide which screen to show |
| `'gozo_admin_token'` | JWT token string from backend | Sent as `x-admin-token` header in every subsequent API request |

**Why two keys instead of one?**  
Having a separate boolean flag (`gozo_admin_logged_in`) makes the startup check explicit and readable. Even if the token were somehow empty or corrupted, the app requires **both** keys to be valid before skipping the login screen.

**How the token is used in API calls:**

```typescript
// src/api.ts — getHeaders() is called before every fetch request
const getHeaders = async () => {
  const token = await AsyncStorage.getItem('gozo_admin_token');
  return {
    'Content-Type': 'application/json',
    'x-admin-token': token || '',   // empty string if no token (backend will reject)
  };
};
```

Every API call that requires authentication uses `getHeaders()` first:
```typescript
const headers = await getHeaders();
const response = await fetch(`${API_BASE_URL}/admin/rides`, { headers });
```

The backend middleware validates the `x-admin-token` header and rejects requests where it is missing or invalid.

---

## 4.3 Logout Flow

Logout is handled in `SettingsScreen.tsx`. The `handleLogout` function:

```tsx
const handleLogout = () => {
  // Step 1: Show a confirmation dialog — prevents accidental logout
  Alert.alert('Logout', 'Are you sure you want to log out from the Admin App?', [
    { text: 'Cancel', style: 'cancel' },   // do nothing
    {
      text: 'Logout',
      style: 'destructive',                // shows in red on iOS
      onPress: async () => {
        try {
          // Step 2: Delete both session keys from AsyncStorage
          await AsyncStorage.removeItem('gozo_admin_token');
          await AsyncStorage.removeItem('gozo_admin_logged_in');

          // Step 3: Call the onLogout prop (passed down from App.tsx via AppNavigator)
          // This sets isLoggedIn = false in App.tsx
          onLogout();

          // Step 4: App.tsx re-renders and shows <LoginScreen> again
          // The AppNavigator (and all screens) are unmounted automatically
        } catch (e) {
          Alert.alert('Error', 'Failed to log out');
        }
      },
    },
  ]);
};
```

**The `onLogout` prop chain:**

```
SettingsScreen.handleLogout()
  → calls onLogout() prop
    → defined in AppNavigator as: onLogout={() => setIsLoggedIn(false)}
      → App.tsx state changes: isLoggedIn = false
        → React re-renders → <LoginScreen> appears
```

After logout, both AsyncStorage keys are gone. The next time the app starts, `checkLoginState()` finds `null` for both keys and shows the login screen again.

---

## 4.4 Security Considerations

### Why This Approach Is Acceptable for Phase 1

The Admin App is:
1. **Used by 3 people internally** — not a public-facing product
2. **Distributed via APK** — not on the Play Store; sent directly to known staff phones
3. **A monitoring tool** — it reads data but doesn't expose user banking or payment credentials
4. **An MVP / Phase 1 build** — security hardening is planned for Phase 2

For these constraints, a simple PIN-based login that issues a server-side token is a reasonable starting point.

### Security Risks of the Current Approach

| Risk | Explanation |
|---|---|
| **Hardcoded constant in config.ts** | `ADMIN_PASSWORD = 'GoZo_2026'` is visible in the source code. Anyone who gets access to the repository or decompiles the APK can find this. |
| **No token expiry** | The `gozo_admin_token` stored in AsyncStorage has no expiry. A stolen device means permanent access until the token is manually revoked on the server. |
| **Single shared credential** | All 3 staff use the same PIN. There is no audit trail showing which staff member performed an action. |
| **AsyncStorage is not encrypted** | On a rooted Android device, AsyncStorage data can be read directly from the device file system. |
| **No brute-force protection** | There is no rate limiting on `POST /admin/auth` in Phase 1. |

### What a Production-Grade Approach Would Look Like

1. **Individual accounts:** Each staff member has their own username/email and password stored (hashed with bcrypt) in the database.
2. **JWT with expiry:** The server issues a JWT with a short expiry (e.g., 24 hours). The app stores it in AsyncStorage but must re-authenticate when it expires.
3. **Refresh tokens:** A long-lived refresh token allows silent re-authentication without prompting the user every day.
4. **Encrypted storage:** Use `react-native-keychain` or `react-native-encrypted-storage` instead of plain AsyncStorage for sensitive tokens.
5. **Rate limiting on backend:** After 5 failed login attempts, lock the account or add a cooldown period.
6. **Audit logs:** Every admin action (payment recorded, ride deleted) is logged with the staff member's user ID and timestamp.

---

*Next: Section 5 — Core Features Code Walkthrough*

---

# Section 5: Core Features — Code Walkthrough

## 5.1 Rides List (`RidesScreen.tsx`)

### Code Flow — From Screen Load to Data Displayed

```
Component mounts
    │
    ▼
useEffect fires (dependency: [navigation, selectedFilter, selectedDate])
    │
    ▼
navigation.addListener('focus', ...) registers a listener
    │
    ▼  (immediately fires because screen is focused)
loadRides() called
    │
    ▼
fetchRides(queryFilter, dateStr)  — src/api.ts
    │   Builds URL: GET /admin/rides?status=pending&date=2026-07-18
    ▼
fetch() sends HTTP GET to backend
    │
    ▼
Response: { success: true, rides: [...] }
    │
    ▼
setRides(res.rides)   — state update triggers re-render
    │
    ▼
FlatList renders each ride as a <RideCard>
```

### The `fetchRides` Function — Line by Line (`src/api.ts`)

```typescript
export const fetchRides = async (
  status?: string,    // optional — e.g. 'pending', 'completed'
  date?: string       // optional — e.g. '2026-07-18'
): Promise<{ success: boolean; rides: Ride[]; error?: string }> => {
  try {
    const headers = await getHeaders();       // reads token from AsyncStorage

    let url = `${API_BASE_URL}/admin/rides`;  // base URL

    const params = new URLSearchParams();     // builds query string cleanly

    // Only add status param if a specific status is selected (not 'All')
    if (status && status !== 'All') params.append('status', status.toLowerCase());

    // Only add date param if user picked a specific date
    if (date) params.append('date', date);

    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    // Result examples:
    //   /admin/rides                         (All + no date)
    //   /admin/rides?status=pending          (filter by status)
    //   /admin/rides?date=2026-07-18         (filter by date)
    //   /admin/rides?status=completed&date=2026-07-18  (both filters)

    const response = await fetch(url, { headers });
    const data = await response.json();

    return {
      success: data.success,
      rides: data.rides ?? [],   // ?? [] = fallback to empty array if null/undefined
      error: data.error,
    };
  } catch (error: any) {
    // Network error, backend down, JSON parse error, etc.
    return { success: false, rides: [], error: error.message };
  }
};
```

### The Filter System

**State variables in `RidesScreen.tsx`:**
```tsx
const [selectedFilter, setSelectedFilter] = useState('All');       // status chip
const [selectedDate, setSelectedDate] = useState<Date | null>(null); // date picker
```

**Filter options array:**
```tsx
const FILTER_OPTIONS = ['All', 'Pending', 'Matched', 'Picked_Up', 'Completed', 'Cancelled'];
```

**How filters are passed to the API:**
```tsx
const loadRides = async (showRefresher = false) => {
  const dateStr = getFormattedDateString(selectedDate); // Date → 'YYYY-MM-DD' string or undefined

  // 'Matched' maps to 'matched' in backend — rest are lowercased directly
  const queryFilter = selectedFilter === 'Matched' ? 'matched' : selectedFilter;

  const res = await fetchRides(queryFilter, dateStr);
  // ...
};
```

**Date formatting helper:**
```tsx
const getFormattedDateString = (d: Date | null) => {
  if (!d) return undefined;
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0'); // padStart ensures 2 digits
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;   // e.g. '2026-07-18'
};
```

**Re-fetch trigger:** A `useEffect` with `[navigation, selectedFilter, selectedDate]` as dependencies means the data reloads automatically whenever any filter changes OR whenever the screen comes into focus (tab is tapped).

### Status Badge Colours (from `StatusBadge.tsx` + `theme.ts`)

| Status value from API | Label shown | Colour |
|---|---|---|
| `'pending'` or `'searching'` | `Searching` | `#F59E0B` Amber |
| `'matched'` or `'assigned'` or `'on_the_way'` or `'arrived'` | `Assigned` / status text | `#3B82F6` Blue |
| `'picked_up'` or `'picked up'` | `Picked Up` | `#8B5CF6` Purple |
| `'completed'` or `'delivered'` | `Delivered` | `#10B981` Green |
| `'cancelled'` | `Cancelled` | `#EF4444` Red |
| `'available'` | `Available` | `#10B981` Green |
| `'in_ride'` | `In Ride` | `#3B82F6` Blue |
| `'offline'` | `Offline` | `#64748B` Slate grey |

The badge background is the colour at 15% opacity (`color + '15'`) with a 1px solid border in the full colour, giving a translucent-pill look.

### Pull-to-Refresh

React Native's `FlatList` has a built-in `onRefresh` + `refreshing` prop pair:

```tsx
<FlatList
  data={rides}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => (
    <RideCard
      ride={item}
      onPress={() => navigation.navigate('RideDetail', { requestId: item.id })}
    />
  )}
  onRefresh={() => loadRides(true)}   // called when user pulls down
  refreshing={refreshing}             // shows the native spinner while true
/>
```

When `loadRides(true)` is called with `showRefresher = true`:
```tsx
const loadRides = async (showRefresher = false) => {
  if (showRefresher) {
    setRefreshing(true);   // shows the native pull-to-refresh spinner
  } else {
    setLoading(true);      // shows the full-screen ActivityIndicator on first load
  }
  // ...fetch...
  setRefreshing(false);    // hides the spinner when done
};
```

---

## 5.2 Ride Detail (`RideDetailScreen.tsx`)

### How Ride Data Is Received

The `RidesScreen` navigates to `RideDetailScreen` by passing only the `requestId`:
```tsx
navigation.navigate('RideDetail', { requestId: item.id })
```

`RideDetailScreen` then makes a **fresh API call** on mount — it does not rely on the data already in the list. This ensures the detail view always has the most up-to-date information:

```tsx
const { requestId } = route.params;   // extract ID from navigation params

useEffect(() => {
  loadDetail();        // fresh fetch on every mount
}, [requestId]);

const loadDetail = async () => {
  setLoading(true);
  const res = await fetchRideDetail(requestId);  // GET /admin/rides/:requestId
  if (res.success) setRide(res.ride);
  else setError(res.error || 'Failed to load details');
  setLoading(false);
};
```

### All Fields Displayed on the Ride Detail Screen

| Section | Fields |
|---|---|
| Header card | Booking ID (full UUID uppercased), Status badge |
| Route Details | Pickup address (green dot), Drop address (red dot), connected by a vertical line |
| Shipment Details | Goods type (with `_dist_` suffix stripped), Weight (kg), Price/freight (₹) |
| Customer Info | Name, factory name, phone number, **Call** button |
| Driver Info | Name, vehicle number, phone number, **Call** button (only shown if driver assigned) |
| Status Timeline | Visual step-by-step timeline component |
| Footer | **Delete Ride** button in red |

**Goods type cleaning:** The backend appends a distance suffix to the goods type string (e.g. `Furniture_dist_12km`). The screen strips it before display:
```tsx
const cleanGoodsType = (ride.goods_type || '').split('_dist_')[0];
// 'Furniture_dist_12km' → 'Furniture'
```

### Status Timeline Implementation (`StatusTimeline.tsx`)

The timeline receives an array of steps from the backend:
```typescript
timeline?: Array<{
  status: string;   // e.g. 'Booked', 'Driver Assigned', 'Picked Up', 'Delivered'
  active: boolean;  // true = this step has been reached
  time: string;     // timestamp string if active, empty if not yet reached
}>
```

Each step renders as a circle node + a connecting line:
```tsx
// The node (circle) is filled green if active, hollow grey if pending
<View style={[styles.node, step.active ? styles.nodeActive : styles.nodeInactive]} />

// The connecting line between steps is green if both current AND next step are active
const lineActive = step.active && nextActive;
<View style={[styles.line, lineActive ? styles.lineActive : styles.lineInactive]} />

// The timestamp or "Pending" label
{step.active && step.time ? (
  <Text style={styles.stepTime}>{step.time}</Text>
) : (
  <Text style={styles.stepPending}>Pending</Text>
)}
```

### Driver Info Conditional Rendering

```tsx
{/* Only render the Driver Info card if a driver is assigned */}
{ride.driver && (
  <View style={styles.detailsCard}>
    <Text style={styles.sectionTitle}>Driver Info</Text>
    <Text>{ride.driver.name}</Text>
    <Text>Vehicle: {ride.driver.vehicle_number}</Text>
    <Text>{ride.driver.phone}</Text>
    <TouchableOpacity onPress={() => handleCall(ride.driver?.phone)}>
      <Text>Call</Text>
    </TouchableOpacity>
  </View>
)}
// If ride.driver is null/undefined → this entire card is not rendered
```

The `handleCall` function uses React Native's `Linking` module:
```tsx
const handleCall = (phone?: string) => {
  if (phone) {
    Linking.openURL(`tel:${phone}`);  // opens the system phone dialler
  }
};
```

---

## 5.3 Scheduled Rides List (`ScheduledRidesScreen.tsx`)

### How It Differs from the Normal Rides List

| Feature | RidesScreen | ScheduledRidesScreen |
|---|---|---|
| API endpoint | `GET /admin/rides` | `GET /admin/scheduled-rides` |
| Card component | `RideCard` | `ScheduledRideCard` |
| Filter options | All, Pending, Matched, Picked_Up, Completed, Cancelled | All, Pending, Assigned, Completed, Cancelled |
| Price shown | Yes (₹ freight) | No |
| Scheduled time shown | No (created_at) | Yes (scheduled_time) |
| Driver assignment | Not done here | Done in ScheduledRideDetailScreen |
| Unassigned badge | Not shown | `UNASSIGNED` amber badge shown on each unassigned card |

### What Each Scheduled Ride Card Shows (`ScheduledRideCard.tsx`)

Each card displays:
- **Booking ID** (first 8 characters of UUID, uppercased)
- **Scheduled time** — formatted as `"Sched: 18 Jul 2026 at 02:30 PM"`
- **Status badge** — same coloured badge system as normal rides
- **Route** — pickup location (green dot) and drop location (red dot) with connecting line
- **Goods / Details** — the `goods_description` text from the booking
- **Driver name** (green text) if assigned — OR — an `UNASSIGNED` amber badge if no driver yet

```tsx
{ride.driver ? (
  <View style={styles.driverCol}>
    <Text style={styles.label}>DRIVER</Text>
    <Text style={styles.driverName}>{ride.driver.name}</Text>
  </View>
) : (
  <View style={styles.unassignedBadge}>
    <Text style={styles.unassignedText}>UNASSIGNED</Text>  {/* amber badge */}
  </View>
)}
```

> **Note:** The current codebase does **not** implement a live countdown timer or an URGENT badge in the card components. The scheduled time is displayed as a static formatted string. A countdown timer or urgency indicator would be a Phase 2 enhancement.

### Load Trigger

Identical pattern to `RidesScreen` — `useEffect` with `[selectedFilter, selectedDate, navigation]` dependencies, plus a `navigation.addListener('focus')` listener for auto-refresh on tab focus:

```tsx
useEffect(() => {
  loadScheduledRides();  // immediate load

  const unsubscribe = navigation.addListener('focus', () => {
    loadScheduledRides();  // reload when tab is tapped
  });
  return unsubscribe;   // cleanup listener on unmount
}, [selectedFilter, selectedDate, navigation]);
```

---

## 5.4 Scheduled Ride Detail (`ScheduledRideDetailScreen.tsx`)

### All Fields Displayed

| Section | Fields |
|---|---|
| Header card | Booking ID, Status badge, Scheduled time (formatted: `"18 Jul 2026 at 02:30 PM"`) |
| Route Details | Pickup location (green dot), Drop location (red dot) |
| Details | Goods description / requirements text |
| Customer Info | Name, factory name, phone, **Call** button |
| Assigned Driver | Name, vehicle number, phone, **Call** button *(shown only if driver assigned)* |
| Assigned Company | Name, location, phone, **Call** button *(shown if company assigned instead of driver)* |
| Driver Assignment Panel | List of available drivers with radio selection + **Assign** button *(shown only if status = `'pending'` and no driver assigned)* |
| Footer | **Delete Ride** button in red |

### Scheduled Time Formatting

```tsx
const scheduledTimeFormatted = ride.scheduled_time
  ? `${new Date(ride.scheduled_time).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    })} at ${new Date(ride.scheduled_time).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit',
    })}`
  : '';
// Result: "18 Jul 2026 at 02:30 PM"
```

> The screen shows the scheduled time as a **static formatted string** — there is no live countdown timer in the current implementation.

### Driver Assignment Flow — Step by Step

```
ScheduledRideDetailScreen mounts
    │
    ▼
loadDetail() → fetchScheduledRideDetail(rideId)
    │
    ├── If ride.status === 'pending':
    │     → fetchDriversWithStatus()   (GET /admin/drivers/status)
    │     → filter: only drivers where status === 'available'
    │     → setAvailableDrivers(available)
    │
    └── Renders driver selection list

Admin taps a driver in the list
    │
    ▼
setSelectedDriverId(driver.id)   — highlights the driver with green border

Admin taps "Assign Transporter"
    │
    ▼
handleAssign()
    │
    ▼
assignDriverToScheduledRide(rideId, selectedDriverId)
    │   PATCH /admin/scheduled-rides/:rideId/assign
    │   body: { driver_id: selectedDriverId }
    ▼
Backend updates ride in Supabase, sends FCM to assigned driver
    │
    ▼
Success → Alert('Driver assigned successfully') → loadDetail() reloads
    │
    ▼
Ride now has status 'assigned', driver card renders, assignment panel disappears
```

**Driver selection UI code:**
```tsx
{availableDrivers.map((driver) => {
  const isSelected = selectedDriverId === driver.id;
  return (
    <TouchableOpacity
      key={driver.id}
      style={[
        styles.driverSelectItem,
        isSelected && styles.driverSelected,  // green border when selected
      ]}
      onPress={() => setSelectedDriverId(driver.id)}
    >
      <Text>{driver.name}</Text>
      <Text>{driver.vehicle_number} • {driver.phone}</Text>
      {/* Radio circle — filled green when selected */}
      <View style={[styles.radioCircle, isSelected && styles.radioSelected]} />
    </TouchableOpacity>
  );
})}
```

---

*Next: Section 6 — API Integration*

---

# Section 5b: Drivers and Earnings Features

## 5b.1 Drivers List (`DriversScreen.tsx`)

### How Driver Status Is Fetched and Displayed

On mount and every time the Drivers tab is focused, the screen calls `fetchDriversWithStatus()`:

```typescript
// src/api.ts
export const fetchDriversWithStatus = async ():
  Promise<{ success: boolean; drivers: Driver[]; error?: string }> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/admin/drivers/status`, { headers });
  const data = await response.json();
  return { success: data.success, drivers: data.drivers ?? [], error: data.error };
};
```

The backend returns every registered driver with their current `status` field — one of `'available'`, `'in_ride'`, or `'offline'`. The entire driver list is stored in state:

```tsx
const [drivers, setDrivers] = useState<Driver[]>([]);         // raw data from API
const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]); // after filter+search
```

### Client-Side Filtering and Search

Unlike rides (which are filtered on the backend via query params), driver filtering is done **entirely on the device** after the full list is fetched. This means only one API call is made regardless of how many filters are changed:

```tsx
useEffect(() => {
  let result = [...drivers];   // start with full list

  // 1. Text search — checks name, phone, and vehicle number
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    result = result.filter(
      (d) =>
        (d.name || '').toLowerCase().includes(query) ||
        (d.phone || '').includes(query) ||
        (d.vehicle_number || '').toLowerCase().includes(query)
    );
  }

  // 2. Status filter chip
  if (selectedFilter === 'Online') {
    // 'Online' means available OR currently in a ride
    result = result.filter((d) => d.status === 'available' || d.status === 'in_ride');
  } else if (selectedFilter === 'Offline') {
    result = result.filter((d) => d.status === 'offline' || !d.status);
  }
  // 'All' — no filtering, keep everything

  setFilteredDrivers(result);
}, [drivers, searchQuery, selectedFilter]);  // re-runs on every change
```

**Filter chip options:** `['All', 'Online', 'Offline']`

The `FlatList` renders `filteredDrivers` (not the raw `drivers` array), so the UI updates instantly as the user types or taps a chip — no loading state needed.

### Status Badge Rendering in DriverCard

Each `DriverCard` passes the driver's `status` string to `StatusBadge`:

```tsx
// DriverCard.tsx
<TouchableOpacity style={styles.card} onPress={onPress}>
  <View style={styles.left}>
    <Text style={styles.name}>{driver.name}</Text>
    <Text style={styles.details}>
      {driver.vehicle_number} • {driver.phone}
    </Text>
  </View>
  <StatusBadge status={driver.status} />  {/* 'available' | 'in_ride' | 'offline' */}
</TouchableOpacity>
```

`StatusBadge` maps the status to colour and label:
- `'available'` → label: `Available`, colour: `#10B981` (green)
- `'in_ride'` → label: `In Ride`, colour: `#3B82F6` (blue)
- `'offline'` → label: `Offline`, colour: `#64748B` (slate grey)

### Making Phone Numbers Tappable

In `DriverDetailScreen`, the **Call Driver** button uses React Native's `Linking` module:

```tsx
<TouchableOpacity
  style={s.callBtn}
  onPress={() => driver.phone && Linking.openURL(`tel:${driver.phone}`)}
>
  <Text style={s.callBtnText}>📞  Call Driver</Text>
</TouchableOpacity>
```

`Linking.openURL('tel:9876543210')` opens the phone's native dialler with the number pre-filled. The `driver.phone &&` guard prevents a crash if the phone field is empty.

---

## 5b.2 Driver Detail (`DriverDetailScreen.tsx`)

### Screen Structure — Two Tabs

`DriverDetailScreen` is split into two tabs, toggled by an `activeTab` state variable:

```tsx
type Tab = 'profile' | 'earnings';
const [activeTab, setActiveTab] = useState<Tab>('profile');
```

The tab bar is two `TouchableOpacity` buttons. The active tab has a 2px green bottom border:
```tsx
<View style={s.tabBar}>
  <TouchableOpacity
    style={[s.tab, activeTab === 'profile' && s.activeTab]}
    onPress={() => setActiveTab('profile')}
  >
    <Text>👤  Profile</Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={[s.tab, activeTab === 'earnings' && s.activeTab]}
    onPress={() => setActiveTab('earnings')}
  >
    <Text>💰  Earnings & Debt</Text>
  </TouchableOpacity>
</View>

{activeTab === 'profile' ? renderProfileTab() : renderEarningsTab()}
```

### Profile Tab — All Fields

The Profile tab shows four cards of information. All fields are editable when the Edit button is tapped:

| Card | Fields |
|---|---|
| BASIC INFO | Full Name, Phone, GoZo Phone, Status |
| KYC DOCUMENTS | Aadhaar Number, PAN Number, DL Number, DL Expiry, Permanent Address |
| VEHICLE DETAILS | Vehicle Number, Vehicle Type |
| BANK DETAILS | Account Number, IFSC Code, Account Name |

**Inline editing pattern:**  
A reusable `Field` component inside `renderProfileTab` renders either a static `Text` or a `TextInput` depending on the `editing` boolean state:

```tsx
const Field = ({ label, value, field }) => (
  <View style={s.fieldRow}>
    <Text style={s.fieldLabel}>{label}</Text>
    {editing && field ? (
      <TextInput
        style={s.fieldInput}
        value={(editFields as any)[field] ?? ''}
        onChangeText={(v) => setEditFields({ ...editFields, [field]: v })}
      />
    ) : (
      <Text style={[s.fieldValue, !value && s.fieldEmpty]}>
        {value || '—'}   {/* shows dash if field is empty */}
      </Text>
    )}
  </View>
);
```

When **Edit Profile** is tapped, `startEdit()` copies the current driver data into `editFields`:
```tsx
const startEdit = () => {
  setEditFields({
    name: driver.name,
    phone: driver.phone,
    vehicle_number: driver.vehicle_number,
    aadhaar_number: driver.aadhaar_number ?? '',
    // ... all other fields pre-populated
  });
  setEditing(true);
};
```

When **Save** is tapped:
```tsx
const saveEdit = async () => {
  setSaving(true);
  const res = await updateDriverProfile(driver.id, editFields);
  // PATCH /admin/api/drivers/:id  with body = editFields object
  if (res.success) {
    setDriver({ ...driver, ...editFields } as Driver); // update local state immediately
    setEditing(false);
    Alert.alert('Saved', 'Driver profile updated successfully.');
  }
  setSaving(false);
};
```

### Ride History

The Earnings tab shows completed trips fetched via `fetchDriverEarnings(driver.id)`. The trips array from this endpoint includes the driver's full ride history. There is no separate pagination call for ride history in the current implementation — all trips are returned in one response.

```typescript
// src/api.ts
export const fetchDriverRideHistory = async (
  driverId: string,
  limit = 10,
  offset = 0
): Promise<{ success: boolean; rides: Ride[]; error?: string }> => {
  const headers = await getHeaders();
  const response = await fetch(
    `${API_BASE_URL}/admin/drivers/${driverId}/rides?limit=${limit}&offset=${offset}`,
    { headers }
  );
  // ...
};
```

> **Note:** `fetchDriverRideHistory` with pagination parameters is defined in `api.ts` but is not currently used by `DriverDetailScreen`. The screen fetches trips via `fetchDriverEarnings` which returns them as part of the earnings summary response.

---

## 5b.3 Earnings Summary

### Which API Endpoint Returns Earnings Data

```typescript
// GET /admin/drivers/:driverId/earnings
export const fetchDriverEarnings = async (driverId: string) => {
  const headers = await getHeaders();
  const response = await fetch(
    `${API_BASE_URL}/admin/drivers/${driverId}/earnings`,
    { headers }
  );
  const data = await response.json();
  return {
    success: data.success,
    trips: data.trips ?? [],          // array of completed ride details
    payments: data.payments ?? [],    // array of cash payments logged by admin
    summary: data.summary ?? {        // aggregated totals
      totalDriverEarning: 0,
      totalAccepted: 0,
      totalGozoCut: 0,
      totalPaid: 0,
      outstandingDebt: 0,
    },
  };
};
```

The backend calculates all summary figures from the database and returns them ready-to-display. The app does not calculate any figures itself.

### The `DriverEarningsSummary` Interface

```typescript
export interface DriverEarningsSummary {
  totalDriverEarning: number;  // sum of driver_earning across all completed rides
  totalAccepted: number;       // sum of accepted_price (what users paid)
  totalGozoCut: number;        // sum of gozo_cut across all completed rides
  totalPaid: number;           // sum of all payments admin has logged for this driver
  outstandingDebt: number;     // totalGozoCut - totalPaid  (calculated on backend)
}
```

### Earnings Summary Card Rendering

The summary is displayed in a 2×2 grid of coloured cells:

```tsx
const renderEarningsTab = () => {
  const debtColor = summary.outstandingDebt > 0
    ? COLORS.cancelled   // #EF4444 RED — driver still owes GoZo money
    : '#059669';          // dark green — debt is fully cleared

  return (
    <View style={[s.card, s.debtCard]}>
      <Text style={s.cardTitle}>FINANCIAL SUMMARY</Text>
      <View style={s.summaryGrid}>

        <View style={s.summaryCell}>
          <Text style={s.summaryCellLabel}>Driver Earned</Text>
          <Text style={[s.summaryCellValue, { color: COLORS.primary }]}>
            {fmtCurrency(summary.totalDriverEarning)}  {/* GoZo Green */}
          </Text>
        </View>

        <View style={s.summaryCell}>
          <Text style={s.summaryCellLabel}>GoZo Commission</Text>
          <Text style={[s.summaryCellValue, { color: '#F59E0B' }]}>
            {fmtCurrency(summary.totalGozoCut)}  {/* Amber */}
          </Text>
        </View>

        <View style={s.summaryCell}>
          <Text style={s.summaryCellLabel}>Total Paid</Text>
          <Text style={[s.summaryCellValue, { color: '#059669' }]}>
            {fmtCurrency(summary.totalPaid)}  {/* Dark green */}
          </Text>
        </View>

        <View style={s.summaryCell}>
          <Text style={s.summaryCellLabel}>Outstanding Debt</Text>
          <Text style={[s.summaryCellValue, { color: debtColor, fontSize: 20 }]}>
            {fmtCurrency(summary.outstandingDebt)}  {/* RED if > 0, dark green if 0 */}
          </Text>
        </View>

      </View>
      <TouchableOpacity style={s.recordPaymentBtn} onPress={() => setPaymentModal(true)}>
        <Text style={s.recordPaymentBtnText}>+ Record Payment</Text>
      </TouchableOpacity>
    </View>
  );
};

// Currency formatter — adds ₹ symbol and Indian number grouping (e.g. ₹1,23,456)
const fmtCurrency = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
```

---

## 5b.4 Log Payment Flow

### Step-by-Step User Flow

```
Admin opens DriverDetailScreen → taps "Earnings & Debt" tab
    │
    ▼
Financial summary loaded → sees outstanding debt amount in red
    │
    ▼
Admin taps "+ Record Payment" button
    │
    ▼
paymentModal state → true → Modal slides up from bottom
    │
    ▼
Admin enters:
  • Amount (numeric keyboard)
  • Notes (optional — e.g. "cash received 18 Jul")
    │
    ▼
Admin taps "Record"
    │
    ▼
handleRecordPayment() fires
    │
    ▼
Validation: parseFloat(paymentAmount) must be > 0
    │
    ▼
recordDriverPayment(driver.id, amount, notes)
  POST /admin/drivers/:driverId/payments
  body: { amount: 500, notes: "cash received 18 Jul" }
    │
    ▼
Backend inserts payment record in Supabase, recalculates outstandingDebt
    │
    ▼
Success → modal closes → loadEarnings() called → UI refreshes with new debt figure
```

### The `handleRecordPayment` Function — Annotated

```tsx
const handleRecordPayment = async () => {
  // Step 1: Parse and validate amount
  const amount = parseFloat(paymentAmount);
  if (!amount || amount <= 0) {
    Alert.alert('Invalid', 'Enter a valid payment amount.');
    return;
  }

  setRecordingPayment(true);  // shows spinner on the Record button

  try {
    // Step 2: Call the API
    const res = await recordDriverPayment(
      driver.id,
      amount,
      paymentNotes.trim() || undefined  // don't send empty string, send undefined
    );

    if (res.success) {
      // Step 3: Clean up modal state
      setPaymentModal(false);
      setPaymentAmount('');
      setPaymentNotes('');

      // Step 4: Reload earnings so the updated debt figure is shown immediately
      await loadEarnings();

      Alert.alert('Recorded', `₹${amount} payment recorded successfully.`);
    } else {
      Alert.alert('Error', res.error || 'Failed to record payment');
    }
  } catch (e: any) {
    Alert.alert('Error', e.message);
  } finally {
    setRecordingPayment(false);  // always hide spinner
  }
};
```

### The API Function (`src/api.ts`)

```typescript
export const recordDriverPayment = async (
  driverId: string,
  amount: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> => {
  const headers = await getHeaders();
  const response = await fetch(
    `${API_BASE_URL}/admin/drivers/${driverId}/payments`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount, notes }),
    }
  );
  const data = await response.json();
  return { success: data.success, error: data.error };
};
```

---

## 5b.5 Payment History

After a payment is recorded, the Earnings tab shows every past payment under a **PAYMENT HISTORY** card:

```tsx
{payments.length > 0 && (
  <View style={s.card}>
    <Text style={s.cardTitle}>PAYMENT HISTORY</Text>
    {payments.map((p, i) => (
      <View key={p.id}>
        {i > 0 && <View style={s.divider} />}  {/* divider between rows */}
        <View style={s.historyRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.paymentDate}>{formatDate(p.created_at)}</Text>
            {p.notes ? <Text style={s.paymentNotes}>{p.notes}</Text> : null}
          </View>
          <Text style={s.paymentAmount}>+ {fmtCurrency(p.amount)}</Text>
        </View>
      </View>
    ))}
  </View>
)}
```

Each payment row shows:
- **Date** — formatted as `"18 Jul 2026"` using `formatDate()`
- **Notes** — optional text (shown below date if present)
- **Amount** — in green, prefixed with `+` (e.g. `+ ₹500`)

> **Note:** The current Phase 1 implementation does not include a delete payment button in the UI. Payment records are permanent once logged. Deletion would require a backend endpoint and UI control to be added in Phase 2.

---

## 5b.6 GoZo Commission Model

### The Business Logic

GoZo operates on a **split-fare model**:

1. **User pays** a price for the ride (stored as `accepted_price` in the ride record)
2. The backend splits this into two parts:
   - **Driver earning** — what the driver gets to keep
   - **GoZo commission (cut)** — what GoZo earns from the ride

The formula (as implemented on the backend):
```
accepted_price  = max(200, distance_km × 50)   — what the user pays
driver_earning  = max(180, distance_km × 45)   — driver's share
gozo_cut        = accepted_price - driver_earning  — GoZo's share (minimum ₹20)
```

**Example for a 10 km trip:**
```
accepted_price = max(200, 10 × 50) = max(200, 500) = ₹500
driver_earning = max(180, 10 × 45) = max(180, 450) = ₹450
gozo_cut       = 500 - 450 = ₹50
```

**Example for a 3 km trip (minimum fare applies):**
```
accepted_price = max(200, 3 × 50) = max(200, 150) = ₹200
driver_earning = max(180, 3 × 45) = max(180, 135) = ₹180
gozo_cut       = 200 - 180 = ₹20
```

### How Debt Accumulates

The driver does not pay GoZo digitally after each ride. Instead:
- The GoZo commission accumulates as a running **debt** across all completed rides
- Periodically, the driver gives GoZo staff a cash payment
- The admin logs this payment in the Admin App
- The backend records the payment and reduces the outstanding debt

```
outstandingDebt = totalGozoCut - totalPaid
```

**Example:**
```
Driver completes 10 rides, total GoZo commission = ₹500
Driver has paid admin ₹300 cash
outstandingDebt = ₹500 - ₹300 = ₹200 (shown in RED)

Driver pays another ₹200 → admin logs it
outstandingDebt = ₹500 - ₹500 = ₹0 (shown in dark GREEN)
```

### Where This Is Calculated

The splitting logic runs on the **Node.js backend** when a ride is marked as completed. The Admin App receives the pre-calculated figures from the `/admin/drivers/:id/earnings` endpoint — it never performs these calculations itself.

Each trip in the `trips` array includes:
```typescript
export interface DriverEarningTrip {
  id: string;
  created_at: string;
  goods_type: string;
  weight_kg: number;
  accepted_price: number;   // what user paid
  driver_earning: number;   // driver's share
  gozo_cut: number;         // GoZo's share
  pickup_address: string;
  drop_address: string;
  status: string;
}
```

Each trip card in the UI shows both figures:
```tsx
<Text style={s.tripDriverEarning}>Driver: {fmtCurrency(t.driver_earning)}</Text>
{t.gozo_cut > 0 && (
  <Text style={s.tripGozoCut}>GoZo: {fmtCurrency(t.gozo_cut)}</Text>
)}
```

---

*Next: Section 6 — API Integration*

---

# Section 6: API Integration

## 6.1 Base Configuration

### API Base URL

Defined in **`src/config.ts`** — a single file that is the only place this value needs to be changed if the backend URL ever changes:

```typescript
// src/config.ts
export const API_BASE_URL = 'https://fcm-backend-lj2h.onrender.com';
```

### How It Is Imported

Every API function in `src/api.ts` imports `API_BASE_URL` at the top of the file:

```typescript
// src/api.ts — line 2
import { API_BASE_URL } from './config';
```

No other file imports `API_BASE_URL` directly. All network calls are centralised in `api.ts`, and screens import named functions from `api.ts`. This means:
- Screens never write `fetch()` calls themselves
- Changing the base URL requires editing only `config.ts`
- All API logic is in one place, easy to audit

### Common Headers Setup

There is no request interceptor (this is plain `fetch`, not Axios). Instead, a shared `getHeaders()` helper is defined at the top of `api.ts` and called at the start of every authenticated function:

```typescript
// src/api.ts
const getHeaders = async () => {
  const token = await AsyncStorage.getItem('gozo_admin_token');
  return {
    'Content-Type': 'application/json',
    'x-admin-token': token || '',    // admin JWT sent with every request
  };
};
```

The `loginAdmin` function is the only one that does **not** use `getHeaders()` — it sends only `Content-Type` because no token exists yet at login time.

---

## 6.2 Complete Endpoint List

Every `fetch()` call found across all files in the Admin App, documented in full:

| # | Method | Endpoint | Params Sent | Response Fields Used | Screen / File |
|---|---|---|---|---|---|
| 1 | `POST` | `/admin/auth` | Body: `{ pin: string }` | `success`, `token` | `LoginScreen` via `loginAdmin()` |
| 2 | `POST` | `/admin/fcm-token` | Body: `{ token: string }`, Header: `x-admin-token` | `success`, `error` | `App.tsx` via `registerAdminFcmToken()` |
| 3 | `GET` | `/admin/rides` | Query: `status?`, `date?`, Header: `x-admin-token` | `success`, `rides[]` | `RidesScreen` via `fetchRides()` |
| 4 | `GET` | `/admin/rides/:requestId` | Path: `requestId`, Header: `x-admin-token` | `success`, `ride` (with nested `user`, `driver`, `timeline`) | `RideDetailScreen` via `fetchRideDetail()` |
| 5 | `DELETE` | `/admin/rides/:rideId` | Path: `rideId`, Header: `x-admin-token` | `success`, `error` | `RideDetailScreen` via `deleteRide()` |
| 6 | `DELETE` | `/admin/rides/clear-all` | Header: `x-admin-token` | `success`, `error` | `SettingsScreen` via `clearAllRides()` |
| 7 | `GET` | `/admin/scheduled-rides` | Query: `status?`, `date?`, Header: `x-admin-token` | `success`, `rides[]` | `ScheduledRidesScreen` via `fetchScheduledRides()` |
| 8 | `GET` | `/scheduled-rides/:rideId` | Path: `rideId`, Header: `x-admin-token` | `success`, `ride` (with nested `user`, `driver`, `company`) | `ScheduledRideDetailScreen` via `fetchScheduledRideDetail()` |
| 9 | `PATCH` | `/admin/scheduled-rides/:rideId/assign` | Path: `rideId`, Body: `{ driver_id: string }`, Header: `x-admin-token` | `success`, `error` | `ScheduledRideDetailScreen` via `assignDriverToScheduledRide()` |
| 10 | `DELETE` | `/admin/scheduled-rides/:rideId` | Path: `rideId`, Header: `x-admin-token` | `success`, `error` | `ScheduledRideDetailScreen` via `deleteScheduledRide()` |
| 11 | `GET` | `/admin/drivers/status` | Header: `x-admin-token` | `success`, `drivers[]` (with `status` field) | `DriversScreen`, `ScheduledRideDetailScreen` via `fetchDriversWithStatus()` |
| 12 | `GET` | `/admin/drivers/:driverId/rides` | Path: `driverId`, Query: `limit`, `offset`, Header: `x-admin-token` | `success`, `rides[]` | Defined in `api.ts` — not yet used by any screen in Phase 1 |
| 13 | `GET` | `/admin/drivers/:driverId/earnings` | Path: `driverId`, Header: `x-admin-token` | `success`, `trips[]`, `payments[]`, `summary` | `DriverDetailScreen` via `fetchDriverEarnings()` |
| 14 | `POST` | `/admin/drivers/:driverId/payments` | Path: `driverId`, Body: `{ amount: number, notes?: string }`, Header: `x-admin-token` | `success`, `error` | `DriverDetailScreen` via `recordDriverPayment()` |
| 15 | `PATCH` | `/admin/api/drivers/:driverId` | Path: `driverId`, Body: `Partial<Driver>`, Header: `x-admin-token` | `success`, `error` | `DriverDetailScreen` via `updateDriverProfile()` |
| 16 | `POST` | `/admin/test-fcm` | Header: `x-admin-token` | `success`, `error` | `SettingsScreen` via `triggerTestNotification()` |

### Endpoint Detail — Key Responses

**`GET /admin/rides` — response shape:**
```json
{
  "success": true,
  "rides": [
    {
      "id": "uuid",
      "status": "pending",
      "goods_type": "Furniture_dist_12km",
      "weight_kg": 50,
      "pickup_address": "...",
      "drop_address": "...",
      "price_inr": 500,
      "created_at": "2026-07-18T10:00:00Z",
      "user": { "id": "...", "name": "...", "phone": "..." },
      "driver": null
    }
  ]
}
```

**`GET /admin/drivers/:id/earnings` — response shape:**
```json
{
  "success": true,
  "trips": [
    {
      "id": "uuid",
      "accepted_price": 500,
      "driver_earning": 450,
      "gozo_cut": 50,
      "goods_type": "Steel",
      "weight_kg": 100,
      "created_at": "2026-07-18T10:00:00Z"
    }
  ],
  "payments": [
    { "id": "uuid", "amount": 300, "notes": "cash", "created_at": "..." }
  ],
  "summary": {
    "totalDriverEarning": 1800,
    "totalAccepted": 2000,
    "totalGozoCut": 200,
    "totalPaid": 100,
    "outstandingDebt": 100
  }
}
```

---

## 6.3 Error Handling Pattern

Every API function in `api.ts` follows an identical try/catch pattern. The function **never throws** — it always returns an object with `{ success: boolean, error?: string }`. This means screens always get a structured response even when something goes wrong.

### The Standard Pattern

```typescript
export const someApiFunction = async (): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/some/endpoint`, { headers });
    const data = await response.json();

    // The backend always returns { success: true/false, ... }
    // HTTP status code is NOT directly checked — success flag from body is used
    return { success: data.success, data: data.someField, error: data.error };

  } catch (error: any) {
    // This catch handles:
    // 1. Network unreachable (no internet, server down)
    // 2. fetch() timeout
    // 3. response.json() failure (server returned HTML error page)
    return { success: false, error: error.message };
  }
};
```

### Special Case — DELETE Endpoints

DELETE endpoints have extra handling because a failed DELETE may return an HTML error page instead of JSON (e.g. if the server crashes mid-request). The app checks the `content-type` header first:

```typescript
export const deleteRide = async (rideId: string) => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/admin/rides/${rideId}`, {
      method: 'DELETE',
      headers,
    });

    // Check if the response is actually JSON before parsing
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return { success: data.success, error: data.error };
    } else {
      // Server returned non-JSON (HTML error page, plain text, etc.)
      const text = await response.text();
      return {
        success: false,
        error: `Server error (${response.status}): ${text.substring(0, 100)}`
      };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
```

### How Error Messages Are Shown to the User

There are two patterns used in screens, depending on context:

**Pattern 1 — Inline error text** (used in list screens where the error replaces the list):
```tsx
const [error, setError] = useState<string | null>(null);

// In loadRides():
if (!res.success) {
  setError(res.error || 'Failed to fetch rides');
}

// In JSX:
{error ? (
  <View style={styles.errorContainer}>
    <Text style={styles.errorText}>{error}</Text>
    {/* No retry button — user must pull-to-refresh */}
  </View>
) : (
  <FlatList ... />
)}
```

**Pattern 2 — Alert dialog** (used for destructive actions like delete, payment logging):
```tsx
try {
  const res = await deleteRide(requestId);
  if (res.success) {
    Alert.alert('Success', 'Ride deleted successfully.', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  } else {
    Alert.alert('Error', res.error || 'Failed to delete ride. Please try again.');
  }
} catch (err: any) {
  Alert.alert('Error', err.message || 'Failed to delete ride. Please try again.');
}
```

### What Happens When Backend Returns Non-200 Status

The current implementation does **not** explicitly check `response.ok` or `response.status`. It reads the JSON body and trusts the `success` boolean field. This means:

- A `401 Unauthorized` (invalid token) → backend returns `{ success: false, error: 'Unauthorized' }` → app shows error text
- A `500 Internal Server Error` → backend may return `{ success: false, error: 'Internal error' }` OR an HTML page → the content-type guard in DELETE endpoints catches this; other endpoints would fail at `response.json()` and fall into the catch block

---

## 6.4 Loading States

Every screen that fetches data manages its own loading state with `useState`. There are two distinct loading variables used:

### First-Load vs Pull-to-Refresh

```tsx
const [loading, setLoading]     = useState(false);   // full-screen spinner (first load)
const [refreshing, setRefreshing] = useState(false);  // pull-to-refresh indicator

const loadRides = async (showRefresher = false) => {
  // Set the appropriate loading state
  if (showRefresher) {
    setRefreshing(true);   // shows the native pull-down indicator
  } else {
    setLoading(true);      // shows the full-screen ActivityIndicator
  }
  setError(null);          // clear any previous error

  try {
    const res = await fetchRides(selectedFilter, dateStr);
    if (res.success) {
      setRides(res.rides);
    } else {
      setError(res.error || 'Failed to fetch rides');
    }
  } catch (err: any) {
    setError(err.message || 'An unexpected error occurred');
  } finally {
    // Always reset both, regardless of success or failure
    setLoading(false);
    setRefreshing(false);
  }
};
```

### The Three UI States

Every list screen renders one of three states:

```tsx
return (
  <SafeAreaView>
    {loading ? (
      // State 1: Full-screen spinner — first load, no data yet
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    ) : error ? (
      // State 2: Error message — fetch failed
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    ) : rides.length === 0 ? (
      // State 3a: Empty state — fetch succeeded but no results
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No rides found matching filters</Text>
      </View>
    ) : (
      // State 3b: Data — normal render with pull-to-refresh
      <FlatList
        data={rides}
        onRefresh={() => loadRides(true)}
        refreshing={refreshing}
        renderItem={...}
      />
    )}
  </SafeAreaView>
);
```

### Button-Level Loading States

For actions like Save, Record Payment, Delete — individual buttons have their own loading state to disable the button and show a spinner inline:

```tsx
const [saving, setSaving] = useState(false);

<TouchableOpacity
  style={[s.saveBtn, saving && s.disabledBtn]}   // reduced opacity when loading
  onPress={saveEdit}
  disabled={saving}                               // prevents double-tap
>
  {saving
    ? <ActivityIndicator color="#fff" size="small" />  // spinner instead of text
    : <Text style={s.saveBtnText}>Save</Text>
  }
</TouchableOpacity>
```

This pattern prevents double-submissions — once the button is tapped and the API call starts, the button is disabled until the call completes (success or failure).

---

*Next: Section 7 — Push Notifications*

---

# Section 7: Push Notifications

## 7.1 FCM Setup

### Firebase Initialization

Firebase initialises automatically when the app starts because `@react-native-firebase/app` is a native module — its `google-services.json` file (placed at `android/app/google-services.json`) is compiled directly into the Android APK during the build. No JavaScript `initializeApp()` call is needed.

**`google-services.json`:**
- Location: `GoZoAdminApp/android/app/google-services.json`
- What it contains: The Firebase project ID, API key, and sender ID for the `com.gozo.admin` Android app
- Why it's needed: The Firebase native SDK reads this file to know which Firebase project to connect to. Without it, `getToken()` will fail with a project configuration error.
- It is listed in `.gitignore` and should never be committed to a public repository.

### Android Notification Channel Creation

Android 8.0 (API 26) and above require that every notification be assigned to a **channel**. The channel is created inside `App.tsx` when the user first logs in:

```tsx
// App.tsx — runs inside the third useEffect, after isLoggedIn becomes true
const createNotifeeChannel = async () => {
  await notifee.createChannel({
    id: 'gozo_admin_alerts',      // unique channel identifier
    name: 'GoZo Admin Alerts',    // visible in Android Settings → App Notifications
    importance: AndroidImportance.HIGH,
    // HIGH = notification appears as a heads-up banner with sound
    // even if the phone is not being actively used
  });
};
createNotifeeChannel();
```

`AndroidImportance.HIGH` is the highest importance level, making notifications appear as pop-up banners. Without this, notifications would silently appear only in the notification drawer.

---

## 7.2 FCM Token Registration

### Where `getToken()` Is Called

FCM token registration runs in the second `useEffect` in `App.tsx`, triggered when `isLoggedIn` becomes `true` (i.e., only after a successful login — not on the login screen):

```tsx
// App.tsx
useEffect(() => {
  if (isLoggedIn !== true) return;   // guard — do nothing until logged in

  const setupNotifications = async () => {
    try {
      // Step 1: Request permission (required on Android 13+ / iOS)
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        // Step 2: Get the unique device FCM token
        const token = await messaging().getToken();

        if (token) {
          console.log('FCM Token:', token);
          // Step 3: Send token to backend so backend can send notifications to this device
          await registerAdminFcmToken(token);
        }

        // Step 4: Listen for token refreshes
        messaging().onTokenRefresh(async (newToken) => {
          console.log('FCM Token Refreshed:', newToken);
          await registerAdminFcmToken(newToken);   // update backend with new token
        });
      }
    } catch (err) {
      console.warn('Error setting up notifications', err);
    }
  };

  setupNotifications();
}, [isLoggedIn]);   // re-runs if isLoggedIn changes
```

### Token Registration API Call

```typescript
// src/api.ts
export const registerAdminFcmToken = async (token: string) => {
  const headers = await getHeaders();   // includes x-admin-token
  const response = await fetch(`${API_BASE_URL}/admin/fcm-token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token }),
  });
  const data = await response.json();
  return { success: data.success, error: data.error };
};
```

The backend stores this token in its database. When a new ride is booked, the backend reads all stored admin FCM tokens and sends a push notification to each one.

### Why the Token Can Change

The FCM token is not permanent. It can change when:
- The app is uninstalled and reinstalled
- The device is restored from backup
- Firebase rotates tokens for security reasons

The `onTokenRefresh` listener handles this automatically — whenever Firebase issues a new token, the app immediately sends it to the backend so notifications are not lost.

---

## 7.3 Notification Handling — Three App States

### State 1: Foreground (App Is Open and Visible)

When the app is in the foreground, the Firebase SDK does **not** display a notification automatically. The `onMessage` listener fires silently. The app uses **Notifee** to display the banner manually:

```tsx
// App.tsx — third useEffect
const unsubscribeMessaging = messaging().onMessage(async (remoteMessage) => {
  console.log('Foreground FCM Message received:', remoteMessage);

  // Use Notifee to render a heads-up notification banner
  await notifee.displayNotification({
    title: remoteMessage.notification?.title || 'GoZo Operations Alert',
    body:  remoteMessage.notification?.body  || 'New operational update',
    android: {
      channelId: 'gozo_admin_alerts',          // must match the created channel
      importance: AndroidImportance.HIGH,      // heads-up banner
      pressAction: { id: 'default' },          // enables tap handling
    },
    data: remoteMessage.data,   // pass through payload for navigation on tap
  });
});
```

The `data` field from the FCM message (containing `type`, `requestId`, `rideId`) is attached to the Notifee notification so it can be used for deep linking when the banner is tapped.

**Handling a tap on the foreground banner:**
```tsx
const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
  if (type === EventType.PRESS) {
    const data = detail.notification?.data;
    if (data) {
      handleNotificationTap(data);   // navigate to correct screen
    }
  }
});
```

Both `unsubscribeMessaging` and `unsubscribeNotifee` are returned from the `useEffect` cleanup function to prevent memory leaks when the component unmounts.

---

### State 2: Background (App Is Running but Not Visible)

When the app is in the background (user has switched to another app or pressed Home), the **Firebase native SDK** on Android handles notification display automatically — no JavaScript runs for the display step. The system shows the notification banner using the `notification.title` and `notification.body` fields sent by the backend.

> **Important:** The Admin App's source code does **not** register a `messaging().setBackgroundMessageHandler()`. This is intentional for the current use case — background notifications are display-only, handled natively by the Android system. When the user taps the notification from the background state, the app comes to the foreground and the `notifee.onForegroundEvent` listener handles the tap navigation.

---

### State 3: Killed (App Is Completely Closed)

When the app is killed (swiped out of recent apps), the Firebase native Android service can still receive and display notifications — the app's JavaScript does not need to be running.

When the user taps the notification, the Android OS launches the app. After the app boots and the navigation container mounts, `getInitialNotification()` checks if the app was opened via a notification:

```tsx
// App.tsx — third useEffect, after isLoggedIn becomes true
notifee.getInitialNotification().then((initialNotification) => {
  if (initialNotification) {
    console.log('App opened from notification in quit state:', initialNotification);
    const data = initialNotification.notification.data;
    if (data) {
      // Delay to allow NavigationContainer to fully mount before navigating
      setTimeout(() => {
        handleNotificationTap(data);
      }, 1500);   // 1.5 second delay
    }
  }
});
```

The 1500ms delay is necessary because the `NavigationContainer` and its screens take time to mount after the app is launched. Calling `navigate()` before the navigation container is ready would silently fail. The `navigationRef.isReady()` guard in `navigationRef.ts` provides a secondary safety check.

---

## 7.4 Notification Types

The Admin App receives two categories of notifications from the backend:

### Type: `ride_created`
- **Trigger:** A factory owner books a new quick ride on the UserApp
- **Data payload sent by backend:**
  ```json
  {
    "type": "ride_created",
    "requestId": "uuid-of-the-ride-request"
  }
  ```
- **Navigates to:** `RideDetailScreen` for the specific ride
- **Title shown:** e.g., `"New Ride Request"` (set by backend)

### Type: `ride_unassigned`
- **Trigger:** A ride that was previously matched to a driver becomes unassigned (driver cancelled or was removed)
- **Data payload:**
  ```json
  {
    "type": "ride_unassigned",
    "requestId": "uuid-of-the-ride-request"
  }
  ```
  > The app also checks `data.request_id` as a fallback field name: `const targetId = requestId || data.request_id`
- **Navigates to:** `RideDetailScreen` — same screen as `ride_created`

### Type: `scheduled_ride_created`
- **Trigger:** A factory owner books a scheduled (future) ride on the UserApp
- **Data payload:**
  ```json
  {
    "type": "scheduled_ride_created",
    "rideId": "uuid-of-the-scheduled-ride"
  }
  ```
  > Also checks `data.ride_id` as fallback: `const targetId = rideId || data.ride_id`
- **Navigates to:** `ScheduledRideDetailScreen` for that scheduled ride

---

## 7.5 Navigation on Notification Tap

All three notification types are handled by a single function in `App.tsx`:

```tsx
// App.tsx
const handleNotificationTap = (data: any) => {
  console.log('Handling Notification Tap:', data);

  // Destructure the standard fields from the notification payload
  const { type, requestId, rideId } = data;

  if (type === 'ride_created' || type === 'ride_unassigned') {
    // Quick ride notification → go to Rides tab → RideDetail screen
    const targetId = requestId || data.request_id;   // handle both field name variants
    if (targetId) {
      navigate('Rides', {
        screen: 'RideDetail',        // the nested stack screen name
        params: { requestId: targetId },
      });
    }

  } else if (type === 'scheduled_ride_created') {
    // Scheduled ride notification → go to Scheduled tab → ScheduledRideDetail screen
    const targetId = rideId || data.ride_id;         // handle both field name variants
    if (targetId) {
      navigate('Scheduled', {
        screen: 'ScheduledRideDetail',
        params: { rideId: targetId },
      });
    }
  }
};
```

**How `navigate()` works here:**

`navigate` is the global function exported from `src/navigation/navigationRef.ts`:

```typescript
export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {       // safety check — container must be mounted
    navigationRef.navigate(name, params);
  }
}
```

`navigationRef` is a `createNavigationContainerRef()` — a React ref attached to the `<NavigationContainer>` in `AppNavigator.tsx`. This allows navigation to be called from anywhere in the app (including `App.tsx`, which is outside the navigator tree) without needing a `navigation` prop.

**Nested navigation:** The `navigate('Rides', { screen: 'RideDetail', params: { requestId } })` pattern navigates into the `Rides` bottom tab, then navigates that tab's internal Stack Navigator to `RideDetail`, passing `requestId` as a route parameter.

---

*Next: Section 8 — Known Limitations and Future Work*

---

# Section 8: Known Limitations and Future Work

As GoZo Admin App (Phase 1) is a Minimum Viable Product (MVP) built to bootstrap internal operations, there are several known limitations in its current architecture. Hardening these areas will be the focus of Phase 2.

## 8.1 Architectural & Security Limitations

1. **Shared Static Credentials:**
   The admin panel is protected by a single, shared PIN (`GoZo_2026`). There is no individual staff account model. Consequently, the backend audit trail cannot distinguish between actions performed by different operational staff.
2. **Hardcoded Configurations:**
   The static password and endpoints are declared in plain text inside `src/config.ts`. If an APK is decompiled or the source code is compromised, these credentials can be extracted.
3. **Plain Text Session Persistence:**
   The JWT and login status are stored using standard `AsyncStorage`, which is unencrypted. On rooted Android devices, this file can be accessed by other applications.
4. **Lack of Local Caching:**
   The app uses a strict "always fetch" strategy. When navigating between screens, the app displays a full-screen loading spinner while waiting for the network request. There is no offline caching layer (e.g., SQLite or WatermelonDB), rendering the app unusable without an active internet connection.
5. **No Network Resiliency (Retries):**
   If a network request fails (e.g., due to a temporary server timeout on Render), the app does not automatically retry. The user must manually trigger a reload or pull-to-refresh.

## 8.2 Operational Limitations

1. **Manual Debt Settlement:**
   Currently, settlements between GoZo and truck drivers are logged manually. When a driver deposits cash, the admin must physically enter the amount. There is no automated settlement workflow (such as UPI deep links, virtual bank accounts, or QR code generation).
2. **Missing Driver CRUD Operations:**
   In Phase 1, admins can view details and edit *existing* profile fields, but they cannot register a new driver or delete a driver's account directly from the app. This must still be executed via direct database manipulations.
3. **No Real-Time Tracking Map:**
   Although the app tracks status timelines (e.g., `'picked_up'`, `'delivered'`), it does not feature an active map view to track the driver's current coordinates.

## 8.3 Future Work (Phase 2 Roadmap)

* **Multi-Factor / Auth0 Authentication:** Move away from shared passwords to OAuth-based individual staff logins with permission layers.
* **Encrypted Storage:** Transition from `AsyncStorage` to `react-native-keychain` for secure storage of JWT tokens.
* **Offline Synchronization:** Implement a caching mechanism (using React Query or RTK Query) to allow operations staff to view cached records offline.
* **UPI Gateway Integration:** Automatically generate dynamic UPI QR codes in the driver profile. When a driver scans and pays, the database and outstanding debt are updated automatically without manual admin intervention.
* **Active Driver Mapping:** Add a Mapbox or Google Maps overlay inside `RideDetailScreen` to show the driver's live GPS location during an active trip.

---

# Section 9: Viva Questions and Answers (Part 1)

This section compiles anticipated basic and intermediate viva-style questions and their corresponding technical answers to assist in student training and exam preparation.

### BASIC QUESTIONS

#### Q1. What is React Native and how is it different from a normal Android app?
**Answer:** React Native is an open-source framework developed by Meta that allows developers to build native mobile apps using JavaScript and React. Unlike a normal Android app written in Java or Kotlin, React Native compiles user interface components into native UI views dynamically using a JavaScript-to-Native bridge. This allows a single codebase to target both Android and iOS platforms. In the GoZo Admin App project, it is configured primarily for Android deployment as seen in the `android/` directory structure. By rendering actual native views rather than web-based wrappers, it delivers a smooth native performance and aesthetic.

#### Q2. What is the difference between React Native CLI and Expo? Why did GoZo use CLI?
**Answer:** React Native CLI is a bare development workflow, whereas Expo is a managed wrapper framework that abstracts native directories like `android/` and `ios/`. GoZo used React Native CLI because it requires linking native library binaries directly, such as Firebase Cloud Messaging and Notifee. In Expo, managing custom native modules is more complex and restricts configuration of system-level settings. Using CLI gives the GoZo developers full access to the `AndroidManifest.xml` file for fine-grained push notification configuration. This also ensures consistency with the native setups used in the primary UserApp and DriverApp codebases.

#### Q3. What is a component in React Native? Give an example from the GoZo Admin App.
**Answer:** A component in React Native is a modular, self-contained building block of the user interface that defines how a section of the screen looks and behaves. It can accept inputs via properties called "props" and maintain local data via "state." An excellent example from the GoZo Admin App is the `StatusBadge` component found in `src/components/StatusBadge.tsx`. This component takes a raw status string like `'completed'` as a prop and renders a styled text box with customized backgrounds and text colors. Reusable components like this ensure visual and behavioral consistency throughout different screens.

#### Q4. What is useState? Show how it is used in the GoZo Admin App with an example.
**Answer:** `useState` is a React Hook that allows functional components to declare, read, and update local state variables. When a state variable is modified using its setter function, React automatically triggers a component re-render to reflect the change in the UI. For instance, in `src/screens/LoginScreen.tsx`, the state variable `password` is declared as `const [password, setPassword] = useState('');`. As the user types into the TextInput, `setPassword` is called with the current characters, which updates the state and inputs values. This local state is subsequently checked against the system's administrative credentials to grant access.

#### Q5. What is useEffect? When does it run? Show an example from the Admin App.
**Answer:** `useEffect` is a Hook used to perform side effects in functional components, such as data fetching, subscription setups, or manual DOM/UI manipulations. It accepts a callback function and a dependency array that determines when that callback should run. In `src/screens/RidesScreen.tsx`, a `useEffect` hook is registered with dependencies `[navigation, selectedFilter, selectedDate]`. This causes the component to call `loadRides()` immediately when the screen mounts, and re-triggers whenever the admin taps a filter chip or changes the date. If the dependency array is empty, the callback runs exactly once when the component is first mounted.

#### Q6. What is AsyncStorage? How is it used in the GoZo Admin App?
**Answer:** `AsyncStorage` is an unencrypted, asynchronous, key-value storage system that acts as a local database for small amounts of persistent data in React Native. In the GoZo Admin App, it is imported from `@react-native-async-storage/async-storage` and used primarily to maintain the admin's login session. When an admin logs in, `AsyncStorage.setItem('gozo_admin_token', token)` saves their session JWT. On application boot, `App.tsx` calls `AsyncStorage.getItem` to retrieve this token. If a valid token is found, the user is automatically navigated past the login screen.

#### Q7. What is a REST API? How does the Admin App communicate with the backend?
**Answer:** A REST API is an architectural style for designing web services that communicate over HTTP using standard methods like GET, POST, PATCH, and DELETE. The GoZo Admin App acts as a client that communicates with the Node.js/Express backend by sending HTTP requests and processing the returned JSON data. This network communication is centralized within `src/api.ts` using JavaScript's native `fetch` client. For example, when an admin views the rides tab, the app sends a GET request to `/admin/rides`. The server responds with status code 200 and the list of rides, which the app then maps to screen cards.

#### Q8. What is JSON? Show an example of JSON data from a GoZo API response.
**Answer:** JSON, or JavaScript Object Notation, is a lightweight, text-based format used for storing and exchanging data in key-value pairs. In the GoZo ecosystem, all API responses return data formatted as JSON. For example, a response from the ride detail request looks like `{ "success": true, "ride": { "id": "UUID", "status": "pending", "price_inr": 500 } }`. The app parses this string using the native `response.json()` method in `src/api.ts`. The resulting JavaScript object is then stored in state and used to render elements like the route and price.

#### Q9. What is FCM (Firebase Cloud Messaging)? Why is it used in the Admin App?
**Answer:** Firebase Cloud Messaging is a cross-platform messaging solution that allows developers to send push notifications and data payloads to client devices. The GoZo Admin App uses FCM to notify administrative staff instantly when operational changes occur. When a factory owner requests a new ride, or when a matched driver cancels, the Node.js backend pushes a payload to the admin's device. The application retrieves these messages using the native `@react-native-firebase/messaging` package. These push messages ensure that staff can monitor operations in real-time without having to refresh the app constantly.

#### Q10. What is a Bottom Tab Navigator? What are the 4 tabs in the GoZo Admin App?
**Answer:** A Bottom Tab Navigator is a common mobile navigation pattern that displays a persistent navigation bar at the bottom of the screen, allowing users to switch between main views. The GoZo Admin App configures this using the `@react-navigation/bottom-tabs` library in `src/navigation/AppNavigator.tsx`. The navigator defines four primary tabs: "Rides" for immediate bookings, "Scheduled" for future shipments, "Drivers" for transporter profiles, and "Settings" for configuration and test triggers. Tapping any icon mounts the corresponding stack navigator, rendering its primary list screen. Each tab manages its own history stack, allowing users to drill down into details without losing their place.

#### Q11. What is TypeScript? Why is it better than plain JavaScript for this project?
**Answer:** TypeScript is a strongly-typed programming language that builds on JavaScript by adding compile-time type definitions. In the GoZo Admin App, TypeScript is used to catch coding errors early during development, such as referencing non-existent properties on API responses. In `src/api.ts`, interfaces like `Ride`, `Driver`, and `Payment` explicitly define the expected structure of our data models. If a developer attempts to pass an incorrect data type to a component, the TypeScript compiler highlights the error before the code runs. This type safety prevents runtime crashes and makes the codebase easier to maintain.

#### Q12. What is a FlatList in React Native? Where is it used in the Admin App?
**Answer:** `FlatList` is a highly performant React Native component designed to render scrollable lists of structured data. Unlike a standard `ScrollView`, it implements lazy rendering, mounting only the elements currently visible on the screen to minimize memory usage. In the GoZo Admin App, `FlatList` is the core list rendering engine in both `RidesScreen.tsx` and `DriversScreen.tsx`. It accepts the data array as a prop, generates keys using `keyExtractor`, and renders individual cards using `renderItem`. It also supports native pull-to-refresh indicators out of the box.

#### Q13. What is the difference between props and state in React Native?
**Answer:** State represents a component's local, mutable data storage that can change over time and is managed entirely within the component itself. Props, short for properties, are immutable configuration values passed down from a parent component to a child component. When state changes, the component that owns it re-renders; when props change, the receiving child component re-renders to reflect the new values. In GoZo, `RidesScreen` maintains the list of bookings in its local `rides` state. It then passes individual ride objects down as a `ride` prop to the child `RideCard` component for display.

#### Q14. What is an API endpoint? List 3 endpoints the Admin App calls.
**Answer:** An API endpoint is a specific web address or URL where a client application can access digital resources from a backend server. The GoZo Admin App references these endpoints in `src/api.ts` relative to the base URL `https://fcm-backend-lj2h.onrender.com`. Three key endpoints called by the app are `/admin/auth` for credentials verification, `/admin/rides` for retrieving bookings, and `/admin/fcm-token` for registering push notification addresses. Each endpoint is mapped to a specific database operation on the server side. The server processes incoming requests and returns corresponding payloads.

#### Q15. What is Supabase? Does the Admin App connect to it directly?
**Answer:** Supabase is an open-source Backend-as-a-Service built on top of a PostgreSQL relational database that handles data storage, authentication, and file storage. The GoZo Admin App does **not** connect to Supabase directly. Instead, all mobile clients issue requests to a custom Node.js/Express backend hosted on Render. The Express backend acts as a secure firewall, validating requests before querying the database. This architecture protects sensitive PostgreSQL credentials from exposure within the client-side binary.

---

### INTERMEDIATE QUESTIONS

#### Q16. How does authentication work in the GoZo Admin App? Walk through the complete flow.
**Answer:** Authentication in the GoZo Admin App starts when the admin opens the application. The entry point `App.tsx` checks if a token exists in `AsyncStorage` via the key `gozo_admin_token`. If no token is found, the user is directed to `LoginScreen.tsx` where they must enter the operational PIN. When they tap the Login button, the app calls `loginAdmin(pin)` in `src/api.ts` which performs a POST request to `/admin/auth`. If the backend validates the PIN, it returns a JWT token, which the app saves locally. This action updates the local `isLoggedIn` state to `true`, causing the app to switch navigation stacks and render the main tab bar.

#### Q17. Why is the password hardcoded and what are the risks of this approach?
**Answer:** The admin password PIN `GoZo_2026` is hardcoded as a fallback comparison constant inside `LoginScreen.tsx` and is also sent to the backend endpoint `/admin/auth` for verification. Hardcoding credentials poses extreme security risks because compile-time constants are stored in plain text inside the compiled JavaScript bundle. If an attacker decompiles the Android APK file using simple reverse-engineering tools, they can easily extract the PIN. Furthermore, if the code is pushed to a public version control repository, the credential becomes exposed to the public. To mitigate this risk in production, individual user accounts and OAuth-based token authorization should be implemented. This would shift credentials verification entirely to secure, dynamic server logic.

#### Q18. How does the app stay logged in after it is closed and reopened?
**Answer:** The app achieves session persistence by utilizing persistent storage on the device. When an admin completes the login flow, the application executes `AsyncStorage.setItem('gozo_admin_token', token)` to save the JSON Web Token. During the bootstrap phase in `App.tsx`, a `useEffect` hook runs once on mount to call `AsyncStorage.getItem('gozo_admin_token')`. If a token string is returned, the app sets the local authentication state `isLoggedIn` to `true`. This causes React Navigation to immediately mount the main tab navigator, bypassing the login interface entirely. The session remains active until the user taps the Logout button in the Settings screen, which clears the storage keys.

#### Q19. How does the Admin App receive push notifications when the app is completely closed?
**Answer:** To receive notifications when completely closed (killed state), the app relies on Android's native system architecture. The operating system runs a persistent background listener service associated with the native Google Play Services framework. When the GoZo Node.js backend broadcasts an FCM payload, Google's servers route it directly to the device. The native OS intercepts this message, wakes up a lightweight system process, and displays the visual alert banner. When the user taps this notification, the OS launches the GoZo app, passing the message payload. The app's Javascript then initializes, and `notifee.getInitialNotification()` reads the data on startup to navigate the user.

#### Q20. What is the difference between foreground, background, and killed notification handling?
**Answer:** The application handles notifications differently depending on the device's state. In the **foreground state** (app open and active), incoming messages are intercepted silently by `messaging().onMessage()`, and the app manually displays a heads-up banner using Notifee. In the **background state** (app open but minimized), the Android system displays the notification banner natively using the message metadata. In the **killed state** (app closed), the native OS registers and renders the notification, and later boots the app when the user taps it. Tap actions in both background and foreground trigger Notifee's `onForegroundEvent` to route the user, while the killed state tap uses `notifee.getInitialNotification()` on startup. This comprehensive architecture ensures operational alerts are never missed.

#### Q21. How does the rides filter system work? How are filters applied?
**Answer:** The rides filter system allows admins to narrow down bookings by status and booking date. In `RidesScreen.tsx`, the selected status is stored in `selectedFilter` (e.g. `'Pending'`) and the date in `selectedDate`. When these variables change, a `useEffect` dependency array triggers `loadRides()`. Inside this function, the status string is mapped to lowercase (mapping `'Matched'` to `'matched'`), and the date object is formatted to a `'YYYY-MM-DD'` string using a helper. These filters are passed as query parameters to `fetchRides` in `src/api.ts`, which appends them to the HTTP GET request URL. The server processes these parameters and returns a filtered list of rides back to the client.

#### Q22. How is the countdown timer implemented in the Scheduled Rides screen?
**Answer:** There is **no live countdown timer** implemented in the current GoZo Admin App codebase. The scheduled time of a ride is fetched from the backend database as a static timestamp and formatted into a human-readable string inside `ScheduledRideCard.tsx` and `ScheduledRideDetailScreen.tsx`. To display a live countdown timer in a future release, the app would need to initialize a local state variable to hold the remaining seconds. We would then implement a `useEffect` hook containing a `setInterval` that fires every 1000 milliseconds to calculate the difference between the current date and the scheduled date. This interval would update the state and trigger a re-render showing the remaining days, hours, and minutes.

#### Q23. What happens when the Admin App loses internet connection during an API call?
**Answer:** When the internet connection drops during an API call, JavaScript's native `fetch` client fails to establish a TCP connection and throws a network error. Inside `src/api.ts`, all API functions wrap their requests in a try/catch block. When this error is thrown, the catch block intercepts it and returns a failure object like `{ success: false, error: 'Network request failed' }` instead of crashing the app. In screens like `RidesScreen.tsx`, this error message is caught and stored in the local `error` state. The UI then renders an error page to alert the admin, and the list remains empty until a new request succeeds. This guarantees clean error handling and guides the user to check their network connection.

#### Q24. Why does the Admin App not connect to Supabase directly — why go through the backend?
**Answer:** Directly connecting the Admin App to Supabase would require compiling the database's administrative secrets or API keys into the mobile binary. An attacker could extract these keys from the APK and execute destructive SQL queries directly on the database. By routing requests through the Node.js/Express backend, GoZo implements a secure intermediary layer. The backend authenticates the client using the `x-admin-token` header, validates user input, and applies business rules before executing database calls. This centralizes security rules, keeps the database hidden from public internet traffic, and makes it easier to update database schemas without modifying the mobile app. This layout is standard practice for secure multi-client web architectures.

#### Q25. How does the driver online/offline status get updated and displayed in the Admin App?
**Answer:** The online/offline status of drivers is managed on the server and fetched by the Admin App. When `DriversScreen.tsx` mounts, it calls `fetchDriversWithStatus()` which queries `GET /admin/drivers/status`. Each driver object returned has a `status` field (e.g. `'available'`, `'in_ride'`, or `'offline'`). The screen renders this status badge on each `DriverCard` using the `StatusBadge` component. Tapping a filter chip (e.g. 'Online') triggers a client-side filter that matches only drivers whose status is `'available'` or `'in_ride'`. If the driver's state changes on the backend, the admin must pull-to-refresh to fetch the updated status list. This provides real-time operational transparency to the operations team.

---

# Section 10: Advanced Viva Questions and Answers (Part 2)

This section compiles anticipated advanced viva-style questions and their corresponding technical answers to assist in senior developer training and viva preparation.

### ADVANCED QUESTIONS

#### Q26. Explain the complete architecture of the GoZo system — from a factory owner booking a ride to the Admin App showing it.
**Answer:** The GoZo system utilizes a decoupled client-server architecture with three front-end mobile applications communicating with a central backend. When a factory owner requests a shipment via the UserApp, the application registers the booking details and issues a POST request to the Node.js backend hosted on Render. The Express backend acts as the controller, validating the booking payload, saving the request record in the Supabase PostgreSQL database, and computing the optimal route. After writing to the database, the backend triggers database listeners or queries driver locations to identify available transporters. Simultaneously, the backend issues a Firebase Cloud Messaging push notification to all online drivers via their DriverApp, as well as to administrative staff via the GoZo Admin App. In the GoZo Admin App, the notification is intercepted by native FCM listeners, which trigger Notifee to display a heads-up banner to the operational team. When the admin clicks this banner, the app routes them to the nested `RideDetailScreen` using the global `navigationRef` helper.

#### Q27. What is the GoZo commission model? How is it calculated in the backend and displayed in the Admin App?
**Answer:** GoZo implements a split-fare commission model that calculates earnings and service cuts automatically for every completed shipment. When a ride finishes, the backend calculates the customer's fare as `accepted_price = max(200, distance_km * 50)` and the driver's payout as `driver_earning = max(180, distance_km * 45)`. The company's commission, stored as `gozo_cut`, is the difference between these two values, which is guaranteed to be at least a minimum of ₹20 per trip. These financial metrics are stored inside the database and aggregated by the backend server for driver profiles. The GoZo Admin App retrieves these figures by calling `fetchDriverEarnings` which queries `GET /admin/drivers/:driverId/earnings`. The screen renders these sums in a 2x2 grid card showing the driver's earnings, GoZo's commission, and total paid amounts. Outstanding debt is calculated as `totalGozoCut - totalPaid` and is rendered in bright red if it exceeds zero, alerting the operations team to collect cash settlements.

#### Q28. What are the security risks of the current Admin App and how would you improve it for a production system with 100 staff members?
**Answer:** The current Phase 1 Admin App has major security vulnerabilities, including a single hardcoded administrative PIN (`GoZo_2026`) and unencrypted local storage. In a production system with 100 staff members, a shared password makes it impossible to trace administrative actions to individual workers, leading to zero accountability. Furthermore, anyone who decompiles the Android APK file can easily extract the hardcoded configuration values and backend endpoints. To secure this system for enterprise use, the shared PIN model must be replaced with individual user accounts managed through an OAuth provider like Auth0. We would store session tokens using `react-native-keychain` instead of unencrypted `AsyncStorage` to secure credentials on the device. The backend should enforce role-based access control (RBAC) on all endpoints, verifying JWT scopes before modifying data. Finally, we would restrict access to the backend API using network firewalls, IP whitelisting, and SSL pinning.

#### Q29. What is a race condition? Can one occur in the GoZo system when two drivers simultaneously accept the same ride? How is it handled?
**Answer:** A race condition occurs when multiple concurrent operations attempt to modify the same resource database entry at the same time, leading to inconsistent state. In the GoZo ecosystem, this could happen if two drivers simultaneously tap the "Accept Ride" button for the same pending request. If the backend does not enforce concurrency limits, both drivers might write their ID to the ride record, leading to double-booking errors. To prevent this, the GoZo backend utilizes database transactions with row-level locking (SELECT FOR UPDATE) or optimistic concurrency control in PostgreSQL. When a driver attempts to accept a ride, the query verifies that the ride status is still exactly `'pending'` before updating it. If the status has already changed to `'assigned'`, the database rejects the second update request and returns a 409 Conflict error. The second driver's app receives this error and alerts them that the ride has already been claimed.

#### Q30. What is the difference between useCallback and useMemo? Give an example of where each could be used in the Admin App.
**Answer:** `useCallback` and `useMemo` are React Hooks used to optimize performance by caching values between component re-renders. `useCallback` caches the definition of a callback function itself, preventing child components from re-rendering due to receiving new function references. `useMemo` runs an expensive calculation on mount and caches the resulting value, re-computing it only when its declared dependencies change. In the GoZo Admin App, `useCallback` could be used to wrap the `onPress` navigation handler in lists to prevent the `RideCard` from rebuilding on every parent render. Conversely, `useMemo` could optimize `DriversScreen.tsx` by memoizing the client-side text filtering logic over the driver list. Since the search is client-side, using `useMemo` would ensure that we only filter the array when `searchQuery` or `drivers` change. This prevents unnecessary array operations during minor visual updates, preserving system memory.

#### Q31. How would you implement pagination for the rides list if there were 10,000 rides in the database?
**Answer:** Rendering 10,000 rides in a single flat list would cause substantial network latency, server strain, and mobile memory depletion. To solve this, we would implement cursor-based or limit-offset pagination on both the backend database queries and the mobile client. The backend endpoint `/admin/rides` would be updated to accept `limit` and `page` (or `cursor`) query parameters. In the Admin App, the `fetchRides` function would pass these parameters and append the newly fetched rides to the existing state array instead of overwriting it. The `FlatList` component would leverage its `onEndReached` prop to trigger the next fetch call when the user scrolls near the bottom. An `onEndReachedThreshold` of 0.5 would ensure that the next page load begins seamlessly before the user finishes scrolling. Finally, we would display a loading spinner at the list footer using the `ListFooterComponent` prop while the next page is loading.

#### Q32. What is the N+1 query problem? Does it exist anywhere in the GoZo Admin App's API calls?
**Answer:** The N+1 query problem occurs when an application executes one initial query to fetch a list of records, and then makes N subsequent queries to fetch related data for each individual record in that list. In this project, this could occur if the rides list fetched booking details, and then the app had to make separate API requests for every single card to retrieve user or driver profiles. Fortunately, the GoZo backend avoids this issue by performing SQL joins inside the PostgreSQL database. When the backend queries `/admin/rides`, it performs a single join query to retrieve the ride details alongside its associated user and driver profiles. This allows the server to return the complete dataset in one unified JSON payload, requiring only a single query. However, if the client developer was to call `fetchRideDetail` for every list item during rendering, they would trigger this problem client-side. Thus, keeping data nested in the primary list payload is crucial for network efficiency.

#### Q33. How would you add role-based access control (e.g. dispatcher vs manager) to the Admin App?
**Answer:** Role-based access control (RBAC) restricts system access based on the user's assigned organizational role. To implement this in GoZo, we would first update the database schema to include a `role` column (e.g. `'dispatcher'` or `'manager'`) in the admin accounts table. When an administrative staff member logs in, the backend would encode their assigned role within the claims payload of the signed JWT. On the mobile client, the React Native app would decode this JWT to determine their permission scope. In the navigation layer, we could conditionally hide or disable screens and buttons depending on the user's role. For example, only users with the `'manager'` role would be allowed to view the "Settings" tab or trigger "Delete All Rides." The backend Express server would also validate these JWT claims on protected endpoints, returning a 403 Forbidden status for unauthorized requests.

#### Q34. How would you make the Admin App work offline — showing cached data when there is no internet?
**Answer:** To make the Admin App work offline, we must implement a local database caching layer and synchronize state when internet connectivity changes. We would integrate a mobile database library like WatermelonDB or AsyncStorage to store fetched rides and driver profiles locally. When the app initiates a data request, it would read and display the locally cached data first, ensuring instant load times. Simultaneously, the app would fetch fresh data from the backend API in the background to update the cache. We would use the `@react-native-community/netinfo` library to monitor the device's internet connection status in real-time. If the admin performs offline modifications, like logging a payment, the app would queue the request in a local synchronization queue. Once connectivity is restored, a background service would execute the queued API calls to update the PostgreSQL database.

#### Q35. What is the FCM token and why does it change? What happens in GoZo if the token changes and the backend still has the old one?
**Answer:** An FCM token is a unique registration string issued by Firebase Cloud Messaging to identify a specific app installation on a device. This token changes when the user reinstalls the app, clears app data, or when Firebase rotates credentials for security purposes. If a token changes but the backend database retains the old one, the backend will attempt to send push notifications using the stale token. Google's FCM servers will reject the request as "NotRegistered" or "InvalidRegistration," and the notification will fail silently. To prevent this, the GoZo Admin App listens for token updates using the `messaging().onTokenRefresh` event listener. When a token changes, the callback function immediately fires a POST request to `/admin/fcm-token` to update the record in the backend. This ensures that the server always possesses the correct address to dispatch operational alerts.

#### Q36. How would you write a unit test for the login screen of the Admin App?
**Answer:** To write a unit test for `LoginScreen.tsx`, we would use the Jest testing framework along with `@testing-library/react-native`. We would first mock the native modules that Jest cannot run, such as AsyncStorage and React Navigation. The test suite would render the login screen component and simulate user typing into the password TextInput using the `fireEvent.changeText` helper. We would then mock the `loginAdmin` API function to return a mock successful response `{ success: true, token: 'fake-jwt-token' }`. Next, the test would trigger the submit action by simulating a press on the Login button using `fireEvent.press`. We would assert that the `loginAdmin` function was called with the correct PIN entered by the user. Finally, we would verify that the app calls `AsyncStorage.setItem` and routes the user to the dashboard.

#### Q37. What is the difference between SQL and NoSQL databases? Why does GoZo use PostgreSQL (via Supabase)?
**Answer:** SQL databases are relational database management systems that store data in structured tables with strict schemas and foreign-key relationships. NoSQL databases are non-relational systems that store unstructured data as JSON documents, key-value pairs, or graphs. GoZo uses PostgreSQL, a relational SQL database hosted on Supabase, because logistics systems require strict data consistency and transactions. For example, a ride must link directly to an existing user ID and driver ID, which is enforced via SQL foreign keys. Relational integrity ensures that a driver cannot be assigned to a ride that does not exist in the system. PostgreSQL also supports ACID transactions, which prevent concurrent booking collisions and duplicate driver assignments. These strict schema checks and relational joins are much harder to maintain in document-based NoSQL systems.

#### Q38. How does React Native's bridge work? How does JavaScript communicate with native Android code?
**Answer:** React Native runs the application's JavaScript code inside a dedicated JavaScript engine thread called Hermes. However, mobile user interface elements and device features (like cameras or push notifications) require execution on native Android threads. The React Native Bridge acts as an asynchronous messaging system that translates and relays commands between these two environments. When the JavaScript thread wants to trigger a notification, it serializes the instruction into a JSON message and sends it across the bridge. The native Android thread deserializes this message and executes the native Notifee API calls in Java or Kotlin. Communication is asynchronous and non-blocking, ensuring that slow native processes do not lock the UI thread. In newer React Native versions, this bridge is being replaced by the JavaScript Interface (JSI). JSI allows JavaScript to hold direct C++ references to native host objects, eliminating serialization bottlenecks.

#### Q39. If the GoZo backend on Render goes down for 30 minutes, what happens in the Admin App? How would you make it more resilient?
**Answer:** If the Render backend crashes, any API requests made by the GoZo Admin App will fail with connection timeouts or server errors. The admin staff will see full-screen loading spinners that never resolve, or empty lists with generic network errors. Operational notifications will also stop sending, leaving staff unaware of incoming client ride bookings. To make the Admin App more resilient, we should first implement automatic retry policies with exponential backoff on all critical API calls. We would display a friendly offline status banner at the top of the screen to notify staff of server issues. Furthermore, the backend should be deployed in a high-availability environment with multiple redundant instances behind a load balancer. Finally, we could implement a local syncing cache, allowing the app to queue data modifications and execute them when the server returns online.

#### Q40. What is Phase 2 of the Admin App? What features would need to be built and what technical challenges would come with adding company and driver CRUD from a mobile interface?
**Answer:** Phase 2 of the GoZo Admin App aims to expand the system from a read-only monitoring tool into a full CRUD administrative command center. Key features will include registering new drivers, adding custom transport company profiles, and managing vehicle lists directly. Developing these features brings several technical challenges, such as building complex multi-step mobile registration forms that handle image uploads for KYC documents. We would need to implement secure multipart/form-data upload channels in `api.ts` to transmit driver license photos to Supabase storage. The UI must handle image resizing and compression on the client side to avoid slow upload speeds. We must also implement strict validation rules for document fields (e.g. Aadhaar, PAN, and IFSC codes) to prevent garbage database entries. Managing these state transitions across deep nested navigators requires a solid global state manager like Redux Toolkit. This will ensure data consistency across screens while maintaining high performance.

---

# Section 11: Conclusion

This technical documentation maps out the Phase 1 architecture of the GoZo Admin App. By implementing a typed API service layer, a responsive React Navigation layout, and Firebase Cloud Messaging/Notifee notifications, the operational app successfully provides real-time monitoring and administrative tools for GoZo operations. Hardening security structures, implementing pagination, and integrating automated payment settlements will be the focus of the Phase 2 roadmap.
