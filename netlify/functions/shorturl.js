const dns = require('dns');
const { URL } = require('url');

// Simple in-memory storage. Resets on serverless function cold starts.
const urlDatabase = [];
let nextId = 1;

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

  // Handle CORS preflight OPTIONS requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  // --- GET /api/shorturl/<id> ---
  // Handle redirection requests
  if (event.httpMethod === 'GET') {
    // Extract the last part of the path, e.g., "1" from "/api/shorturl/1"
    const pathParts = event.path.split('/').filter(Boolean);
    const shortUrlId = parseInt(pathParts[pathParts.length - 1], 10);

    // Check if it's a valid number and find it in our "database"
    if (!isNaN(shortUrlId)) {
      const entry = urlDatabase.find(item => item.short_url === shortUrlId);
      if (entry) {
        // Success: redirect to the original URL
        return {
          statusCode: 302,
          headers: { Location: entry.original_url },
          body: '',
        };
      }
    }
    // If not found, return an error
    return {
      statusCode: 404,
      headers: { ...commonHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No short URL found for the given input' }),
    };
  }
  
  // --- POST /api/shorturl ---
  // Handle new URL submissions
  if (event.httpMethod === 'POST') {
    const originalUrl = parseBody(event.body);
    const errorResponse = {
      statusCode: 200, // freeCodeCamp tests check for status 200 on this error
      headers: { ...commonHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'invalid url' }),
    };

    let urlObject;
    try {
      urlObject = new URL(originalUrl);
      if (urlObject.protocol !== 'http:' && urlObject.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      return errorResponse;
    }

    try {
      await dns.promises.lookup(urlObject.hostname);
      
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
      return errorResponse; // DNS lookup failed
    }
  }

  // Fallback for unhandled methods
  return {
    statusCode: 405,
    headers: commonHeaders,
    body: 'Method Not Allowed',
  };
};