import http from "node:http";

const port = Number(process.env.MOCK_CHAT_SMOKE_PORT || 4010);

const smallTalkReplies = new Set([
  "تمام، ما في مشكلة. شو بتحب تعمل؟",
  "ماشي! إذا بدك شي تاني أنا هون.",
]);

function replyFor(message) {
  const query = String(message || "").trim();

  if (query.includes("معاش") || query.includes("الابنة") || query.includes("الزوجة") || query.includes("الوالدة")) {
    return {
      reply: "هذا رد تجريبي ضمن مجال المعاش التقاعدي. يتضمن معاش وتقاعد وإعادة تخصيص بدون fallback دردشة.",
      debug: {
        source: "mock-chat-smoke-server",
        domain: "family-pension",
      },
    };
  }

  if (query.includes("طبابة") || query.includes("معالجة") || query.includes("استشفاء") || query.includes("بطاقة") || query.includes("صحية") || query.includes("خدمات اجتماعية")) {
    return {
      reply: "هذا رد تجريبي ضمن المجال الطبي. يتضمن طبابة ومعالجة وتصريح وبطاقة صحية بدون fallback عام.",
      debug: {
        source: "mock-chat-smoke-server",
        domain: "medical",
      },
    };
  }

  if (query.includes("بيان") || query.includes("إفادة") || query.includes("افادة") || query.includes("قيد") || query.includes("مستند") || query.includes("طلب خطي") || query.includes("الخطي")) {
    return {
      reply: "هذا رد تجريبي ضمن المجال الإداري. يتضمن طلب وإفادة وبيان وقيد ومستند بدون fallback عام.",
      debug: {
        source: "mock-chat-smoke-server",
        domain: "administrative",
      },
    };
  }

  if (query.includes("وفاة") || query.includes("الورثة") || query.includes("ورثة") || query.includes("مأتم") || query.includes("تصريح")) {
    return {
      reply: "هذا رد تجريبي ضمن مجال الوفاة والورثة. يتضمن وفاة ومساعدة وتصريح وورثة بدون fallback عام.",
      debug: {
        source: "mock-chat-smoke-server",
        domain: "death-benefits",
      },
    };
  }

  if (query.includes("تقاعد") || query.includes("راتب") || query.includes("انتقال") || query.includes("مدرس") || query.includes("تعويض") || query.includes("مساعدة")) {
    return {
      reply: "هذا رد تجريبي ضمن المجال المالي. يتضمن راتب وتقاعد وانتقال ومساعدة بدون fallback عام.",
      debug: {
        source: "mock-chat-smoke-server",
        domain: "financial",
      },
    };
  }

  return {
    reply: [...smallTalkReplies][0],
    debug: {
      source: "mock-chat-smoke-server",
      chitchat: "fallback",
    },
  };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/chat") {
    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "not found" }));
    return;
  }

  let rawBody = "";
  request.setEncoding("utf8");

  for await (const chunk of request) {
    rawBody += chunk;
  }

  let payload = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "invalid json" }));
    return;
  }

  const body = replyFor(payload.message);
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Mock chat smoke server listening on http://127.0.0.1:${port}`);
});