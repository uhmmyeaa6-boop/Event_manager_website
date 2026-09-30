/**
* index.js
* This is your main app entry point
*/

const express = require('express');
const app = express();
const port = 3000;
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));

const organiserRoutes = require('./routes/organiser');
app.use('/organiser', organiserRoutes);

const attendeeRoutes = require('./routes/attendee');
app.use('/attendee', attendeeRoutes);

const sqlite3 = require('sqlite3').verbose();
global.db = new sqlite3.Database('./database.db', function (err) {
    if (err) {
        console.error(err);
        process.exit(1);
    } else {
        console.log("Database connected");
        global.db.run("PRAGMA foreign_keys=ON");
    }
});

// GET / — this will render the homepage with live site settings, highlight cards, and active-nav state
app.get('/', (req, res, next) => {
    let settingsQuery = "SELECT * FROM site_settings LIMIT 1";

    // Fetch the current site name/description so the homepage hero
    // reflects whatever the organiser has set, not hardcoded text
    global.db.get(settingsQuery, function (err, settings) {
        if (err) {
            next(err);
            return;
        }

        res.render('index', {
            pageTitle: settings.site_name,
            currentPage: 'home',
            settings: settings,
            highlights: [
                { icon: '🎸', title: 'Weekly Instrument Classes', description: 'Develop your musical skills through regular classes led by experienced instructors.' },
                { icon: '🎤', title: 'Student Showcase Concerts', description: 'Celebrate the progress and achievements of our talented music students.' },
                { icon: '🎼', title: 'Guest Artist Masterclasses', description: 'Learn new techniques from professional musicians and special guest artists.' },
                { icon: '🎹', title: 'Piano Recitals', description: 'Enjoy inspiring performances from academy pianists of different ages and abilities.' },
                { icon: '🎻', title: 'Orchestra Performances', description: 'Experience live orchestral music performed by our academy ensembles.' }
            ]
        });
    });
});

const usersRoutes = require('./routes/users');
app.use('/users', usersRoutes);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})