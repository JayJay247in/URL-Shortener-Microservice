// netlify/functions/shorturl.js

const { MongoClient } = require('mongodb');
const dns = require('dns');
const { URL } = require('url');

// Your MongoDB connection string, securely pulled from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

// --- Database Connection Caching ---
// Cache the database connection between function invocations for better performance.
let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  // IMPORTANT: Replace 'url_shortener_db' with the name of your database
  const db = client.db('url_shortener_db');
  cachedDb = db;
  return db;
}

// --- Counter for short_url ---
// Gets the next sequential number for the short_url field
async function getNextSequenceValue(db) {
    // This finds the document with _id: "short_url_id" and increments its sequence_value by 1.
    // It's an atomic operation, which prevents race conditions.
    const sequenceDocument = await db.collection('counters').findOneAndUpdate(
        { _id: 'short_url_id' },
        { $inc: { sequence_value: 1 } },
        { returnDocument: 'after', upsert: true } // "upsert: true" creates the doc if it doesn't exist
    );
    return sequenceDocument.sequence_value;
}


// Utility to parse the urlencoded form body from POST requests
const parseBody = (body) => {
  if (!body) return null;
  const params = new URLSearchParams(body);
  return params.get('url');
};

exports.handler = async (event, context) => {
  const commonHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  try {
    const db = await connectToDatabase();
    
    // --- GET /api/shorturl/<id> ---
    if (event.httpMethod === 'GET') {
      const pathParts = event.path.split('/').filter(Boolean);
      const shortUrlId = parseInt(pathParts[pathParts.length - 1], 10);
      
      if (!isNaN(shortUrlId)) {
        // Find the URL by its numeric short_url in the database
        const urlDoc = await db.collection('urls').findOne({ short_url: shortUrlId });
        
        if (urlDoc) {
          return {
            statusCode: 302, // 302 is a temporary redirect
            headers: { Location: urlDoc.original_url },
            body: '',
          };
        }
      }
      
      return {
        statusCode: 404,
        headers: { ...commonHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No short URL found for the given input' }),
      };
    }
  
    // --- POST /api/shorturl ---
    if (event.httpMethod === 'POST') {
        const originalUrl = parseBody(event.body);
        const errorResponse = {
            statusCode: 200, // freeCodeCamp expects 200 on validation error
            headers: { ...commonHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'invalid url' }),
        };

        try {
            const urlObject = new URL(originalUrl);
            if (urlObject.protocol !== 'http:' && urlObject.protocol !== 'https:') {
                throw new Error('Invalid protocol');
            }
            // Use promises-based dns lookup
            await dns.promises.lookup(urlObject.hostname);
        } catch (error) {
            return errorResponse;
        }

        // Check if URL already exists in DB
        let urlDoc = await db.collection('urls').findOne({ original_url: originalUrl });

        if (urlDoc) {
            // If it exists, return the existing entry
             return {
                statusCode: 200,
                headers: { ...commonHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    original_url: urlDoc.original_url,
                    short_url: urlDoc.short_url,
                }),
            };
        } else {
            // If it doesn't exist, create a new one
            const shortUrl = await getNextSequenceValue(db);
            const newEntry = {
                original_url: originalUrl,
                short_url: shortUrl,
            };
            await db.collection('urls').insertOne(newEntry);
             return {
                statusCode: 200,
                headers: { ...commonHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(newEntry),
            };
        }
    }

  } catch (error) {
      console.error(error);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal Server Error.' }),
      }
  }

  return { statusCode: 405, headers: commonHeaders, body: 'Method Not Allowed' };
};