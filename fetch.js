/**
 * fetch.js — FINAL STABLE VERSION
 */

const fs = require("fs");
const fetch = require("node-fetch");

const LOCATIONS_FILE = "./locations.json";
const DAYS = 8;
const MAX_LOCATIONS = 10; // 🔒 safety limit
const DELAY_MS = 1500;

const OPENWEATHER_API = "https://api.openweathermap.org/data/3.0/onecall";

const API_KEY = process.env.OPENWEATHER_API_KEY;
const WP_ENDPOINT = process.env.WP_ENDPOINT;
const WP_SECRET = process.env.WP_SECRET;

if (!API_KEY || !WP_ENDPOINT || !WP_SECRET) {
  console.error("❌ Missing env variables");
  process.exit(0); // soft exit
}

const locations = JSON.parse(fs.readFileSync(LOCATIONS_FILE, "utf8"));

async function fetchWeather(lat, lon) {
  const url = `${OPENWEATHER_API}?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&units=metric&appid=${API_KEY}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`OpenWeather failed: ${res.status}`);
  }

  return res.json();
}

(async () => {
  const payload = [];
  let count = 0;

  for (const loc of locations) {
    if (count >= MAX_LOCATIONS) break;

    if (!loc.lat || !loc.lon) {
      console.log("⏭ Skipping invalid location", loc);
      continue;
    }

    const label = loc.label || loc.name || "Unknown";

    try {
      console.log(`🌤 Fetching: ${label}`);

      const data = await fetchWeather(loc.lat, loc.lon);

      if (!data.daily || !data.daily.length) {
        console.log(`⚠ No daily data for ${label}`);
        continue;
      }

      payload.push({
        lat: loc.lat,
        lon: loc.lon,
        daily: data.daily.slice(0, DAYS),
      });

      count++;

      await new Promise(r => setTimeout(r, DELAY_MS));

    } catch (e) {
      console.log(`⚠ ${label} failed → ${e.message}`);
    }
  }

  if (!payload.length) {
    console.log("⚠ No data fetched — exiting safely");
    process.exit(0); // ✅ IMPORTANT
  }

  console.log(`📤 Sending ${payload.length} locations to WordPress`);

  const res = await fetch(WP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cwf-secret": WP_SECRET,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log("✅ WP response:", text);

  process.exit(0);
})();
