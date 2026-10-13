const API = "http://localhost:8081";

const SERVICES = [
  { id: "gateway", name: "Gateway", job: "The only door" },
  { id: "auth", name: "Auth", job: "Users and the token" },
  { id: "event", name: "Event", job: "Concerts and seats" },
  { id: "booking", name: "Booking", job: "Tickets and the outbox" }
];

const POSTERS = ["#243018", "#3a2618", "#1a2830", "#2a2418", "#2c1e28", "#1c2a24"];

const state = {
  token: localStorage.getItem("eb-token"),
  user: null,
  events: [],
  venues: {},
  tickets: [],
  page: 0,
  totalPages: 1,
  loading: false,
  notice: "",
  error: "",
  missing: false
};

let route = "shows";
let selectedId = null;
let seatsWanted = 1;
let authMode = "login";
let lit = [];
let trace = [];
let generation = 0;

localStorage.removeItem("eb-demo");

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatWhen(value) {
  if (!value) return "Time not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function poster(event) {
  const n = String(event.title || "").split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return POSTERS[n % POSTERS.length];
}

function parseRoute() {
  const hash = location.hash.replace("#", "") || "shows";
  const [name, id] = hash.split("/");
  route = ["shows", "how", "tickets", "auth", "event"].includes(name) ? name : "shows";
  selectedId = route === "event" ? Number(id) : selectedId;
}

function setRoute(next) {
  if (location.hash === "#" + next) {
    refresh();
    return;
  }
  location.hash = next;
}

function saveToken(token) {
  state.token = token;
  if (token) localStorage.setItem("eb-token", token);
  else localStorage.removeItem("eb-token");
}

function messageOf(err) {
  if (!err || err.status === 0) {
    return "The gateway on port 8081 did not answer. Start auth, event, booking, and the gateway. Open this page at http://localhost:3000.";
  }
  if (err.status === 401) return err.detail || "Sign in again. That token is not valid.";
  if (err.status === 403) return "This account cannot do that. Book is for an attendee.";
  return err.detail || "The request failed.";
}

async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { Accept: "application/json" };
  const correlation = crypto.randomUUID();
  headers["X-Correlation-Id"] = correlation;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && state.token) headers.Authorization = "Bearer " + state.token;

  let response;
  try {
    response = await fetch(API + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    const err = new Error("offline");
    err.status = 0;
    throw err;
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!response.ok) {
    const err = new Error("http");
    err.status = response.status;
    err.detail = (data && (data.detail || data.title || data.message)) || response.statusText;
    err.correlation = response.headers.get("X-Correlation-Id") || correlation;
    throw err;
  }

  return {
    data,
    status: response.status,
    correlation: response.headers.get("X-Correlation-Id") || correlation
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function play(steps) {
  trace = [];
  lit = [];
  for (const step of steps) {
    await wait(160);
    trace.push(step);
    if (!lit.includes(step.service)) lit.push(step.service);
    paintTrace();
    paintRail();
  }
}

function failTrace(err, service, who) {
  lit = [service];
  trace = [{
    service,
    who,
    method: (err.status ? err.status + " — " : "") + messageOf(err)
  }];
}

function currentEvent() {
  return state.events.find((event) => event.id === selectedId) || null;
}

function venueLine(event) {
  const venue = state.venues[event.venueId];
  const place = venue && venue.address ? venue.address : "";
  return [event.venueName, place].filter(Boolean).join(" · ") || "Venue not loaded";
}

function render() {
  const who = document.getElementById("who");
  const account = document.getElementById("account-btn");
  if (state.user) {
    who.textContent = state.user.email + " · " + state.user.role;
    account.textContent = "Sign out";
  } else {
    who.textContent = "";
    account.textContent = "Sign in";
  }

  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === route);
  });

  const views = { shows: viewShows, event: viewEvent, auth: viewAuth, tickets: viewTickets, how: viewHow };
  document.getElementById("view").innerHTML = banner() + (views[route] || viewShows)();
  paintRail();
  paintTrace();
  bind();
}

function banner() {
  if (location.protocol === "file:") {
    return `<p class="banner bad">Open <a href="http://localhost:3000">http://localhost:3000</a>. A file page cannot call the gateway.</p>`;
  }
  if (state.error) return `<p class="banner bad">${esc(state.error)}</p>`;
  if (state.notice) return `<p class="banner ok">${esc(state.notice)}</p>`;
  if (state.loading) return `<p class="banner">Talking to the gateway…</p>`;
  return "";
}

