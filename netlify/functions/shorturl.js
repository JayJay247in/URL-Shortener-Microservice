const dns = require('dns').promises;
const url = require('url');

// In-memory storage (in production, use a database like MongoDB or PostgreSQL)
let urlDatabase = [];
let currentId = 1;

// Utility function to validate URL format
function isValidUrl(urlString) {
  try {
    const urlObj = new URL(urlString);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  const path = event.path.replace('/.netlify/functions/shorturl', '');
  
  try {
    // POST /api/shorturl - Create short URL
    if (event.httpMethod === 'POST' && path === '') {
      let originalUrl;
      
      // Parse body based on content type
      if (event.headers['content-type']?.includes('application/json')) {
        const body = JSON.parse(event.body);
        originalUrl = body.url;
      } else {
        // Handle form-encoded data
        const params = new URLSearchParams(event.body);
        originalUrl = params.get('url');
      }
      
      // Check if URL format is valid
      if (!isValidUrl(originalUrl)) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ error: 'invalid url' })
        };
      }
      
      // Parse the URL to get hostname
      const parsedUrl = url.parse(originalUrl);
      const hostname = parsedUrl.hostname;
      
      try {
        // Use dns.lookup to verify the URL exists
        await dns.lookup(hostname);
        
        // Check if URL already exists in database
        const existingUrl = urlDatabase.find(item => item.original_url === originalUrl);
        
        if (existingUrl) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              original_url: existingUrl.original_url,
              short_url: existingUrl.short_url
            })
          };
        }
        
        // Create new short URL entry
        const shortUrl = currentId++;
        const urlEntry = {
          original_url: originalUrl,
          short_url: shortUrl
        };
        
        urlDatabase.push(urlEntry);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            original_url: originalUrl,
            short_url: shortUrl
          })
        };
        
      } catch (dnsError) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ error: 'invalid url' })
        };
      }
    }
    
    // GET /api/shorturl/:short_url - Redirect to original URL
    if (event.httpMethod === 'GET' && path.startsWith('/')) {
      const shortUrlParam = path.substring(1); // Remove leading slash
      const shortUrl = parseInt(shortUrlParam);
      
      if (isNaN(shortUrl)) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Invalid short URL format' })
        };
      }
      
      // Find the URL entry in database
      const urlEntry = urlDatabase.find(item => item.short_url === shortUrl);
      
      if (urlEntry) {
        return {
          statusCode: 302,
          headers: {
            ...headers,
            'Location': urlEntry.original_url
          },
          body: ''
        };
      } else {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'No short URL found for the given input' })
        };
      }
    }
    
    // Route not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route not found' })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};