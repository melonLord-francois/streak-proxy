const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGO_URI;


if (!mongoUri) {
  console.error('❌ MONGO_URI environment variable is not set!');
  process.exit(1); // stop app early if no URI
}

console.log('Using Mongo URI:', mongoUri);


const client = new MongoClient(mongoUri);

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

// mongo.js addition
async function closeMongoConnection() {
  await client.close();
  console.log('✅ MongoDB connection closed');
}


module.exports = {
  connectToMongo,
  getCollection: async (collectionName) => {
    const database = await connectToMongo();
    return database.collection(collectionName);
  },
  closeMongoConnection,
};
