import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBFXGeQ0OytxoSKwgj8o1gdf7m7O0VwNEk",
  authDomain: "callingcrm-9c9fd.firebaseapp.com",
  projectId: "callingcrm-9c9fd",
  storageBucket: "callingcrm-9c9fd.firebasestorage.app",
  messagingSenderId: "637296400354",
  appId: "1:637296400354:web:bfa1fb963f02dcc4fa0bbb",
  measurementId: "G-V2FLHY5XNH",
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let firebaseAuth;
try {
  firebaseAuth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  firebaseAuth = getAuth(app);
}

export const auth = firebaseAuth;
