const dns = require('dns');
const { URL } = require('url');

// Using a simple in-memory "database".
// Note: In a stateless serverless environment, this will reset on cold starts.
// For the freeCodeCamp challenge, this is generally acceptable.
const urlDatabase = [];
let nextId = 1;

// Utility to parse the URL from the urlencoded form body
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

  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: commonHeaders,
      body: '',
    };
  }

  // --- Handle GET requests for redirection ---
  // e.g., /api/shorturl/1
  if (event.httpMethod === 'GET') {
    const pathParts = event.path.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    
    // Check if the last part of the path is a number (our short_url id)
    if (lastPart && /^\d+$/.test(lastPart)) {
        const shortUrlId = parseInt(lastPart, 10);
        const entry = urlDatabase.find(item => item.short_url === shortUrlId);

        if (entry) {
            // Redirect to the original URL
            return {
                statusCode: 302,
                headers: {
                    Location: entry.original_url,
                },
                body: '',
            };
        } else {
            return {
                statusCode: 404,
                headers: { ...commonHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'No short URL found for the given input' }),
            };
        }
    }
  }

  // --- Handle POST requests to create a new short URL ---
  if (event.httpMethod === 'POST' && event.path.includes('/api/shorturl')) {
    const originalUrl = parseBody(event.body);
    const errorResponse = {
        statusCode: 200, // freeCodeCamp tests expect 200 OK for this error
        headers: { ...commonHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'invalid url' }),
    };

    // 1. Validate URL format
    let urlObject;
    try {
      urlObject = new URL(originalUrl);
      if (urlObject.protocol !== 'http:' && urlObject.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      return errorResponse;
    }

    // 2. Validate hostname with DNS lookup
    try {
      await dns.promises.lookup(urlObject.hostname);
      
      // If validation passes, check if it already exists
      const existingEntry = urlDatabase.find(item => item.original_url === originalUrl);
      if (existingEntry) {
          return {
              statusCode: 200,
              headers: { ...commonHeaders, 'Content-Type': 'application/json' },
              body: JSON.stringify(existingEntry),
          };
      }

      // If not, store the new URL
      const newEntry = {
        original_url: originalUrl,
        short_url: nextId++,
      };
      urlDatabase.push(newEntry);

      return {
        statusCode: 200,
        headers: { ...commonHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry),
      };

    } catch (error) {
      // DNS lookup failed
      return errorResponse;
    }
  }

  // Fallback for unhandled methods or paths
  return {
    statusCode: 405,
    headers: commonHeaders,
    body: 'Method Not Allowed',
  };
};