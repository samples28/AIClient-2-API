# Claude Messages API 完整指南 / Complete Guide to Claude Messages API

**端点 / Endpoint**: `POST /v1/messages`  
**协议版本 / Protocol Version**: Claude Messages API v1  
**状态 / Status**: ✅ 完全支持 / Fully Supported

---

## 📋 目录 / Table of Contents

- [API 概述](#api-概述--api-overview)
- [请求格式](#请求格式--request-format)
- [响应格式](#响应格式--response-format)
- [工具调用支持](#工具调用支持--tool-use-support)
- [流式响应](#流式响应--streaming)
- [多模态内容](#多模态内容--multimodal-content)
- [错误处理](#错误处理--error-handling)
- [Cline 集成](#cline-集成--cline-integration)
- [使用示例](#使用示例--examples)
- [最佳实践](#最佳实践--best-practices)

---

## API 概述 / API Overview

### 中文

`/v1/messages` 是 Claude Messages API 的核心端点，完全兼容 Anthropic Claude API 规范。支持：

- ✅ 文本对话
- ✅ 多轮对话
- ✅ 系统提示词
- ✅ 工具调用（Tool Use / Function Calling）
- ✅ 流式响应
- ✅ 多模态内容（图片、PDF 文档）
- ✅ Cline IDE 完美兼容

### English

The `/v1/messages` endpoint is the core of the Claude Messages API, fully compatible with Anthropic's Claude API specification. Supports:

- ✅ Text conversations
- ✅ Multi-turn dialogues
- ✅ System prompts
- ✅ Tool use (Function Calling)
- ✅ Streaming responses
- ✅ Multimodal content (images, PDFs)
- ✅ Perfect Cline IDE compatibility

---

## 请求格式 / Request Format

### 基本请求 / Basic Request

```http
POST /v1/messages HTTP/1.1
Host: localhost:3000
Content-Type: application/json
x-api-key: YOUR_API_KEY

{
  "model": "claude-3-opus-20240229",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "Hello, Claude!"
    }
  ]
}
```

### 必需字段 / Required Fields

| 字段 / Field | 类型 / Type | 说明 / Description |
|-------------|------------|-------------------|
| `model` | string | 模型名称 / Model name |
| `messages` | array | 消息数组 / Array of messages |
| `max_tokens` | integer | 最大生成令牌数 / Maximum tokens to generate |

### 可选字段 / Optional Fields

| 字段 / Field | 类型 / Type | 默认值 / Default | 说明 / Description |
|-------------|------------|-----------------|-------------------|
| `system` | string | - | 系统提示词 / System prompt |
| `temperature` | float | 1.0 | 温度参数 (0-1) / Temperature (0-1) |
| `top_p` | float | 0.9 | 核采样 / Nucleus sampling |
| `stream` | boolean | false | 是否流式返回 / Enable streaming |
| `tools` | array | - | 工具定义数组 / Tool definitions |
| `tool_choice` | object/string | auto | 工具选择策略 / Tool selection |

### 消息格式 / Message Format

#### 文本消息 / Text Message
```json
{
  "role": "user",
  "content": "What is the weather today?"
}
```

#### 多模态消息 / Multimodal Message
```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "What's in this image?"
    },
    {
      "type": "image",
      "source": {
        "type": "base64",
        "media_type": "image/jpeg",
        "data": "base64_encoded_image_data"
      }
    }
  ]
}
```

#### 文档消息 / Document Message
```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "Summarize this PDF"
    },
    {
      "type": "document",
      "source": {
        "type": "base64",
        "media_type": "application/pdf",
        "data": "base64_encoded_pdf_data"
      }
    }
  ]
}
```

---

## 响应格式 / Response Format

### 成功响应 / Success Response

```json
{
  "id": "msg_01ABC123def456",
  "type": "message",
  "role": "assistant",
  "model": "claude-3-opus-20240229",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you today?"
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 10,
    "output_tokens": 25
  }
}
```

### 响应字段说明 / Response Fields

| 字段 / Field | 类型 / Type | 说明 / Description |
|-------------|------------|-------------------|
| `id` | string | 消息唯一标识符 / Unique message ID |
| `type` | string | 固定为 "message" / Always "message" |
| `role` | string | 固定为 "assistant" / Always "assistant" |
| `model` | string | 使用的模型 / Model used |
| `content` | array | 内容块数组 / Array of content blocks |
| `stop_reason` | string | 停止原因 / Reason for stopping |
| `usage` | object | Token 使用统计 / Token usage |

### 停止原因 / Stop Reasons

- `end_turn` - 正常结束 / Natural completion
- `max_tokens` - 达到最大 token 限制 / Reached max tokens
- `stop_sequence` - 遇到停止序列 / Hit stop sequence
- `tool_use` - 需要工具调用 / Tool use required

---

## 工具调用支持 / Tool Use Support

### 概述 / Overview

Claude Messages API 完全支持工具调用（Tool Use），允许模型调用外部函数和 API。

### 定义工具 / Defining Tools

```json
{
  "model": "claude-3-opus-20240229",
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
            "enum": ["celsius", "fahrenheit"],
            "description": "The unit of temperature"
          }
        },
        "required": ["location"]
      }
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": "What's the weather like in San Francisco?"
    }
  ]
}
```

### 工具调用响应 / Tool Use Response

当 Claude 决定使用工具时，响应格式：

```json
{
  "id": "msg_01XYZ789",
  "type": "message",
  "role": "assistant",
  "model": "claude-3-opus-20240229",
  "content": [
    {
      "type": "text",
      "text": "I'll check the weather for you."
    },
    {
      "type": "tool_use",
      "id": "toolu_01A2B3C4",
      "name": "get_weather",
      "input": {
        "location": "San Francisco, CA",
        "unit": "fahrenheit"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

### 提供工具结果 / Providing Tool Results

执行工具后，将结果返回给 Claude：

```json
{
  "model": "claude-3-opus-20240229",
  "max_tokens": 1024,
  "tools": [...],
  "messages": [
    {
      "role": "user",
      "content": "What's the weather like in San Francisco?"
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "text",
          "text": "I'll check the weather for you."
        },
        {
          "type": "tool_use",
          "id": "toolu_01A2B3C4",
          "name": "get_weather",
          "input": {
            "location": "San Francisco, CA",
            "unit": "fahrenheit"
          }
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "tool_result",
          "tool_use_id": "toolu_01A2B3C4",
          "content": "72°F, sunny with light clouds"
        }
      ]
    }
  ]
}
```

### 工具选择策略 / Tool Choice

控制工具使用行为：

```json
{
  "tool_choice": "auto"  // 自动决定是否使用工具 / Auto
}

{
  "tool_choice": {
    "type": "tool",
    "name": "get_weather"  // 强制使用特定工具 / Force specific tool
  }
}

{
  "tool_choice": "none"  // 禁用工具 / Disable tools
}
```

---

## 流式响应 / Streaming

### 启用流式 / Enable Streaming

```json
{
  "model": "claude-3-opus-20240229",
  "max_tokens": 1024,
  "stream": true,
  "messages": [...]
}
```

### 流式事件格式 / Streaming Event Format

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant"}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" there"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}

event: message_stop
data: {"type":"message_stop"}
```

### 流式事件类型 / Event Types

| 事件 / Event | 说明 / Description |
|-------------|-------------------|
| `message_start` | 消息开始 / Message started |
| `content_block_start` | 内容块开始 / Content block started |
| `content_block_delta` | 内容增量 / Content delta |
| `content_block_stop` | 内容块结束 / Content block stopped |
| `message_delta` | 消息元数据更新 / Message metadata |
| `message_stop` | 消息结束 / Message stopped |

---

## 多模态内容 / Multimodal Content

### 支持的内容类型 / Supported Content Types

| 类型 / Type | MIME Types | 说明 / Description |
|------------|-----------|-------------------|
| 文本 / Text | - | 纯文本内容 / Plain text |
| 图片 / Image | image/jpeg, image/png, image/gif, image/webp | 图片分析 / Image analysis |
| 文档 / Document | application/pdf | PDF 文档分析 / PDF analysis |

### 图片示例 / Image Example

```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "What breed is this dog?"
    },
    {
      "type": "image",
      "source": {
        "type": "base64",
        "media_type": "image/jpeg",
        "data": "/9j/4AAQSkZJRg..."
      }
    }
  ]
}
```

### PDF 文档示例 / PDF Example

```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "Summarize the key points in this document"
    },
    {
      "type": "document",
      "source": {
        "type": "base64",
        "media_type": "application/pdf",
        "data": "JVBERi0xLjQK..."
      }
    }
  ]
}
```

### URL 引用 / URL Reference

```json
{
  "type": "document",
  "source": {
    "type": "url",
    "url": "https://example.com/document.pdf"
  }
}
```

---

## 错误处理 / Error Handling

### 错误响应格式 / Error Response Format

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Missing required field: messages"
  }
}
```

### 错误类型 / Error Types

| 类型 / Type | HTTP 状态码 / Status | 说明 / Description |
|------------|-------------------|-------------------|
| `invalid_request_error` | 400 | 请求格式错误 / Invalid request |
| `authentication_error` | 401 | 认证失败 / Authentication failed |
| `permission_error` | 403 | 权限不足 / Permission denied |
| `not_found_error` | 404 | 资源未找到 / Not found |
| `rate_limit_error` | 429 | 速率限制 / Rate limited |
| `api_error` | 500+ | 服务器错误 / Server error |

### 常见错误处理 / Common Error Handling

```python
import requests

try:
    response = requests.post(
        'http://localhost:3000/v1/messages',
        headers={'x-api-key': 'your-key'},
        json={
            'model': 'claude-3-opus',
            'max_tokens': 1024,
            'messages': [{'role': 'user', 'content': 'Hello'}]
        }
    )
    response.raise_for_status()
    result = response.json()
except requests.exceptions.HTTPError as e:
    if e.response.status_code == 401:
        print("Authentication failed - check API key")
    elif e.response.status_code == 429:
        print("Rate limited - retry after delay")
    else:
        error_data = e.response.json()
        print(f"Error: {error_data['error']['message']}")
```

---

## Cline 集成 / Cline Integration

### 配置 Cline / Configure Cline

#### VS Code Settings
```json
{
  "cline.apiProvider": "anthropic",
  "cline.anthropicBaseUrl": "http://localhost:3000",
  "cline.anthropicApiKey": "your-api-key",
  "cline.model": "claude-3-opus-20240229"
}
```

#### 或使用环境变量 / Or use Environment Variables
```bash
export ANTHROPIC_API_KEY="your-api-key"
export ANTHROPIC_BASE_URL="http://localhost:3000"
```

### Cline 使用场景 / Cline Use Cases

#### 1. 代码审查 / Code Review
Cline 会自动调用 `/v1/messages` 分析代码：
```
User: Review this function
Cline: [Calls API with code context]
```

#### 2. 工具调用 / Tool Usage
Cline 使用工具进行文件操作：
- `read_file` - 读取文件
- `write_file` - 写入文件
- `list_directory` - 列出目录
- `execute_command` - 执行命令

#### 3. 多轮对话 / Multi-turn Conversation
Cline 维护对话上下文，支持连续交互。

### Cline 最佳实践 / Best Practices

1. **合理的 max_tokens 设置**
   ```json
   {
     "max_tokens": 4096  // 对于代码生成任务
   }
   ```

2. **使用系统提示词自定义行为**
   ```json
   {
     "system": "You are an expert Python developer. Always include type hints and docstrings."
   }
   ```

3. **启用详细日志用于调试**
   ```bash
   # 在配置中启用
   "PROMPT_LOG_MODE": "file"
   ```

---

## 使用示例 / Examples

### Python 示例 / Python Example

```python
import requests
import json

API_URL = "http://localhost:3000/v1/messages"
API_KEY = "your-api-key"

def chat(message, conversation_history=[]):
    """发送消息到 Claude API"""
    messages = conversation_history + [
        {"role": "user", "content": message}
    ]
    
    response = requests.post(
        API_URL,
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY
        },
        json={
            "model": "claude-3-opus-20240229",
            "max_tokens": 1024,
            "messages": messages
        }
    )
    
    return response.json()

# 基本对话
result = chat("Hello, Claude!")
print(result['content'][0]['text'])

# 多轮对话
history = [
    {"role": "user", "content": "My name is Alice"},
    {"role": "assistant", "content": [{"type": "text", "text": "Nice to meet you, Alice!"}]}
]
result = chat("What's my name?", history)
print(result['content'][0]['text'])
```

### JavaScript/Node.js 示例 / JavaScript Example

```javascript
const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000/v1/messages';
const API_KEY = 'your-api-key';

async function chat(message, conversationHistory = []) {
    const messages = [...conversationHistory, {
        role: 'user',
        content: message
    }];
    
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
        },
        body: JSON.stringify({
            model: 'claude-3-opus-20240229',
            max_tokens: 1024,
            messages: messages
        })
    });
    
    return await response.json();
}

// 使用示例
(async () => {
    const result = await chat('Tell me a joke');
    console.log(result.content[0].text);
})();
```

### cURL 示例 / cURL Example

```bash
# 基本请求
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "model": "claude-3-opus-20240229",
    "max_tokens": 1024,
    "messages": [
      {
        "role": "user",
        "content": "Explain quantum computing in simple terms"
      }
    ]
  }'

# 带系统提示词
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "model": "claude-3-opus-20240229",
    "max_tokens": 1024,
    "system": "You are a helpful physics teacher",
    "messages": [
      {
        "role": "user",
        "content": "What is quantum entanglement?"
      }
    ]
  }'

