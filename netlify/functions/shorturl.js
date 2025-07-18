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

// --- SCHEMAS (URL Mapping + a New Counter) ---

const urlMappingSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true, unique: true },
});

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const UrlMapping = mongoose.model("UrlMapping", urlMappingSchema);
const Counter = mongoose.model('Counter', counterSchema);

// --- ROUTES ---

app.get("/", function(req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// --- API ENDPOINT #1: CREATE SHORT URL (With Atomic Counter) ---
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
      // **THE DEFINITIVE FIX IS HERE:**
      // Use the atomic counter to get the next sequence number.
      // `findOneAndUpdate` with `$inc` is an atomic operation.
      // `upsert: true` creates the counter if it doesn't exist.
      // `new: true` returns the updated document.
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'url_count' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      mapping = new UrlMapping({
        original_url: originalUrl,
        short_url: counter.seq,
      });

      await mapping.save();
      res.json({
        original_url: mapping.original_url,
        short_url: mapping.short_url,
      });
    }
  } catch (err) {
    // This will catch DNS errors and other unexpected errors
    return res.json({ error: 'invalid url' });
  }
});

// --- API ENDPOINT #2: REDIRECT (This handler is correct) ---
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
