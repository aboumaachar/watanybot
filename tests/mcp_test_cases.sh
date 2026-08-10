#!/usr/bin/env bash
# Simple script to execute the MCP test cases described earlier.
# Usage: BASE_URL=http://localhost:4000/mcp ./mcp_test_cases.sh
# (you can also source BASE_URL from .env or modify the variable below)

BASE_URL=${BASE_URL:-http://localhost:4000/mcp}

post() {
    local endpoint="$1"
    local body="$2"
    echo -e "\n---\n$3\nPOST $BASE_URL$endpoint\nPayload: $body\n"
    curl -s -X POST "$BASE_URL$endpoint" \
         -H 'Content-Type: application/json' \
         -d "$body" \
         | jq .
    echo -e "\n---"
}

# 1. KB search
post "/api/ask" '{"prompt":"ما هي طريقة التقديم على إعانة ؟"}' "KB search / simple Q&A"

# 2. Conversational chat
# First create conversation
resp=$(curl -s -X POST "$BASE_URL/api/chat" -H 'Content-Type: application/json' -d '{"prompt":"مرحبا"}')
conv_id=$(echo "$resp" | jq -r '.conversation_id')
echo "\nConversation created: $conv_id"
# second turn
post "/api/chat" "{\"prompt\":\"هل يمكنني تحديث معلوماتي؟\",\"conversation_id\":\"$conv_id\"}" "Conversational chat follow-up"

# 3. Admin query
post "/api/ask" '{"prompt":"أريد رؤية كل القضايا للمستخدم 42"}' "Admin query - list user cases"

# 4. KB ingestion
post "/api/ingest" '{"prompt":"ingest","document":{"title":"قانون جديد","text":"هذا نص القانون..."}}' "KB ingestion"

# 5. Health check (GET)
echo -e "\n---\nHealth check GET $BASE_URL/health\n"
curl -s "$BASE_URL/health" | jq .
echo -e "\n---"

# Negative test cases
post "/api/ask" '{"prompt":"What’s the weather like in Cairo tomorrow?"}' "Negative 1 - weather question"
post "/api/ask" '{"prompt":"Tell me a joke about programmers."}' "Negative 2 - chit-chat"
post "/api/ask" '{"prompt":"Restart the server now."}' "Negative 3 - dangerous command"


exit 0