# 流式响应
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -N \
  -d '{
    "model": "claude-3-opus-20240229",
    "max_tokens": 1024,
    "stream": true,
    "messages": [
      {
        "role": "user",
        "content": "Write a short poem about the ocean"
      }
    ]
  }'
```

### 工具调用完整示例 / Complete Tool Use Example

```python
import requests

API_URL = "http://localhost:3000/v1/messages"
API_KEY = "your-api-key"

# 定义天气工具
tools = [
    {
        "name": "get_weather",
        "description": "Get current weather for a location",
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City name"
                }
            },
            "required": ["location"]
        }
    }
]

# 第一次请求
response1 = requests.post(
    API_URL,
    headers={"x-api-key": API_KEY},
    json={
        "model": "claude-3-opus-20240229",
        "max_tokens": 1024,
        "tools": tools,
        "messages": [
            {"role": "user", "content": "What's the weather in Tokyo?"}
        ]
    }
).json()

# 检查是否需要调用工具
if response1['stop_reason'] == 'tool_use':
    tool_use = next(c for c in response1['content'] if c['type'] == 'tool_use')
    
    # 模拟执行工具
    tool_result = "Tokyo: 22°C, Sunny"
    
    # 第二次请求，提供工具结果
    response2 = requests.post(
        API_URL,
        headers={"x-api-key": API_KEY},
        json={
            "model": "claude-3-opus-20240229",
            "max_tokens": 1024,
            "tools": tools,
            "messages": [
                {"role": "user", "content": "What's the weather in Tokyo?"},
                {"role": "assistant", "content": response1['content']},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": tool_use['id'],
                            "content": tool_result
                        }
                    ]
                }
            ]
        }
    ).json()
    
    print(response2['content'][0]['text'])
