/**
 * routes/organiser.js
 * Routes for the Organiser side of the app: the Organiser Home Page,
 * the Site Settings Page, and the Organiser Edit Event Page, plus the
 * POST actions that create, publish, and delete events.
 */

const express = require("express");
const router = express.Router();
const { allocateWaitlist } = require("../utils/waitlist");


router.get("/", (req, res, next) => {
    // this will fetch the single site settings row (name + description)
    let settingsQuery = "SELECT * FROM site_settings LIMIT 1";

    global.db.get(settingsQuery, function (err, settings) {
        if (err) {
            next(err);
            return;
        }

        // this will fetch every published event, most recently published first
        let publishedQuery =
            "SELECT * FROM events WHERE status = 'published' ORDER BY published_at DESC";

        global.db.all(publishedQuery, function (err, publishedEvents) {
            if (err) {
                next(err);
                return;
            }

            // this will fetch every draft event, most recently created first
            let draftQuery =
                "SELECT * FROM events WHERE status = 'draft' ORDER BY created_at DESC";

            global.db.all(draftQuery, function (err, draftEvents) {
                if (err) {
                    next(err);
                    return;
                }

                res.render("organiser/home.ejs", {
                    pageTitle: "Organiser Home Page",
                    currentPage: "organiser",
                    settings: settings,
                    publishedEvents: publishedEvents,
                    draftEvents: draftEvents,
                });
            });
        });
    });
});

router.post("/event/new", (req, res, next) => {
    let now = new Date().toISOString();
    // thiswill default event_date to today (YYYY-MM-DD) so the date input on the
    // edit page always starts with a valid value
    let today = now.slice(0, 10);
    let query = `INSERT INTO events
        (event_title, event_description, event_date, created_at, last_modified_at, status)
        VALUES (?, ?, ?, ?, ?, 'draft')`;
    let params = ["Untitled Event", "", today, now, now];

    global.db.run(query, params, function (err) {
        if (err) {
            next(err);
            return;
        }
        res.redirect(`/organiser/event/${this.lastID}/edit`);
    });
});

router.get("/event/:id/edit", (req, res, next) => {
    let query = "SELECT * FROM events WHERE event_id = ?";

    // this will fetch the event to edit
    global.db.get(query, [req.params.id], function (err, event) {
        if (err) {
            next(err);
            return;
        }
        if (!event) {
            res.status(404).send("Event not found.");
            return;
        }

        res.render("organiser/edit-event.ejs", {
            pageTitle: "Organiser Edit Event Page",
            currentPage: "organiser",
            event: event,
        });
    });
});

router.post("/event/:id/edit", (req, res, next) => {
    // this is server-side validation backing up the "required" 
    if (!req.body.event_title || req.body.event_title.trim() === "") {
        res.status(400).send("Event title is required.");
        return;
    }
    if (!req.body.event_date) {
        res.status(400).send("Event date is required.");
        return;
    }

    let now = new Date().toISOString();
    let query = `UPDATE events SET
        event_title = ?,
        event_description = ?,
        event_date = ?,
        full_price_ticket_qty = ?,
        full_price_ticket_price = ?,
        concession_ticket_qty = ?,
        concession_ticket_price = ?,
        last_modified_at = ?
        WHERE event_id = ?`;
    let params = [
        req.body.event_title,
        req.body.event_description,
        req.body.event_date,
        req.body.full_price_ticket_qty,
        req.body.full_price_ticket_price,
        req.body.concession_ticket_qty,
        req.body.concession_ticket_price,
        now,
        req.params.id,
    ];

    // this will save the submitted changes and update the last-modified timestamp
    global.db.run(query, params, function (err) {
        if (err) {
            next(err);
            return;
        }
        res.redirect("/organiser");
    });
});

router.post("/event/:id/publish", (req, res, next) => {
    let now = new Date().toISOString();
    let query =
        "UPDATE events SET status = 'published', published_at = ? WHERE event_id = ?";

    global.db.run(query, [now, req.params.id], function (err) {
        if (err) {
            next(err);
            return;
        }
        res.redirect("/organiser");
    });
});


