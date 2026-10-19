// Local page uses the gateway on this machine.
// A hosted page uses the public gateway once BOOKING_API_PUBLIC is set.
window.BOOKING_API_PUBLIC = window.BOOKING_API_PUBLIC || "https://event-booking-gateway.onrender.com";
window.BOOKING_API = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "http://localhost:8081"
  : (window.BOOKING_API_PUBLIC || "http://localhost:8081");
