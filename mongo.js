const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGO_URI;
const client = new MongoClient(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let db;

async function connectToMongo() {
  if (!db) {
    try {
      await client.connect();
      console.log('✅ Connected to MongoDB');
      db = client.db('revoke-scheduler'); // Replace with your actual DB name
    } catch (err) {
      console.error('❌ MongoDB connection error:', err);
      throw err;
    }
  }
  return db;
}

module.exports = {
  connectToMongo,
  getCollection: async (collectionName) => {
    const database = await connectToMongo();
    return database.collection(collectionName);
  },
};
