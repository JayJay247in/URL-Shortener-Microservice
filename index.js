require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');
const url = require('url'); // To parse hostname
const path = require('path');

const UrlModel = require('./models/urlModel'); // Adjust path if needed

const app = express();
const port = process.env.PORT || 3000;

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Successfully connected to MongoDB'))
  .catch(err => {
    console.error('Error connecting to MongoDB:', err.message);
    process.exit(1);
  });

// --- Middleware ---
app.use(cors());
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Serve static files from 'public' directory (for style.css)
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- HTML Route ---
// Serve the index.html file for the root path
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// --- API Routes ---

// Helper function to get the next sequence number for short_url
async function getNextSequenceValue(sequenceName) {
  // A simple counter implementation (could be a separate collection in a real app)
  // For FCC, just finding the max existing short_url and incrementing is fine.
  const lastUrl = await UrlModel.findOne().sort({ short_url: -1 });
  if (lastUrl) {
    return lastUrl.short_url + 1;
  }
  return 1; // Start with 1 if no URLs exist
}

// User Story 2: POST a URL to /api/shorturl
app.post('/api/shorturl', async (req, res) => {
  const originalUrl = req.body.url;

  // Validate URL format (simple check for http/https prefix)
  if (!originalUrl || !/^(http|https):\/\//i.test(originalUrl)) {
    return res.json({ error: 'invalid url' });
  }

  try {
    const parsedUrl = new URL(originalUrl); // Use URL constructor for robust parsing
    const hostname = parsedUrl.hostname;

    // User Story 4 (continued): DNS lookup for URL validation
    dns.lookup(hostname, async (err) => {
      if (err) {
        console.error('DNS lookup failed for:', hostname, err);
        return res.json({ error: 'invalid url' });
      }

      // URL is valid (format and DNS)
      try {
        // Check if URL already exists
        let urlEntry = await UrlModel.findOne({ original_url: originalUrl });

        if (urlEntry) {
          // URL already exists, return existing short URL
          res.json({
            original_url: urlEntry.original_url,
            short_url: urlEntry.short_url
          });
        } else {
          // Create new short URL
          const shortUrlId = await getNextSequenceValue('urlId');
          urlEntry = new UrlModel({
            original_url: originalUrl,
            short_url: shortUrlId
          });
          await urlEntry.save();
          res.json({
            original_url: urlEntry.original_url,
            short_url: urlEntry.short_url
          });
        }
      } catch (dbErr) {
        console.error('Database error:', dbErr);
        res.status(500).json({ error: 'Database error' });
      }
    });
  } catch (urlParseError) {
    // This catches errors from `new URL()` if the format is fundamentally wrong
    console.error('URL parsing error:', urlParseError);
    return res.json({ error: 'invalid url' });
  }
});

// User Story 3: Visit /api/shorturl/<short_url> to be redirected
app.get('/api/shorturl/:short_id', async (req, res) => {
  const shortId = parseInt(req.params.short_id); // Ensure it's a number

  if (isNaN(shortId)) {
    return res.status(400).json({ error: 'Invalid short URL format' });
  }

  try {
    const urlEntry = await UrlModel.findOne({ short_url: shortId });
    if (urlEntry) {
      res.redirect(urlEntry.original_url);
    } else {
      res.status(404).json({ error: 'No short URL found for the given input' });
    }
  } catch (dbErr) {
    console.error('Database error on redirect:', dbErr);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});