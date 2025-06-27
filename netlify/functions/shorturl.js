const express = require('express');
const cors = require('cors');
const dns = require('dns');
const url = require('url');

const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

// Middleware to parse URL-encoded and JSON bodies
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// In-memory storage (resets on server restart)
let urlDatabase = [];
let currentId = 1;

// Function to validate URL format
function isValidUrlFormat(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    // Check if protocol is http or https
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// Function to verify URL exists using DNS lookup
function verifyUrlExists(urlString, callback) {
  try {
    const parsedUrl = new URL(urlString);
    const hostname = parsedUrl.hostname;
    
    dns.lookup(hostname, (err, address) => {
      if (err) {
        callback(false);
      } else {
        callback(true);
      }
    });
  } catch (e) {
    callback(false);
  }
}

// POST endpoint to create short URL
app.post('/api/shorturl', function(req, res) {
  const originalUrl = req.body.url;
  
  // Check if URL format is valid
  if (!isValidUrlFormat(originalUrl)) {
    return res.json({ error: 'invalid url' });
  }
  
  // Verify URL exists using DNS lookup
  verifyUrlExists(originalUrl, (exists) => {
    if (!exists) {
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
    const newUrlEntry = {
      original_url: originalUrl,
      short_url: currentId
    };
    
    urlDatabase.push(newUrlEntry);
    currentId++;
    
    res.json({
      original_url: newUrlEntry.original_url,
      short_url: newUrlEntry.short_url
    });
  });
});

// GET endpoint to redirect to original URL
app.get('/api/shorturl/:short_url', function(req, res) {
  const shortUrl = parseInt(req.params.short_url);
  
  // Check if short_url is a valid number
  if (isNaN(shortUrl)) {
    return res.json({ error: 'invalid url' });
  }
  
  // Find the URL entry in database
  const urlEntry = urlDatabase.find(item => item.short_url === shortUrl);
  
  if (!urlEntry) {
    return res.json({ error: 'No short URL found for the given input' });
  }
  
  // Redirect to original URL
  res.redirect(urlEntry.original_url);
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});