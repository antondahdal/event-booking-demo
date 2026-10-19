# Event Booking front end

The browser talks only to the gateway on port **8081**.

Sign in, the show list, Book, and My tickets call the real API.
The side panel names the service method for that click.

Register saves an attendee and does not return a token.
Book needs a signed-in attendee.
The token stays in this browser. Auth does not store it.

## Run

Start auth (8082), event (8083), booking (8080), and the gateway (8081) first.

Serve this folder on port **3000**. The API allows that origin only.

```powershell
python -m http.server 3000
```

Open [http://localhost:3000](http://localhost:3000).

A hosted copy of this folder uses `js/config.js`. On localhost the page calls `http://localhost:8081`. Anywhere else it calls `window.BOOKING_API_PUBLIC`.

A `file://` page cannot call the gateway.
