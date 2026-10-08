const SERVICES = [
  { id: "gateway", name: "Gateway", port: "8081", job: "Forwards the path" },
  { id: "auth", name: "Auth", port: "8082", job: "Users and the token" },
  { id: "event", name: "Event", port: "8083", job: "Concerts and seats" },
  { id: "booking", name: "Booking", port: "8080", job: "Tickets and the outbox" }
];

const POSTERS = ["#243018", "#3a2618", "#1a2830", "#2a2418"];

const seedEvents = [
  { id: 1, title: "Night Jazz", venue: "Arena", city: "Haifa", when: "Fri 12 Dec · 20:00", seats: 86, blurb: "A small band, a loud room, two hours." },
  { id: 2, title: "String Quartet", venue: "Old Hall", city: "Tel Aviv", when: "Sat 13 Dec · 19:30", seats: 24, blurb: "Forty seats. No amplification." },
  { id: 3, title: "Harbour Choir", venue: "Port Steps", city: "Jaffa", when: "Sun 14 Dec · 18:00", seats: 6, blurb: "Almost sold out. The last rows are outside." }
];

const state = load();
let route = "shows";
let selectedId = 1;
let seatsWanted = 2;
let authMode = "login";
let lit = [];
let trace = [];
let busy = false;

function load() {
  const blank = { user: null, users: [], events: seedEvents, tickets: [] };
  try {
    const saved = JSON.parse(localStorage.getItem("eb-demo") || "null");
    if (!saved || !saved.events) return blank;
    return saved;
  } catch {
    return blank;
  }
}

function save() {
  localStorage.setItem("eb-demo", JSON.stringify({
    user: state.user,
    users: state.users,
    events: state.events,
    tickets: state.tickets
  }));
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseRoute() {
  const hash = location.hash.replace("#", "") || "shows";
  const [name, id] = hash.split("/");
  route = ["shows", "how", "tickets", "auth", "event"].includes(name) ? name : "shows";
  if (route === "event") selectedId = Number(id) || 1;
}

function setRoute(next) {
  location.hash = next;
}

async function play(steps) {
  busy = true;
  trace = [];
  lit = [];
  render();
  for (const step of steps) {
    await wait(280);
    trace.push(step);
    if (!lit.includes(step.service)) lit.push(step.service);
    render();
  }
  busy = false;
  render();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function currentEvent() {
  return state.events.find((event) => event.id === selectedId) || state.events[0];
}

function render() {
  document.getElementById("rail").innerHTML = SERVICES.map((service) => `
    <div class="svc ${lit.includes(service.id) ? "on" : ""}">
      <strong>${service.name}</strong>
      <span>${service.job}</span>
    </div>
  `).join("");

  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === route);
  });

  const account = document.getElementById("account-btn");
  account.textContent = state.user ? state.user.email : "Sign in";

  const views = { shows: viewShows, event: viewEvent, auth: viewAuth, tickets: viewTickets, how: viewHow };
  document.getElementById("view").innerHTML = (views[route] || viewShows)();
  document.getElementById("trace").innerHTML = trace.length
    ? trace.map((step) => `<li><div class="svcname">${esc(step.who)}</div>${esc(step.method)}</li>`).join("")
    : `<li class="empty">Click sign in, a show, or Book. The methods appear here in order.</li>`;
  bind();
}

