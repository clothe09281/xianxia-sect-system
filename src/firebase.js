import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyACk3YO4ryglELbhsYOdXnICrN11lJqkJ0",
  authDomain: "class601-e350f.firebaseapp.com",
  projectId: "class601-e350f",
  storageBucket: "class601-e350f.firebasestorage.app",
  messagingSenderId: "967815039715",
  appId: "1:967815039715:web:74b31557b5f883fe2713d6",
  measurementId: "G-65VFP8EBVY"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
