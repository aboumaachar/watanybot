import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 10 },
    { duration: "2m", target: 25 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"],
  },
};

const BASE = "https://koudama.com";

export default function () {
  const pages = [
    "/mcp/",
    "/mcp/services",
    "/mcp/legal",
    "/mcp/faq",
    "/mcp/useful-links",
    "/mcp/deaths",
    "/mcp/api/salary/meta",
    "/mcp/api/forms",
    "/mcp/api/useful-links",
    "/mcp/api/deaths?limit=5",
  ];

  for (const path of pages) {
    const res = http.get(`${BASE}${path}`, { timeout: "10s" });
    check(res, {
      [`GET ${path} OK`]: (r) => r.status >= 200 && r.status < 400,
    });
    sleep(0.2);
  }

  sleep(1);
}
