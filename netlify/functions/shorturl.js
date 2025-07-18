//
// 1. IMPORT NECESSARY MODULES
//
const express = require("express");
const mongoose = require("mongoose");
const dns = require("dns").promises; // Use the modern promise-based DNS module
const { URL } = require("url");
const cors = require("cors");
const serverless = require("serverless-http"); // Required to wrap the Express app

//
// 2. INITIALIZE EXPRESS APP & MIDDLEWARE
//
const app = express();

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Body-parser is now built into Express.
// This replaces `bodyParser.urlencoded({ extended: false })`.
// The typo 'entended' has also been corrected.
app.use(express.urlencoded({ extended: false }));

// Serve static files from the 'public' directory
app.use("/public", express.static(process.cwd() + "/public"));


//
// 3. DATABASE CONNECTION & SCHEMA
//
// IMPORTANT: Use `MONGODB_URI` to match your .env file.
// The connection is now wrapped in a function to be managed per invocation.
const connectToDatabase = async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
};

const urlMappingSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: String, required: true, unique: true },
});

const UrlMapping = mongoose.model("UrlMapping", urlMappingSchema);

//
// 4. API ROUTES (Using modern async/await syntax)
//
app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/views/index.html");
});

app.get("/api/hello", (req, res) => {
  res.json({ greeting: "hello API" });
});

/**
 * Creates a new short URL.
 */
app.post("/api/shorturl/new", async (req, res) => {
  const originalUrl = req.body.url;

  try {
    // Connect to the database for this request
    await connectToDatabase();

    // Step 1: Validate the URL's hostname
    const urlObject = new URL(originalUrl);
    await dns.lookup(urlObject.hostname);

    // Step 2: Check if URL already exists in the database
    let mapping = await UrlMapping.findOne({ original_url: originalUrl });

    if (mapping) {
      // If it exists, return the stored data
      res.json({
        original_url: mapping.original_url,
        short_url: mapping.short_url,
      });
    } else {
      // Step 3: If it's a new URL, create a short version and save it
      const shortUrl = shorterUrl();
      mapping = new UrlMapping({
        original_url: originalUrl,
        short_url: shortUrl,
      });
      await mapping.save();
      res.json({
        original_url: mapping.original_url,
        short_url: mapping.short_url,
      });
    }
  } catch (err) {
    // This will catch DNS errors, invalid URL errors, and DB errors
    if (err.code === 'ENOTFOUND' || err.name === 'TypeError') {
      res.json({ error: "invalid URL" });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
});


/**
 * Redirects a short URL to the original URL.
 */
app.get("/api/shorturl/:shortUrl", async (req, res) => {
  try {
    // Connect to the database for this request
    await connectToDatabase();

    const { shortUrl } = req.params;
    const mapping = await UrlMapping.findOne({ short_url: shortUrl });

    if (mapping) {
      res.redirect(mapping.original_url);
    } else {
      res.json({ error: "No short URL found for the given input" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to generate a random string
function shorterUrl() {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 5; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}


//
// 5. EXPORT THE HANDLER FOR NETLIFY
//
// This line replaces `app.listen(port)`.
// The serverless-http wrapper makes the Express app compatible with Netlify Functions.
module.exports.handler = serverless(app);
