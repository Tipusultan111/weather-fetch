/**
 * fetch.js
 * Runs in GitHub Actions
 * Fetches OpenWeather data and pushes to WordPress
 * Compatible with node-fetch@2 (CommonJS)
 */

const fs = require("fs");
const fetch = require("node-fetch");

const LOCATIONS_FILE = "./locations.json";
const DAYS = 8;

const OPENWEATHER_API = "https://api.openweathermap.org/data/3.0/onecall";

const API_KEY = process.env.OPENWEATHER_API_KEY;
const WP_ENDPOINT = process.env.WP_ENDPOINT;
const WP_SECRET = process.env.WP_SECRET;

/* -----------------------
   Safety checks
----------------------- */
if (!API_KEY || !WP_ENDPOINT || !WP_SECRET) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

if (!fs.existsSync(LOCATIONS_FILE)) {
  console.error("❌ locations.json not found");
  process.exit(1);
}

/* -----------------------
   Load locations
----------------------- */
let locations;
try {
  locations = JSON.parse(fs.readFileSync(LOCATIONS_FILE, "utf8"));
} catch (err) {
  console.error("❌ Invalid locations.json");
  process.exit(1);
}

/* -----------------------
   Fetch weather
----------------------- */
async function fetchWeather(lat, lon) {
  const url =
    `${OPENWEATHER_API}` +
    `?lat=${lat}` +
    `&lon=${lon}` +
    `&exclude=minutely,hourly,alerts` +
    `&units=metric` +
    `&appid=${API_KEY}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`OpenWeather failed (${res.status})`);
  }

  return res.json();
}

/* -----------------------
   Main runner
----------------------- */
(async () => {
  const payload = [];

  for (const loc of locations) {
    try {
      console.log(`🌤 Fetching: ${loc.label}`);

      const data = await fetchWeather(loc.lat, loc.lon);

      if (!data.daily || !data.daily.length) {
        console.warn(`⚠ No daily data for ${loc.label}`);
        continue;
      }

      payload.push({
        lat: loc.lat,
        lon: loc.lon,
        daily: data.daily.slice(0, DAYS),
      });

    } catch (err) {
      console.error(`❌ Failed: ${loc.label}`, err.message);
    }
  }

  if (!payload.length) {
    console.error("❌ No weather data collected");
    process.exit(1);
  }

  /* -----------------------
     Push to WordPress
  ----------------------- */
  console.log("📤 Sending data to WordPress…");

  const res = await fetch(WP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cwf-secret": WP_SECRET,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("❌ WordPress rejected data:", text);
    process.exit(1);
  }

  console.log("✅ WordPress response:", text);
  console.log("🎉 Weather fetch completed successfully");

  // IMPORTANT: end process (prevents infinite loading)
  process.exit(0);

})().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
