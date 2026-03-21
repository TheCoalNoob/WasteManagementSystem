// ===== FIREBASE CONFIGURATION & INITIALIZATION =====
// Using Firebase Realtime Database — NO authentication

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    push,
    update,
    remove,
    onValue,
    get,
    child,
    query,
    orderByChild,
    equalTo
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyD5hOFQHDQm9AQXTWxCsCgRetWSlW7LEf8",
    authDomain: "wastemanagementsystem-b68c1.firebaseapp.com",
    databaseURL: "https://wastemanagementsystem-b68c1-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "wastemanagementsystem-b68c1",
    storageBucket: "wastemanagementsystem-b68c1.firebasestorage.app",
    messagingSenderId: "832305900456",
    appId: "1:832305900456:web:8fbdcddbc5734524868b9d",
    measurementId: "G-NLVGR55TR0"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Export everything needed by app.js
export {
    db,
    ref,
    set,
    push,
    update,
    remove,
    onValue,
    get,
    child,
    query,
    orderByChild,
    equalTo
};
