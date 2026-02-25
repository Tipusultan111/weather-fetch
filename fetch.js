const fs = require("fs");
const fetch = require("node-fetch");

const WORDPRESS_ENDPOINT = process.env.WP_ENDPOINT;
const SECRET = process.env.WP_SECRET;

if (!WORDPRESS_ENDPOINT || !SECRET) {
  console.error("❌ Missing WP_ENDPOINT or WP_SECRET");
  process.exit(1);
}

const BATCH_SIZE = 10;
const DELAY = 1000;
const DAYS = 8;

const locations = JSON.parse(
  fs.readFileSync("./locations.json", "utf8")
);

const batch = locations.slice(0, BATCH_SIZE);

async function fetchWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=precipitation_probability_mean,precipitation_sum` +
    `&timezone=Australia/Sydney`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather API failed");

  const json = await res.json();

  return json.daily.time.map((date, i) => ({
    date,
    pop: json.daily.precipitation_probability_mean?.[i] ?? 0,
    precip_mm: json.daily.precipitation_sum?.[i] ?? 0,
  })).slice(0, DAYS);
}

(async () => {

  const payload = [];

  for (const loc of batch) {

    console.log(`🌤 Fetching: ${loc.name}`);

    try {
      const daily = await fetchWeather(loc.lat, loc.lon);

      payload.push({
        lat: Number(loc.lat.toFixed(4)),
        lon: Number(loc.lon.toFixed(4)),
        daily
      });

      await new Promise(r => setTimeout(r, DELAY));

    } catch (e) {
      console.error(`❌ Failed: ${loc.name}`);
    }
  }

  console.log(`📦 Sending ${payload.length} locations`);

  const res = await fetch(WORDPRESS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cwf-secret": SECRET
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("❌ WP ERROR:", text);
    process.exit(1);
  }

  console.log("✅ WP response:", text);
  process.exit(0);

})();
console.log("WP_ENDPOINT:", process.env.WP_ENDPOINT);
console.log("WP_SECRET:", process.env.WP_SECRET);
