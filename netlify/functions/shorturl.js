// netlify/functions/shorturl.js

const { MongoClient } = require('mongodb');
const dns = require('dns');
const { URL } = require('url');

// Your MongoDB connection string, securely pulled from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

// --- Database Connection Caching ---
let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('url_shortener_db');
  cachedDb = db;
  return db;
}

// --- Counter for short_url ---
async function getNextSequenceValue(db) {
    const sequenceDocument = await db.collection('counters').findOneAndUpdate(
        { _id: 'short_url_id' },
        { $inc: { sequence_value: 1 } },
        { returnDocument: 'after', upsert: true }
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
  
  // --- ADDED FOR DEBUGGING ---
  console.log('--- Invoking function ---');
  console.log('HTTP Method:', event.httpMethod);
  console.log('Request Path:', event.path);
  // --- END DEBUGGING ---

  try {
    const db = await connectToDatabase();
    
    // --- GET /api/shorturl/<id> ---
    if (event.httpMethod === 'GET') {
      const pathParts = event.path.split('/').filter(Boolean);
      const shortUrlParam = pathParts[pathParts.length - 1];
      
      // --- ADDED FOR DEBUGGING ---
      console.log('Handling GET request.');
      console.log('Parsed path parts:', pathParts);
      console.log('Extracted parameter from path:', shortUrlParam);
      // --- END DEBUGGING ---

      const shortUrlId = parseInt(shortUrlParam, 10);
      
      console.log('Parsed parameter as integer:', shortUrlId); // DEBUG

      if (!isNaN(shortUrlId)) {
        console.log('Looking for short_url in DB:', shortUrlId); // DEBUG
        const urlDoc = await db.collection('urls').findOne({ short_url: shortUrlId });
        console.log('Database query result (urlDoc):', urlDoc); // DEBUG
        
        if (urlDoc) {
          console.log('SUCCESS: Found document. Redirecting to:', urlDoc.original_url); // DEBUG
          return {
            statusCode: 302, // 302 is a temporary redirect
            headers: { Location: urlDoc.original_url },
            body: '',
          };
        }
      }
      
      console.log('FAILURE: No valid URL doc found for this ID.'); // DEBUG
      return {
        statusCode: 404,
        headers: { ...commonHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No short URL found for the given input' }),
      };
    }
  
    // --- POST /api/shorturl ---
    if (event.httpMethod === 'POST') {
        console.log('Handling POST request.'); // DEBUG
        const originalUrl = parseBody(event.body);
        console.log('Parsed URL from body:', originalUrl); // DEBUG

        const errorResponse = {
            statusCode: 200, 
            headers: { ...commonHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'invalid url' }),
        };

        try {
            const urlObject = new URL(originalUrl);
            if (urlObject.protocol !== 'http:' && urlObject.protocol !== 'https:') {
                throw new Error('Invalid protocol');
            }
            await dns.promises.lookup(urlObject.hostname);
        } catch (error) {
            console.log('URL validation failed.'); // DEBUG
            return errorResponse;
        }

        let urlDoc = await db.collection('urls').findOne({ original_url: originalUrl });

        if (urlDoc) {
            console.log('URL found in DB. Returning existing entry.'); // DEBUG
            return {
                statusCode: 200,
                headers: { ...commonHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    original_url: urlDoc.original_url,
                    short_url: urlDoc.short_url,
                }),
            };
        } else {
            console.log('URL not in DB. Creating new entry.'); // DEBUG
            const shortUrl = await getNextSequenceValue(db);
            const newEntry = {
                original_url: originalUrl,
                short_url: shortUrl,
            };
            await db.collection('urls').insertOne(newEntry);
            console.log('New entry created:', newEntry); // DEBUG
            return {
                statusCode: 200,
                headers: { ...commonHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(newEntry),
            };
        }
    }

  } catch (error) {
      console.error('CRITICAL ERROR:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal Server Error.' }),
      }
  }

  return { statusCode: 405, headers: commonHeaders, body: 'Method Not Allowed' };
};