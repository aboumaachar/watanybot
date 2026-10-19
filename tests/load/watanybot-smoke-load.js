import http from "k6/http";
import { check, sleep } from "k6";
export const options = {
  stages: [
    { duration: "1m", target: 5 },
    { duration: "2m", target: 10 },
    { duration: "2m", target: 25 },
    { duration: "1m", target: 0 }
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"]
  }
};
const BASE = "https://koudama.com";
export default function () {
  const pages = ["/mcp/","/mcp/services","/mcp/legal","/mcp/faq","/mcp/api/salary/meta","/mcp/api/forms","/mcp/api/useful-links"];
  for (const path of pages) {
    const res = http.get(`${BASE}${path}`);
    check(res, { [`GET ${path} status OK`]: (r) => r.status >= 200 && r.status < 400 });
    sleep(0.3);
  }
  const payload = JSON.stringify({ message: "مرحبا", lang: "ar", channel: "web" });
  const chat = http.post(`${BASE}/mcp/api/chat`, payload, { headers: { "Content-Type": "application/json" }, timeout: "10s" });
  check(chat, { "chat status OK": (r) => r.status >= 200 && r.status < 400, "chat has body": (r) => r.body && r.body.length > 20 });
  sleep(1);
}