function paintRail() {
  document.getElementById("rail").innerHTML = SERVICES.map((service) => `
    <div class="svc ${lit.includes(service.id) ? "on" : ""}">
      <strong>${service.name}</strong>
      <span>${service.job}</span>
    </div>
  `).join("");
}

function paintTrace() {
  document.getElementById("trace").innerHTML = trace.length
    ? trace.map((step) => `<li><div class="svcname">${esc(step.who)}</div>${esc(step.method)}</li>`).join("")
    : `<li class="empty">Sign in, open a show, or Book. The methods for that click show up here.</li>`;
}

function viewShows() {
  const cards = state.events.length
    ? state.events.map((event) => `
        <article class="card">
          <div class="poster" style="background:${poster(event)}"></div>
          <div class="body">
            <h2>${esc(event.title)}</h2>
            <p>${esc(venueLine(event))}</p>
            <div class="meta">
              <span>${esc(formatWhen(event.dateTime))}</span>
              <span class="${event.availableSeats < 10 ? "low" : ""}">${event.availableSeats} left</span>
            </div>
            <p><a class="go" href="#event/${event.id}">Choose seats</a></p>
          </div>
        </article>
      `).join("")
    : `<p class="quiet">No shows yet. The list comes from Event. An organizer has to create a venue and a concert first.</p>`;

  const pager = state.totalPages > 1 ? `
    <div class="pager">
      <button type="button" id="prev-page" ${state.page <= 0 ? "disabled" : ""}>Previous</button>
      <span>${state.page + 1} / ${state.totalPages}</span>
      <button type="button" id="next-page" ${state.page + 1 >= state.totalPages ? "disabled" : ""}>Next</button>
    </div>
  ` : "";

  return `
    <section class="hero">
      <p class="kicker">Gateway · port 8081</p>
      <h1>Shows</h1>
      <p>The browser talks only to the gateway. Booking is the only service that calls the others.</p>
    </section>
    <section class="grid">${cards}</section>
    ${pager}
  `;
}

function viewEvent() {
  const event = currentEvent();
  if (!event) {
    const line = state.missing ? "That show is not on Event." : "Loading the show…";
    return `<section class="hero"><h1>Show</h1><p>${line}</p><p><a href="#shows">Back to shows</a></p></section>`;
  }

  const left = event.availableSeats;
  const attendee = state.user && state.user.role === "ATTENDEE";
  const reason = !state.user
    ? "Sign in as an attendee to book."
    : !attendee
      ? "Book is for an attendee. This account is " + state.user.role + "."
      : left < 1
        ? "Sold out."
        : "The gateway forwards this. Event takes the seats. Booking writes the ticket.";

  return `
    <section class="detail">
      <div class="panel">
        <p class="kicker">${esc(event.venueName || "Show")}</p>
        <h1>${esc(event.title)}</h1>
        <p>${esc(venueLine(event))}</p>
        <p>${esc(formatWhen(event.dateTime))}</p>
        <p class="${left < 10 ? "low" : ""}">${left} of ${event.totalSeats} seats free</p>
      </div>
      <form class="panel" id="book-form">
        <h2>Book</h2>
        <div class="stepper">
          <button type="button" id="minus" aria-label="Fewer seats">−</button>
          <span class="seats" id="seat-count">${seatsWanted}</span>
          <button type="button" id="plus" aria-label="More seats">+</button>
        </div>
        <button class="solid" type="submit" ${state.loading || !attendee || left < 1 ? "disabled" : ""}>Book</button>
        <p class="quiet">${esc(reason)}</p>
        <p class="err" id="book-err"></p>
      </form>
    </section>
  `;
}

function viewAuth() {
  const login = authMode === "login";
  return `
    <section class="hero">
      <p class="kicker">Auth</p>
      <h1>${login ? "Sign in" : "Create an account"}</h1>
      <p>${login
        ? "Login returns a new token. This page keeps it in the browser. Auth does not store it."
        : "Register saves an attendee. It does not return a token. Sign in after that."}</p>
    </section>
    <form class="form" id="auth-form">
      <label>Email <input name="email" type="email" required autocomplete="username" /></label>
      <label>Password <input name="password" type="password" required autocomplete="${login ? "current-password" : "new-password"}" /></label>
      <p class="err" id="auth-err"></p>
      <button class="solid" type="submit" ${state.loading ? "disabled" : ""}>${login ? "Sign in" : "Register"}</button>
      <button class="texty" type="button" id="swap-auth">${login ? "Need an account?" : "Already registered?"}</button>
    </form>
  `;
}

