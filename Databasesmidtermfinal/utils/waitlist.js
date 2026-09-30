/**
 * utils/waitlist.js
 * Extension: Smart Waiting List & Reallocation.
 *
 When the organiser cancels a booking, those tickets become available again. 
 The system then gives the tickets to people on the waiting list, starting with the person who joined first.
 If a person’s requested number of tickets fits the available amount,
 the system creates a booking for them and changes their waiting-list status to `allocated`.
 If their request is too large, they are skipped but remain on the waiting list. 
 The system then checks the next person. This allows smaller requests to be accepted 
 instead of one large request blocking everyone else.
 */

function allocateWaitlist(eventId, ticketType, availableQty, callback) {
    if (availableQty <= 0) {
        callback();
        return;
    }

    let waitingQuery = `SELECT * FROM waitlist_entries
        WHERE event_id = ? AND ticket_type = ? AND status = 'waiting'
        ORDER BY joined_at ASC`;

    global.db.all(waitingQuery, [eventId, ticketType], function (err, entries) {
        if (err) {
            callback(err);
            return;
        }
        allocateNext(entries, 0, availableQty);
    });

    // this will processes one waiting-list entry at a time. Recursive rather than
    // a loop because each step needs to wait for two SQLite callbacks
    // before moving to the next person.
    function allocateNext(entries, index, remaining) {
        if (remaining <= 0 || index >= entries.length) {
            callback();
            return;
        }

        let entry = entries[index];

        if (entry.quantity > remaining) {
            allocateNext(entries, index + 1, remaining);
            return;
        }

        let now = new Date().toISOString();
        let fullQty = ticketType === "full" ? entry.quantity : 0;
        let concessionQty = ticketType === "concession" ? entry.quantity : 0;

        let insertBookingQuery = `INSERT INTO bookings
            (event_id, attendee_name, full_price_ticket_qty, concession_ticket_qty, booked_at)
            VALUES (?, ?, ?, ?, ?)`;
        let bookingParams = [eventId, entry.attendee_name, fullQty, concessionQty, now];

        global.db.run(insertBookingQuery, bookingParams, function (err) {
            if (err) {
                callback(err);
                return;
            }

            let updateWaitlistQuery = `UPDATE waitlist_entries
                SET status = 'allocated', allocated_at = ?
                WHERE waitlist_id = ?`;

            global.db.run(updateWaitlistQuery, [now, entry.waitlist_id], function (err) {
                if (err) {
                    callback(err);
                    return;
                }
                allocateNext(entries, index + 1, remaining - entry.quantity);
            });
        });
    }
}

module.exports = { allocateWaitlist };