# Kiro Claude 架构图和流程图

本文档包含 Kiro Claude 实现的各种可视化图表，帮助理解系统架构和运行流程。

---

## 目录

- [整体系统架构](#整体系统架构)
- [请求处理流程](#请求处理流程)
- [认证流程详解](#认证流程详解)
- [工具调用序列](#工具调用序列)
- [流式响应流程](#流式响应流程)
- [错误处理和重试](#错误处理和重试)
- [组件依赖关系](#组件依赖关系)
- [数据转换流程](#数据转换流程)

---

## 整体系统架构

```mermaid
graph TB
    subgraph "Client Layer"
        A[Client Application]
        A1[LobeChat]
        A2[Cline/Cursor]
        A3[NextChat]
        A4[Custom Client]
    end

    subgraph "API Gateway Layer"
        B[Express Server]
        B1[Route Handler]
        B2[Authentication]
        B3[Request Validator]
    end

    subgraph "Adapter Layer"
        C[Service Factory]
        C1[KiroApiServiceAdapter]
        C2[ClaudeApiServiceAdapter]
        C3[GeminiApiServiceAdapter]
        C4[OpenAIApiServiceAdapter]
    end

    subgraph "Core Service Layer"
        D[KiroApiService]
        D1[Auth Manager]
        D2[Request Transformer]
        D3[Response Parser]
        D4[Tool Call Handler]
        D5[Stream Simulator]
    end

    subgraph "External Services"
        E[Kiro/CodeWhisperer API]
        E1[Token Refresh Endpoint]
        E2[generateAssistantResponse]
        E3[SendMessageStreaming]
    end

    A --> B
    A1 --> B
    A2 --> B
    A3 --> B
    A4 --> B
    
    B --> B1
    B1 --> B2
    B2 --> B3
    B3 --> C
    
    C --> C1
    C --> C2
    C --> C3
    C --> C4
    
    C1 --> D
    
    D --> D1
    D --> D2
    D --> D3
    D --> D4
    D --> D5
    
    D1 --> E1
    D2 --> E2
    D2 --> E3
    
    E1 --> D1
    E2 --> D3
    E3 --> D3

    style A fill:#e1f5ff
    style B fill:#fff3e0
    style C fill:#f3e5f5
    style D fill:#e8f5e9
    style E fill:#fce4ec
```

---

## 请求处理流程

```mermaid
sequenceDiagram
    participant Client
    participant Server as API Server
    participant Adapter as KiroAdapter
    participant Service as KiroService
    participant Auth as Auth Manager
    participant Kiro as Kiro API

    Client->>Server: POST /v1/chat/completions
    Note over Client,Server: OpenAI format request
    
    Server->>Server: Validate API Key
    Server->>Server: Parse request body
    
    Server->>Adapter: generateContent(model, body)
    
    Adapter->>Service: Check initialization
    alt Not initialized
        Service->>Auth: initialize()
        Auth->>Auth: Load credentials
        Auth->>Auth: Setup axios instance
    end
    
    Service->>Service: buildCodewhispererRequest()
    Note over Service: OpenAI → CodeWhisperer format
    
    Service->>Auth: Check token validity
    alt Token expired
        Auth->>Kiro: POST /refreshToken
        Kiro-->>Auth: New access token
        Auth->>Auth: Save to file
    end
    
    Service->>Kiro: POST /generateAssistantResponse
    Note over Service,Kiro: CodeWhisperer format
    
    Kiro-->>Service: Event stream response
    
    Service->>Service: parseEventStreamChunk()
    Service->>Service: Extract tool calls
    Service->>Service: Clean response text
    Service->>Service: buildClaudeResponse()
    Note over Service: CodeWhisperer → Claude format
    
    Service-->>Adapter: Claude format response
    Adapter-->>Server: Return response
    Server-->>Client: Claude format response
    
    Note over Client,Server: Compatible with Claude SDK
```

---

## 认证流程详解

```mermaid
flowchart TD
    Start([Start: initializeAuth]) --> CheckToken{Has accessToken<br/>and not force?}
    
    CheckToken -->|Yes| Return([Return])
    CheckToken -->|No| LoadCreds[Load Credentials]
    
    LoadCreds --> Priority1{Base64 Env Var?}
    Priority1 -->|Yes| DecodeBase64[Decode Base64]
    Priority1 -->|No| Priority2
    
    DecodeBase64 --> MergeCreds[Merge to credentials]
    
    Priority2{Specific File Path?} -->|Yes| LoadFile1[Load from file]
    Priority2 -->|No| Priority3
    
    LoadFile1 --> MergeCreds
    
    Priority3{Default Directory?} -->|Yes| ScanDir[Scan *.json files]
    Priority3 -->|No| MergeCreds
    
    ScanDir --> LoadMultiple[Load all JSON files]
    LoadMultiple --> MergeCreds
    
    MergeCreds --> ApplyCreds[Apply credentials to service]
    ApplyCreds --> SetRegion[Set region URLs]
    
    SetRegion --> NeedRefresh{Need token refresh?<br/>forceRefresh OR<br/>no accessToken?}
    
    NeedRefresh -->|No| ValidateToken
    NeedRefresh -->|Yes| CheckRefreshToken{Has refreshToken?}
    
    CheckRefreshToken -->|No| Error([Throw Error])
    CheckRefreshToken -->|Yes| PrepareRefresh[Prepare refresh request]
    
    PrepareRefresh --> CheckAuthMethod{Auth Method?}
    
    CheckAuthMethod -->|Social| UseSocialURL[Use REFRESH_URL]
    CheckAuthMethod -->|IDC| UseIDCURL[Use REFRESH_IDC_URL<br/>Add clientId/Secret]
    
    UseSocialURL --> CallRefresh[POST to refresh endpoint]
    UseIDCURL --> CallRefresh
    
    CallRefresh --> CheckResponse{Response valid?}
    
    CheckResponse -->|No| Error
    CheckResponse -->|Yes| UpdateTokens[Update tokens:<br/>- accessToken<br/>- refreshToken<br/>- expiresAt<br/>- profileArn]
    
    UpdateTokens --> SaveToFile[Save to token file]
    SaveToFile --> ValidateToken
    
    ValidateToken --> HasAccessToken{Has accessToken?}
    HasAccessToken -->|No| Error
    HasAccessToken -->|Yes| Return
    
    style Start fill:#e3f2fd
    style Return fill:#c8e6c9
    style Error fill:#ffcdd2
    style MergeCreds fill:#fff9c4
    style CallRefresh fill:#f8bbd0
    style SaveToFile fill:#b2dfdb
```

---

## 工具调用序列

```mermaid
sequenceDiagram
    participant Client
    participant Service as KiroService
    participant Parser as Tool Parser
    participant Kiro as Kiro API

    Note over Client,Service: Round 1: Initial Request with Tools

    Client->>Service: Request with tool definitions
    Service->>Service: Convert tools to CodeWhisperer format
    Service->>Kiro: Send with toolSpecification
    Kiro-->>Service: Response with tool calls
    
    Service->>Parser: parseEventStreamChunk()
    
    rect rgb(220, 240, 255)
        Note over Parser: Parse structured events
        Parser->>Parser: Extract eventData.name/toolUseId
        Parser->>Parser: Accumulate eventData.input
    end
    
    rect rgb(255, 240, 220)
        Note over Parser: Parse bracket format
        Parser->>Parser: Find [Called function with args: {...}]
        Parser->>Parser: Extract function name
        Parser->>Parser: Parse JSON arguments
    end
    
    Parser->>Parser: deduplicateToolCalls()
    Parser->>Parser: Clean response text
    Parser-->>Service: {content, toolCalls}
    
    Service->>Service: buildClaudeResponse()
    Note over Service: stop_reason: "tool_use"
    Service-->>Client: Response with tool_use blocks
    
    Note over Client,Service: Round 2: Tool Results

    Client->>Client: Execute tools locally
    Client->>Service: Send tool results
    Note over Client,Service: role: "user"<br/>content: [{type: "tool_result", ...}]
    
    Service->>Service: Convert to toolResults format
    Service->>Kiro: Send with toolResults context
    Kiro-->>Service: Final response
    Service-->>Client: Final answer
    
    Note over Client,Service: stop_reason: "end_turn"
```

---

## 流式响应流程

```mermaid
flowchart LR
    subgraph "1. Client Request"
        A[Client] -->|stream: true| B[API Server]
    end
    
    subgraph "2. Service Processing"
        B --> C[KiroService.generateContentStream]
        C --> D[callApi - Get Full Response]
        D --> E[Wait for complete response]
    end
    
    subgraph "3. Parse Response"
        E --> F[parseEventStreamChunk]
        F --> G[Extract content & toolCalls]
    end
    
    subgraph "4. Build Stream Events"
        G --> H[buildClaudeResponse<br/>isStream=true]
        H --> I1[message_start]
        H --> I2[content_block_start]
        H --> I3[content_block_delta]
        H --> I4[content_block_stop]
        H --> I5[message_delta]
        H --> I6[message_stop]
    end
    
    subgraph "5. Yield Events"
        I1 --> J[Yield event 1]
        I2 --> K[Yield event 2]
        I3 --> L[Yield event 3]
        I4 --> M[Yield event 4]
        I5 --> N[Yield event 5]
        I6 --> O[Yield event 6]
    end
    
    subgraph "6. Client Receives"
        O --> P[Client processes<br/>SSE stream]
        P --> Q[Render incrementally]
    end
    
    style H fill:#fff3e0
    style F fill:#e1f5ff
    style P fill:#e8f5e9
```

---

## 错误处理和重试

```mermaid
stateDiagram-v2
    [*] --> SendRequest: callApi()
    
    SendRequest --> CheckResponse: Response received
    SendRequest --> NetworkError: Network failure
    
    CheckResponse --> Success: 2xx
    CheckResponse --> Error403: 403 Forbidden
    CheckResponse --> Error429: 429 Rate Limit
    CheckResponse --> Error5xx: 5xx Server Error
    CheckResponse --> OtherError: Other errors
    
    Error403 --> CheckRetried: Check if retried
    CheckRetried --> RefreshToken: Not retried yet
    CheckRetried --> FinalError: Already retried
    
    RefreshToken --> SendRequest: Retry with new token
    RefreshToken --> FinalError: Refresh failed
    
    Error429 --> CheckRetryCount: Check retry count
    CheckRetryCount --> ExponentialBackoff: retryCount < maxRetries
    CheckRetryCount --> FinalError: Max retries reached
    
    ExponentialBackoff --> Wait: delay = baseDelay * 2^retryCount
    Wait --> SendRequest: Retry
    
    Error5xx --> CheckRetryCount
    
    NetworkError --> CheckRetryCount
    
    OtherError --> FinalError
    
    Success --> [*]: Return response
    FinalError --> [*]: Throw error
    
    note right of ExponentialBackoff
        Retry 1: 1s delay
        Retry 2: 2s delay
        Retry 3: 4s delay
    end note
```

---

## 组件依赖关系

```mermaid
graph TD
    subgraph "Configuration"
        Config[config.json]
        PoolsConfig[provider_pools.json]
        EnvVars[Environment Variables]
    end
    
    subgraph "Core Components"
        Server[api-server.js]
        Adapter[adapter.js]
        KiroCore[claude-kiro.js]
        Common[common.js]
    end
    
    subgraph "External Dependencies"
        Axios[axios]
        UUID[uuid]
        Crypto[crypto]
        FS[fs/promises]
    end
    
    subgraph "Utilities"
        MacAddr[getMacAddressSha256]
        ToolParser[Tool Call Parsers]
        Dedupe[deduplicateToolCalls]
    end
    
    Config --> Server
    PoolsConfig --> Server
    EnvVars --> Server
    
    Server --> Adapter
    Adapter --> KiroCore
    
    Common --> Server
    Common --> Adapter
    Common --> KiroCore
    
    KiroCore --> Axios
    KiroCore --> UUID
    KiroCore --> Crypto
    KiroCore --> FS
    
    KiroCore --> MacAddr
    KiroCore --> ToolParser
    KiroCore --> Dedupe
    
    MacAddr --> Crypto
    ToolParser --> UUID
    
    style Config fill:#e3f2fd
    style KiroCore fill:#e8f5e9
    style Server fill:#fff3e0
```

---

## 数据转换流程

```mermaid
flowchart TB
    subgraph "OpenAI Format Input"
        A1[messages: Array]
        A2[model: string]
        A3[tools: Array]
        A4[system: string]
        A5[stream: boolean]
    end
    
    subgraph "Transformation Layer"
        B1[buildCodewhispererRequest]
        B2[Extract system prompt]
        B3[Process messages history]
        B4[Handle multimodal content]
        B5[Convert tool definitions]
        B6[Build current message]
    end
    
    subgraph "CodeWhisperer Format"
        C1[conversationState]
        C2[chatTriggerType: MANUAL]
        C3[conversationId: UUID]
        C4[history: Array]
        C5[currentMessage]
        C6[profileArn]
    end
    
    subgraph "API Response"
        D1[Event stream data]
        D2[event content: text]
        D3[name + toolUseId + input]
        D4[Bracket format calls]
    end
    
    subgraph "Parse Layer"
        E1[parseEventStreamChunk]
        E2[Parse structured events]
        E3[Parse bracket calls]
        E4[Deduplicate]
        E5[Clean text]
    end
    
    subgraph "Claude Format Output"
        F1[id: msg_xxx]
        F2[type: message]
        F3[role: assistant]
        F4[content: Array]
        F5[type: text OR tool_use]
        F6[stop_reason]
        F7[usage]
    end
    
    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B1
    A5 --> B1
    
    B1 --> B2
    B2 --> B3
    B3 --> B4
    B4 --> B5
    B5 --> B6
    
    B6 --> C1
    C1 --> C2
    C1 --> C3
    C1 --> C4
    C1 --> C5
    C1 --> C6
    
    C1 --> D1
    D1 --> D2
    D1 --> D3
    D1 --> D4
    
    D2 --> E1
    D3 --> E1
    D4 --> E1
    
    E1 --> E2
    E1 --> E3
    E2 --> E4
    E3 --> E4
    E4 --> E5
    
    E5 --> F1
    E5 --> F2
    E5 --> F3
    E5 --> F4
    F4 --> F5
    E5 --> F6
    E5 --> F7
    
    style A1 fill:#e3f2fd
    style B1 fill:#fff9c4
    style C1 fill:#f3e5f5
    style D1 fill:#fce4ec
    style E1 fill:#fff3e0
    style F1 fill:#e8f5e9
```

---

## 多模态内容处理

```mermaid
graph LR
    subgraph "Input Content Types"
        A1[Text]
        A2[Image Base64]
        A3[Tool Result]
        A4[Tool Use]
    end
    
    subgraph "Content Parser"
        B1{Array.isArray?}
        B2[Iterate parts]
        B3{part.type?}
    end
    
    subgraph "Type Handlers"
        C1[Text Handler]
        C2[Image Handler]
        C3[Tool Result Handler]
        C4[Tool Use Handler]
    end
    
    subgraph "CodeWhisperer Format"
        D1[content: string]
        D2[images: Array]
        D3[toolResults: Array]
        D4[toolUses: Array]
    end
    
    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B1
    
    B1 -->|Yes| B2
    B1 -->|No| C1
    B2 --> B3
    
    B3 -->|text| C1
    B3 -->|image| C2
    B3 -->|tool_result| C3
    B3 -->|tool_use| C4
    
    C1 --> D1
    C2 --> D2
    C3 --> D3
    C4 --> D4
    
    style A2 fill:#ffecb3
    style C2 fill:#ffecb3
    style D2 fill:#ffecb3
```

---

## Token 生命周期管理

```mermaid
gantt
    title Token Lifecycle Management
    dateFormat  YYYY-MM-DD HH:mm
    axisFormat  %H:%M
    
    section Token Lifecycle
    Token Valid Period           :active, token, 2025-01-01 00:00, 60m
    Normal Usage                 :active, usage, 2025-01-01 00:00, 45m
    Near Expiry Warning          :crit, warning, 2025-01-01 00:45, 15m
    Token Refresh Triggered      :milestone, refresh, 2025-01-01 00:50, 0m
    New Token Valid              :active, newtoken, 2025-01-01 01:00, 60m
    
    section Background Tasks
    Cron Check (every 5 min)     :done, cron1, 2025-01-01 00:00, 5m
    Cron Check                   :done, cron2, 2025-01-01 00:05, 5m
    Cron Check                   :done, cron3, 2025-01-01 00:10, 5m
    Cron Check (Near Expiry)     :crit, cron4, 2025-01-01 00:45, 5m
    Refresh Token                :active, refresh2, 2025-01-01 00:50, 5m
```

---

## 工具调用文本清理流程

```mermaid
flowchart TD
    A[Raw Response Text] --> B{Contains '[Called'?}
    
    B -->|No| Z[Return text as-is]
    B -->|Yes| C[parseBracketToolCalls]
    
    C --> D[Find all '[Called' positions]
    D --> E[For each position]
    
    E --> F[Find matching ']' bracket]
    F --> G[Extract tool call text]
    G --> H[Parse function name and args]
    H --> I[Create tool call object]
    
    I --> J[Add to toolCalls array]
    J --> K{More positions?}
    
    K -->|Yes| E
    K -->|No| L[Deduplicate tool calls]
    
    L --> M[For each tool call]
    M --> N[Build regex pattern]
    N --> O["Pattern: \[Called name with args: {...}\]"]
    
    O --> P[Replace in text with empty string]
    P --> Q{More tool calls?}
    
    Q -->|Yes| M
    Q -->|No| R[Clean whitespace]
    
    R --> S[Replace multiple spaces with single space]
    S --> T[Trim text]
    T --> Z[Return cleaned text + tool calls]
    
    style A fill:#e3f2fd
    style C fill:#fff3e0
    style L fill:#f8bbd0
    style R fill:#c8e6c9
    style Z fill:#a5d6a7
```

---

## 使用这些图表

所有图表使用 Mermaid 语法编写，可以在以下环境中渲染：

1. **GitHub**: 原生支持 Mermaid 图表
2. **VSCode**: 安装 Mermaid 预览插件
3. **在线编辑器**: https://mermaid.live/
4. **文档生成器**: Docusaurus, GitBook, MkDocs 等

### 在 Markdown 中使用

直接将 Mermaid 代码块嵌入到 Markdown 文件中：

\`\`\`mermaid
graph TD
    A[开始] --> B[结束]
\`\`\`

### 导出为图片

使用 Mermaid CLI 导出：

```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i KIRO_CLAUDE_DIAGRAMS.md -o output.png
```

---

**文档版本**: 1.0.0  
**最后更新**: 2025-02-07  
**维护者**: AIClient-2-API Team