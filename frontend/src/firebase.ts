import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDWOfGlXKb2XZ0gqgKDOAAFh9ZdIq9Z6RE",
  authDomain: "smartguard-system.firebaseapp.com",
  projectId: "smartguard-system",
  storageBucket: "smartguard-system.firebasestorage.app",
  messagingSenderId: "481987146929",
  appId: "1:481987146929:web:212e9df1f277a7bb485e90"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
