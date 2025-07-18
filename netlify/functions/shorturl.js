
// init project
require('dotenv').config();
const express = require('express');
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const dns = require("dns");
const urlparser = require("url");
const multer = require("multer");
const app = express();
const port = process.env.PORT || 3000;




//Setup DB
//mongoose.connect(process.env.DB_URI)
//middle-ware

app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect(process.env.DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})


// enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
// so that your API is remotely testable by FCC 
var cors = require('cors');
//const shortid = require('shortid');
const { json } = require('express');
app.use(cors({ optionsSuccessStatus: 200 }));  // some legacy browsers choke on 204
const upload = multer({ dest: "./public/data/uploads" })

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});


// your first API endpoint... 
app.get("/api/hello", (req, res) => {
  res.json({greeting: 'hello API'});
});


//Timestamp HTML router

app.get("/timestamp", (req, res) => {
    res.sendFile(__dirname + '/views/timestamp.html');
});

//Request Header parser router

app.get("/requestHeaderParser", (req, res) => {
    res.sendFile(__dirname + '/views/requestHeaderParser.html');
});

//URL Shortner

app.get("/urlShortenerMicroservice", (req, res) => {
    res.sendFile(__dirname + '/views/urlShortenerMicroservice.html');
});



//Exercise Tracker
app.get("/exerciseTracker", (req, res) => {
    res.sendFile(__dirname + '/views/exerciseTracker.html');

//File Metadata Microservice
app.get("/fileMetadataMicroservice", (req, res) => {
res.sendFile(__dirname + '/views/fileMetadataMicroservice.html');

// Timestamp Project
app.get("/api/timestamp", (req, res) => {
    var now = new Date()
    res.json({
        "unix": now.getTime(),
        "utc": now.toUTCString()
    });
});



        app.get("/api/timestamp/:date_string", (req, res) => {
            let dateString = req.params.date_string;



            if (parseInt(dateString) > 10000) {
                let unixTime = new Date(parseInt(dateString));
                res.json({
                    "unix": unixTime.getTime(),
                    "utc": unixTime.toUTCString()
                });
            }



            let passedInValue = new Date(dateString);

            if (passedInValue == "Invalid Date") {
                res.json({ "error": "Invalid Date" });
            } else {
                res.json({
                    "unix": passedInValue.getTime(),
                    "utc": passedInValue.toUTCString()
                })
            }
        });

        //whoami API

        app.get("/api/whoami", (req, res) => {

            res.json({
                "ipaddress": req.connection.remoteAddress,
                "language": req.headers["accept-language"],
                "software": req.headers["user-agent"]
            })
        });

        //URL Shortner
        const schema = new mongoose.Schema({ url: 'string' });
        const Url = mongoose.model('Url', schema);

        app.post('/api/shorturl/', (req, res) => {
            const bodyurl = req.body.url;

            const something = dns.lookup(urlparser.parse(bodyurl).hostname, (err, address) => {
                if (!address) {
                    res.json({ error: "Invalid URL" })
                } else {
                    const url = new Url({ url: bodyurl })
                    url.save((err, data) => {
                        res.json({
                            original_url: data.url,
                            short_url: data.id
                        })
                    })
                }
            })
        });

        app.get("/api/shorturl/:id", (req, res) => {
            const id = req.params.id;
            Url.findById(id, (err, data) => {
                if (!data) {
                    res.json({ error: "Invalid URL" })
                } else {

                    res.redirect(data.url)
                }
            });
        });
    });


    //Exercise tracker
    const exerciseSchema = {
        userId: { type: String, required: true },
        description: String,
        duration: Number,
        date: { type: Date, default: Date.now }
    }

    const userSchema = mongoose.Schema(
        {
            username: { type: String, required: true, unique: true },
            exercices: [
                {
                    description: { type: String },
                    duration: { type: Number },
                    date: { type: String, required: false }
                }
            ]
        }
    );
    const User = mongoose.model('User', userSchema);
    const Exercise = mongoose.model('Exercise', exerciseSchema)

    const logSchema = new mongoose.Schema({
        userId: String,
        description: String,
        duration: Number,
        date: Date,
    });

    const Log = mongoose.model('Log', logSchema);

    app.use(bodyParser.urlencoded({ extended: false }))
    app.use(bodyParser.json())


    app.post("/api/users", (req, res) => {
        const newUser = new User({
            username: req.body.username
        });
        newUser.save((err, data) => {
            if (err) {
                res.json("Username already taken")
            } else {
                res.json({ "username": data.username, "_id": data.id });
            }
        })
    })

    app.get('/api/users', (req, res) => {
        User.find({}, { __v: 0 }, (err, data) => {
            if (err) {
                res.json({ error: 'Unable to retrieve users' });
            } else {
                res.json(data);
            }
        });
    });

    app.post('/api/users/:_id/exercises', (req, res) => {
        const userId = req.params._id;
        const description = req.body.description;
        const duration = req.body.duration;
        if (!req.body.date) {
            date = new Date();
        } else {
            date = new Date(req.body.date);
        }
        if (description == '' || duration == '') {
            res.send('Please enter a description and duration');
        } else {
            User.findById(userId, (err, userData) => {
                if (err) {
                    res.json({ error: 'Unable to find user' });
                } else {
                    const newLog = new Log({
                        userId: userId,
                        description: description,
                        duration: duration,
                        date: date,
                    });
                    newLog.save((err, data) => {
                        if (err) {
                            console.log(err);
                            res.json({ error: 'Unable to create log' });
                        } else {
                            res.json({
                                username: userData.username,
                                description: data.description,
                                duration: data.duration,
                                _id: data.userId,
                                date: data.date.toDateString(),
                            });
                        }
                    });
                }
            });
        }
    });

    app.get('/api/users/:_id/logs', (req, res) => {
        const userId = req.params._id;
        const from = req.query.from;
        const to = req.query.to;
        const limit = req.query.limit;
        User.findById(userId, (err, userData) => {
            if (err) {
                res.json({ error: 'Unable to find user' });
            } else {
                Log.find(
                    { userId: userId },
                    {
                        _id: 0,
                        __v: 0,
                    },
                    (err, data) => {
                        if (err) {
                            res.json({ error: 'Unable to find logs' });
                        } else {
                            if (from) {
                                data = data.filter((log) => log.date >= new Date(from));
                            }
                            if (to) {
                                data = data.filter((log) => log.date <= new Date(to));
                            }
                            if (limit) {
                                data = data.slice(0, limit);
                            }

                            let logArr = [];
                            for (let i = 0; i < data.length; i++) {
                                logArr.push({
                                    description: data[i].description,
                                    duration: data[i].duration,
                                    date: new Date(data[i].date).toDateString().slice(0, 16),
                                });
                            }
                            if (from && to) {
                                res.json({
                                    _id: userData._id,
                                    username: userData.username,
                                    from: new Date(from).toDateString(),
                                    to: new Date(to).toDateString(),
                                    count: data.length,
                                    log: logArr,
                                });
                            } else if (from) {
                                res.json({
                                    _id: userData._id,
                                    username: userData.username,
                                    from: new Date(from).toDateString(),
                                    count: data.length,
                                    log: logArr,
                                });
                            } else if (to) {
                                res.json({
                                    _id: userData._id,
                                    username: userData.username,
                                    to: new Date(to).toDateString(),
                                    count: data.length,
                                    log: logArr,
                                });
                            } else {
                                res.json({
                                    _id: userId,
                                    username: userData.username,
                                    count: data.length,
                                    log: [...logArr],
                                });
                            }
                        }
                    }
                );
            }
        });
    });

    app.get('/api/users/:_id/logs', (req, res) => {
        const userId = req.params._id;
        const from = req.query.from;
        const to = req.query.to;
        const limit = req.query.limit;
        User.findById(userId, (err, userData) => {
            if (err) {
                res.json({ error: 'Unable to find user' });
            } else {
                Log.find(
                    { userId: userId },
                    {
                        _id: 0,
                        __v: 0,
                    },
                    (err, data) => {
                        if (err) {
                            res.json({ error: 'Unable to find logs' });
                        } else {
                            if (from) {
                                data = data.filter((log) => log.date >= new Date(from));
                            }
                            if (to) {
                                data = data.filter((log) => log.date <= new Date(to));
                            }
                            if (limit) {
                                data = data.slice(0, limit);
                            }

                            let logArr = [];
                            for (let i = 0; i < data.length; i++) {
                                logArr.push({
                                    description: data[i].description,
                                    duration: data[i].duration,
                                    date: new Date(data[i].date).toDateString().slice(0, 16),
                                });
                            }
                            if (from && to) {
                                res.json({
                                    _id: userData._id,
                                    username: userData.username,
                                    from: new Date(from).toDateString(),
                                    to: new Date(to).toDateString(),
                                    count: data.length,
                                    log: logArr,
                                });
                            } else if (from) {
                                res.json({
                                    _id: userData._id,
                                    username: userData.username,
                                    from: new Date(from).toDateString(),
                                    count: data.length,
                                    log: logArr,
                                });
                            } else if (to) {
                                res.json({
                                    _id: userData._id,
                                    username: userData.username,
                                    to: new Date(to).toDateString(),
                                    count: data.length,
                                    log: logArr,
                                });
                            } else {
                                res.json({
                                    _id: userId,
                                    username: userData.username,
                                    count: data.length,
                                    log: [...logArr],
                                });
                            }
                        }
                    }
                );
            }
        });
    });

});
    //File Metadata Microservice
app.post("/api/fileanalyse", upload.single("upfile"), (req, res) => {
    const { originalname, mimetype, size } = req.file;
    res.json({
        name: originalname,
        type: mimetype,
        size,
    });
});
// listen for requests :)
var listener = app.listen(port, () => {
    console.log('Your app is listening on port' + listener.address().port);
});