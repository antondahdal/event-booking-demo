// The page calls whatever address this file chooses.
// ?api= wins. On this machine, set window.BOOKING_API_LOCAL before this file to use a local gateway.
// Anywhere else, the public gateway is used.
(function () {
  const fromQuery = new URLSearchParams(location.search).get("api");
  const hosted = window.BOOKING_API_PUBLIC || "https://event-booking-gateway.onrender.com";
  const onMachine = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const chosen = fromQuery || (onMachine && window.BOOKING_API_LOCAL) || hosted;
  window.BOOKING_API = String(chosen).replace(/\/$/, "");
})();
