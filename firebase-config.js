// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/setup#config-object
const firebaseConfig = {
  apiKey: "AIzaSyDtvzo9oE0qdFRbm6qIW9Eq1pEZEUxoFno",
  authDomain: "bais-website.firebaseapp.com",
  projectId: "bais-website",
  storageBucket: "bais-website.firebasestorage.app",
  messagingSenderId: "437164593673",
  appId: "1:437164593673:web:c2ffb2dda2e8c1cd79ded8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);