```

---

## 最佳实践 / Best Practices

### 1. Token 管理 / Token Management

```python
# ✅ 好的做法
{
    "max_tokens": 4096,  # 为复杂任务预留足够空间
    "messages": [...]
}

# ❌ 避免
{
    "max_tokens": 10,  # 太小，可能截断响应
    "messages": [...]
}
```

### 2. 系统提示词 / System Prompts

```python
# ✅ 明确具体
{
    "system": "You are a Python expert. Always provide type hints, docstrings, and follow PEP 8 style guide.",
    "messages": [...]
}

# ❌ 过于模糊
{
    "system": "You are helpful.",
    "messages": [...]
}
```

### 3. 错误处理 / Error Handling

```python
# ✅ 完整的错误处理
import time

def chat_with_retry(message, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.post(API_URL, ...)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                # 速率限制，等待后重试
                time.sleep(2 ** attempt)
                continue
            raise
    raise Exception("Max retries exceeded")
```

### 4. 对话历史管理 / Conversation History

```python
# ✅ 限制历史长度
MAX_HISTORY = 20

def manage_history(history, new_message):
    history.append(new_message)
    if len(history) > MAX_HISTORY:
        # 保留系统消息和最近的消息
        history = history[-MAX_HISTORY:]
    return history
```

### 5. 多模态内容 / Multimodal Content

```python
# ✅ 正确的图片处理
import base64

with open('image.jpg', 'rb') as f:
    image_data = base64.b64encode(f.read()).decode('utf-8')

message = {
    "role": "user",
    "content": [
        {"type": "text", "text": "Describe this image"},
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": image_data
            }
        }
    ]
}

