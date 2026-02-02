/**
 * fetch.js (CommonJS – STABLE)
 * Runs in GitHub Actions
 * Fetches OpenWeather data and pushes to WordPress
 */

const fs = require("fs");
const fetch = require("node-fetch");

const LOCATIONS_FILE = "./locations.json";
const DAYS = 8;

const OPENWEATHER_API = "https://api.openweathermap.org/data/3.0/onecall";
const API_KEY = process.env.OPENWEATHER_API_KEY;
const WP_ENDPOINT = process.env.WP_ENDPOINT;
const WP_SECRET = process.env.WP_SECRET;

if (!API_KEY || !WP_ENDPOINT || !WP_SECRET) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

const locations = JSON.parse(fs.readFileSync(LOCATIONS_FILE, "utf8"));

async function fetchWeather(lat, lon) {
  const url =
    `${OPENWEATHER_API}?lat=${lat}&lon=${lon}` +
    `&exclude=minutely,hourly,alerts&units=metric&appid=${API_KEY}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`OpenWeather API failed (${res.status})`);
  }

  return res.json();
}

(async () => {
  const payload = [];

  for (const loc of locations) {
    try {
      console.log(`🌤 Fetching: ${loc.label}`);

      const data = await fetchWeather(loc.lat, loc.lon);

      if (!data.daily) throw new Error("No daily data");

      payload.push({
        lat: loc.lat,
        lon: loc.lon,
        daily: data.daily.slice(0, DAYS),
      });

    } catch (err) {
      console.error(`⚠ Failed for ${loc.label}:`, err.message);
    }
  }

  if (!payload.length) {
    console.error("❌ No data fetched for any location");
    process.exit(1);
  }

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

  console.log("✅ WordPress response:", text);

  if (!res.ok) {
    process.exit(1);
  }
})();
