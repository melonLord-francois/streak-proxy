// atlas cluster creds
// fboulou_db_user
// JtyrRZjbWwwMP02D


require('dotenv').config(); // Make sure this is at the top
const { getCollection } = require('./mongo'); // Or adjust path if different
const { connectToMongo } = require('./mongo');



const express = require('express');
const fetch = require('node-fetch');
const app = express();
const cors = require('cors'); // <-- import cors

connectToMongo().catch(err => {
  console.error('Failed to connect to MongoDB during startup', err);
  process.exit(1); // Exit if DB connection fails at startup
});

const PORT = process.env.PORT || 3000;
const STREAK_API_KEY = process.env.STREAK_API_KEY;
const STREAK_BASE_URL = 'https://api.streak.com/api/v1';
const NEXT_API_TOKEN = process.env.NEXT_API_TOKEN;
const NEXT_BASE = 'https://api.nextcenturymeters.com/api'

console.log('STREAK_API_KEY:', STREAK_API_KEY ? '[set]' : '[NOT SET]');

app.use(express.json());
app.use(cors()); // <-- enable CORS for all routes and origins




app.get('/boxes/:boxKey', async (req, res) => {
  const boxKey = req.params.boxKey;

  try {
    const response = await fetch(`${STREAK_BASE_URL}/boxes/${boxKey}`, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${STREAK_API_KEY}:`).toString('base64')
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
        Authorization: NEXT_API_TOKEN,
        Version: 2
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `External API error ${response.status}` });
    }

    const text = await response.text();
    console.log('Fetched users response:', text);

    const data = JSON.parse(text);


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
        Authorization: NEXT_API_TOKEN,
        Version: 2
      }


    }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `External API error ${response.status}` });
    }

    const text = await response.text();
    console.log('Fetched users response:', text);

    const data = JSON.parse(text);


    res.set('Access-Control-Allow-Origin', '*'); // CORS
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});



app.post('/schedule-revoke', express.json(), async (req, res) => {
  try {
    const { _id, propertyId, revokeDate, users, companies } = req.body;

    // Basic validation
    if (!_id || !propertyId || !revokeDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const toRevoke = await getCollection('toRevoke');

    await toRevoke.updateOne(
      { _id },
      {
        $set: {
          propertyId,
          revokeDate: new Date(revokeDate),
          users,
          companies,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    // Create a task in the Streak box
    const userList = users.length ? users.join(', ') : 'no users';
    const companyList = companies.length ? companies.join(', ') : 'no companies';
    const revokeDateStr = new Date(revokeDate).getTime();
;

    const taskMessage = `Extension has scheduled revocation for users: [${userList}] and companies: [${companyList}] on ${new Date(revokeDate).toLocaleDateString()}.`;

    const taskResponse = await fetch(`${STREAK_BASE_URL}/boxes/${_id}/tasks`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${STREAK_API_KEY}:`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: _id,
        text: taskMessage,
        dueDate: revokeDateStr,
      }),
    });

    if (!taskResponse.ok) {
      console.warn(`⚠️ Failed to create task in Streak box ${_id}: ${taskResponse.status}`);
    } else {
      console.log(`✅ Created revocation task in Streak box ${_id}`);
    }

    res.set('Access-Control-Allow-Origin', '*'); // CORS
    res.json({ success: true, message: 'Revocation scheduled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});




app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Streak proxy running on port ${PORT}`);
});

