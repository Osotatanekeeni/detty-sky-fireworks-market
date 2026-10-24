// December spike load test (browse + catalogue). https://k6.io
//   k6 run -e BASE=https://staging.dettysky.ng scripts/loadtest/k6-december.js
// Checkout writes are covered by oversell.sql at the database level; don't hammer Paystack
// (their test mode is rate-limited). Run against staging, never production.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE || "http://localhost:8080";
const PRODUCTS = [
  "royal-crown-100",
  "owambe-king-49",
  "gold-sparklers-36cm-10",
  "sky-blast-rockets-5",
  "naira-rain-cannon",
];

export const options = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "3m", target: 300 }, // New Year's Eve evening
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  const home = http.get(`${BASE}/`);
  check(home, { "home 200": (r) => r.status === 200 });
  sleep(Math.random() * 2);
  const shop = http.get(`${BASE}/shop`);
  check(shop, { "shop 200": (r) => r.status === 200 });
  sleep(Math.random() * 2);
  const slug = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
  const p = http.get(`${BASE}/product/${slug}`);
  check(p, {
    "product 200": (r) => r.status === 200,
    "has JSON-LD": (r) => r.body.includes("application/ld+json"),
  });
  sleep(1 + Math.random() * 3);
}
