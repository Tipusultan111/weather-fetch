const fs = require("fs");
const fetch = require("node-fetch");

const LOCATIONS_FILE = "./locations.json";
const DAYS = 8;
const MAX_LOCATIONS = 5; // 🔒 safety limit

const OPENWEATHER_API = "https://api.openweathermap.org/data/3.0/onecall";
const API_KEY = process.env.OPENWEATHER_API_KEY;
const WP_ENDPOINT = process.env.WP_ENDPOINT;
const WP_SECRET = process.env.WP_SECRET;

if (!API_KEY || !WP_ENDPOINT || !WP_SECRET) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const locations = JSON.parse(fs.readFileSync(LOCATIONS_FILE, "utf8"));

async function fetchWeather(lat, lon) {
  const url = `${OPENWEATHER_API}?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&units=metric&appid=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeather ${res.status}`);
  return res.json();
}

(async () => {
  const payload = [];
  let count = 0;

  for (const loc of locations) {
    if (!loc.lat || !loc.lon) continue;

    if (count >= MAX_LOCATIONS) break;

    const label = loc.label || loc.name || "Unknown";

    try {
      console.log(`🌤 Fetching ${label}`);

      const data = await fetchWeather(loc.lat, loc.lon);

      payload.push({
        lat: loc.lat,
        lon: loc.lon,
        daily: data.daily.slice(0, DAYS),
      });

      count++;
      await new Promise(r => setTimeout(r, 1200));

    } catch (e) {
      console.error(`⚠ ${label} failed`, e.message);
    }
  }

  if (!payload.length) {
    console.error("❌ No data fetched");
    process.exit(1);
  }

  console.log(`📤 Sending ${payload.length} locations to WP`);

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
})();
