// This server-side module initializes Firebase Admin SDK for Firestore access
import 'server-only';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Check if we have already initialized the app to avoid "App already exists" errors
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Handle the private key newline characters strictly
      privateKey: process.env.FIREBASE_PRIVATE_KEY 
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
        : undefined,
    }),
  });
}

export const adminDb = getFirestore();