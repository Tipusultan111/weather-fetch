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

const STATE_FILE = "./batch-state.json";
const BATCH_SIZE = 50;

/* -----------------------------
   LOAD STATE
------------------------------ */

let offset = 0;

if (fs.existsSync(STATE_FILE)) {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  offset = state.offset || 0;
}

console.log("Current Offset:", offset);

/* -----------------------------
   PREPARE BATCH
------------------------------ */

let batch = locations.slice(offset, offset + BATCH_SIZE);

if (batch.length === 0) {
  offset = 0;
  batch = locations.slice(0, BATCH_SIZE);
}

async function getWeather(lat, lon) {

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=precipitation_probability_mean,precipitation_sum` +
    `&forecast_days=8` +
    `&timezone=Australia/Sydney`;

  const res = await fetch(url);

  if (!res.ok) throw new Error("Weather API failed");

  const json = await res.json();

  return json.daily.time.map((d, i) => ({
    date: d,
    pop: json.daily.precipitation_probability_mean?.[i] ?? 0,
    mm:  json.daily.precipitation_sum?.[i] ?? 0
  }));
}

/* -----------------------------
   MAIN
------------------------------ */

(async () => {

  const payload = [];

  for (const loc of batch) {

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
      body: JSON.stringify({ data: payload })
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("❌ WP ERROR:", text);
      process.exit(1);
    }

    console.log("✅ SUCCESS:", text);

    /* -----------------------------
       UPDATE OFFSET
    ------------------------------ */

    offset += BATCH_SIZE;

    if (offset >= locations.length) {
      offset = 0;
    }

    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ offset }, null, 2)
    );

    console.log("Next Offset:", offset);

    process.exit(0);

  } catch (err) {

    console.error("❌ Network Error:", err.message);
    process.exit(1);

  }

})();
