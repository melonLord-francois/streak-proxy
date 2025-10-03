require('dotenv').config();
const fetch = require('node-fetch');
const { connectToMongo, getCollection } = require('./mongo');

const STREAK_API_KEY = process.env.STREAK_API_KEY;
const STREAK_BASE_URL = 'https://api.streak.com/api/v1';
const STREAK_BASE_URL_2 = 'https://api.streak.com/api/v2';
const NEXT_API_TOKEN = process.env.NEXT_API_TOKEN;
const NEXT_BASE = 'https://api.nextcenturymeters.com/api';

async function processRevocations() {
  const now = new Date();

  try {
    const toRevoke = await getCollection('toRevoke');
    const docs = await toRevoke.find({ revokeDate: { $lte: now } }).toArray();

    if (docs.length === 0) {
      console.log('✅ No revocations to process.');
      return;
    }

    for (const doc of docs) {
      console.log(`🔁 Processing revoke for box: ${doc._id}`);

      const userTasks = doc.userTasks || [];
      const companyTasks = doc.companyTasks || [];

      // --- USERS ---
      for (const user of userTasks) {
        try {
          const response = await fetch(`${NEXT_BASE}/Users/${user.userId}/Permissions/${doc.propertyId}`, {
            method: 'DELETE',
            headers: {
              Authorization: NEXT_API_TOKEN,
              Version: 2
            }
          });

          if (!response.ok) {
            console.error(`❌ User revoke failed for ${user.userId}`);
            // TODO: Push note to Streak box
          }

          const taskResponse = await fetch(`${STREAK_BASE_URL_2}/tasks/${user.taskId}`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: 'Basic ' + Buffer.from(`${STREAK_API_KEY}:`).toString('base64'),
            },
            body: JSON.stringify({ status: 'DONE' }),
          });

          if (!taskResponse.ok) {
            console.error(`❌ Failed to mark user task ${user.taskId} as DONE`);
            // TODO: Push note to Streak box
          }
        } catch (error) {
          console.error(`❌ Exception during user revocation: ${error.message}`);
        }
      }

      // --- COMPANIES ---
      for (const company of companyTasks) {
        try {
          const response = await fetch(`${NEXT_BASE}/Properties/${doc.propertyId}/RevokeAccess/${company.companyId}`, {
            method: 'PUT',
            headers: {
              Authorization: NEXT_API_TOKEN,
              Version: 2
            }
          });

          if (!response.ok) {
            console.error(`❌ Company revoke failed for ${company.companyId}`);
            // TODO: Push note to Streak box
          }

          const taskResponse = await fetch(`${STREAK_BASE_URL_2}/tasks/${company.taskId}`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: 'Basic ' + Buffer.from(`${STREAK_API_KEY}:`).toString('base64'),
            },
            body: JSON.stringify({ status: 'DONE' }),
          });

          if (!taskResponse.ok) {
            console.error(`❌ Failed to mark company task ${company.taskId} as DONE`);
            // TODO: Push note to Streak box
          }
        } catch (error) {
          console.error(`❌ Exception during company revocation: ${error.message}`);
        }
      }

      // ✅ Clean up after success
      await toRevoke.deleteOne({ _id: doc._id });
      console.log(`✅ Revoked and removed: ${doc._id}`);
    }
  } catch (err) {
    console.error('❌ Error processing revocations:', err);
  }
}

connectToMongo().then(() => processRevocations());
