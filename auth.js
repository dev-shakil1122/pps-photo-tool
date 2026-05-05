// Firebase Configuration
// REPLACE THIS WITH YOUR FIREBASE CONFIG FROM CONSOLE
const firebaseConfig = {
    apiKey: "AIzaSyA89_lXwNv_u1rTFCEQVfNt4WkmEwoCBdQ",
    authDomain: "master-tool-8154b.firebaseapp.com",
    projectId: "master-tool-8154b",
    storageBucket: "master-tool-8154b.firebasestorage.app",
    messagingSenderId: "482521828970",
    appId: "1:482521828970:web:5034b92a37361cc1864413",
    measurementId: "G-B9MRN51R67"
};

// Initialize Firebase (Check if script is loaded first)
let db;
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
} else {
    console.error('Firebase SDK not loaded.');
}

// Auth State Logic
function checkAuth(redirectIfFound = false) {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // User IS logged in
            console.log('User:', user.email);
            if (redirectIfFound) {
                // If on login page, go to dashboard
                window.location.href = 'index.html';
            }
        } else {
            // User is NOT logged in
            console.log('No user');
            if (!redirectIfFound) {
                // If on protected page, go to login
                // Handle relative paths - Check if we are deep in tools
                const path = window.location.pathname;
                if (path.includes('/tools/')) {
                    // Go up two levels from tools/TOOL_NAME/index.html
                    window.location.href = '../../login.html';
                } else {
                    window.location.href = 'login.html';
                }
            }
        }
    });
}

// --- NEW: Get API Key from Firestore ---
function waitForAuth() {
    return new Promise((resolve) => {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user);
        });
    });
}

async function getUserApiKey() {
    let user = firebase.auth().currentUser;
    if (!user) {
        user = await waitForAuth();
    }

    if (!user) throw new Error("User not logged in. Please reload or login again.");

    // 1. Check Local Storage (Persistent)
    const cacheKey = `fal_key_${user.email}`;
    const cachedKey = localStorage.getItem(cacheKey);
    if (cachedKey) return cachedKey;

    // 2. Try to get user-specific key
    const userDoc = await db.collection('users').doc(user.email).get();

    if (userDoc.exists && userDoc.data().fal_key) {
        const key = userDoc.data().fal_key;
        localStorage.setItem(cacheKey, key); // Save permanently
        return key;
    }

    throw new Error(`No API Key found for user: ${user.email}. Please verify Firestore Database setup.`);
}

function login(email, password) {
    // Force Session Persistence (Logout on tab close)
    return firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(() => {
            return firebase.auth().signInWithEmailAndPassword(email, password);
        })
        .then(() => {
            window.location.href = 'index.html';
        })
        .catch((error) => {
            console.error(error);
            alert('Login Failed: ' + error.message);
        });
}

function logout() {
    firebase.auth().signOut().then(() => {
        window.location.href = 'login.html'; // Or ../../login.html if inside tool
    }).catch((error) => {
        console.error('Logout failed', error);
    });
}
