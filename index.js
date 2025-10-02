const express = require('express');
const fetch = require('node-fetch');
const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.STREAK_API_KEY;
const STREAK_BASE_URL = 'https://api.streak.com/api/v1';
const NEXT_KEY = process.env.NEXT_API_KEY;
const NEXT_BASE = 'https://api.nextcenturymeters.com/api'

console.log('API_KEY:', API_KEY ? '[set]' : '[NOT SET]');

app.use(express.json());

app.get('/boxes/:boxKey', async (req, res) => {
  const boxKey = req.params.boxKey;

  try {
    const response = await fetch(`${STREAK_BASE_URL}/boxes/${boxKey}`, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${API_KEY}:`).toString('base64')
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Streak API error ${response.status}` });
    }

    const data = await response.json();

    res.set('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/users/:id', async (req, res) => {
  const id = `p_${req.params.id}`;

  try {
    const response = await fetch(`${NEXT_BASE}/Properties/${id}/Users`, {
      headers: {
        Authorization: NEXT_KEY,
        Version: 2
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `External API error ${response.status}` });
    }

    const data = await response.json();

    res.set('Access-Control-Allow-Origin', '*'); // CORS
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/sharedaccess/:id', async (req, res) => {
  const id = `p_${req.params.id}`;

  try {
    const response = await fetch(`${NEXT_BASE}/Properties/${id}/CompaniesWithPermissionOnMe`, {
      headers: {
        Authorization: NEXT_KEY,
        Version: 2
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `External API error ${response.status}` });
    }

    const data = await response.json();

    res.set('Access-Control-Allow-Origin', '*'); // CORS
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Streak proxy running on port ${PORT}`);
});
