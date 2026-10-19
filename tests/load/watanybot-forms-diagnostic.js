import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 10 },
    { duration: "30s", target: 0 },
  ],
};

export default function () {
  const res = http.get("https://koudama.com/mcp/api/forms", { timeout: "15s" });

  check(res, {
    "forms status OK": (r) => r.status >= 200 && r.status < 400,
    "forms has body": (r) => r.body && r.body.length > 20,
  });

  if (res.status >= 400) {
    console.log(`FORMS_FAIL status=${res.status} body=${String(res.body).slice(0, 200)}`);
  }

  sleep(1);
}
