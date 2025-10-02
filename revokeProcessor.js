require('dotenv').config();
const { connectToMongo, getCollection } = require('./mongo');

// You can move these functions elsewhere if needed
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

      // 👉 TODO: Add logic to actually revoke access via API
      // e.g., revokeUsers(doc.propertyId, doc.users), etc.

      // 👇 After success, remove from DB (or mark as done)
      await toRevoke.deleteOne({ _id: doc._id });
      console.log(`✅ Revoked and removed: ${doc._id}`);
    }
  } catch (err) {
    console.error('❌ Error processing revocations:', err);
  }
}

// Connect to Mongo and run logic
connectToMongo().then(() => processRevocations());