# ❌ 避免 - 不要忘记移除换行符
image_data = base64.b64encode(f.read())  # 可能包含换行符
```

### 6. 工具调用 / Tool Use

```python
# ✅ 提供清晰的工具描述
{
    "name": "search_database",
    "description": "Search the customer database by name, email, or ID. Returns customer details including contact info and purchase history.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query (name, email, or customer ID)"
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of results to return (1-100)",
                "minimum": 1,
                "maximum": 100
            }
        },
        "required": ["query"]
    }
}

# ❌ 避免 - 描述不清晰
{
    "name": "search",
    "description": "Search",  # 太简单
    "input_schema": {...}
}
```

---

## 性能优化 / Performance Optimization

### 1. 使用流式响应 / Use Streaming

```python
# 对于长响应，使用流式可以更快显示结果
response = requests.post(
    API_URL,
    headers={"x-api-key": API_KEY},
    json={
        "model": "claude-3-opus-20240229",
        "max_tokens": 4096,
        "stream": True,  # 启用流式
        "messages": [...]
    },
    stream=True
)

for line in response.iter_lines():
    if line:
        print(line.decode('utf-8'))
```

### 2. 批量处理 / Batch Processing

```python
# 对于多个独立请求，可以并发处理
import concurrent.futures

def process_message(msg):
    return chat(msg)

