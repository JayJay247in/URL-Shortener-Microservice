// functions/shorturl.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const dns = require('dns');
const UrlModel = require('../models/urlModel'); // Adjust path

// Database connection (needs careful handling in serverless)
let conn = null;
const MONGODB_URI = process.env.MONGODB_URI;

const connectDB = async () => {
  if (conn == null) {
    conn = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000 // Short timeout for serverless
    }).then(() => mongoose);
    await conn; // Wait for connection to establish
  }
  return conn;
};

// Helper to get next sequence (simplified)
async function getNextSequenceValue() {
  const lastUrl = await UrlModel.findOne().sort({ short_url: -1 });
  return lastUrl ? lastUrl.short_url + 1 : 1;
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false; // Important for Mongoose
  await connectDB();

  const pathParts = event.path.split('/').filter(part => part); // e.g., ['api', 'shorturl', '1'] or ['api', 'shorturl']
  const isShortIdRequest = pathParts.length === 3 && pathParts[1] === 'shorturl' && /^\d+$/.test(pathParts[2]);

  if (event.httpMethod === 'POST' && pathParts.length === 2 && pathParts[1] === 'shorturl') {
    const body = JSON.parse(event.body || '{}'); // Assuming JSON body for Netlify functions, or parse form data
    const originalUrl = body.url;

    if (!originalUrl || !/^(http|https):\/\//i.test(originalUrl)) {
      return { statusCode: 200, body: JSON.stringify({ error: 'invalid url' }) }; // FCC expects 200 for this error
    }

    try {
      const parsedUrl = new URL(originalUrl);
      const hostname = parsedUrl.hostname;

      return new Promise((resolve) => {
        dns.lookup(hostname, async (err) => {
          if (err) {
            resolve({ statusCode: 200, body: JSON.stringify({ error: 'invalid url' }) });
            return;
          }
          try {
            let urlEntry = await UrlModel.findOne({ original_url: originalUrl });
            if (urlEntry) {
              resolve({ statusCode: 200, body: JSON.stringify({ original_url: urlEntry.original_url, short_url: urlEntry.short_url }) });
            } else {
              const shortUrlId = await getNextSequenceValue();
              urlEntry = new UrlModel({ original_url: originalUrl, short_url: shortUrlId });
              await urlEntry.save();
              resolve({ statusCode: 200, body: JSON.stringify({ original_url: urlEntry.original_url, short_url: urlEntry.short_url }) });
            }
          } catch (dbErr) {
            resolve({ statusCode: 500, body: JSON.stringify({ error: 'Database error' }) });
          }
        });
      });
    } catch (urlParseError) {
      return { statusCode: 200, body: JSON.stringify({ error: 'invalid url' }) };
    }
  } else if (event.httpMethod === 'GET' && isShortIdRequest) {
    const shortId = parseInt(pathParts[2]);
    try {
      const urlEntry = await UrlModel.findOne({ short_url: shortId });
      if (urlEntry) {
        return {
          statusCode: 302, // Temporary redirect
          headers: {
            Location: urlEntry.original_url,
          },
          body: ''
        };
      } else {
        return { statusCode: 404, body: JSON.stringify({ error: 'No short URL found' }) };
      }
    } catch (dbErr) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error' }) };
    }
  }

  return {
    statusCode: 404,
    body: 'Not Found'
  };
};