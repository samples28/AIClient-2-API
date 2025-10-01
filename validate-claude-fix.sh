#!/bin/bash

# Quick validation script for Claude Messages API fix
# Usage: ./validate-claude-fix.sh

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="${API_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-123456}"

echo "========================================"
echo "Claude API Fix Validation"
echo "========================================"
echo "API URL: $API_URL"
echo ""

# Check server
echo -n "1. Checking server... "
if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Server not running${NC}"
    exit 1
fi

# Test basic Claude API call
echo -n "2. Testing basic Claude API call... "
RESPONSE=$(curl -s -X POST "$API_URL/v1/messages" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d '{
        "model": "claude-3-opus",
        "max_tokens": 50,
        "messages": [{"role": "user", "content": "Say hello"}]
    }')

if echo "$RESPONSE" | jq -e '.id and .type and .role and .content and .model' > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi

# Test error handling
echo -n "3. Testing error handling... "
ERROR_RESPONSE=$(curl -s -X POST "$API_URL/v1/messages" \
    -H "Content-Type: application/json" \
    -H "x-api-key: invalid-key" \
    -d '{
        "model": "claude-3-opus",
        "max_tokens": 50,
        "messages": [{"role": "user", "content": "Hello"}]
    }')

if echo "$ERROR_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    exit 1
fi

# Test document support
echo -n "4. Testing document support... "
DOC_RESPONSE=$(curl -s -X POST "$API_URL/v1/messages" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d '{
        "model": "claude-3-opus",
        "max_tokens": 100,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": "What is this?"},
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlL1BhZ2U+PgplbmRvYmo="
                    }
                }
            ]
        }]
    }')

if echo "$DOC_RESPONSE" | jq -e '.content' > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ Document support may need configuration${NC}"
fi

echo ""
echo "========================================"
echo -e "${GREEN}All critical tests passed!${NC}"
echo "========================================"
echo ""
echo "The Claude Messages API is working correctly."
echo "You can now use it with Cline."
echo ""
echo "To run comprehensive tests:"
echo "  ./tests/test-claude-messages-api.sh"
echo ""
echo "To configure Cline, use:"
echo "  API Endpoint: $API_URL/v1/messages"
echo "  API Key: $API_KEY"
