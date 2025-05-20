require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const {
  TENANT_ID,
  CLIENT_ID,
  CLIENT_SECRET,
  SHAREPOINT_DRIVE_ID,
} = process.env;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const tokenParams = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
  });

  console.log("[Step 1] Requesting new access token...");
  const tokenRes = await axios.post(tokenUrl, tokenParams.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const accessToken = tokenRes.data.access_token;
  const expiresIn = tokenRes.data.expires_in; // in seconds

  if (!accessToken) throw new Error("Access token was not received.");

  cachedToken = accessToken;
  tokenExpiresAt = now + (expiresIn - 60) * 1000;

  console.log("[Step 1] Access token acquired and cached.");
  return accessToken;
}

app.get("/api/sharepoint/recent-file", async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    const folderPath = "BY Observer/BYSO Files/BYSO";

    const filesUrl = `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root:/${encodeURIComponent(folderPath)}:/children?$orderby=lastModifiedDateTime desc&$top=1`;

    console.log("[Step 2] Fetching most recent file from folder:", folderPath);
    const fileRes = await axios.get(filesUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const files = fileRes.data.value;
    if (!files || files.length === 0) {
      console.error("[Step 2] No files found.");
      return res.status(404).json({ error: "No files found in the specified folder." });
    }

    const file = files[0];
    console.log("[Step 2] Most recent file:", file.name);

    const downloadUrl = file["@microsoft.graph.downloadUrl"];
    if (!downloadUrl) throw new Error("Download URL is missing.");

    console.log("[Step 3] Downloading file content...");
    const contentRes = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
    });

    res.set("Content-Type", contentRes.headers["content-type"] || "application/octet-stream");
    res.send(contentRes.data);
    console.log("[Step 3] File content sent successfully.");
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error("Graph API error:", errorMsg);
    res.status(500).json({ error: errorMsg });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
