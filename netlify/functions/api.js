// netlify/functions/api.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http');

const app = express();
const router = express.Router(); // Use an Express router

// Enable CORS
router.use(cors({ optionsSuccessStatus: 200 }));

// Serve static files and index.html
// __dirname for Netlify functions is the directory of the function file itself.
// process.cwd() is /var/task/ which is the root of the unzipped lambda package.
const projectRoot = process.cwd(); 

// Netlify serves static files from the 'publish' directory specified in netlify.toml
// if those files are not handled by a rewrite to a function.
// For simplicity and ensuring our function serves them if needed (e.g. from root):
router.use(express.static(path.join(projectRoot, 'public')));

router.get("/", (req, res) => {
  const filePath = path.join(projectRoot, 'views/index.html');
  console.log("Attempting to serve index.html from:", filePath);
  res.sendFile(filePath, (err) => {
    if (err) {
        console.error("Error sending index.html:", err);
        res.status(500).send("Error loading page. File not found in package.");
    }
  });
});

// API endpoint
router.get("/api/whoami", (req, res) => {
  // For Netlify, the client IP is in 'x-nf-client-connection-ip'
  // The 'req.ip' from Express might not be reliable without 'trust proxy'
  // serverless-http might pass event.headers to req.headers
  const ipaddress = req.headers['x-nf-client-connection-ip'] || req.ip;
  const language = req.headers["accept-language"];
  const software = req.headers["user-agent"];

  res.json({
    ipaddress: ipaddress,
    language: language,
    software: software
  });
});

// Mount the router to a base path that Netlify will proxy to.
// If your rewrite is from "/*" to "/.netlify/functions/api/:splat",
// then requests like "/" or "/api/whoami" will hit router.get("/") or router.get("/api/whoami") respectively.
app.use('/', router); // Mount router at the root of the function's path

module.exports.handler = serverless(app);