function viewShows() {
  return `
    <section class="hero">
      <p class="kicker">Demo in the browser</p>
      <h1>Four services. One door.</h1>
      <p>The phone only talks to the gateway. Booking is the only service that calls the others. This page plays that path so you can see it without the servers.</p>
    </section>
    <section class="grid">
      ${state.events.map((event, index) => `
        <article class="card">
          <div class="poster" style="background:${POSTERS[index % POSTERS.length]}"></div>
          <div class="body">
            <h2>${esc(event.title)}</h2>
            <p>${esc(event.venue)} · ${esc(event.city)}</p>
            <div class="meta">
              <span>${esc(event.when)}</span>
              <span class="${event.seats < 10 ? "low" : ""}">${event.seats} left</span>
            </div>
            <p><a href="#event/${event.id}">Choose seats</a></p>
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function viewEvent() {
  const event = currentEvent();
  return `
    <section class="detail">
      <div class="panel">
        <p class="kicker">${esc(event.city)}</p>
        <h1>${esc(event.title)}</h1>
        <p>${esc(event.blurb)}</p>
        <p>${esc(event.venue)} · ${esc(event.when)}</p>
        <p class="${event.seats < 10 ? "low" : ""}">${event.seats} seats still free</p>
      </div>
      <form class="panel" id="book-form">
        <h2>Book</h2>
        <div class="stepper">
          <button type="button" id="minus" aria-label="Fewer seats">−</button>
          <span class="seats" id="seat-count">${seatsWanted}</span>
          <button type="button" id="plus" aria-label="More seats">+</button>
        </div>
        <button class="solid" type="submit" ${busy || event.seats < 1 ? "disabled" : ""}>Book</button>
        <p class="quiet">A signed-in attendee only. The gateway does not take the seats.</p>
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
      <p>${login ? "Login builds a new token. Nothing here stores an old one." : "Register saves a user. It does not return a token."}</p>
    </section>
    <form class="form" id="auth-form">
      <label>Email <input name="email" type="email" required autocomplete="username" /></label>
      <label>Password <input name="password" type="password" minlength="6" required autocomplete="${login ? "current-password" : "new-password"}" /></label>
      <p class="err" id="auth-err"></p>
      <button class="solid" type="submit">${login ? "Sign in" : "Register"}</button>
      <button class="texty" type="button" id="swap-auth">${login ? "Need an account?" : "Already registered?"}</button>
    </form>
  `;
}

function viewTickets() {
  if (!state.user) {
    return `<section class="hero"><h1>My tickets</h1><p>Sign in first. The list is read from Booking, after Auth says who you are.</p><p><a href="#auth">Sign in</a></p></section>`;
  }
  const mine = state.tickets.filter((ticket) => ticket.email === state.user.email);
  if (!mine.length) {
    return `<section class="hero"><h1>My tickets</h1><p>No tickets yet.</p></section>`;
  }
  return `
    <section class="hero"><h1>My tickets</h1><p>The title is the copy saved on the ticket. Opening a show asks Event.</p></section>
    ${mine.map((ticket) => `
      <article class="ticket">
        <div>
          <b>${esc(ticket.title)}</b>
          <div class="quiet">${esc(ticket.when)} · ${esc(ticket.venue)}</div>
        </div>
        <div>${ticket.seats} seats</div>
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
      <p class="how-lead">Mail and confirm run later, from OutboxPoller.poller. They are not inside book. Confirm uses a shared internal token, not the user's JWT.</p>
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
      state.user = null;
      save();
      lit = [];
      trace = [{ service: "auth", who: "Auth", method: "Signed out on this phone. The token is dropped here. Auth does not store it." }];
      render();
      return;
    }
    setRoute("auth");
  };

  const bookForm = document.getElementById("book-form");
  if (bookForm) {
    document.getElementById("minus").onclick = () => { seatsWanted = Math.max(1, seatsWanted - 1); render(); };
    document.getElementById("plus").onclick = () => { seatsWanted = Math.min(4, seatsWanted + 1); render(); };
    bookForm.onsubmit = (event) => { event.preventDefault(); doBook(); };
  }

  const authForm = document.getElementById("auth-form");
  if (authForm) {
    document.getElementById("swap-auth").onclick = () => { authMode = authMode === "login" ? "register" : "login"; render(); };
    authForm.onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(authForm);
      submitAuth(String(data.get("email")).trim(), String(data.get("password")));
    };
  }
}

async function submitAuth(email, password) {
  if (authMode === "register") {
    if (state.users.some((user) => user.email === email)) {
      document.getElementById("auth-err").textContent = "That email is already registered.";
      return;
    }
    state.users.push({ email, password });
    save();
    await play([
      { service: "gateway", who: "Gateway", method: "GatewayRouteConfig forwards POST /api/auth/register" },
      { service: "auth", who: "Auth", method: "AuthController.insertUser" },
      { service: "auth", who: "Auth", method: "AuthService.addNewUser — user saved, no token" }
    ]);
    authMode = "login";
    render();
    return;
  }

  const found = state.users.find((user) => user.email === email && user.password === password);
  if (!found) {
    document.getElementById("auth-err").textContent = "Unknown email or wrong password.";
    return;
  }
  await play([
    { service: "gateway", who: "Gateway", method: "GatewayRouteConfig forwards POST /api/auth/login" },
    { service: "auth", who: "Auth", method: "AuthController.login" },
    { service: "auth", who: "Auth", method: "AuthService.login → authenticate" },
    { service: "auth", who: "Auth", method: "JwtService.generateToken — a new token, signed with JWT_SECRET" }
  ]);
  state.user = { email };
  save();
  setRoute("shows");
}

async function doBook() {
  const eventItem = currentEvent();
  if (!state.user) {
    setRoute("auth");
    return;
  }
  if (eventItem.seats < seatsWanted) {
    await play([{ service: "event", who: "Event", method: "EventService.reserveSeats — not enough seats, 409" }]);
    return;
  }
  await play([
    { service: "gateway", who: "Gateway", method: "GatewayRouteConfig forwards POST /api/events/" + eventItem.id + "/bookings" },
    { service: "booking", who: "Booking", method: "BookingController.book" },
    { service: "booking", who: "Booking", method: "BookingService.book" },
    { service: "auth", who: "Auth", method: "AuthClient.checkIfExist → AuthService.checkIfExist" },
    { service: "event", who: "Event", method: "EventClient.reserveSeats → EventService.reserveSeats" },
    { service: "booking", who: "Booking", method: "BookingWriter.writeBook — ticket plus two outbox rows" }
  ]);
  eventItem.seats -= seatsWanted;
  state.tickets.push({
    email: state.user.email,
    title: eventItem.title,
    venue: eventItem.venue,
    when: eventItem.when,
    seats: seatsWanted
  });
  save();
  render();
}

window.addEventListener("hashchange", () => { parseRoute(); render(); });
parseRoute();
render();
