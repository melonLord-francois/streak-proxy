const express = require('express');
const fetch = require('node-fetch');
const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.STREAK_API_KEY;

app.use(express.json());

app.get('/boxes/:boxKey', async (req, res) => {
  const boxKey = req.params.boxKey;

  try {
    const response = await fetch(`https://api.streak.com/api/v1/boxes/${boxKey}`, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${API_KEY}:`).toString('base64')
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Streak API error ${response.status}` });
    }

    const data = await response.json();

    // Allow CORS so your extension can call this endpoint
    res.set('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Streak proxy running on port ${PORT}`);
});
