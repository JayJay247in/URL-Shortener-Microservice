// File: netlify/functions/shorturl.js

"use strict";

const express = require("express");
const mongoose = require("mongoose");
const dns = require("dns").promises;
const { URL } = require("url");
const cors = require("cors");
const serverless = require("serverless-http");

const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(process.cwd() + "/public"));

// A single function to connect to the database
const connectToDatabase = async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
};

// Define schemas for our data
const urlMappingSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true, unique: true },
});

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const UrlMapping = mongoose.model("UrlMapping", urlMappingSchema);
const Counter = mongoose.model("Counter", counterSchema);

// --- API ROUTES ---

// Route for the main page
app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/views/index.html");
});


// Route to create a new short URL
app.post("/api/shorturl", async (req, res) => {
  const originalUrl = req.body.url;

  // Validate the URL starts with http:// or https://
  if (!/^https?:\/\//i.test(originalUrl)) {
    return res.json({ error: 'invalid url' });
  }

  try {
    const urlObject = new URL(originalUrl);
    await dns.lookup(urlObject.hostname); // Validate hostname

    await connectToDatabase();

    // Check if the URL has already been shortened
    let mapping = await UrlMapping.findOne({ original_url: originalUrl });

    if (mapping) {
      // If it exists, return the existing short URL
      return res.json({
        original_url: mapping.original_url,
        short_url: mapping.short_url,
      });
    }

    // *** THE DEFINITIVE FIX IS HERE ***
    // Use findOneAndUpdate (which is atomic) to safely get the next number
    const counter = await Counter.findOneAndUpdate(
      { _id: 'url_count' }, // Find the counter document
      { $inc: { seq: 1 } },  // Increment its sequence number by 1
      { new: true, upsert: true } // Options: return new doc, create if it doesn't exist
    );

    // Create and save the new URL mapping
    mapping = new UrlMapping({
      original_url: originalUrl,
      short_url: counter.seq,
    });
    await mapping.save();

    return res.json({
      original_url: mapping.original_url,
      short_url: mapping.short_url,
    });

  } catch (err) {
    // This will catch the DNS error or other failures
    return res.json({ error: 'invalid url' });
  }
});


// Route to redirect to the original URL
app.get("/api/shorturl/:shortUrl", async (req, res) => {
  try {
    const shortUrlParam = req.params.shortUrl;
    
    // Check if the provided shortUrl is a number
    if (!/^\d+$/.test(shortUrlParam)) {
       return res.json({ error: "Wrong format" });
    }

    await connectToDatabase();

    // Find the mapping in the database
    const mapping = await UrlMapping.findOne({ short_url: Number(shortUrlParam) });

    if (mapping) {
      // If found, redirect the user
      return res.redirect(mapping.original_url);
    } else {
      // If not found, return an error
      return res.json({ error: "No short URL found for the given input" });
    }

  } catch (err) {
    // Catch any unexpected server errors
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});


// Export the serverless handler
module.exports.handler = serverless(app);
