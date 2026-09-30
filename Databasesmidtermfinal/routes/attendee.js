/**
 * routes/attendee.js
 * Routes for the Attendee side of the app: the Attendee Home Page
 * >> has list of published events and >>> Attendee Event Page view one
 * event's details and book tickets.
 */

const express = require("express");
const router = express.Router();
/**
 * Displays the attendee home page.
 * Input: none.
 * Output: renders the site settings and published events.
 */
router.get("/", (req, res, next) => {
    let settingsQuery = "SELECT * FROM site_settings LIMIT 1";

    // this will fetch the site name shown at the top of the page
    global.db.get(settingsQuery, function (err, settings) {
        if (err) {
            next(err);
            return;
        }

        // Only published events are visible to attendees
        let eventsQuery =
            "SELECT * FROM events WHERE status = 'published' ORDER BY event_date ASC";

        global.db.all(eventsQuery, function (err, events) {
            if (err) {
                next(err);
                return;
            }

            res.render("attendee/home.ejs", {
                pageTitle: "Attendee Home Page",
                currentPage: "attendee",
                settings: settings,
                events: events,
            });
        });
    });
});


router.get("/event/:id", (req, res, next) => {
    let eventQuery = "SELECT * FROM events WHERE event_id = ? AND status = 'published'";

    // this will fetch the one event this page is for, by its id only if published,
    // so that a draft event's URL can't be viewed by attendees
    global.db.get(eventQuery, [req.params.id], function (err, event) {
        if (err) {
            next(err);
            return;
        }
        if (!event) {
            res.status(404).send("Event not found.");
            return;
        }

        // this will sum up tickets already booked for this event, so we can work
        // out how many of each type are still available.
        let bookedQuery = `SELECT
            COALESCE(SUM(full_price_ticket_qty), 0) AS booked_full,
            COALESCE(SUM(concession_ticket_qty), 0) AS booked_concession
            FROM bookings WHERE event_id = ?`;

        global.db.get(bookedQuery, [req.params.id], function (err, booked) {
            if (err) {
                next(err);
                return;
            }

            res.render("attendee/event.ejs", {
                pageTitle: "Attendee Event Page",
                currentPage: "attendee",
                event: event,
                remainingFull: event.full_price_ticket_qty - booked.booked_full,
                remainingConcession: event.concession_ticket_qty - booked.booked_concession,
                bookingSuccess: req.query.booked === "1",
                waitlistSuccess: req.query.waitlisted === "1",
            });
        });
    });
});


router.post("/event/:id/book", (req, res, next) => {
    let attendeeName = req.body.attendee_name;
    let fullQty = parseInt(req.body.full_price_ticket_qty, 10) || 0;
    let concessionQty = parseInt(req.body.concession_ticket_qty, 10) || 0;

    if (!attendeeName || attendeeName.trim() === "") {
        res.status(400).send("Please enter your name.");
        return;
    }
    if (fullQty < 0 || concessionQty < 0) {
        res.status(400).send("Ticket quantities can't be negative.");
        return;
    }
    if (fullQty === 0 && concessionQty === 0) {
        res.status(400).send("Please select at least one ticket.");
        return;
    }

    let eventQuery = "SELECT * FROM events WHERE event_id = ? AND status = 'published'";

    // this will re-fetch the event server side rather than trusting anything the form claims about it
    global.db.get(eventQuery, [req.params.id], function (err, event) {
        if (err) {
            next(err);
            return;
        }
        if (!event) {
            res.status(404).send("Event not found.");
            return;
        }

        let bookedQuery = `SELECT
            COALESCE(SUM(full_price_ticket_qty), 0) AS booked_full,
            COALESCE(SUM(concession_ticket_qty), 0) AS booked_concession
            FROM bookings WHERE event_id = ?`;

        // this will re-check current booked totals server side 
        global.db.get(bookedQuery, [req.params.id], function (err, booked) {
            if (err) {
                next(err);
                return;
            }

            let remainingFull = event.full_price_ticket_qty - booked.booked_full;
            let remainingConcession = event.concession_ticket_qty - booked.booked_concession;

            // this does availability check 
            if (fullQty > remainingFull || concessionQty > remainingConcession) {
                res.status(400).send("Not enough tickets remaining for that request.");
                return;
            }

            let now = new Date().toISOString();
            let insertQuery = `INSERT INTO bookings
                (event_id, attendee_name, full_price_ticket_qty, concession_ticket_qty, booked_at)
                VALUES (?, ?, ?, ?, ?)`;
            let params = [req.params.id, attendeeName, fullQty, concessionQty, now];

            // this will insert the confirmed booking now that availability has been verified
            global.db.run(insertQuery, params, function (err) {
                if (err) {
                    next(err);
                    return;
                }
                res.redirect(`/attendee/event/${req.params.id}?booked=1`);
            });
        });
    });
});

router.post("/event/:id/waitlist", (req, res, next) => {
    let attendeeName = req.body.attendee_name;
    let ticketType = req.body.ticket_type;
    let quantity = parseInt(req.body.quantity, 10) || 0;

    if (!attendeeName || attendeeName.trim() === "") {
        res.status(400).send("Please enter your name.");
        return;
    }
    if (ticketType !== "full" && ticketType !== "concession") {
        res.status(400).send("Invalid ticket type.");
        return;
    }
    if (quantity <= 0) {
        res.status(400).send("Please enter a quantity of at least 1.");
        return;
    }

    let eventQuery = "SELECT * FROM events WHERE event_id = ? AND status = 'published'";

    // this will re-fetch the event server-side to confirm it exists and is published
    global.db.get(eventQuery, [req.params.id], function (err, event) {
        if (err) {
            next(err);
            return;
        }
        if (!event) {
            res.status(404).send("Event not found.");
            return;
        }

        let bookedQuery = `SELECT
            COALESCE(SUM(full_price_ticket_qty), 0) AS booked_full,
            COALESCE(SUM(concession_ticket_qty), 0) AS booked_concession
            FROM bookings WHERE event_id = ?`;

        // this will re-check how many tickets of this type are already booked, to confirm it really is sold out
        global.db.get(bookedQuery, [req.params.id], function (err, booked) {
            if (err) {
                next(err);
                return;
            }

            let remaining = ticketType === "full"
                ? event.full_price_ticket_qty - booked.booked_full
                : event.concession_ticket_qty - booked.booked_concession;

            // Only actually sold out types can be joined — if there's
            // still availability, the attendee will be able to book normally.
            if (remaining > 0) {
                res.status(400).send("This ticket type isn't sold out — please book it directly instead.");
                return;
            }

            let now = new Date().toISOString();
            let insertQuery = `INSERT INTO waitlist_entries
                (event_id, attendee_name, ticket_type, quantity, status, joined_at)
                VALUES (?, ?, ?, ?, 'waiting', ?)`;
            let params = [req.params.id, attendeeName, ticketType, quantity, now];

            // add this attendee to the waiting list for this event/ticket type
            global.db.run(insertQuery, params, function (err) {
                if (err) {
                    next(err);
                    return;
                }
                res.redirect(`/attendee/event/${req.params.id}?waitlisted=1`);
            });
        });
    });
});

module.exports = router;