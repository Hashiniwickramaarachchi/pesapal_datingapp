// firebase.js
const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDE8UYxc1zP_t-6u5oCWgS8mi_jM5EAICs",
    authDomain: "appexlove-e7972.firebaseapp.com",
    databaseURL: "https://appexlove-e7972-default-rtdb.firebaseio.com",
    projectId: "appexlove-e7972",
    storageBucket: "appexlove-e7972.appspot.com",
    messagingSenderId: "972396664960",
    appId: "1:972396664960:web:2279e76bc8c8f04fc7ee65",
    measurementId: "G-2XXW7K7PF7"
};

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

module.exports = { db };