function viewTickets() {
  if (!state.user) {
    return `<section class="hero"><h1>My tickets</h1><p>Sign in first. Booking reads the token and asks Auth who you are.</p><p><a href="#auth">Sign in</a></p></section>`;
  }
  if (!state.tickets.length) {
    return `<section class="hero"><h1>My tickets</h1><p>No tickets yet.</p></section>`;
  }
  return `
    <section class="hero"><h1>My tickets</h1><p>The title is the copy saved on the ticket.</p></section>
    ${state.tickets.map((ticket) => `
      <article class="ticket">
        <div>
          <b>${esc(ticket.eventTitle)}</b>
          <div class="quiet">Ticket ${esc(ticket.id)}</div>
        </div>
        <div>${ticket.seats} ${ticket.seats === 1 ? "seat" : "seats"}</div>
      </article>
    `).join("")}
  `;
}

function viewHow() {
  const rows = [
    ["Gateway", "GatewayRouteConfig", "Forwards POST /api/events/{id}/bookings"],
    ["Booking", "BookingController.book", "Calls BookingService.book"],
    ["Booking", "AuthClient.checkIfExist", "GET /api/users/me"],
    ["Auth", "AuthService.checkIfExist", "Returns the user id"],
    ["Booking", "EventClient.reserveSeats", "POST seat-reservations"],
    ["Event", "EventService.reserveSeats", "Locks the row, saves a 10-minute hold"],
    ["Booking", "BookingWriter.writeBook", "One commit: ticket and two outbox rows"]
  ];
  return `
    <section class="hero">
      <p class="kicker">The path to memorize</p>
      <h1>Who calls whom</h1>
      <p class="how-lead">Mail and confirm run later, from OutboxPoller.poller. They are not inside book. Confirm uses a shared internal token, not the user's JWT. This page calls the gateway on ${esc(API)}.</p>
    </section>
    <div class="chain">
      ${rows.map(([who, method, note]) => `
        <div class="hop"><strong>${esc(who)}</strong><div><em>${esc(method)}</em><div class="quiet">${esc(note)}</div></div></div>
      `).join("")}
    </div>
  `;
}

function bind() {
  document.getElementById("account-btn").onclick = () => {
    if (state.user) {
      saveToken(null);
      state.user = null;
      state.tickets = [];
      state.notice = "";
      state.error = "";
      lit = ["auth"];
      trace = [{ service: "auth", who: "This browser", method: "Signed out here. The token is dropped. Auth does not store it." }];
      setRoute("shows");
      return;
    }
    setRoute("auth");
  };

  const prev = document.getElementById("prev-page");
  const next = document.getElementById("next-page");
  if (prev) prev.onclick = () => { state.page -= 1; refresh(); };
  if (next) next.onclick = () => { state.page += 1; refresh(); };

  const bookForm = document.getElementById("book-form");
  if (bookForm) {
    const event = currentEvent();
    const max = Math.max(1, Math.min(8, event ? event.availableSeats : 1));
    document.getElementById("minus").onclick = () => {
      seatsWanted = Math.max(1, seatsWanted - 1);
      render();
    };
    document.getElementById("plus").onclick = () => {
      seatsWanted = Math.min(max, seatsWanted + 1);
      render();
    };
    bookForm.onsubmit = (domEvent) => {
      domEvent.preventDefault();
      doBook();
    };
  }

  const authForm = document.getElementById("auth-form");
  if (authForm) {
    document.getElementById("swap-auth").onclick = () => {
      authMode = authMode === "login" ? "register" : "login";
      state.error = "";
      state.notice = "";
      render();
    };
    authForm.onsubmit = (domEvent) => {
      domEvent.preventDefault();
      const data = new FormData(authForm);
      submitAuth(String(data.get("email")).trim(), String(data.get("password")));
    };
  }
}

async function loadMe() {
  const result = await api("/api/users/me");
  state.user = result.data;
}

async function loadCatalog() {
  const [eventsRes, venuesRes] = await Promise.all([
    api("/api/events?page=" + state.page + "&size=12&sort=dateTime,asc", { auth: false }),
    api("/api/venues", { auth: false })
  ]);
  const page = eventsRes.data || {};
  state.events = Array.isArray(page) ? page : (page.content || []);
  state.totalPages = page.totalPages || 1;
  state.page = typeof page.number === "number" ? page.number : state.page;
  const venues = Array.isArray(venuesRes.data) ? venuesRes.data : [];
  state.venues = Object.fromEntries(venues.map((venue) => [venue.id, venue]));
  state.missing = false;
}

