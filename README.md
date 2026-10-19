# Event Booking front end

The browser talks only to the gateway. The address comes from `js/config.js`.

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

A hosted copy calls the public gateway. On this machine, open the page with `?api=` set to the local gateway address, or set `window.BOOKING_API_LOCAL` before `js/config.js`.

A `file://` page cannot call the gateway.
