// File: netlify/functions/shorturl.js

"use strict";

const express = require("express");
const mongoose = require("mongoose");
const dns = require("dns").promises;
const { URL } = require("url");
const cors = require("cors");
const serverless = require("serverless-http");

const app = express();

// Use built-in express body parser and cors
app.use(cors());
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Serve static files (if you have any)
app.use("/public", express.static(process.cwd() + "/public"));

// Connect to the database when the function is invoked
const connectToDatabase = async () => {
  if (mongoose.connection.readyState !== 1) {
    // IMPORTANT: Make sure your environment variable in Netlify is MONGODB_URI
    await mongoose.connect(process.env.MONGODB_URI);
  }
};

// --- SCHEMA UPDATED ---
// The schema now expects short_url to be a Number
const urlMappingSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true, unique: true },
});

const UrlMapping = mongoose.model("UrlMapping", urlMappingSchema);

// --- ROUTES ---

// Main index page
app.get("/", function(req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// --- API ENDPOINT #1: CREATE SHORT URL (FIXED) ---
app.post("/api/shorturl", async function(req, res) {
  const originalUrl = req.body.url;

  // Step 1: Validate URL format
  // It must start with http:// or https://
  if (!/^https?:\/\//i.test(originalUrl)) {
    // The test requires this EXACT error message.
    return res.json({ error: 'invalid url' });
  }

  try {
    const urlObject = new URL(originalUrl);
    // Step 2: Validate hostname using DNS lookup
    await dns.lookup(urlObject.hostname);

    await connectToDatabase();

    // Step 3: Check if URL already exists
    let mapping = await UrlMapping.findOne({ original_url: originalUrl });

    if (mapping) {
      res.json({
        original_url: mapping.original_url,
        short_url: mapping.short_url,
      });
    } else {
      // Step 4: Create a new short URL (as a number)
      const urlCount = await UrlMapping.countDocuments({});
      const newShortUrl = urlCount + 1;

      mapping = new UrlMapping({
        original_url: originalUrl,
        short_url: newShortUrl,
      });

      await mapping.save();
      res.json({
        original_url: mapping.original_url,
        short_url: mapping.short_url,
      });
    }
  } catch (err) {
    // This will now catch DNS lookup errors
    return res.json({ error: 'invalid url' });
  }
});


// --- API ENDPOINT #2: REDIRECT (FIXED) ---
app.get("/api/shorturl/:shortUrl", async function(req, res) {
  try {
    const shortUrlParam = req.params.shortUrl;
    // Ensure the parameter is a valid number before querying
    if (!/^\d+$/.test(shortUrlParam)) {
       return res.json({ error: "Wrong format" });
    }

    await connectToDatabase();
    
    const mapping = await UrlMapping.findOne({ short_url: Number(shortUrlParam) });

    if (mapping) {
      res.redirect(mapping.original_url);
    } else {
      res.json({ error: "No short URL found for the given input" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// Export the handler for Netlify
module.exports.handler = serverless(app);
