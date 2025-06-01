require("dotenv").config();
import express, { json } from "express";
import { post, get } from "axios";
import cors from "cors";

const app = express();

app.use(cors({
  origin: "https://david654100.github.io"
}));

app.use(json());

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

  const tokenRes = await post(tokenUrl, tokenParams.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const accessToken = tokenRes.data.access_token;
  const expiresIn = tokenRes.data.expires_in;

  if (!accessToken) throw new Error("Access token was not received.");

  cachedToken = accessToken;
  tokenExpiresAt = now + (expiresIn - 60) * 1000;

  return accessToken;
}

app.get("/api/sharepoint/recent-file", async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    const folderName = req.query.folder;
    if (!folderName) {
      return res.status(400).json({ error: "Missing folder query parameter." });
    }

    const folderPath = `BY Observer/BYSO Files/${folderName.replace(/_/g, " ")}`;

    const filesUrl = `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root:/${encodeURIComponent(folderPath)}:/children?$orderby=lastModifiedDateTime desc&$top=1`;

    const fileRes = await get(filesUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const files = fileRes.data.value;
    if (!files || files.length === 0) {
      return res.status(404).json({ error: "No files found in the specified folder." });
    }

    const file = files[0];
    const downloadUrl = file["@microsoft.graph.downloadUrl"];
    if (!downloadUrl) throw new Error("Download URL is missing.");

    const contentRes = await get(downloadUrl, {
      responseType: "arraybuffer",
    });

    res.set("Content-Type", contentRes.headers["content-type"] || "application/octet-stream");
    res.set("Content-Disposition", `inline; filename="${file.name}"`);
    res.send(contentRes.data);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error("Graph API error:", errorMsg);
    res.status(500).json({ error: errorMsg });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
