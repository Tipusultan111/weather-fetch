const fs = require('fs');
const fetch = require('node-fetch');

const API_KEY = process.env.OPENWEATHER_API;
const WP_ENDPOINT = process.env.WP_ENDPOINT;
const WP_SECRET = process.env.WP_SECRET;

const locations = JSON.parse(fs.readFileSync('./locations.json', 'utf8'));

async function run() {
  const results = {};

  for (const loc of locations) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${loc.lat}&lon=${loc.lon}&units=metric&appid=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.list) continue;

      results[loc.slug] = {
        name: loc.name,
        country: loc.country,
        forecast: data.list.slice(0, 24)
      };
    } catch (e) {
      console.error('Error for', loc.name);
    }
  }

  await fetch(WP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-SECRET': WP_SECRET
    },
    body: JSON.stringify(results)
  });

  console.log('Weather cache pushed successfully');
}

run();