async function ensureEvent() {
  if (!selectedId) {
    state.missing = true;
    return;
  }
  if (state.events.some((event) => event.id === selectedId)) {
    state.missing = false;
    return;
  }
  try {
    const result = await api("/api/events/" + selectedId, { auth: false });
    state.events = [result.data, ...state.events];
    state.missing = false;
  } catch (err) {
    if (err.status === 404) {
      state.missing = true;
      return;
    }
    throw err;
  }
}

async function loadTickets() {
  const result = await api("/api/bookings/me");
  state.tickets = Array.isArray(result.data) ? result.data : [];
}

async function refresh() {
  const mine = ++generation;
  state.loading = true;
  state.error = "";
  render();
  try {
    if (location.protocol === "file:") return;
    if (state.token && !state.user) await loadMe();
    if (route === "shows" || route === "event") await loadCatalog();
    if (route === "event") await ensureEvent();
    if (route === "tickets" && state.user) await loadTickets();
    if (route === "event") {
      const event = currentEvent();
      if (event) seatsWanted = Math.min(seatsWanted, Math.max(1, Math.min(8, event.availableSeats || 1)));
    }
  } catch (err) {
    if (err.status === 401) {
      saveToken(null);
      state.user = null;
    }
    state.error = messageOf(err);
  } finally {
    if (mine === generation) {
      state.loading = false;
      render();
    }
  }
}

async function submitAuth(email, password) {
  state.loading = true;
  render();
  const errBox = document.getElementById("auth-err");
  try {
    if (authMode === "register") {
      await api("/api/auth/register", { method: "POST", body: { email, password }, auth: false });
      await play([
        { service: "gateway", who: "Gateway", method: "POST /api/auth/register" },
        { service: "auth", who: "Auth", method: "AuthController.insertUser" },
        { service: "auth", who: "Auth", method: "AuthService.addNewUser — attendee saved, no token" }
      ]);
      authMode = "login";
      state.notice = "Account saved. Sign in to get a token.";
      state.loading = false;
      render();
      return;
    }

    const result = await api("/api/auth/login", { method: "POST", body: { email, password }, auth: false });
    saveToken(result.data.token);
    await loadMe();
    await play([
      { service: "gateway", who: "Gateway", method: "POST /api/auth/login — " + result.status },
      { service: "auth", who: "Auth", method: "AuthController.login" },
      { service: "auth", who: "Auth", method: "AuthService.login → authenticate" },
      { service: "auth", who: "Auth", method: "JwtService.generateToken — " + result.correlation }
    ]);
    state.notice = "Signed in.";
    state.loading = false;
    setRoute("shows");
  } catch (err) {
    state.loading = false;
    failTrace(err, "auth", "Auth");
    render();
    const box = document.getElementById("auth-err");
    if (box) box.textContent = messageOf(err);
    else if (errBox) errBox.textContent = messageOf(err);
  }
}

async function doBook() {
  const event = currentEvent();
  if (!event) return;
  if (!state.user) {
    setRoute("auth");
    return;
  }
  if (state.user.role !== "ATTENDEE") {
    state.error = "Book is for an attendee.";
    render();
    return;
  }
  if (event.availableSeats < seatsWanted) {
    failTrace({ status: 409, detail: "Not enough seats." }, "event", "Event");
    render();
    return;
  }

  state.loading = true;
  state.error = "";
  state.notice = "";
  render();
  try {
    const result = await api("/api/events/" + event.id + "/bookings", {
      method: "POST",
      body: { seats: seatsWanted }
    });
    await play([
      { service: "gateway", who: "Gateway", method: "POST /api/events/" + event.id + "/bookings — " + result.status },
      { service: "booking", who: "Booking", method: "BookingController.book" },
      { service: "booking", who: "Booking", method: "BookingService.book" },
      { service: "auth", who: "Auth", method: "AuthClient.checkIfExist → AuthService.checkIfExist" },
      { service: "event", who: "Event", method: "EventClient.reserveSeats → EventService.reserveSeats" },
      { service: "booking", who: "Booking", method: "BookingWriter.writeBook — ticket " + (result.data && result.data.id) },
      { service: "gateway", who: "Correlation", method: result.correlation }
    ]);
    state.notice = "Ticket saved.";
    await loadCatalog();
    await ensureEvent();
  } catch (err) {
    if (err.status === 401) {
      saveToken(null);
      state.user = null;
    }
    const service = err.status === 409 || err.status === 404 || err.status === 502 || err.status === 503 ? "event" : "booking";
    failTrace(err, service, service === "event" ? "Event" : "Booking");
    state.error = messageOf(err);
  } finally {
    state.loading = false;
    render();
  }
}

window.addEventListener("hashchange", () => {
  parseRoute();
  refresh();
});

parseRoute();
refresh();
