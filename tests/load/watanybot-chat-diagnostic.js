import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

export const options = {
  vus: 5,
  duration: "1m",
};

const chat2xx = new Counter("chat_2xx");
const chat429 = new Counter("chat_429");
const chat4xx = new Counter("chat_4xx_other");
const chat5xx = new Counter("chat_5xx");

export default function () {
  const payload = JSON.stringify({
    message: `مرحبا اختبار ${__VU}-${__ITER}`,
    lang: "ar",
    channel: "load-test",
    sessionId: `k6-${__VU}`,
  });

  const res = http.post("https://koudama.com/mcp/api/chat", payload, {
    headers: {
      "Content-Type": "application/json",
      "X-WatanyBot-Load-Test": "true",
    },
    timeout: "15s",
  });

  if (res.status >= 200 && res.status < 400) chat2xx.add(1);
  else if (res.status === 429) chat429.add(1);
  else if (res.status >= 400 && res.status < 500) chat4xx.add(1);
  else if (res.status >= 500) chat5xx.add(1);

  check(res, {
    "chat status 2xx/3xx": (r) => r.status >= 200 && r.status < 400,
    "chat has body": (r) => r.body && r.body.length > 0,
  });

  if (res.status >= 400) {
    console.log(`CHAT_FAIL status=${res.status} body=${String(res.body).slice(0, 200)}`);
  }

  sleep(1);
}
