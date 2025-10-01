#!/bin/bash

# Claude Messages API Test Script
# Tests the /v1/messages endpoint for Cline compatibility

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-123456}"
LOG_FILE="claude-api-test-$(date +%Y%m%d-%H%M%S).log"

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✓${NC} $1" | tee -a "$LOG_FILE"
    ((TESTS_PASSED++))
}

error() {
    echo -e "${RED}✗${NC} $1" | tee -a "$LOG_FILE"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1" | tee -a "$LOG_FILE"
}

test_start() {
    ((TESTS_RUN++))
    log "Test #$TESTS_RUN: $1"
}

# Check if server is running
check_server() {
    log "Checking if server is running at $API_URL..."
    if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
        success "Server is running"
        return 0
    else
        error "Server is not running at $API_URL"
        exit 1
    fi
}

# Test 1: Basic Claude Messages API call
test_basic_message() {
    test_start "Basic Claude Messages API call"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 100,
            "messages": [
                {
                    "role": "user",
                    "content": "Hello, what is 2+2?"
                }
            ]
        }')

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        # Validate response structure
        if echo "$BODY" | jq -e '.id' > /dev/null 2>&1 && \
           echo "$BODY" | jq -e '.type' > /dev/null 2>&1 && \
           echo "$BODY" | jq -e '.role' > /dev/null 2>&1 && \
           echo "$BODY" | jq -e '.content' > /dev/null 2>&1 && \
           echo "$BODY" | jq -e '.model' > /dev/null 2>&1; then
            success "Basic message API call succeeded with valid response structure"
            log "Response: $(echo "$BODY" | jq -c '.')"
        else
            error "Response structure is invalid"
            log "Response: $BODY"
        fi
    else
        error "HTTP status code: $HTTP_CODE"
        log "Response: $BODY"
    fi
}

# Test 2: Multi-turn conversation
test_multi_turn() {
    test_start "Multi-turn conversation"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 200,
            "messages": [
                {
                    "role": "user",
                    "content": "My name is Alice."
                },
                {
                    "role": "assistant",
                    "content": "Nice to meet you, Alice!"
                },
                {
                    "role": "user",
                    "content": "What is my name?"
                }
            ]
        }')

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        if echo "$BODY" | jq -r '.content[0].text' | grep -qi "alice"; then
            success "Multi-turn conversation works correctly"
        else
            warn "Multi-turn conversation response may not be correct"
            log "Response: $(echo "$BODY" | jq -r '.content[0].text')"
        fi
    else
        error "HTTP status code: $HTTP_CODE"
        log "Response: $BODY"
    fi
}

# Test 3: System prompt
test_system_prompt() {
    test_start "System prompt handling"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 100,
            "system": "You are a helpful assistant. Always respond in uppercase.",
            "messages": [
                {
                    "role": "user",
                    "content": "Hello"
                }
            ]
        }')

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        success "System prompt request succeeded"
        log "Response: $(echo "$BODY" | jq -c '.content[0].text')"
    else
        error "HTTP status code: $HTTP_CODE"
        log "Response: $BODY"
    fi
}

# Test 4: Streaming response
test_streaming() {
    test_start "Streaming response"

    OUTPUT=$(curl -s -N -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 100,
            "stream": true,
            "messages": [
                {
                    "role": "user",
                    "content": "Count from 1 to 5"
                }
            ]
        }' 2>&1)

    if echo "$OUTPUT" | grep -q "event:"; then
        success "Streaming response works"
        log "First few lines: $(echo "$OUTPUT" | head -n 5)"
    else
        error "Streaming response failed or format incorrect"
        log "Output: $OUTPUT"
    fi
}

# Test 5: Multimodal content (image)
test_multimodal_image() {
    test_start "Multimodal content with image"

    # Create a small base64 encoded test image (1x1 red pixel PNG)
    IMAGE_BASE64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d "{
            \"model\": \"claude-3-opus\",
            \"max_tokens\": 100,
            \"messages\": [
                {
                    \"role\": \"user\",
                    \"content\": [
                        {
                            \"type\": \"text\",
                            \"text\": \"What color is this image?\"
                        },
                        {
                            \"type\": \"image\",
                            \"source\": {
                                \"type\": \"base64\",
                                \"media_type\": \"image/png\",
                                \"data\": \"$IMAGE_BASE64\"
                            }
                        }
                    ]
                }
            ]
        }")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        success "Multimodal image request succeeded"
        log "Response: $(echo "$BODY" | jq -c '.content[0].text' | head -c 100)"
    else
        error "HTTP status code: $HTTP_CODE"
        log "Response: $BODY"
    fi
}

