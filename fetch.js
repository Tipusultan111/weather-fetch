const fs = require("fs");
const fetch = require("node-fetch");

const ENDPOINT = process.env.WP_ENDPOINT;
const SECRET   = process.env.CWF_SECRET;

if (!ENDPOINT || !SECRET) {
  console.error("❌ Missing WP_ENDPOINT or CWF_SECRET");
  process.exit(1);
}

const locations = JSON.parse(
  fs.readFileSync("./locations.json", "utf8")
);

// You can change batch size if needed
const BATCH = locations.slice(0, 10);

async function getWeather(lat, lon) {

  const url =
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
  `&daily=precipitation_probability_mean,precipitation_sum` +
  `&forecast_days=8` +
  `&timezone=Australia/Sydney`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Weather API failed");
  }

  const json = await res.json();

  if (!json.daily || !json.daily.time) {
    throw new Error("Invalid weather response");
  }

  return json.daily.time.map((d, i) => ({
    date: d,
    pop: json.daily.precipitation_probability_mean?.[i] ?? 0,
    mm:  json.daily.precipitation_sum?.[i] ?? 0
  }));
}

(async () => {

  const payload = [];

  for (const loc of BATCH) {

    console.log("Fetching:", loc.name);

    try {
      const daily = await getWeather(loc.lat, loc.lon);

      payload.push({
        lat: Number(loc.lat.toFixed(4)),
        lon: Number(loc.lon.toFixed(4)),
        daily
      });

    } catch (e) {
      console.log("Fail:", loc.name);
    }
  }

  console.log("Sending:", payload.length);

  try {

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cwf-secret": SECRET
      },
      body: JSON.stringify({
        data: payload   // ✅ FIXED STRUCTURE
      })
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("❌ WP ERROR:", text);
      process.exit(1);
    }

    console.log("✅ SUCCESS:", text);
    process.exit(0);

  } catch (err) {

    console.error("❌ Network Error:", err.message);
    process.exit(1);

  }

})();
