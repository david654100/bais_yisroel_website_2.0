require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");


const app = express();
app.use(cors({ origin: "https://david654100.github.io" }));
app.use(express.json());

const {
  TENANT_ID,
  CLIENT_ID,
  CLIENT_SECRET,
  SHAREPOINT_DRIVE_ID
} = process.env;

let cachedToken = null;
let tokenExpiresAt = 0;

// Step 1: Get access token
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

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
  return cachedToken;
}

//Step 2
async function getMostRecentFile(folderPath, accessToken) {
  let files = [];
  // let nextUrl = `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root:/${encodeURIComponent(folderPath)}:/children?$top=200`;
  let nextUrl = `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root:/${folderPath}:/children?$top=200`;


  while (nextUrl) {
    const res = await axios.get(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log("✅ Raw page from Graph:");
    if (!res.data.value || res.data.value.length === 0) {
      console.log("❌ No items returned in this page.");
    }

    res.data.value.forEach((f) => {
      console.log(
        `- ${f.name} | type: ${f.folder ? "folder" : "file"} | modified: ${f.lastModifiedDateTime}`
      );
    });

    files.push(...res.data.value);
    nextUrl = res.data["@odata.nextLink"];
  }

  const onlyFiles = files.filter((f) => f.file);
  if (onlyFiles.length === 0) throw new Error("No files found.");

  console.log("✅ Files filtered (only files):");
  onlyFiles.forEach((f) => {
    console.log(`- ${f.name} | Modified: ${f.lastModifiedDateTime}`);
  });

  onlyFiles.sort((a, b) => {
    const dateDiff = new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime);
    return dateDiff !== 0 ? dateDiff : b.name.localeCompare(a.name);
  });

  const mostRecent = onlyFiles[0];
  console.log(`[Step 2] Most recent file: ${mostRecent.name}`);

  const fileContent = await axios.get(mostRecent["@microsoft.graph.downloadUrl"], {
    responseType: "arraybuffer",
  });

  return {
    buffer: fileContent.data,
    fileName: mostRecent.name,
    contentType: fileContent.headers["content-type"],
  };
}


// // Step 2: Get most recently modified file in a folder (recursive paging)
// async function getMostRecentFile(folderPath, accessToken) {
//   let files = [];
//   let nextUrl = `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root:/${encodeURIComponent(folderPath)}:/children?$top=200`;

//   while (nextUrl) {
//     const res = await axios.get(nextUrl, {
//       headers: { Authorization: `Bearer ${accessToken}` },
//     });

//     files.push(...res.data.value);
//     // Right after getting a page of results:
//     console.log("Raw page from Graph:");
//     res.data.value.forEach(f => {
//       console.log(`- ${f.name} | type: ${f.folder ? "folder" : "file"} | modified: ${f.lastModifiedDateTime}`);
//     });

    
//     nextUrl = res.data["@odata.nextLink"];
//   }

//   // const onlyFiles = files.filter(f => f.file);
//   // if (onlyFiles.length === 0) throw new Error("No files found.");
//   // const onlyFiles = files.filter(f => f.file);

//   const onlyFiles = files.filter(f => f.file);
//   console.log("Files in folder:");
//   onlyFiles.forEach(f => {
//     console.log(`- ${f.name} | Modified: ${f.lastModifiedDateTime}`);
//   });


//   console.log("Files in folder:", onlyFiles.map(f => ({
//     name: f.name,
//     modified: f.lastModifiedDateTime,
//   })));


//   // onlyFiles.sort((a, b) => new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime));
//   onlyFiles.sort((a, b) => {
//     const dateDiff = new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime);
//     return dateDiff !== 0 ? dateDiff : b.name.localeCompare(a.name);
//   });
  

//   const mostRecent = onlyFiles[0];
//   const fileContent = await axios.get(mostRecent["@microsoft.graph.downloadUrl"], {
//     responseType: "arraybuffer",
//   });

//   return {
//     buffer: fileContent.data,
//     fileName: mostRecent.name,
//     contentType: fileContent.headers["content-type"],
//   };
// }

// Step 3: Endpoint
app.get("/api/sharepoint/recent-file", async (req, res) => {
  try {
    const folder = req.query.folder;
    if (!folder) return res.status(400).json({ error: "Missing folder query parameter." });

    const folderPath = `BY Observer/BYSO Files/${folder.replace(/_/g, " ")}`;
    console.log("Requesting folder:", folderPath);

    const token = await getAccessToken();
    const file = await getMostRecentFile(folderPath, token);

    res.set("Content-Type", file.contentType);
    res.set("Content-Disposition", `inline; filename="${file.fileName}"`);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Expires", "0");
    res.set("Pragma", "no-cache");

    res.send(file.buffer);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/sharepoint/list-folders", async (req, res) => {
  try {
    const token = await getAccessToken();
    const folderPath = req.query.path || "";
    const baseUrl = `https://graph.microsoft.com/v1.0/drives/${SHAREPOINT_DRIVE_ID}/root${folderPath ? `:/${folderPath}` : ""}:/children`;

    console.log(`[List] Requesting: ${baseUrl}`);

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

    res.json({ path: folderPath || "/", items });
  } catch (err) {
    console.error("Folder listing failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});


// Step 4: Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