router.post("/event/:id/delete", (req, res, next) => {
    let query = "DELETE FROM events WHERE event_id = ?";

    global.db.run(query, [req.params.id], function (err) {
        if (err) {
            next(err);
            return;
        }
        res.redirect("/organiser");
    });
});

router.get("/settings", (req, res, next) => {
    let query = "SELECT * FROM site_settings LIMIT 1";

    // this will fetch the current site name to pre-populate the form
    global.db.get(query, function (err, settings) {
        if (err) {
            next(err);
            return;
        }
        res.render("organiser/settings.ejs", {
            pageTitle: "Site Settings",
            currentPage: "organiser",
            settings: settings,
        });
    });
});

router.post("/settings", (req, res, next) => {
    // this is server side validation backing up the "required" 
    if (!req.body.site_name || !req.body.site_description) {
        res.status(400).send("Site name and description are both required.");
        return;
    }

    let query =
        "UPDATE site_settings SET site_name = ?, site_description = ? WHERE site_settings_id = 1";
    let params = [req.body.site_name, req.body.site_description];

    global.db.run(query, params, function (err) {
        if (err) {
            next(err);
            return;
        }
        res.redirect("/organiser");
    });
});

/**
 * EXTENSION: Smart Waiting List & Reallocation.
 */
router.get("/event/:id/bookings", (req, res, next) => {
    let eventQuery = "SELECT * FROM events WHERE event_id = ?";

    // this will fetch the event this Manage Bookings page is for
    global.db.get(eventQuery, [req.params.id], function (err, event) {
        if (err) {
            next(err);
            return;
        }
        if (!event) {
            res.status(404).send("Event not found.");
            return;
        }

        let bookingsQuery = "SELECT * FROM bookings WHERE event_id = ? ORDER BY booked_at DESC";

        // this wil fetch every booking made for this event, most recent first
        global.db.all(bookingsQuery, [req.params.id], function (err, bookings) {
            if (err) {
                next(err);
                return;
            }

            let waitlistQuery = `SELECT * FROM waitlist_entries
                WHERE event_id = ? ORDER BY status ASC, joined_at ASC`;

            global.db.all(waitlistQuery, [req.params.id], function (err, waitlist) {
                if (err) {
                    next(err);
                    return;
                }

                res.render("organiser/bookings.ejs", {
                    pageTitle: "Manage Bookings",
                    currentPage: "organiser",
                    event: event,
                    bookings: bookings,
                    waitlist: waitlist,
                });
            });
        });
    });
});

router.post("/event/:id/bookings/:bookingId/cancel", (req, res, next) => {
    let bookingQuery = "SELECT * FROM bookings WHERE booking_id = ?";

    // this will fetch the booking being cancelled, so we know how many tickets
    // of each type to free up for waitlist allocation
    global.db.get(bookingQuery, [req.params.bookingId], function (err, booking) {
        if (err) {
            next(err);
            return;
        }
        if (!booking) {
            res.status(404).send("Booking not found.");
            return;
        }

        let deleteQuery = "DELETE FROM bookings WHERE booking_id = ?";

        global.db.run(deleteQuery, [req.params.bookingId], function (err) {
            if (err) {
                next(err);
                return;
            }

            // One booking can include both ticket types. When it is cancelled,
            // the available tickets for each type are given to their separate waiting lists one at a time.

            allocateWaitlist(req.params.id, "full", booking.full_price_ticket_qty, function (err) {
                if (err) {
                    next(err);
                    return;
                }
                allocateWaitlist(req.params.id, "concession", booking.concession_ticket_qty, function (err) {
                    if (err) {
                        next(err);
                        return;
                    }
                    res.redirect(`/organiser/event/${req.params.id}/bookings`);
                });
            });
        });
    });
});

module.exports = router;