require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const {
  TENANT_ID,
  CLIENT_ID,
  CLIENT_SECRET,
  SHAREPOINT_DRIVE_ID,
  PORT = 3001,
} = process.env;

let cachedToken = null;
let tokenExpiresAt = 0;

function log(message) {
  const logLine = `[${new Date().toISOString()}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(path.join(__dirname, "debug.log"), logLine);
}

// Step 1: Get access token
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  log("[Auth] Requesting new access token...");
  const response = await axios.post(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  cachedToken = response.data.access_token;
  tokenExpiresAt = now + (response.data.expires_in - 60) * 1000;
  log("[Auth] Access token acquired.");
  return cachedToken;
}

// Step 2: Get most recently modified file
async function getMostRecentFile(folderPath, accessToken) {
  let files = [];
  let nextUrl = `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root:/${folderPath}:/children?$top=200`;

  while (nextUrl) {
    log(`[Graph] Fetching: ${nextUrl}`);
    const res = await axios.get(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.data.value || res.data.value.length === 0) {
      log("❌ No items returned in this page.");
    }

    res.data.value.forEach((f) => {
      const type = f.folder ? "folder" : "file";
      log(`- ${f.name} | type: ${type} | modified: ${f.lastModifiedDateTime}`);
    });

    files.push(...res.data.value);
    nextUrl = res.data["@odata.nextLink"];
  }

  const onlyFiles = files.filter((f) => f.file);
  if (onlyFiles.length === 0) throw new Error("No files found.");

  onlyFiles.sort((a, b) => {
    const dateDiff = new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime);
    return dateDiff !== 0 ? dateDiff : b.name.localeCompare(a.name);
  });

  const mostRecent = onlyFiles[0];
  log(`[Recent] Most recent file: ${mostRecent.name}`);

  const fileContent = await axios.get(mostRecent["@microsoft.graph.downloadUrl"], {
    responseType: "arraybuffer",
  });

  return {
    buffer: fileContent.data,
    fileName: mostRecent.name,
    contentType: fileContent.headers["content-type"],
  };
}

// API: /api/sharepoint/recent-file
app.get("/api/sharepoint/recent-file", async (req, res) => {
  try {
    const folder = req.query.folder;
    if (!folder) return res.status(400).json({ error: "Missing folder query parameter." });

    const folderPath = `BY Observer/BYSO Files/${folder.replace(/_/g, " ")}`;
    log(`[Route] Requesting folder: ${folderPath}`);

    const token = await getAccessToken();
    const file = await getMostRecentFile(folderPath, token);

    res.set("Content-Type", file.contentType);
    res.set("Content-Disposition", `inline; filename="${file.fileName}"`);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Expires", "0");
    res.set("Pragma", "no-cache");

    res.send(file.buffer);
  } catch (err) {
    log(`❌ Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// API: /api/sharepoint/list-folders
app.get("/api/sharepoint/list-folders", async (req, res) => {
  try {
    const folderPath = req.query.path || "";
    const baseUrl = `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root${folderPath ? `:/${folderPath}` : ""}:/children`;

    log(`[List] Listing: ${baseUrl}`);

    const token = await getAccessToken();
    const response = await axios.get(baseUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const items = response.data.value.map((item) => ({
      name: item.name,
      isFolder: !!item.folder,
      modified: item.lastModifiedDateTime,
      path: item.parentReference?.path,
    }));

    log(`[List] Found ${items.length} items.`);
    res.json({ path: folderPath || "/", items });
  } catch (err) {
    log(`❌ Folder listing failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  log(`✅ Server running on http://localhost:${PORT}`);
});
