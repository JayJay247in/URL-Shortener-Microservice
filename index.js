require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dns = require('dns');
const url = require('url');
const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

// Body parsing middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/public/index.html');
});

// In-memory storage for URLs (in production, use a database)
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

// POST endpoint to create short URL
app.post('/api/shorturl', function(req, res) {
  const originalUrl = req.body.url;
  
  // Check if URL format is valid
  if (!isValidUrl(originalUrl)) {
    return res.json({ error: 'invalid url' });
  }
  
  // Parse the URL to get hostname
  const parsedUrl = url.parse(originalUrl);
  const hostname = parsedUrl.hostname;
  
  // Use dns.lookup to verify the URL exists
  dns.lookup(hostname, (err, address) => {
    if (err) {
      return res.json({ error: 'invalid url' });
    }
    
    // Check if URL already exists in database
    const existingUrl = urlDatabase.find(item => item.original_url === originalUrl);
    
    if (existingUrl) {
      return res.json({
        original_url: existingUrl.original_url,
        short_url: existingUrl.short_url
      });
    }
    
    // Create new short URL entry
    const shortUrl = currentId++;
    const urlEntry = {
      original_url: originalUrl,
      short_url: shortUrl
    };
    
    urlDatabase.push(urlEntry);
    
    res.json({
      original_url: originalUrl,
      short_url: shortUrl
    });
  });
});

// GET endpoint to redirect to original URL
app.get('/api/shorturl/:short_url', function(req, res) {
  const shortUrl = parseInt(req.params.short_url);
  
  // Find the URL entry in database
  const urlEntry = urlDatabase.find(item => item.short_url === shortUrl);
  
  if (urlEntry) {
    res.redirect(urlEntry.original_url);
  } else {
    res.json({ error: 'No short URL found for the given input' });
  }
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});