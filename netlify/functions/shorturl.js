// File: netlify/functions/shorturl.js

"use strict";

const express = require("express");
const mongoose = require("mongoose");
const dns = require("dns").promises;
const { URL } = require("url");
const cors = require("cors");
const serverless = require("serverless-http");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(process.cwd() + "/public"));

// Database connection function
const connectToDatabase = async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
};

// Mongoose Schema
const urlMappingSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true, unique: true },
});

const UrlMapping = mongoose.model("UrlMapping", urlMappingSchema);


// --- ROUTES ---

app.get("/", function(req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// --- API ENDPOINT #1: CREATE SHORT URL (FIXED COUNTER LOGIC) ---
app.post("/api/shorturl", async function(req, res) {
  const originalUrl = req.body.url;

  if (!/^https?:\/\//i.test(originalUrl)) {
    return res.json({ error: 'invalid url' });
  }

  try {
    const urlObject = new URL(originalUrl);
    await dns.lookup(urlObject.hostname);

    await connectToDatabase();

    let mapping = await UrlMapping.findOne({ original_url: originalUrl });

    if (mapping) {
      res.json({
        original_url: mapping.original_url,
        short_url: mapping.short_url,
      });
    } else {
      // **THE FIX IS HERE:** Instead of counting documents, find the highest
      // existing short_url and add 1. This is much more robust.
      const lastUrl = await UrlMapping.findOne().sort({ short_url: -1 });
      const newShortUrl = lastUrl ? lastUrl.short_url + 1 : 1;

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
    return res.json({ error: 'invalid url' });
  }
});

// --- API ENDPOINT #2: REDIRECT (This part was already correct) ---
app.get("/api/shorturl/:shortUrl", async function(req, res) {
  try {
    const shortUrlParam = req.params.shortUrl;
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
    res.status(500).json({ error: "Server error" });
  }
});

// Export the handler for Netlify
module.exports.handler = serverless(app);
