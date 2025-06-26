// netlify/functions/shorturl.js

const dns = require('dns').promises; // Using promises version of dns
const { URL } = require('url'); // Using modern URL constructor

// In-memory storage (resets on function cold starts or new instances)
let urlDatabase = [];
let currentId = 1;

// Utility function to validate URL format (protocol check)
function isValidUrlFormat(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

exports.handler = async (event, context) => {
  // Common headers for CORS and JSON responses (except for redirects)
  const commonJsonResponseHeaders = {
    'Access-Control-Allow-Origin': '*', // Allows requests from any origin
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // Allowed HTTP methods
    'Content-Type': 'application/json' // Default content type for JSON responses
  };

  // Handle preflight OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { // Specific headers for OPTIONS
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: ''
    };
  }

  // Determine the relative path for routing within the function
  // Example: if event.path is "/.netlify/functions/shorturl/123", path becomes "/123"
  // Example: if event.path is "/.netlify/functions/shorturl", path becomes ""
  const basePath = '/.netlify/functions/shorturl';
  let relativePath = event.path;
  if (event.path.startsWith(basePath)) {
    relativePath = event.path.substring(basePath.length);
  }
  
  try {
    // POST /api/shorturl - Create short URL
    // This condition checks if the request is POST and the path is exactly for creating a new URL
    // (e.g., /api/shorturl, which translates to an empty relativePath here)
    if (event.httpMethod === 'POST' && (relativePath === '' || relativePath === '/')) {
      let originalUrl;
      
      // Parse body: freeCodeCamp tests usually send 'application/x-www-form-urlencoded'
      // Netlify might base64 encode the body.
      let requestBody = event.body;
      if (event.isBase64Encoded) {
        requestBody = Buffer.from(event.body, 'base64').toString('utf-8');
      }

      // Check content type to decide parsing strategy
      if (event.headers['content-type'] && event.headers['content-type'].includes('application/json')) {
        const bodyData = JSON.parse(requestBody); // requestBody is already decoded if it was base64
        originalUrl = bodyData.url;
      } else { // Assume 'application/x-www-form-urlencoded'
        const params = new URLSearchParams(requestBody);
        originalUrl = params.get('url');
      }
      
      if (!originalUrl) {
        return {
          statusCode: 400, // Bad Request
          headers: commonJsonResponseHeaders,
          body: JSON.stringify({ error: 'url parameter is missing' })
        };
      }

      // 1. Validate URL format (http/https)
      if (!isValidUrlFormat(originalUrl)) {
        return {
          // statusCode: 400, // Technically a bad request
          // The test expects a 200 OK with this error message for invalid format
          statusCode: 200,
          headers: commonJsonResponseHeaders,
          body: JSON.stringify({ error: 'invalid url' })
        };
      }
      
      let hostname;
      try {
        const parsedUrlForHostname = new URL(originalUrl);
        hostname = parsedUrlForHostname.hostname;
        if (!hostname) throw new Error('Hostname could not be extracted');
      } catch (parseError) {
         // This catch handles cases where new URL() fails even if isValidUrlFormat passed
         // (e.g., http:// leading spaces etc.) - defensive
        return {
          statusCode: 200, // As per FCC test for 'invalid url'
          headers: commonJsonResponseHeaders,
          body: JSON.stringify({ error: 'invalid url' })
        };
      }
      
      // 2. Validate URL using DNS lookup
      try {
        await dns.lookup(hostname);
        
        // If DNS lookup successful, proceed.
        // Check if URL already exists in database (optional, but good practice)
        const existingUrl = urlDatabase.find(item => item.original_url === originalUrl);
        if (existingUrl) {
          return {
            statusCode: 200,
            headers: commonJsonResponseHeaders,
            body: JSON.stringify({
              original_url: existingUrl.original_url,
              short_url: existingUrl.short_url
            })
          };
        }
        
        // Create new short URL entry
        const shortUrlId = currentId++;
        const urlEntry = {
          original_url: originalUrl,
          short_url: shortUrlId // Ensure this is a number
        };
        
        urlDatabase.push(urlEntry);
        
        return {
          statusCode: 200,
          headers: commonJsonResponseHeaders,
          body: JSON.stringify({
            original_url: originalUrl,
            short_url: shortUrlId
          })
        };
        
      } catch (dnsError) {
        // dns.lookup failed
        return {
          statusCode: 200, // As per FCC test for 'invalid url'
          headers: commonJsonResponseHeaders,
          body: JSON.stringify({ error: 'invalid url' })
        };
      }
    }
    
    // GET /api/shorturl/:short_url - Redirect to original URL
    // This condition checks if it's a GET request and the path is not empty
    // (e.g., /api/shorturl/1, which translates to a relativePath of "/1")
    if (event.httpMethod === 'GET' && relativePath && relativePath !== '/') {
      const shortUrlParam = relativePath.substring(1); // Remove leading slash, e.g., "1"
      const shortUrlId = parseInt(shortUrlParam, 10); // Parse as base 10
      
      if (isNaN(shortUrlId)) {
        return {
          statusCode: 400, // Bad Request
          headers: commonJsonResponseHeaders,
          body: JSON.stringify({ error: 'Invalid short URL format: not a number' })
        };
      }
      
      const urlEntry = urlDatabase.find(item => item.short_url === shortUrlId);
      
      if (urlEntry) {
        // For redirect, only Location header is strictly needed.
        // No Content-Type or CORS headers for the 302 itself.
        return {
          statusCode: 302, // Found and redirect
          headers: {
            'Location': urlEntry.original_url
          },
          body: '' // Body should be empty for a 302 redirect
        };
      } else {
        return {
          statusCode: 404, // Not Found
          headers: commonJsonResponseHeaders,
          body: JSON.stringify({ error: 'No short URL found for the given input' })
        };
      }
    }
    
    // If no routes matched
    return {
      statusCode: 404,
      headers: commonJsonResponseHeaders,
      body: JSON.stringify({ error: 'Route not found or method not allowed for route' })
    };
    
  } catch (error) {
    console.error('Critical Error in Function:', error);
    return {
      statusCode: 500,
      headers: commonJsonResponseHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};