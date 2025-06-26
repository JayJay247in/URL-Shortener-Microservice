// models/urlModel.js
const mongoose = require('mongoose');

const urlSchema = new mongoose.Schema({
  original_url: {
    type: String,
    required: true,
    unique: true // Ensure original URLs are unique if you don't want duplicates with different short URLs
  },
  short_url: {
    type: Number, // Using Number as per FCC example { short_url : 1 }
    required: true,
    unique: true
  }
});

module.exports = mongoose.model('Url', urlSchema);