# Kiro Claude 深入实现分析

## 📋 目录

- [概述](#概述)
- [架构设计](#架构设计)
- [核心实现](#核心实现)
- [认证机制](#认证机制)
- [请求转换](#请求转换)
- [响应处理](#响应处理)
- [工具调用支持](#工具调用支持)
- [流式处理](#流式处理)
- [适配器模式](#适配器模式)
- [配置管理](#配置管理)
- [错误处理与重试](#错误处理与重试)
- [技术亮点](#技术亮点)
- [使用示例](#使用示例)
- [最佳实践](#最佳实践)

---

## 概述

### 什么是 Kiro Claude？

Kiro Claude 是本项目中的一个关键组件，它通过逆向工程 Kiro IDE 的 API 调用机制，实现了对 Amazon CodeWhisperer / Kiro 服务背后的 Claude Sonnet 4 模型的访问。该实现将 Kiro 的专有 API 转换为标准的 OpenAI 兼容格式，使得用户可以通过统一的接口免费使用 Claude Sonnet 4 模型。

### 核心价值

- **突破官方限制**：绕过 Kiro 客户端限制，直接通过 API 访问
- **免费使用 Claude Sonnet 4**：利用 Kiro 提供的免费额度
- **OpenAI 兼容**：提供标准化的 API 接口
- **完整功能支持**：包括多模态、工具调用、流式响应等

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Application                      │
│          (LobeChat, NextChat, Cline, etc.)                  │
└───────────────────────────┬─────────────────────────────────┘
                            │ OpenAI Compatible Request
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   API Server (api-server.js)                │
│                    - Route Handling                          │
│                    - Request Validation                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Adapter Layer (adapter.js)                      │
│              KiroApiServiceAdapter                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│           Core Service (claude-kiro.js)                      │
│              KiroApiService                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Authentication Management                         │  │
│  │    - OAuth Token Handling                            │  │
│  │    - Token Refresh                                   │  │
│  │    - Multi-source Credential Loading                 │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ 2. Request Transformation                            │  │
│  │    - OpenAI → CodeWhisperer Format                   │  │
│  │    - Message History Handling                        │  │
│  │    - Tool & Image Support                            │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ 3. Response Processing                               │  │
│  │    - Event Stream Parsing                            │  │
│  │    - Tool Call Extraction                            │  │
│  │    - Claude Format Conversion                        │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ 4. Error Handling & Retry                            │  │
│  │    - Exponential Backoff                             │  │
│  │    - Token Refresh on 403                            │  │
│  │    - Rate Limit Handling                             │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ CodeWhisperer API Request
                            ↓
┌─────────────────────────────────────────────────────────────┐
│          Kiro / Amazon CodeWhisperer Backend                 │
│                  (Claude Sonnet 4)                           │
└─────────────────────────────────────────────────────────────┘
```

### 模块职责

| 模块 | 文件 | 职责 |
|------|------|------|
| 核心服务 | `claude-kiro.js` | 实现完整的 Kiro API 调用逻辑 |
| 适配器 | `adapter.js` | 提供统一的服务接口 |
| 路由层 | `api-server.js` | 处理 HTTP 请求和路由 |
| 工具函数 | `common.js` | 通用常量和工具函数 |

---

## 核心实现

### 文件结构：`src/claude/claude-kiro.js`

```javascript
// 核心类和函数
- KIRO_CONSTANTS          // 配置常量
- MODEL_MAPPING           // 模型映射
- getMacAddressSha256()   // 设备指纹
- Tool Call Parsers       // 工具调用解析器
- KiroApiService          // 主服务类
```

### 核心常量配置

```javascript
const KIRO_CONSTANTS = {
    // API 端点 (动态区域替换)
    REFRESH_URL: 'https://prod.{{region}}.auth.desktop.kiro.dev/refreshToken',
    REFRESH_IDC_URL: 'https://oidc.{{region}}.amazonaws.com/token',
    BASE_URL: 'https://codewhisperer.{{region}}.amazonaws.com/generateAssistantResponse',
    AMAZON_Q_URL: 'https://codewhisperer.{{region}}.amazonaws.com/SendMessageStreaming',
    
    // 默认模型
    DEFAULT_MODEL_NAME: 'kiro-claude-sonnet-4-20250514',
    
    // 请求配置
    AXIOS_TIMEOUT: 120000,  // 2 分钟超时
    USER_AGENT: 'KiroIDE',
    
    // 认证方法
    AUTH_METHOD_SOCIAL: 'social',
    
    // 其他常量
    CHAT_TRIGGER_TYPE_MANUAL: 'MANUAL',
    ORIGIN_AI_EDITOR: 'AI_EDITOR',
};
```

### 模型映射

```javascript
const MODEL_MAPPING = {
    "claude-sonnet-4-20250514": "CLAUDE_SONNET_4_20250514_V1_0",
    "claude-3-7-sonnet-20250219": "CLAUDE_3_7_SONNET_20250219_V1_0",
    "amazonq-claude-sonnet-4-20250514": "CLAUDE_SONNET_4_20250514_V1_0",
    "amazonq-claude-3-7-sonnet-20250219": "CLAUDE_3_7_SONNET_20250219_V1_0"
};
```

---

## 认证机制

### 认证流程

```
┌─────────────────────────────────────────────────────────┐
│              initializeAuth(forceRefresh)                │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
      ┌──────────────────────────────────────┐
      │ 是否已有 AccessToken 且不强制刷新？    │
      └────────────┬────────────┬─────────────┘
                   │ Yes        │ No
                   ↓            ↓
              ┌────────┐   ┌─────────────────────────┐
              │ 返回   │   │ 加载凭证 (多优先级)      │
              └────────┘   └──────────┬──────────────┘
                                      │
                         ┌────────────┴──────────────┐
                         │                           │
                    Priority 1                  Priority 2
               ┌──────────────────┐      ┌──────────────────┐
               │ Base64 环境变量  │      │ 指定文件路径      │
               └──────────────────┘      └──────────────────┘
                         │                           │
                         │              Priority 3   │
                         │       ┌──────────────────┐│
                         │       │ 默认目录扫描     ││
                         │       └──────────────────┘│
                         └────────────┬──────────────┘
                                      │
                                      ↓
                         ┌────────────────────────────┐
                         │ 合并所有凭证               │
                         │ - accessToken              │
                         │ - refreshToken             │
                         │ - clientId/clientSecret    │
                         │ - region/profileArn        │
                         └──────────┬─────────────────┘
                                    │
                                    ↓
                    ┌───────────────────────────────┐
                    │ 需要刷新 Token？              │
                    │ (强制刷新 || 无 AccessToken)  │
                    └──────┬───────────┬────────────┘
                           │ Yes       │ No
                           ↓           ↓
              ┌────────────────────┐  │
              │ 调用刷新 API       │  │
              │ - Social: /refresh │  │
              │ - IDC: /token      │  │
              └─────────┬──────────┘  │
                        │             │
                        ↓             │
              ┌────────────────────┐  │
              │ 更新本地 Token 文件│  │
              └─────────┬──────────┘  │
                        └─────────────┘
                                ↓
                        ┌───────────────┐
                        │ 验证并返回    │
                        └───────────────┘
```

### 凭证加载优先级

1. **Base64 环境变量** (`KIRO_OAUTH_CREDS_BASE64`)
   - 最高优先级
   - 适合容器化部署
   - 解码后直接使用

2. **指定文件路径** (`KIRO_OAUTH_CREDS_FILE_PATH`)
   - 次优先级
   - 可自定义位置
   - 支持绝对路径

3. **默认目录扫描** (`~/.aws/sso/cache/`)
   - 兜底方案
   - 自动扫描所有 `.json` 文件
   - 合并多个凭证源

### 凭证文件结构

```json
{
  "accessToken": "eyJraWQ...",
  "refreshToken": "eyJjdH...",
  "expiresAt": "2025-02-10T12:00:00.000Z",
  "clientId": "client-id",
  "clientSecret": "client-secret",
  "region": "us-east-1",
  "profileArn": "arn:aws:iam::...",
  "authMethod": "social"
}
```

### Token 刷新逻辑

```javascript
async initializeAuth(forceRefresh = false) {
    // 1. 检查是否需要刷新
    if (this.accessToken && !forceRefresh) return;
    
    // 2. 加载凭证（多源合并）
    let mergedCredentials = {};
    
    // Priority 1: Base64
    if (this.base64Creds) {
        Object.assign(mergedCredentials, this.base64Creds);
    }
    
    // Priority 2: 指定文件
    if (credPath) {
        const creds = await loadCredentialsFromFile(credPath);
        Object.assign(mergedCredentials, creds);
    }
    
    // Priority 3: 目录扫描
    if (!this.credsFilePath) {
        // 扫描并合并所有 JSON 文件
    }
    
    // 3. 应用凭证
    this.accessToken = mergedCredentials.accessToken;
    this.refreshToken = mergedCredentials.refreshToken;
    // ... 其他字段
    
    // 4. 刷新 Token（如果需要）
    if (forceRefresh || !this.accessToken) {
        const response = await this.axiosInstance.post(
            this.authMethod === 'social' ? this.refreshUrl : this.refreshIDCUrl,
            requestBody
        );
        
        // 更新 Token
        this.accessToken = response.data.accessToken;
        this.expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
        
        // 保存到文件
        await saveCredentialsToFile(tokenFilePath, updatedTokenData);
    }
}
```

### 设备指纹生成

```javascript
async function getMacAddressSha256() {
    const networkInterfaces = os.networkInterfaces();
    let macAddress = '';
    
    // 查找第一个非内部网卡的 MAC 地址
    for (const interfaceName in networkInterfaces) {
        for (const iface of networkInterfaces[interfaceName]) {
            if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
                macAddress = iface.mac;
                break;
            }
        }
        if (macAddress) break;
    }
    
    // 生成 SHA256 哈希
    const sha256Hash = crypto.createHash('sha256')
        .update(macAddress)
        .digest('hex');
    
    return sha256Hash;
}
```

---

## 请求转换

### OpenAI → CodeWhisperer 格式转换

```javascript
buildCodewhispererRequest(messages, model, tools, systemPrompt) {
    const conversationId = uuidv4();
    const codewhispererModel = MODEL_MAPPING[model];
    
    // 1. 处理系统提示词
    let history = [];
    if (systemPrompt) {
        // 合并到第一条用户消息或单独添加
        history.push({
            userInputMessage: {
                content: systemPrompt,
                modelId: codewhispererModel,
                origin: 'AI_EDITOR'
            }
        });
    }
    
    // 2. 处理历史消息
    for (const message of messages.slice(0, -1)) {
        if (message.role === 'user') {
            const userMsg = {
                content: this.getContentText(message),
                modelId: codewhispererModel,
                origin: 'AI_EDITOR',
                images: [],  // 多模态支持
                userInputMessageContext: {
                    toolResults: [],  // 工具结果
                    tools: []         // 工具定义
                }
            };
            history.push({ userInputMessage: userMsg });
        } else if (message.role === 'assistant') {
            const assistantMsg = {
                content: this.getContentText(message),
                toolUses: []  // 工具使用
            };
            history.push({ assistantResponseMessage: assistantMsg });
        }
    }
    
    // 3. 处理当前消息（最后一条）
    const currentMessage = messages[messages.length - 1];
    // ... 构建当前消息
    
    // 4. 组装最终请求
    return {
        conversationState: {
            chatTriggerType: 'MANUAL',
            conversationId,
            currentMessage: { ... },
            history
        },
        profileArn: this.profileArn  // 社交认证需要
    };
}
```

### 多模态内容处理

```javascript
// 处理包含图片的消息
if (Array.isArray(message.content)) {
    for (const part of message.content) {
        if (part.type === 'text') {
            userInputMessage.content += part.text;
        } else if (part.type === 'image') {
            userInputMessage.images.push({
                format: part.source.media_type.split('/')[1],  // jpeg, png, etc.
                source: {
                    bytes: part.source.data  // Base64 编码
                }
            });
        }
    }
}
```

### 工具定义转换

```javascript
// OpenAI 工具格式
const openaiTools = [
    {
        name: "get_weather",
        description: "Get current weather",
        input_schema: {
            type: "object",
            properties: { city: { type: "string" } }
        }
    }
];

// 转换为 CodeWhisperer 格式
const toolsContext = {
    tools: tools.map(tool => ({
        toolSpecification: {
            name: tool.name,
            description: tool.description || "",
            inputSchema: { 
                json: tool.input_schema || {} 
            }
        }
    }))
};
```

---

## 响应处理

### 事件流解析

Kiro API 返回的是一种特殊的事件流格式，需要自定义解析：

```javascript
parseEventStreamChunk(rawData) {
    const rawStr = Buffer.isBuffer(rawData) 
        ? rawData.toString('utf8') 
        : String(rawData);
    
    let fullContent = '';
    const toolCalls = [];
    let currentToolCallDict = null;
    
    // 使用正则匹配事件块
    const eventBlockRegex = /event({.*?(?=event{|$))/gs;
    
    for (const match of rawStr.matchAll(eventBlockRegex)) {
        const potentialJsonBlock = match[1];
        
        // 尝试解析 JSON（可能在多个 } 位置）
        let searchPos = 0;
        while ((searchPos = potentialJsonBlock.indexOf('}', searchPos + 1)) !== -1) {
            const jsonCandidate = potentialJsonBlock.substring(0, searchPos + 1);
            
            try {
                const eventData = JSON.parse(jsonCandidate);
                
                // 1. 处理结构化工具调用
                if (eventData.name && eventData.toolUseId) {
                    if (!currentToolCallDict) {
                        currentToolCallDict = {
                            id: eventData.toolUseId,
                            type: "function",
                            function: {
                                name: eventData.name,
                                arguments: ""
                            }
                        };
                    }
                    
                    if (eventData.input) {
                        currentToolCallDict.function.arguments += eventData.input;
                    }
                    
                    if (eventData.stop) {
                        // 工具调用结束
                        toolCalls.push(currentToolCallDict);
                        currentToolCallDict = null;
                    }
                }
                // 2. 处理普通内容
                else if (!eventData.followupPrompt && eventData.content) {
                    fullContent += eventData.content.replace(/\\n/g, '\n');
                }
                
                break;  // 成功解析，跳出内层循环
            } catch (e) {
                // 解析失败，继续寻找下一个 }
            }
        }
    }
    
    return { content: fullContent, toolCalls };
}
```

### 括号式工具调用解析

Kiro 有时会在响应文本中使用特殊的括号格式表示工具调用：

```
[Called get_weather with args: {"city": "Beijing"}]
```

解析器实现：

```javascript
function parseBracketToolCalls(responseText) {
    if (!responseText || !responseText.includes("[Called")) {
        return null;
    }
    
    const toolCalls = [];
    
    // 1. 找到所有 [Called 的位置
    const callPositions = [];
    let start = 0;
    while (true) {
        const pos = responseText.indexOf("[Called", start);
        if (pos === -1) break;
        callPositions.push(pos);
        start = pos + 1;
    }
    
    // 2. 对每个位置，找到匹配的右括号
    for (let i = 0; i < callPositions.length; i++) {
        const startPos = callPositions[i];
        const endSearchLimit = callPositions[i + 1] || responseText.length;
        
        const segment = responseText.substring(startPos, endSearchLimit);
        const bracketEnd = findMatchingBracket(segment, 0);
        
        if (bracketEnd !== -1) {
            const toolCallText = segment.substring(0, bracketEnd + 1);
            const parsedCall = parseSingleToolCall(toolCallText);
            if (parsedCall) {
                toolCalls.push(parsedCall);
            }
        }
    }
    
    return toolCalls.length > 0 ? toolCalls : null;
}

function parseSingleToolCall(toolCallText) {
    // 解析: [Called function_name with args: {...}]
    const namePattern = /\[Called\s+(\w+)\s+with\s+args:/i;
    const nameMatch = toolCallText.match(namePattern);
    
    if (!nameMatch) return null;
    
    const functionName = nameMatch[1].trim();
    
    // 提取 JSON 参数
    const argsStartPos = toolCallText.toLowerCase().indexOf("with args:") + "with args:".length;
    const argsEnd = toolCallText.lastIndexOf(']');
    const jsonCandidate = toolCallText.substring(argsStartPos, argsEnd).trim();
    
    try {
        // 修复常见 JSON 问题
        let repairedJson = jsonCandidate;
        repairedJson = repairedJson.replace(/,\s*([}\]])/g, '$1');  // 删除尾随逗号
        
        const argumentsObj = JSON.parse(repairedJson);
        
        return {
            id: `call_${uuidv4().replace(/-/g, '').substring(0, 8)}`,
            type: "function",
            function: {
                name: functionName,
                arguments: JSON.stringify(argumentsObj)
            }
        };
    } catch (e) {
        console.error(`Failed to parse tool call: ${e.message}`);
        return null;
    }
}
```

### 响应格式转换（Claude 格式）

```javascript
buildClaudeResponse(content, isStream, role, model, toolCalls) {
    const messageId = uuidv4();
    
    if (isStream) {
        // 流式响应：返回事件数组
        const events = [];
        
        // 1. message_start
        events.push({
            type: "message_start",
            message: {
                id: messageId,
                type: "message",
                role: role,
                model: model,
                usage: { input_tokens: 0, output_tokens: 0 },
                content: []
            }
        });
        
        // 2. content_block_start + content_block_delta (文本)
        if (content) {
            events.push({
                type: "content_block_start",
                index: 0,
                content_block: { type: "text", text: "" }
            });
            events.push({
                type: "content_block_delta",
                index: 0,
                delta: { type: "text_delta", text: content }
            });
            events.push({
                type: "content_block_stop",
                index: 0
            });
        }
        
        // 3. content_block_start + content_block_delta (工具调用)
        if (toolCalls && toolCalls.length > 0) {
            toolCalls.forEach((tc, index) => {
                events.push({
                    type: "content_block_start",
                    index: index,
                    content_block: {
                        type: "tool_use",
                        id: tc.id,
                        name: tc.function.name,
                        input: {}
                    }
                });
                events.push({
                    type: "content_block_delta",
                    index: index,
                    delta: {
                        type: "input_json_delta",
                        partial_json: tc.function.arguments
                    }
                });
                events.push({
                    type: "content_block_stop",
                    index: index
                });
            });
        }
        
        // 4. message_delta
        events.push({
            type: "message_delta",
            delta: {
                stop_reason: toolCalls ? "tool_use" : "end_turn",
                stop_sequence: null
            },
            usage: { output_tokens: estimateTokens(content) }
        });
        
        // 5. message_stop
        events.push({ type: "message_stop" });
        
        return events;
    } else {
        // 非流式响应：返回完整消息对象
        const contentArray = [];
        
        if (toolCalls && toolCalls.length > 0) {
            for (const tc of toolCalls) {
                contentArray.push({
                    type: "tool_use",
                    id: tc.id,
                    name: tc.function.name,
                    input: JSON.parse(tc.function.arguments)
                });
            }
        } else if (content) {
            contentArray.push({
                type: "text",
                text: content
            });
        }
        
        return {
            id: messageId,
            type: "message",
            role: role,
            model: model,
            stop_reason: toolCalls ? "tool_use" : "end_turn",
            stop_sequence: null,
            usage: {
                input_tokens: 0,
                output_tokens: estimateTokens(content)
            },
            content: contentArray
        };
    }
}
```

---

## 工具调用支持

### 完整的工具调用流程

```
┌─────────────────────────────────────────────────────────────┐
│                  1. 客户端发送带工具定义的请求                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│           2. buildCodewhispererRequest()                     │
│              转换工具定义到 CodeWhisperer 格式                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              3. 发送请求到 Kiro API                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│         4. parseEventStreamChunk()                           │
│            - 解析结构化工具调用（eventData.name）             │
│            - 解析括号式工具调用（[Called ...]）              │
│            - 清理响应文本中的工具调用语法                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│         5. deduplicateToolCalls()                            │
│            去除重复的工具调用                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│         6. buildClaudeResponse()                             │
│            构建 Claude 格式的工具调用响应                     │
│            stop_reason: "tool_use"                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│         7. 客户端执行工具并发送结果                           │
│            role: "user"                                      │
│            content: [{ type: "tool_result", ... }]           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│         8. 转换工具结果到 CodeWhisperer 格式                 │
│            userInputMessageContext.toolResults               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              9. 继续对话，直到完成                           │
└─────────────────────────────────────────────────────────────┘
```

### 工具结果处理

```javascript
// 客户端发送的工具结果格式（OpenAI/Claude）
{
    role: "user",
    content: [
        {
            type: "tool_result",
            tool_use_id: "call_abc123",
            content: "The weather in Beijing is sunny, 25°C"
        }
    ]
}

// 转换为 CodeWhisperer 格式
userInputMessage: {
    content: '',
    userInputMessageContext: {
        toolResults: [
            {
                content: [{ text: "The weather in Beijing is sunny, 25°C" }],
                status: 'success',
                toolUseId: 'call_abc123'
            }
        ]
    }
}
```

### 工具调用去重

由于可能同时从多个源解析到工具调用，需要去重：

```javascript
function deduplicateToolCalls(toolCalls) {
    const seen = new Set();
    const uniqueToolCalls = [];
    
    for (const tc of toolCalls) {
        // 使用函数名和参数作为唯一键
        const key = `${tc.function.name}-${tc.function.arguments}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueToolCalls.push(tc);
        } else {
            console.log(`Skipping duplicate tool call: ${tc.function.name}`);
        }
    }
    
    return uniqueToolCalls;
}
```

---

## 流式处理

### 伪流式实现

Kiro API 本身**不支持真正的流式响应**，但为了兼容客户端期望，实现了"伪流式"：

```javascript
async * generateContentStream(model, requestBody) {
    if (!this.isInitialized) await this.initialize();
    const finalModel = MODEL_MAPPING[model] ? model : this.modelName;
    
    try {
        // 1. 一次性获取完整响应
        const response = await this.streamApi('', finalModel, requestBody);
        
        // 2. 解析响应
        const { responseText, toolCalls } = this._processApiResponse(response);
        
        // 3. 构建流式事件数组
        const events = this.buildClaudeResponse(
            responseText, 
            true,  // isStream = true
            'assistant', 
            model, 
            toolCalls
        );
        
        // 4. 逐个 yield 事件
        for (const chunkJson of events) {
            yield chunkJson;
        }
    } catch (error) {
        console.error('[Kiro] Error in streaming generation:', error);
        // 错误也以流式事件形式返回
        for (const chunkJson of this.buildClaudeResponse(
            `Error: ${error.message}`, 
            true, 
            'assistant', 
            model, 
            null
        )) {
            yield chunkJson;
        }
    }
}
```

### 流式事件序列

一个完整的流式响应包含以下事件：

```javascript
// 1. message_start - 消息开始
{
    type: "message_start",
    message: {
        id: "msg_abc123",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4-20250514",
        usage: { input_tokens: 0, output_tokens: 0 },
        content: []
    }
}

// 2. content_block_start - 内容块开始（文本或工具）
{
    type: "content_block_start",
    index: 0,
    content_block: {
        type: "text",  // 或 "tool_use"
        text: ""
    }
}

// 3. content_block_delta - 内容增量
{
    type: "content_block_delta",
    index: 0,
    delta: {
        type: "text_delta",  // 或 "input_json_delta"
        text: "Hello, world!"
    }
}

// 4. content_block_stop - 内容块结束
{
    type: "content_block_stop",
    index: 0
}

// 5. message_delta - 消息元数据更新
{
    type: "message_delta",
    delta: {
        stop_reason: "end_turn",  // 或 "tool_use"
        stop_sequence: null
    },
    usage: { output_tokens: 50 }
}

// 6. message_stop - 消息结束
{
    type: "message_stop"
}
```

---

## 适配器模式

### 适配器层设计

```javascript
// src/adapter.js

export class KiroApiServiceAdapter extends ApiServiceAdapter {
    constructor(config) {
        super();
        this.kiroApiService = new KiroApiService(config);
    }
    
    // 统一的接口方法
    async generateContent(model, requestBody) {
        if (!this.kiroApiService.isInitialized) {
            await this.kiroApiService.initialize();
        }
        return this.kiroApiService.generateContent(model, requestBody);
    }
    
    async *generateContentStream(model, requestBody) {
        if (!this.kiroApiService.isInitialized) {
            await this.kiroApiService.initialize();
        }
        yield* this.kiroApiService.generateContentStream(model, requestBody);
    }
    
    async listModels() {
        if (!this.kiroApiService.isInitialized) {
            await this.kiroApiService.initialize();
        }
        return this.kiroApiService.listModels();
    }
    
    async refreshToken() {
        // 检查 Token 是否即将过期
        if (this.kiroApiService.isExpiryDateNear()) {
            console.log(`[Kiro] Expiry date is near, refreshing token...`);
            return this.kiroApiService.initializeAuth(true);
        }
        return Promise.resolve();
    }
}
```

### 服务工厂

```javascript
// src/adapter.js

export function getServiceAdapter(config) {
    const provider = config.MODEL_PROVIDER;
    const uuid = config.uuid;
    
    // 单例模式 - 每个 provider 只创建一次
    const key = `${provider}-${uuid}`;
    if (!serviceInstances[key]) {
        switch (provider) {
            case MODEL_PROVIDER.KIRO_API:
                serviceInstances[key] = new KiroApiServiceAdapter(config);
                break;
            case MODEL_PROVIDER.CLAUDE_CUSTOM:
                serviceInstances[key] = new ClaudeApiServiceAdapter(config);
                break;
            // ... 其他 provider
        }
    }
    
    return serviceInstances[key];
}
```

---

## 配置管理

### 配置文件示例

```json
{
  "REQUIRED_API_KEY": "123456",
  "SERVER_PORT": 3000,
  "HOST": "localhost",
  "MODEL_PROVIDER": "claude-kiro-oauth",
  
  "KIRO_OAUTH_CREDS_BASE64": null,
  "KIRO_OAUTH_CREDS_FILE_PATH": "/Users/username/.aws/sso/cache/kiro-auth-token.json",
  "KIRO_OAUTH_CREDS_DIR_PATH": null,
  
  "REQUEST_MAX_RETRIES": 3,
  "REQUEST_BASE_DELAY": 1000,
  "CRON_NEAR_MINUTES": 15,
  "CRON_REFRESH_TOKEN": true,
  
  "PROVIDER_POOLS_FILE_PATH": null
}
```

### 配置优先级

1. **环境变量** (最高优先级)
2. **config.json 文件**
3. **默认值** (最低优先级)

### 关键配置项说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `MODEL_PROVIDER` | 模型提供商 | `claude-kiro-oauth` |
| `KIRO_OAUTH_CREDS_BASE64` | Base64 编码的凭证 | `null` |
| `KIRO_OAUTH_CREDS_FILE_PATH` | 凭证文件路径 | `null` |
| `KIRO_OAUTH_CREDS_DIR_PATH` | 凭证目录路径 | `~/.aws/sso/cache` |
| `REQUEST_MAX_RETRIES` | 最大重试次数 | `3` |
| `REQUEST_BASE_DELAY` | 重试基础延迟（毫秒） | `1000` |
| `CRON_NEAR_MINUTES` | Token 过期提前刷新时间 | `15` |
| `CRON_REFRESH_TOKEN` | 是否启用定时刷新 | `true` |

### 多账号池配置

```json
// provider_pools.json
{
  "claude-kiro-oauth": {
    "accounts": [
      {
        "KIRO_OAUTH_CREDS_FILE_PATH": "/path/to/account1.json",
        "weight": 1
      },
      {
        "KIRO_OAUTH_CREDS_FILE_PATH": "/path/to/account2.json",
        "weight": 1
      }
    ],
    "strategy": "round-robin",  // 或 "random", "weighted"
    "fallback": {
      "enabled": true,
      "degradeTo": "gemini-cli-oauth"
    }
  }
}
```

---

## 错误处理与重试

### 错误类型与处理策略

```javascript
async callApi(method, model, body, isRetry = false, retryCount = 0) {
    const maxRetries = this.config.REQUEST_MAX_RETRIES || 3;
    const baseDelay = this.config.REQUEST_BASE_DELAY || 1000;
    
    try {
        const response = await this.axiosInstance.post(url, requestData, { headers });
        return response;
    } catch (error) {
        // 1. 403 Forbidden - Token 过期
        if (error.response?.status === 403 && !isRetry) {
            console.log('[Kiro] Received 403. Attempting token refresh...');
            try {
                await this.initializeAuth(true);  // 强制刷新
                return this.callApi(method, model, body, true, retryCount);
            } catch (refreshError) {
                throw refreshError;
            }
        }
        
        // 2. 429 Too Many Requests - 速率限制
        if (error.response?.status === 429 && retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount);  // 指数退避
            console.log(`[Kiro] Rate limited. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.callApi(method, model, body, isRetry, retryCount + 1);
        }
        
        // 3. 5xx Server Errors - 服务器错误
        if (error.response?.status >= 500 && retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount);
            console.log(`[Kiro] Server error. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.callApi(method, model, body, isRetry, retryCount + 1);
        }
        
        throw error;  // 不可恢复的错误
    }
}
```

### 指数退避策略

```
重试次数  |  延迟时间
---------|----------
   0     |    0 ms
   1     | 1000 ms (1s)
   2     | 2000 ms (2s)
   3     | 4000 ms (4s)
```

### Token 过期检测

```javascript
isExpiryDateNear() {
    try {
        const expirationTime = new Date(this.expiresAt);
        const currentTime = new Date();
        const threshold = (this.config.CRON_NEAR_MINUTES || 10) * 60 * 1000;
        const thresholdTime = new Date(currentTime.getTime() + threshold);
        
        console.log(`[Kiro] Token expires at: ${expirationTime}, threshold: ${thresholdTime}`);
        
        return expirationTime.getTime() <= thresholdTime.getTime();
    } catch (error) {
        console.error(`[Kiro] Error checking expiry: ${error.message}`);
        return false;  // 解析失败视为未过期
    }
}
```

---

## 技术亮点

### 1. 多源凭证加载

支持从多个来源加载和合并凭证：
- Base64 环境变量（适合容器化）
- 指定文件路径（灵活性）
- 目录自动扫描（兼容性）

### 2. 智能工具调用解析

同时支持两种工具调用格式：
- 结构化 JSON 事件（主要方式）
- 括号式文本标记（备用方式）

### 3. 响应文本清理

自动清理响应中的工具调用语法：
```javascript
// 原始响应
"The weather is [Called get_weather with args: {...}] sunny."

// 清理后
"The weather is sunny."
```

### 4. 伪流式响应

虽然底层 API 不支持流式，但完美模拟了 Claude 的流式事件：
- 符合 SSE (Server-Sent Events) 规范
- 与真实 Claude API 行为一致
- 客户端无感知

### 5. 设备指纹生成

使用 MAC 地址 SHA256 哈希作为设备标识：
```javascript
const macSha256 = await getMacAddressSha256();
headers['x-amz-user-agent'] = `aws-sdk-js/1.0.7 KiroIDE-0.1.25-${macSha256}`;
```

### 6. 健壮的错误处理

- 自动 Token 刷新（403 错误）
- 指数退避重试（429、5xx 错误）
- 优雅的降级和回退

### 7. 多模态支持

完整支持：
- 文本输入
- 图片输入（Base64）
- PDF 文档（通过 Claude 原生支持）

---

## 使用示例

### 基本对话

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 123456" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {
        "role": "user",
        "content": "What is the capital of France?"
      }
    ]
  }'
```

### 流式对话

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 123456" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {
        "role": "user",
        "content": "Tell me a story"
      }
    ],
    "stream": true
  }'
```

### 工具调用

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 123456" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {
        "role": "user",
        "content": "What is the weather in Beijing?"
      }
    ],
    "tools": [
      {
        "name": "get_weather",
        "description": "Get current weather for a city",
        "input_schema": {
          "type": "object",
          "properties": {
            "city": {
              "type": "string",
              "description": "City name"
            }
          },
          "required": ["city"]
        }
      }
    ]
  }'
```

### 图片输入

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 123456" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "What is in this image?"
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
    ]
  }'
```

### 在编程 Agent 中使用

#### Cline (VSCode)

```json
{
  "anthropic.baseUrl": "http://localhost:3000/claude-kiro-oauth",
  "anthropic.apiKey": "123456"
}
```

#### Cursor

```json
{
  "models": [
    {
      "name": "Claude Sonnet 4",
      "provider": "anthropic",
      "baseUrl": "http://localhost:3000/claude-kiro-oauth",
      "apiKey": "123456"
    }
  ]
}
```

---

## 最佳实践

### 1. 凭证管理

**推荐方式（按优先级）：**

```bash
# Docker 部署 - 使用 Base64 环境变量
KIRO_OAUTH_CREDS_BASE64=$(cat kiro-auth-token.json | base64)

# 本地开发 - 使用文件路径
KIRO_OAUTH_CREDS_FILE_PATH=~/.aws/sso/cache/kiro-auth-token.json

# 自动发现 - 使用默认目录
# 不需要配置，自动扫描 ~/.aws/sso/cache/
```

### 2. Token 刷新策略

```json
{
  "CRON_REFRESH_TOKEN": true,      // 启用定时刷新
  "CRON_NEAR_MINUTES": 15          // 提前 15 分钟刷新
}
```

### 3. 错误处理

```javascript
// 客户端应实现重试逻辑
async function callKiroAPI(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch('http://localhost:3000/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer 123456' },
                body: JSON.stringify(requestData)
            });
            
            if (response.ok) return await response.json();
            
            if (response.status === 429 || response.status >= 500) {
                // 可重试错误
                await sleep(1000 * Math.pow(2, i));
                continue;
            }
            
            // 不可重试错误
            throw new Error(`API error: ${response.status}`);
        } catch (error) {
            if (i === retries - 1) throw error;
        }
    }
}
```

### 4. 性能优化

- **连接池复用**：使用 axios 实例复用连接
- **请求去重**：避免重复的工具调用
- **并发控制**：合理设置超时和重试次数

### 5. 监控和日志

```javascript
// 启用详细日志
console.log('[Kiro] Request:', JSON.stringify(requestData));
console.log('[Kiro] Response:', JSON.stringify(responseData));
console.log('[Kiro] Token expires at:', this.expiresAt);
```

### 6. 多账号池使用

```json
{
  "PROVIDER_POOLS_FILE_PATH": "./provider_pools.json"
}
```

配置多个账号实现：
- **负载均衡**：轮询或随机分配
- **故障转移**：账号失败自动切换
- **配额管理**：多账号共享额度

### 7. 安全建议

- ✅ 不要在代码中硬编码 Token
- ✅ 使用环境变量或加密文件存储凭证
- ✅ 定期轮换 Token
- ✅ 限制 API 访问（IP 白名单、API Key）
- ✅ 监控异常调用模式

### 8. 模型选择

| 模型 | 特点 | 适用场景 |
|------|------|---------|
| `claude-sonnet-4-20250514` | 最新、最强 | 复杂推理、代码生成 |
| `claude-3-7-sonnet-20250219` | 平衡性能 | 日常对话、一般任务 |
| `amazonq-*` | Amazon Q 模式 | 特定 AWS 场景 |

### 9. 调试技巧

```bash
# 查看完整请求日志
DEBUG=kiro:* npm start

# 测试 Token 有效性
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer 123456"

# 检查服务健康
curl http://localhost:3000/health
```

### 10. 常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 403 Forbidden | Token 过期 | 重新登录 Kiro 客户端生成新 Token |
| 429 Too Many Requests | 速率限制 | 等待或使用多账号池 |
| 工具调用未识别 | 解析失败 | 检查响应日志，可能需要更新解析器 |
| 流式响应中断 | 网络超时 | 增加 `AXIOS_TIMEOUT` 配置 |
| 凭证加载失败 | 文件路径错误 | 检查 `KIRO_OAUTH_CREDS_FILE_PATH` |

---

## 总结

Kiro Claude 实现是本项目的核心技术亮点之一，通过以下技术手段实现了完整的功能：

### 核心技术

1. **逆向工程**：深入分析 Kiro IDE 的 API 调用机制
2. **协议转换**：OpenAI ↔ CodeWhisperer ↔ Claude 格式互转
3. **智能解析**：多种工具调用格式的统一处理
4. **伪流式**：无缝模拟 Claude 的流式响应体验
5. **健壮性**：完善的错误处理和重试机制

### 应用价值

- 🎯 **免费使用 Claude Sonnet 4**：突破官方限制
- 🔧 **统一接口**：与 OpenAI API 完全兼容
- 🚀 **生产就绪**：支持多账号、故障转移、监控日志
- 🎨 **灵活扩展**：模块化设计，易于维护和扩展

### 未来展望

- 支持更多 Kiro 模型
- 优化解析性能
- 增强多模态能力
- 完善监控和告警

---

**文档版本**: 1.0.0  
**最后更新**: 2025-02-07  
**维护者**: AIClient-2-API Team