messages = ["Question 1", "Question 2", "Question 3"]

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    results = list(executor.map(process_message, messages))
```

### 3. 缓存响应 / Cache Responses

```python
from functools import lru_cache
import hashlib

@lru_cache(maxsize=100)
def chat_cached(message_hash, message):
    return chat(message)

def chat_with_cache(message):
    msg_hash = hashlib.md5(message.encode()).hexdigest()
    return chat_cached(msg_hash, message)
```

---

## 故障排查 / Troubleshooting

### 问题 1: "Authentication failed"

**原因**: API 密钥无效或缺失

**解决方案**:
```bash
# 检查 API 密钥
curl -X POST http://localhost:3000/v1/messages \
  -H "x-api-key: 123456" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-opus","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```

### 问题 2: "Empty response"

**原因**: 后端服务配置问题

**解决方案**:
```bash
# 检查健康状态
curl http://localhost:3000/health

# 查看日志
tail -f logs/server.log
```

### 问题 3: Tool Use 不工作

**原因**: 工具定义格式错误

**解决方案**:
- 检查 `input_schema` 是否符合 JSON Schema 规范
- 确保 `required` 字段正确
- 验证工具名称和描述清晰

---

## 限制和注意事项 / Limitations

1. **最大 Token 限制** / Max Token Limit
   - 请求 + 响应总和不能超过模型上下文窗口
   - Claude 3 Opus: 200K tokens
   - Claude 3 Sonnet: 200K tokens

2. **文件大小限制** / File Size Limits
   - 单个请求: 32MB
   - PDF 文档: 最多 100 页

3. **速率限制** / Rate Limits
   - 取决于后端提供商配置
   - 建议实现指数退避重