import { auth } from "./firebase-config.js";
import { logout } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Cloud Function endpoint that accepts payload: { date, prayer_type, time, token }
const CLOUD_FUNCTION_URL =
  "https://us-central1-bais-website.cloudfunctions.net/bais_shul_times";

function normalizeTime(t) {
  // Accept "HH:MM" or "HH:MM:SS" and normalize to "HH:MM:SS"
  if (!t) return t;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  return t;
}

function setStatus(el, text, kind = "info") {
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("prayer-time-form");
  const dateEl = document.getElementById("prayer-date");
  const typeEl = document.getElementById("prayer-type");
  const timeEl = document.getElementById("prayer-time");
  const previewEl = document.getElementById("payload-preview");
  const statusEl = document.getElementById("submit-status");
  const logoutBtn = document.getElementById("logout-btn");

  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  function updatePreview(token = "") {
    const payload = {
      date: dateEl?.value || "",
      prayer_type: typeEl?.value || "",
      time: normalizeTime(timeEl?.value || ""),
      token: token ? `${token.slice(0, 24)}...` : "",
    };
    if (previewEl) previewEl.textContent = JSON.stringify(payload, null, 2);
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Show the login modal instead of redirecting
      const modal = document.getElementById("login-modal");
      const loginBtn = document.getElementById("login-btn");
      if (loginBtn) loginBtn.style.display = "inline-block";
      if (modal) modal.style.display = "block";
      return;
    }
    try {
      const token = await user.getIdToken();
      updatePreview(token);
    } catch {
      updatePreview("");
    }
  });

  ["change", "input"].forEach((evt) => {
    dateEl?.addEventListener(evt, () => updatePreview(""));
    typeEl?.addEventListener(evt, () => updatePreview(""));
    timeEl?.addEventListener(evt, () => updatePreview(""));
  });

  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(statusEl, "Submitting to Cloud Function...", "info");

    const user = auth.currentUser;
    if (!user) {
      setStatus(statusEl, "Not logged in. Please log in again.", "error");
      return;
    }

    try {
      const token = await user.getIdToken();
      const payload = {
        date: dateEl.value,
        prayer_type: typeEl.value,
        time: normalizeTime(timeEl.value),
        token, // Included as required by the Cloud Function
      };

      // Show the exact shape requested (with real token) right before submit
      if (previewEl) previewEl.textContent = JSON.stringify(payload, null, 2);

      const res = await fetch(CLOUD_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      setStatus(statusEl, "Saved via Cloud Function ✅", "success");
    } catch (err) {
      console.error("Submission error:", err);
      setStatus(statusEl, `Error: ${err.message}`, "error");
    }
  });
});



