# Harmony Hub Music Academy — Event Manager

An event manager built for Harmony Hub Music Academy, with separate Organiser
and Attendee sides, plus a Smart Waiting List & Reallocation extension.

## Setup

```
npm install
npm run build-db-win
npm run start
```
Then visit:

- `http://localhost:3000/` — Main Home Page
- `http://localhost:3000/organiser` — Organiser Home Page
- `http://localhost:3000/attendee` — Attendee Home Page

## Additional libraries

None. 

## Extension: Smart Waiting List & Reallocation

When a ticket type is sold out, attendees can join a waiting list.
 If the organiser cancels a booking through the Manage booking page, 
 the available tickets are automatically given to the earliest people on 
 the waiting list whose requests can be fulfilled. More details, diagrams, 
 and code references are included in the report.
