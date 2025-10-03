// atlas cluster creds
// fboulou_db_user
// 

const { closeMongoConnection } = require('./mongo');

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
const STREAK_BASE_URL_2 = 'https://api.streak.com/api/v2';
const NEXT_API_TOKEN = process.env.NEXT_API_TOKEN;
const NEXT_BASE = 'https://api.nextcenturymeters.com/api'

console.log('STREAK_API_KEY:', STREAK_API_KEY ? '[set]' : '[NOT SET]');

app.use(express.json());
app.use(cors()); // <-- enable CORS for all routes and origins

// ✅ Logging middleware: logs method, path, status, and response time
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ➜ ${res.statusCode} (${duration}ms)`);
  });

  next();
});



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
  const id = req.params.id;


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
  const id = req.params.id;


  try {
    const response = await fetch(`${NEXT_BASE}/Properties/${id}/CompaniesWithPermissionOnMe`, {
      headers: {
        Authorization: NEXT_API_TOKEN,
        Version: 2
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `External API error ${response.status}` });
    }

    const text = await response.text();
    console.log('Fetched companies response:', text);

    const data = JSON.parse(text);


    res.set('Access-Control-Allow-Origin', '*'); 
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});


app.post('/schedule-revoke', express.json(), async (req, res) => {
  try {
    const { _id, propertyId, revokeDate, users = [], companies = [] } = req.body;

    if (!_id || !propertyId || !revokeDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const toRevoke = await getCollection('toRevoke');

    // Prepare arrays to hold created task IDs
    const userTasks = [];
    const companyTasks = [];

    const revokeDateMs = new Date(revokeDate).getTime();

    // Helper to create a task and return the task ID
    async function createTask(boxId, text) {
      const res = await fetch(`${STREAK_BASE_URL_2}/boxes/${boxId}/tasks`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${STREAK_API_KEY}:`).toString('base64'),
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: boxId,
          text,
          dueDate: revokeDateMs,
        }),
      });

      if (!res.ok) {
        console.warn(`⚠️ Failed to create task "${text}" for box ${boxId}: ${res.status}`);
        return null;
      }

      const data = await res.json();
      console.log(`✅ Created task "${text}" with ID: ${data.key} for box ${boxId}`);
      return data.key; // task ID returned by Streak API
    }

    // Create tasks for users, collect their task IDs
    for (const userId of users) {
      const taskId = await createTask(_id, `Revoke access for user: ${userId}`);
      if (taskId) userTasks.push({ userId, taskId });
    }

    // Create tasks for companies, collect their task IDs
    for (const companyId of companies) {
      const taskId = await createTask(_id, `Revoke access for company: ${companyId}`);
      if (taskId) companyTasks.push({ companyId, taskId });
    }

    // Upsert the document with task IDs included
    await toRevoke.updateOne(
      { _id },
      {
        $set: {
          propertyId,
          revokeDate: new Date(revokeDate),
          users,
          companies,
          userTasks,
          companyTasks,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    res.set('Access-Control-Allow-Origin', '*');
    res.json({ success: true, message: 'Revocation scheduled successfully', userTasks, companyTasks });
  } catch (error) {
    console.error('❌ schedule-revoke error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});




app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Streak proxy running on port ${PORT}`);
});

// Graceful shutdown for Render (and local)
process.on('SIGINT', async () => {
  console.log('🔌 SIGINT received – closing Mongo connection...');
  await closeMongoConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔌 SIGTERM received – closing Mongo connection...');
  await closeMongoConnection();
  process.exit(0);
});

//YY6kR2v7KEWOe8t7 connection manager pw