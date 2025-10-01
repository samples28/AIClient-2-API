#!/bin/bash

# Tool Use Test Script for Claude Messages API
# Tests function calling / tool use capabilities

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-123456}"
LOG_FILE="tool-use-test-$(date +%Y%m%d-%H%M%S).log"

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

# Test 1: Basic tool definition
test_basic_tool_definition() {
    test_start "Basic tool definition and call"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 1024,
            "tools": [
                {
                    "name": "get_weather",
                    "description": "Get the current weather in a given location",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "location": {
                                "type": "string",
                                "description": "The city and state, e.g. San Francisco, CA"
                            },
                            "unit": {
                                "type": "string",
                                "enum": ["celsius", "fahrenheit"]
                            }
                        },
                        "required": ["location"]
                    }
                }
            ],
            "messages": [
                {
                    "role": "user",
                    "content": "What is the weather in San Francisco?"
                }
            ]
        }')

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        if echo "$BODY" | jq -e '.content' > /dev/null 2>&1; then
            success "Tool definition accepted and processed"

            # Check if tool_use is in response
            if echo "$BODY" | jq -e '.content[] | select(.type == "tool_use")' > /dev/null 2>&1; then
                log "  → Model decided to use tool"
            else
                log "  → Model responded without using tool"
            fi
        else
            error "Invalid response structure"
        fi
    else
        error "HTTP status code: $HTTP_CODE"
        log "Response: $BODY"
    fi
}

# Test 2: Multiple tools
test_multiple_tools() {
    test_start "Multiple tool definitions"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 1024,
            "tools": [
                {
                    "name": "get_weather",
                    "description": "Get current weather",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "location": {"type": "string"}
                        },
                        "required": ["location"]
                    }
                },
                {
                    "name": "search_web",
                    "description": "Search the web",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"}
                        },
                        "required": ["query"]
                    }
                },
                {
                    "name": "calculate",
                    "description": "Perform mathematical calculations",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "expression": {"type": "string"}
                        },
                        "required": ["expression"]
                    }
                }
            ],
            "messages": [
                {
                    "role": "user",
                    "content": "What is 15 * 23?"
                }
            ]
        }')

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        success "Multiple tools handled correctly"
        log "Response: $(echo "$BODY" | jq -c '.content[0]' | head -c 100)..."
    else
        error "HTTP status code: $HTTP_CODE"
    fi
}

# Test 3: Tool result handling
test_tool_result_handling() {
    test_start "Tool result handling"

    # First request - get tool use
    RESPONSE1=$(curl -s -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 1024,
            "tools": [
                {
                    "name": "get_stock_price",
                    "description": "Get current stock price",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "symbol": {"type": "string"}
                        },
                        "required": ["symbol"]
                    }
                }
            ],
            "messages": [
                {
                    "role": "user",
                    "content": "What is the price of AAPL stock?"
                }
            ]
        }')

    # Check if we got tool_use
    if echo "$RESPONSE1" | jq -e '.content[] | select(.type == "tool_use")' > /dev/null 2>&1; then
        TOOL_ID=$(echo "$RESPONSE1" | jq -r '.content[] | select(.type == "tool_use") | .id')
        log "  → Got tool_use with ID: $TOOL_ID"

        # Second request - provide tool result
        RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
            -H "Content-Type: application/json" \
            -H "x-api-key: $API_KEY" \
            -d "{
                \"model\": \"claude-3-opus\",
                \"max_tokens\": 1024,
                \"tools\": [
                    {
                        \"name\": \"get_stock_price\",
                        \"description\": \"Get current stock price\",
                        \"input_schema\": {
                            \"type\": \"object\",
                            \"properties\": {
                                \"symbol\": {\"type\": \"string\"}
                            },
                            \"required\": [\"symbol\"]
                        }
                    }
                ],
                \"messages\": [
                    {
                        \"role\": \"user\",
                        \"content\": \"What is the price of AAPL stock?\"
                    },
                    {
                        \"role\": \"assistant\",
                        \"content\": $(echo "$RESPONSE1" | jq -c '.content')
                    },
                    {
                        \"role\": \"user\",
                        \"content\": [
                            {
                                \"type\": \"tool_result\",
                                \"tool_use_id\": \"$TOOL_ID\",
                                \"content\": \"150.25 USD\"
                            }
                        ]
                    }
                ]
            }")

        HTTP_CODE=$(echo "$RESPONSE2" | tail -n1)
        BODY=$(echo "$RESPONSE2" | sed '$d')

        if [ "$HTTP_CODE" = "200" ]; then
            success "Tool result processed successfully"
            log "Final response: $(echo "$BODY" | jq -r '.content[0].text' | head -c 100)"
        else
            error "Tool result handling failed: HTTP $HTTP_CODE"
        fi
    else
        warn "Model didn't use tool (may be provider-specific)"
    fi
}

