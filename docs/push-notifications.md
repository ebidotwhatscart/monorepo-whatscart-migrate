# Firebase order push notifications

The dashboard push flow uses Firebase Cloud Messaging for delivery and Firestore for the in-app notification history. A store owner must be signed in and enable alerts from the dashboard bell. Orders placed through the public order API create the in-app notification and send a push to each registered owner device.

## Firebase configuration

Set these values in the deployment environment for each Firebase project:

- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (Firebase project number / Cloud Messaging sender ID)
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (the public Web Push certificate key from Firebase Console → Project settings → Cloud Messaging → Web Push certificates)
- `FIREBASE_PROJECT_ID` and server credentials. On Google-hosted runtimes use Application Default Credentials; elsewhere set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` for a service account allowed to send Firebase Cloud Messaging messages.

The site's production origin must be authorized for Firebase Authentication and configured for the Firebase web app. Keep the VAPID key and sender ID from the same Firebase project as the client app and Admin credentials. The private service-account key must remain server-side and must never use a `NEXT_PUBLIC_` variable.

`/sw.js` is generated at the root scope and includes Firebase's background message handler only when `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` is configured. The service worker and VAPID key must be available from the same deployed origin before users enable alerts. Missing client messaging values cause push registration to remain inactive; they do not prevent the in-app notification history from working.

## Delivery flow

1. An owner chooses **Enable order alerts** from the dashboard notification bell.
2. The browser grants notification permission; the client obtains an FCM token and registers it through the authenticated device API.
3. A public order creates a Firestore notification for the business owner and sends a push through Firebase Admin to that owner's device tokens.
4. Foreground and background pushes open the order detail page. Invalid FCM tokens are removed after a send attempt.
5. Signing out removes the current browser token from that user's device list.

Real push delivery requires a deployed Firebase project and browser permission. Firebase Auth and Firestore emulators can exercise the API and notification-history paths, but they do not validate delivery through FCM.
