/**
 * Sets CORS on Firebase Storage bucket using Firebase CLI credentials.
 * Usage: node firebase/set-cors.mjs
 */
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const BUCKET = "chordmini-5ea94.firebasestorage.app";
const CORS_FILE = join(import.meta.dirname, "cors.json");
const FIREBASE_CONFIG = join(
  homedir(),
  ".config",
  "configstore",
  "firebase-tools.json"
);
const CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

async function getAccessToken() {
  const config = JSON.parse(readFileSync(FIREBASE_CONFIG, "utf8"));
  const refreshToken = config.tokens.refresh_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function setCors() {
  const cors = JSON.parse(readFileSync(CORS_FILE, "utf8"));
  const accessToken = await getAccessToken();

  console.log(`Setting CORS on gs://${BUCKET} ...`);

  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${BUCKET}?fields=cors`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cors }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to set CORS: ${res.status} ${text}`);
  }

  const result = await res.json();
  console.log("CORS set successfully!");
  console.log(JSON.stringify(result.cors, null, 2));
}

setCors().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
