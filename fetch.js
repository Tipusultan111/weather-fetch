/**
 * fetch.js (FINAL – STABLE)
 * Runs in GitHub Actions
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
  console.error("❌ Missing env variables");
  process.exit(1);
}

const locations = JSON.parse(fs.readFileSync(LOCATIONS_FILE, "utf8"));

async function fetchWeather(lat, lon) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 15000); // ⏱ 15s timeout

  const url = `${OPENWEATHER_API}?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&units=metric&appid=${API_KEY}`;
  const res = await fetch(url, { signal: controller.signal });

  if (!res.ok) throw new Error("OpenWeather failed");
  return res.json();
}

(async () => {
  try {
    const payload = [];

    for (const loc of locations) {
      console.log(`🌤 Fetching ${loc.label}`);
      const data = await fetchWeather(loc.lat, loc.lon);

      payload.push({
        lat: loc.lat,
        lon: loc.lon,
        daily: data.daily.slice(0, DAYS),
      });
    }

    console.log("📤 Sending to WordPress…");

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

    process.exit(0); // 🔥 VERY IMPORTANT
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
