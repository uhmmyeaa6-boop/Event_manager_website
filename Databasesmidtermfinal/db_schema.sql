-- This makes sure that foreign_key constraints are observed and that errors will be thrown for violations
PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

-- Create your tables with SQL commands here (watch out for slight syntactical differences with SQLite vs MySQL)

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_accounts (
    email_account_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_address TEXT NOT NULL,
    user_id  INT, --the user that the email account belongs to
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- This will stores the single sitename/description shown on the Organiser
-- Home Page, the Attendee Home Page, and edited on the Site Settings Page.
CREATE TABLE IF NOT EXISTS site_settings (
    site_settings_id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_name TEXT NOT NULL,
    site_description TEXT NOT NULL
);

-- This will stores each event created by the organiser, in either 'draft' or
-- 'published' state. Only two ticket types are required by the spec
-- (full-price and concession), so they're stored as columns rather
-- than a separate ticket_types table.
CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_title TEXT NOT NULL,
    event_description TEXT,
    event_date TEXT NOT NULL,             -- the date the event itself takes place (YYYY-MM-DD)
    full_price_ticket_qty INTEGER NOT NULL DEFAULT 0,
    full_price_ticket_price REAL NOT NULL DEFAULT 0,
    concession_ticket_qty INTEGER NOT NULL DEFAULT 0,
    concession_ticket_price REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft' or 'published'
    created_at TEXT NOT NULL,             -- set once, when the event is first created
    published_at TEXT,                    -- set when the event is published; null while draft
    last_modified_at TEXT NOT NULL        -- updated every time the event is edited
);

-- This will stores each ticket booking an attendee makes for a published event.
-- Remaining ticket availability is calculated by subtracting the sum
-- of bookings for an event from that event's ticket quantities.
CREATE TABLE IF NOT EXISTS bookings (
    booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    attendee_name TEXT NOT NULL,
    full_price_ticket_qty INTEGER NOT NULL DEFAULT 0,
    concession_ticket_qty INTEGER NOT NULL DEFAULT 0,
    booked_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

-- EXTENSION: Smart Waiting List & Reallocation.
-- When an attendee tries to book a ticket type that's sold out, they
-- can join the waiting list instead. When the organiser cancels a
-- booking, tickets are automatically allocated to the
-- earliest waiting entries that fit, oldest first (see
-- utils/waitlist.js for the allocation logic).
CREATE TABLE IF NOT EXISTS waitlist_entries (
    waitlist_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    attendee_name TEXT NOT NULL,
    ticket_type TEXT NOT NULL,        -- 'full' or 'concession'
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting' or 'allocated'
    joined_at TEXT NOT NULL,
    allocated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

-- Insert default data (if necessary here)

-- Set up three users
INSERT INTO users ('user_name') VALUES ('Simon Star');
INSERT INTO users ('user_name') VALUES ('Dianne Dean');
INSERT INTO users ('user_name') VALUES ('Harry Hilbert');

-- Give Simon two email addresses and Diane one, but Harry has none
INSERT INTO email_accounts ('email_address', 'user_id') VALUES ('simon@gmail.com', 1);
INSERT INTO email_accounts ('email_address', 'user_id') VALUES ('simon@hotmail.com', 1);
INSERT INTO email_accounts ('email_address', 'user_id') VALUES ('dianne@yahoo.co.uk', 2);

-- Seed the one settings row the app expects to always exist.
INSERT INTO site_settings (site_name, site_description)
VALUES (
    'Harmony Hub Music Academy',
    'Join weekly music classes, attend live performances, and experience unforgettable musical events at Harmony Hub Music Academy.'
);

COMMIT;