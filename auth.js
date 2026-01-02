import { auth } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export function signInWithEmail(email, password) {
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            console.log("User signed in:", userCredential.user);
            closeLoginModal();
            // Send admins to the admin entry form after successful login
            if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/" || window.location.pathname === "") {
                window.location.href = "admin.html";
            }
        })
        .catch((error) => {
            console.error("Error signing in:", error);
            alert("Error signing in: " + error.message);
        });
}

export function logout() {
    signOut(auth).then(() => {
        console.log("User signed out");
    }).catch((error) => {
        console.error("Error signing out:", error);
    });
}

function updateAuthUI(user) {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userDisplay = document.getElementById('user-display');

    if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (userDisplay) {
            userDisplay.textContent = `Hello, ${user.displayName || user.email}`;
            userDisplay.style.display = 'block';
        }
    } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (userDisplay) userDisplay.style.display = 'none';
    }
}

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
    updateAuthUI(user);
});

// Modal Logic
function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
}
