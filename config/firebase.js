import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

console.log('🔥 Firebase: Début de l\'initialisation');

const firebaseConfig = {
  apiKey: "AIzaSyD2nyliFJZZy5Do3dLJ4kxADW04emL75OM",
  authDomain: "lini-47633.firebaseapp.com",
  databaseURL: "https://lini-47633-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "lini-47633",
  storageBucket: "lini-47633.firebasestorage.app",
  messagingSenderId: "296042269081",
  appId: "1:296042269081:web:031070b56be942fabaab08",
  measurementId: "G-JTXNWQP065"
};

// Initialize Firebase
console.log('🔥 Firebase: Initialisation de l\'app');
const app = initializeApp(firebaseConfig);
console.log('✅ Firebase: App initialisée');

// Initialize Firebase Auth with AsyncStorage persistence
console.log('🔐 Firebase: Initialisation de l\'auth avec AsyncStorage');
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
console.log('✅ Firebase: Auth initialisée');

// Initialize other Firebase services
console.log('💾 Firebase: Initialisation de Firestore et Storage');
export const db = getFirestore(app);
export const storage = getStorage(app);
console.log('✅ Firebase: Tous les services initialisés');

export default app;
