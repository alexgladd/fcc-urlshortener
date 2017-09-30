// server.js
// where your node app starts

// config
var rootUrl = 'https://excited-margin.glitch.me/';

// init mongoose
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
mongoose.connect(process.env.MONGO_URI, { useMongoClient: true, promiseLibrary: global.Promise });

var urlSchema = new Schema({
  shortId: Number,
  url: String
}, {
  timestamps: true
});

var Url = mongoose.model('urls', urlSchema);

// business logic
function createNewShortUrl(originalUrl, response) {
  var resultUrl = {
    originalUrl: originalUrl,
    shortUrl: null
  };
  
  console.log('Starting create chain for url ' + originalUrl);
  
  async.waterfall([
    function(next) {
      // check for existing short url
      console.log('Looking for existing shortened...');
      Url.findOne({ url: originalUrl }, function(err, url) {
        if (err) {
          next(err);
        } else {
          next(null, url);
        }
      });
    },
    function(existingUrl, next) {
      if (existingUrl) {
        console.log('Found existing shortened: ' + existingUrl.shortId);
        
        resultUrl.shortUrl = rootUrl + existingUrl.shortId
        response.status(200).json(resultUrl);
        
        next('ok');
      } else {
        console.log('None existing; finding max shortId...');
        Url.find({}).sort({ shortId: -1 }).select({ shortId: 1 }).limit(1).exec(function (err, result) {
          if (err) {
            next(err);
          } else if (result.length === 0) {
            next(null, 1000);
          } else {
            next(null, result[0].shortId + 1);
          }
        });
      }
    },
    function(shortId, next) {
      console.log('Creating new short url record with shortId ' + shortId);
      var shortUrl = new Url({
        shortId: shortId,
        url: originalUrl
      });
      
      shortUrl.save(function(err) {
        if (err) {
          next(err);
        } else {
          next(null, shortUrl);
        }
      });
    }
  ], function(err, result) {
    if (err) {
      if (err === 'ok') return;
      
      console.log('Error creating new short url: ' + err);
      
      response.status(500).json({ error: 'Encountered an error creating short url' });
    } else {
      console.log('Successfully created new short url');
      
      resultUrl.shortUrl = rootUrl + result.shortId
      
      response.status(201).json(resultUrl);
    }
  });
}

// init project
var async = require('async');
var express = require('express');
var app = express();

// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

// create a new short url
app.get(/\/new\/.+/, function(req, res) {
  var urlRegex = /\/new\/(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&/=]*))/;
  
  var match = req.originalUrl.match(urlRegex);
  
  if (match) {
    createNewShortUrl(match[1], res);
  } else {
    res.status(400).json({ error: 'Malformed URL submitted' });
  }
});

// visit a short url
app.get(/\/([0-9]{4,})/, function(req, res) {
  var sId = req.params[0];
  
  Url.findOne({ shortId: sId }, function(err, url) {
    if (err) {
      res.status(500).json({ error: 'Encountered server error' });
    } else if (url) {
      res.redirect(301, url.url);
    } else {
      res.status(400).json({ error: 'No such short url ID found' });
    }
  });
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