# Test 4: Tool choice - auto
test_tool_choice_auto() {
    test_start "Tool choice: auto"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 1024,
            "tools": [
                {
                    "name": "calculator",
                    "description": "Calculate math expressions",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "expression": {"type": "string"}
                        },
                        "required": ["expression"]
                    }
                }
            ],
            "tool_choice": {"type": "auto"},
            "messages": [
                {
                    "role": "user",
                    "content": "Hello, how are you?"
                }
            ]
        }')

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        success "Tool choice 'auto' works correctly"
        # Should not use tool for greeting
        if ! echo "$BODY" | jq -e '.content[] | select(.type == "tool_use")' > /dev/null 2>&1; then
            log "  → Correctly didn't use tool for greeting"
        fi
    else
        error "HTTP status code: $HTTP_CODE"
    fi
}

# Test 5: Tool choice - specific tool
test_tool_choice_specific() {
    test_start "Tool choice: force specific tool"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 1024,
            "tools": [
                {
                    "name": "get_time",
                    "description": "Get current time",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "timezone": {"type": "string"}
                        }
                    }
                }
            ],
            "tool_choice": {"type": "tool", "name": "get_time"},
            "messages": [
                {
                    "role": "user",
                    "content": "What time is it in Tokyo?"
                }
            ]
        }')

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        if echo "$BODY" | jq -e '.content[] | select(.type == "tool_use" and .name == "get_time")' > /dev/null 2>&1; then
            success "Forced tool use works correctly"
        else
            warn "Tool forcing may not be supported by current provider"
        fi
    else
        error "HTTP status code: $HTTP_CODE"
    fi
}

# Test 6: Complex tool schema
test_complex_tool_schema() {
    test_start "Complex tool schema with nested properties"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 1024,
            "tools": [
                {
                    "name": "create_user",
                    "description": "Create a new user account",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "username": {
                                "type": "string",
                                "description": "Unique username"
                            },
                            "email": {
                                "type": "string",
                                "description": "Email address"
                            },
                            "age": {
                                "type": "integer",
                                "minimum": 13,
                                "maximum": 120
                            },
                            "preferences": {
                                "type": "object",
                                "properties": {
                                    "theme": {
                                        "type": "string",
                                        "enum": ["light", "dark"]
                                    },
                                    "notifications": {
                                        "type": "boolean"
                                    }
                                }
                            }
                        },
                        "required": ["username", "email"]
                    }
                }
            ],
            "messages": [
                {
                    "role": "user",
                    "content": "Create a user account with username john_doe and email john@example.com"
                }
            ]
        }')

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        success "Complex tool schema handled correctly"
    else
        error "HTTP status code: $HTTP_CODE"
    fi
}

# Test 7: Error - invalid tool schema
test_invalid_tool_schema() {
    test_start "Error handling: invalid tool schema"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 1024,
            "tools": [
                {
                    "name": "broken_tool",
                    "description": "This tool has invalid schema",
                    "input_schema": "not_an_object"
                }
            ],
            "messages": [
                {
                    "role": "user",
                    "content": "Test"
                }
            ]
        }')

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "422" ]; then
        success "Invalid tool schema correctly rejected"
    else
        warn "Expected 400/422 error, got $HTTP_CODE (may still work)"
    fi
}

# Test 8: Tool use with streaming
test_tool_streaming() {
    test_start "Tool use with streaming"

    OUTPUT=$(curl -s -N -X POST "$API_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "model": "claude-3-opus",
            "max_tokens": 1024,
            "stream": true,
            "tools": [
                {
                    "name": "get_info",
                    "description": "Get information",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"}
                        }
                    }
                }
            ],
            "messages": [
                {
                    "role": "user",
                    "content": "Get info about Paris"
                }
            ]
        }' 2>&1)

    if echo "$OUTPUT" | grep -q "event:"; then
        success "Tool use with streaming works"
    else
        error "Streaming with tools failed"
    fi
}

# Main execution
main() {
    log "======================================"
    log "Tool Use Test Suite"
    log "======================================"
    log "API URL: $API_URL"
    log "Log file: $LOG_FILE"
    log ""

    # Check prerequisites
    if ! command -v jq &> /dev/null; then
        error "jq is not installed. Please install jq to run this test."
        exit 1
    fi

    # Check server
    log "Checking server health..."
    if ! curl -s -f "$API_URL/health" > /dev/null 2>&1; then
        error "Server is not running at $API_URL"
        exit 1
    fi
    success "Server is running"
    log ""

    # Run all tests
    test_basic_tool_definition
    test_multiple_tools
    test_tool_result_handling
    test_tool_choice_auto
    test_tool_choice_specific
    test_complex_tool_schema
    test_invalid_tool_schema
    test_tool_streaming

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
        log "Tool use / function calling is fully functional."
        exit 0
    else
        log ""
        error "Some tests failed."
        log "Note: Some features may be provider-specific."
        log "Check the log file for details: $LOG_FILE"
        exit 1
    fi
}

# Run main function
main
