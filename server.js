import dotenv from "dotenv";
dotenv.config();

import express from "express";
import axios from "axios";
import cors from "cors";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";


const app = express();

// CORS: allow the site(s) that host the frontend
const allowedOrigins = new Set([
  "https://david654100.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
]);
app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser clients (no Origin header)
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json());

function initFirebaseAdmin() {
  if (admin.apps.length) return;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const svc = JSON.parse(json);
    admin.initializeApp({
      credential: admin.credential.cert(svc),
    });
    return;
  }

  // Fallback for environments that provide default credentials
  admin.initializeApp();
}

initFirebaseAdmin();
const db = getFirestore();

app.get("/", (req, res) => {
  res.send("✅ SharePoint file API is alive");
});

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", process.env.CLIENT_ID);
  params.append("client_secret", process.env.CLIENT_SECRET);
  params.append("scope", "https://graph.microsoft.com/.default");

  const response = await axios.post(tokenUrl, params.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  cachedToken = response.data.access_token;
  tokenExpiresAt = now + (response.data.expires_in - 60) * 1000;

  return cachedToken;
}


async function getMostRecentFile(folderPath, accessToken) {
  let files = [];
  let url = `https://graph.microsoft.com/v1.0/drives/${process.env.SHAREPOINT_DRIVE_ID}/root:/${encodeURIComponent(folderPath)}:/children`;

  while (url) {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    files.push(...res.data.value);
    url = res.data["@odata.nextLink"];
  }

  const onlyFiles = files.filter(item => item.file);

  console.log(`📄 Fetching from: ${folderPath}`);
  console.log("📄 Fetched files:");

  onlyFiles.forEach(file => {
    console.log(`- ${file.name} | Modified: ${file.lastModifiedDateTime}`);
  });

  if (onlyFiles.length === 0) {
    throw new Error("No files found in the folder.");
  }

  onlyFiles.sort((a, b) => new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime));
  return onlyFiles[0];
}


app.get("/api/token-test", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ message: "Access token retrieved successfully ✅", token });
  } catch (err) {
    console.error("❌ Token error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.get("/api/sharepoint/recent-file", async (req, res) => {
  try {
    const folder = req.query.folder;
    if (!folder) return res.status(400).json({ error: "Missing folder query parameter" });

    const accessToken = await getAccessToken();

    const folderPath = `BY Observer/BYSO Files/${folder.replace(/_/g, " ")}`;
    
    const latestFile = await getMostRecentFile(folderPath, accessToken);

    const fileResponse = await axios.get(latestFile["@microsoft.graph.downloadUrl"], {
      responseType: "arraybuffer"
    });

    res.set({
      "Cache-Control": "no-store",
      "Content-Type": fileResponse.headers["content-type"] || "application/pdf",
      "Content-Disposition": `inline; filename="${latestFile.name}"`
    });

    res.send(fileResponse.data);
  } catch (err) {
    console.error("❌ Error fetching file:", err.message);
    res.status(500).json({ error: err.message });
  }
});

function normalizeTime(t) {
  if (typeof t !== "string") return t;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  return t;
}

function isValidDateYYYYMMDD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function extractBearer(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

app.post("/api/admin/prayer-time", async (req, res) => {
  try {
    const token = req.body?.token || extractBearer(req);
    if (!token) return res.status(401).json({ error: "Missing Firebase token" });

    const decoded = await admin.auth().verifyIdToken(token);

    // Optional: restrict to specific admin email(s)
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (adminEmails.length && !adminEmails.includes((decoded.email || "").toLowerCase())) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { date, prayer_type, time } = req.body || {};
    if (!isValidDateYYYYMMDD(date)) {
      return res.status(400).json({ error: "Invalid 'date'. Expected YYYY-MM-DD." });
    }
    const allowedTypes = new Set(["mincha", "maariv", "shachrit"]);
    if (!allowedTypes.has(prayer_type)) {
      return res.status(400).json({ error: "Invalid 'prayer_type'." });
    }
    const normTime = normalizeTime(time);
    if (typeof normTime !== "string" || !/^\d{2}:\d{2}:\d{2}$/.test(normTime)) {
      return res.status(400).json({ error: "Invalid 'time'. Expected HH:MM or HH:MM:SS." });
    }

    const docId = `${date}_${prayer_type}`;
    await db
      .collection("prayer_times")
      .doc(docId)
      .set(
        {
          date,
          prayer_type,
          time: normTime,
          updatedAt: FieldValue.serverTimestamp(),
          updatedByUid: decoded.uid,
          updatedByEmail: decoded.email || null,
        },
        { merge: true }
      );

    return res.json({
      ok: true,
      id: docId,
      data: { date, prayer_type, time: normTime },
    });
  } catch (err) {
    console.error("❌ Error saving prayer time:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});