# Test 6: Document/PDF support
test_document_pdf() {
    test_start "Document/PDF support"

    # Small PDF base64 (minimal valid PDF)
    PDF_BASE64="JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSA1IDAgUj4+Pj4vQ29udGVudHMgNCAwIFI+PgplbmRvYmoKNCAwIG9iago8PC9MZW5ndGggNDQ+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKEhlbGxvIFdvcmxkKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvVGltZXMtUm9tYW4+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PgplbmRvYmoKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKNiAwIG9iago8PC9Qcm9kdWNlcihQREYgVGVzdCk+PgplbmRvYmoKeHJlZgowIDcKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMzYzIDAwMDAwIG4gCjAwMDAwMDAzMDcgMDAwMDAgbiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMTIyIDAwMDAwIG4gCjAwMDAwMDAyMTQgMDAwMDAgbiAKMDAwMDAwMDQxMiAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNy9Sb290IDEgMCBSL0luZm8gNiAwIFI+PgpzdGFydHhyZWYKNDU5CiUlRU9G"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d "{
            \"model\": \"claude-3-opus\",
            \"max_tokens\": 200,
            \"messages\": [
                {
                    \"role\": \"user\",
                    \"content\": [
                        {
                            \"type\": \"text\",
                            \"text\": \"What does this PDF say?\"
                        },
                        {
                            \"type\": \"document\",
                            \"source\": {
                                \"type\": \"base64\",
                                \"media_type\": \"application/pdf\",
                                \"data\": \"$PDF_BASE64\"
                            }
                        }
                    ]
                }
            ]
        }")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        success "Document/PDF request succeeded"
        log "Response: $(echo "$BODY" | jq -c '.content[0].text' | head -c 100)"
    else
        error "HTTP status code: $HTTP_CODE"
        log "Response: $BODY"
    fi
}

# Test 7: Error handling - missing required field
test_error_missing_field() {
    test_start "Error handling - missing max_tokens"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "messages": [
                {
                    "role": "user",
                    "content": "Hello"
                }
            ]
        }')

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    # Should still work with default max_tokens
    if [ "$HTTP_CODE" = "200" ]; then
        success "Request handled with default max_tokens"
    else
        warn "Request failed without max_tokens (HTTP $HTTP_CODE)"
        log "Response: $BODY"
    fi
}

# Test 8: Error handling - invalid authentication
test_error_invalid_auth() {
    test_start "Error handling - invalid authentication"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: invalid-key" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 100,
            "messages": [
                {
                    "role": "user",
                    "content": "Hello"
                }
            ]
        }')

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "401" ]; then
        success "Invalid authentication correctly rejected"
    else
        error "Expected HTTP 401, got $HTTP_CODE"
        log "Response: $BODY"
    fi
}

# Test 9: Cline-specific scenario (code editor context)
test_cline_scenario() {
    test_start "Cline-specific scenario (code editor context)"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 500,
            "system": "You are an AI coding assistant.",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Here is a file:\n\n<file_path>test.js</file_path>\n<file_content>\nfunction add(a, b) {\n  return a + b\n}\n</file_content>\n\nPlease review this code."
                        }
                    ]
                }
            ]
        }')

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        success "Cline scenario request succeeded"
        log "Response excerpt: $(echo "$BODY" | jq -r '.content[0].text' | head -c 200)"
    else
        error "HTTP status code: $HTTP_CODE"
        log "Response: $BODY"
    fi
}

# Test 10: Response format validation
test_response_format() {
    test_start "Response format validation"

    RESPONSE=$(curl -s -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 50,
            "messages": [
                {
                    "role": "user",
                    "content": "Hi"
                }
            ]
        }')

    # Validate all required fields
    ERRORS=0

    if ! echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        error "Missing 'id' field in response"
        ((ERRORS++))
    fi

    if ! echo "$RESPONSE" | jq -e '.type' > /dev/null 2>&1; then
        error "Missing 'type' field in response"
        ((ERRORS++))
    fi

    if ! echo "$RESPONSE" | jq -e '.role' > /dev/null 2>&1; then
        error "Missing 'role' field in response"
        ((ERRORS++))
    fi

    if ! echo "$RESPONSE" | jq -e '.content' > /dev/null 2>&1; then
        error "Missing 'content' field in response"
        ((ERRORS++))
    fi

    if ! echo "$RESPONSE" | jq -e '.model' > /dev/null 2>&1; then
        error "Missing 'model' field in response"
        ((ERRORS++))
    fi

    if ! echo "$RESPONSE" | jq -e '.stop_reason' > /dev/null 2>&1; then
        error "Missing 'stop_reason' field in response"
        ((ERRORS++))
    fi

    if ! echo "$RESPONSE" | jq -e '.usage' > /dev/null 2>&1; then
        error "Missing 'usage' field in response"
        ((ERRORS++))
    fi

    if [ $ERRORS -eq 0 ]; then
        success "Response format is valid"
    else
        error "Response format has $ERRORS issues"
        log "Response: $(echo "$RESPONSE" | jq -c '.')"
    fi
}

# Main execution
main() {
    log "======================================"
    log "Claude Messages API Compatibility Test"
    log "======================================"
    log "API URL: $API_URL"
    log "Log file: $LOG_FILE"
    log ""

    # Check prerequisites
    if ! command -v jq &> /dev/null; then
        error "jq is not installed. Please install jq to run this test."
        exit 1
    fi

    check_server
    log ""

    # Run all tests
    test_basic_message
    test_multi_turn
    test_system_prompt
    test_streaming
    test_multimodal_image
    test_document_pdf
    test_error_missing_field
    test_error_invalid_auth
    test_cline_scenario
    test_response_format

    # Summary
    log ""
    log "======================================"
    log "Test Summary"
    log "======================================"
    log "Total tests run: $TESTS_RUN"
    success "Tests passed: $TESTS_PASSED"
    error "Tests failed: $TESTS_FAILED"

    if [ $TESTS_FAILED -eq 0 ]; then
        log ""
        success "All tests passed! ✓"
        log "The Claude Messages API is fully compatible with Cline."
        exit 0
    else
        log ""
        error "Some tests failed."
        log "Please check the log file for details: $LOG_FILE"
        exit 1
    fi
}

# Run main function
main
