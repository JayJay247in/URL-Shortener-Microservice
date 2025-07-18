// set up an express app
const port = 3000;

/** require dependencies
 * express to handle routing
 * dotenv to access .env variables locally
 * dns to check the validity of the input URL
 * body parser to properly retrieve the form's value
 * mongodb and mongoose to handle the database logic
 */
const express = require('express');
require('dotenv').config();
const dns = require('dns');
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
const mongoose = require('mongoose');

// set up an express app
const app = express();

// mount the body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));

// render the stylesheet as found in the public folder
app.use(express.static(`${__dirname}/public`));

// MONGO && MONGOOSE
// connect the application to the mLab database through the process variable detailing the URI code
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true
});

// define a schema for the url(s) documents, to be stored and read in the database
const { Schema } = mongoose;
// each instance shall have two fields
// a string representing the original URL
// an integer for the shortened counterpart
const urlSchema = new Schema({
  original_url: {
    type: String,
    required: true
  },
  short_url: {
    type: Number,
    required: true,
    default: 0
  }
});

// define a model, on which all instances (documents) will be based
const Url = mongoose.model('Url', urlSchema);

// EXPRESS && ROUTING
// in the root path render the HTML file as found in the views folder
app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/views/index.html`);
});

// following a post request in the selected path, create and save a document
app.post('/api/shorturl', (req, res) => {
  /** path's logic
   * use the dns module to check if the input valid represents a valid url
   *    valid
   *    use the findOne() method to check if the database already contains a matching document
   *        not found
   *        use the estimatedDocumentCount() method to assess the number of items in the database
   *        create a new entry, using the length to create a unique short_url value
   *        save the entry
   *        display pertinent information
   *
   *        found
   *        display pertinent information
   *
   *    invalid
   *    display an error message
   */

  // store in a variable the requested url
  const urlRequest = req.body.url;

  // retrieve the hostname removing from the url (the section between https:// and relative paths)
  const hostname = urlRequest
    .replace(/http[s]?\:\/\//, '')
    .replace(/\/(.+)?/, '');

  // use the hostname in the lookup() function
  dns.lookup(hostname, (lookupErr, addresses) => {
    if (lookupErr) {
      console.log('lookup() error');
    }
    // lookup() returns either _undefined_ or _an IP address_
    // if undefined , send a JSON object detailing the invalid nature of the request
    if (!addresses) {
      res.json({
        error: 'invalid URL'
      });
    } else {
      // if an IP address is returned
      // check if the database alread contains a matching document
      Url.findOne({
        original_url: urlRequest
      }, (findOneErr, urlFound) => {
        if (findOneErr) {
          console.log('findOne() error');
        }
        // findOne() returns either _null_ or _a document_
        // depending on whether or not a document matches the specified property value pair(s)
        // if null, create a new document
        if (!urlFound) {
          // check the number of documents in the database
          Url.estimatedDocumentCount((countErr, count) => {
            if (countErr) {
              res.send('estimatedDocumentCount() error');
            }
            // create a new document
            // for the short_url field increment the number of documents
            const url = new Url({
              original_url: urlRequest,
              short_url: count + 1
            });

            // save the document in the database
            url.save((saveErr, urlSaved) => {
              if (saveErr) {
                res.send('save() error');
              }
              // send a json object detailing the values of the saved url
              res.json({
                original_url: urlSaved.original_url,
                short_url: urlSaved.short_url
              });
            // save block
            });
          // count block
          });
        // url not found block
        } else {
          // findOne() returns an object
          // display its information
          res.json({
            original_url: urlFound.original_url,
            short_url: urlFound.short_url
          });
        } // url found block
      }); // findOne() block
    } // vaid lookup block
  }); // lookup/(block)
}); // post request block

// following a get request in the selected path, re-route the visitor toward the unshortened url
app.get('/api/shorturl/:shorturl', (req, res) => {
  // retrieve the requested short url through the request parameter
  const { shorturl } = req.params;

  // lookf for a document in the database with the matching shorturl
  Url.findOne({
    short_url: shorturl
  }, (err, urlFound) => {
    if (err) {
      console.log('findOne() error');
    }
    // once again, findOne() can either return _null_ or _an object_
    // returns null, return a message relating the lack of shortened url
    if (!urlFound) {
      res.json({
        error: 'no matching URL'
      });
    } else {
      // returns a document matching the short url, forward toward the unshortened url
      res.redirect(urlFound.original_url);
    }
  }); // findOne() block
}); // get request block

// listen in the selected port and render the simple application
app.listen(port);
console.log(`listening on port ${port}`);
