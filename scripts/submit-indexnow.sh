#!/bin/bash
# Submit URLs to IndexNow for mymcptools.com

INDEXNOW_KEY="412187ad75ab965450330fc28c39a49c"
HOST="mymcptools.com"
KEY_LOCATION="https://${HOST}/${INDEXNOW_KEY}.txt"
SITEMAP_URL="https://${HOST}/sitemap.xml"

if [[ "$1" == "--all" ]]; then
    echo "Fetching all URLs from sitemap..."
    URLS=$(curl -s "$SITEMAP_URL" | grep -oE 'https://mymcptools\.com[^<]+')
elif [[ "$1" == "--new" ]]; then
    echo "Fetching server pages from sitemap..."
    URLS=$(curl -s "$SITEMAP_URL" | grep -oE 'https://mymcptools\.com[^<]+' | grep -E '(/servers/|/category/|/compare/|/integration/)')
else
    URLS="$@"
fi

URL_COUNT=$(echo "$URLS" | wc -l | tr -d ' ')
echo "Submitting $URL_COUNT URLs to IndexNow..."

URL_JSON=$(echo "$URLS" | python3 -c "
import sys, json
urls = [line.strip() for line in sys.stdin if line.strip()]
print(json.dumps(urls))
")

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://api.indexnow.org/indexnow" \
    -H "Content-Type: application/json" \
    -d "{
        \"host\": \"${HOST}\",
        \"key\": \"${INDEXNOW_KEY}\",
        \"keyLocation\": \"${KEY_LOCATION}\",
        \"urlList\": ${URL_JSON}
    }")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response: HTTP $HTTP_CODE"
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "202" ]]; then
    echo "✅ URLs submitted successfully!"
else
    echo "❌ Submission failed: $BODY"
fi
