const fs = require("fs");
const fetch = require("node-fetch");

/* ==============================
   CONFIG
============================== */

const WORDPRESS_ENDPOINT = process.env.WP_ENDPOINT;
const SECRET = process.env.CWF_SECRET;

const BATCH_SIZE = 10;
const DELAY_MS = 1200;
const DAYS = 8;

/* ==============================
   LOAD LOCATIONS
============================== */

const locations = JSON.parse(
  fs.readFileSync("./locations.json", "utf8")
);

/* ==============================
   BATCH OFFSET
============================== */

const START_INDEX = Number(process.env.START || 0);
const batch = locations.slice(START_INDEX, START_INDEX + BATCH_SIZE);

if (!batch.length) {
  console.log("✅ All locations already processed.");
  process.exit(0);
}

console.log(
  `🚀 Processing locations ${START_INDEX} → ${START_INDEX + batch.length - 1}`
);

/* ==============================
   WEATHER FETCH
============================== */

async function fetchWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=precipitation_probability_mean,precipitation_sum` +
    `&timezone=Australia/Sydney`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("API failed");

  const json = await res.json();

  return json.daily.time.map((date, i) => ({
    date,
    pop: json.daily.precipitation_probability_mean?.[i] ?? 0,
    precip_mm: json.daily.precipitation_sum?.[i] ?? 0,
  })).slice(0, DAYS);
}

/* ==============================
   MAIN
============================== */

(async () => {
  const payload = [];

  for (const loc of batch) {
    if (!loc.lat || !loc.lon) continue;

    console.log(`🌤 Fetching: ${loc.name}`);

    try {
      const daily = await fetchWeather(loc.lat, loc.lon);

      payload.push({
        lat: Number(Number(loc.lat).toFixed(4)),
        lon: Number(Number(loc.lon).toFixed(4)),
        daily,
      });

      await new Promise(r => setTimeout(r, DELAY_MS));
    } catch (e) {
      console.error(`❌ Failed: ${loc.name}`);
    }
  }

  console.log(`📦 Sending ${payload.length} locations to WordPress`);

  const res = await fetch(WORDPRESS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cwf-secret": SECRET,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log("✅ WP response:", text);
})();
