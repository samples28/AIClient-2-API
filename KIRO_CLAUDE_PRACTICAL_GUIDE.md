# Kiro Claude 实战指南

> 从零开始，快速上手 Kiro Claude，实现免费使用 Claude Sonnet 4 模型

---

## 📋 目录

- [快速开始](#快速开始)
- [前置准备](#前置准备)
- [安装步骤](#安装步骤)
- [配置指南](#配置指南)
- [实战案例](#实战案例)
- [客户端集成](#客户端集成)
- [常见问题](#常见问题)
- [故障排除](#故障排除)
- [性能优化](#性能优化)
- [安全建议](#安全建议)

---

## 快速开始

### 5 分钟快速体验

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/AIClient-2-API.git
cd AIClient-2-API

# 2. 安装依赖
npm install

# 3. 获取 Kiro 凭证（需要先安装 Kiro 客户端）
# 凭证文件会自动生成在 ~/.aws/sso/cache/kiro-auth-token.json

# 4. 配置项目
cp config.json config.json.backup
# 编辑 config.json，设置 MODEL_PROVIDER 为 "claude-kiro-oauth"

# 5. 启动服务
npm start

# 6. 测试调用
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 123456" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## 前置准备

### 系统要求

- **操作系统**: macOS, Linux, Windows
- **Node.js**: >= 20.0.0
- **内存**: 至少 512MB
- **网络**: 能够访问 AWS 服务

### 必需工具

1. **Kiro 客户端**
   - 下载地址: https://aibook.ren/archives/kiro-install
   - 用途: 生成认证凭证
   - 注意: 目前 Kiro 服务政策可能调整，请关注官方公告

2. **Node.js 和 npm**
   ```bash
   # 检查版本
   node --version  # 应该 >= 20.0.0
   npm --version
   ```

3. **Git** (可选，用于克隆项目)
   ```bash
   git --version
   ```

---

## 安装步骤

### 步骤 1: 安装 Kiro 客户端

#### macOS

```bash
# 下载安装包
curl -L https://kiro-install-url/kiro-macos.dmg -o kiro.dmg

# 安装
open kiro.dmg
# 拖拽 Kiro.app 到 Applications 文件夹
```

#### Windows

```bash
# 下载安装包
# 访问 https://aibook.ren/archives/kiro-install
# 下载 kiro-windows-setup.exe

# 运行安装程序
.\kiro-windows-setup.exe
```

#### Linux

```bash
# 下载 AppImage
curl -L https://kiro-install-url/kiro-linux.AppImage -o kiro.AppImage

# 添加执行权限
chmod +x kiro.AppImage

# 运行
./kiro.AppImage
```

### 步骤 2: 登录 Kiro 客户端

1. 启动 Kiro 应用
2. 点击 "Sign In" 或 "登录"
3. 选择登录方式:
   - **Social Login** (推荐): 使用 Google/GitHub 账号
   - **IDC Login**: 使用企业凭证
4. 完成授权流程
5. 确认登录成功

### 步骤 3: 验证凭证文件

登录成功后，Kiro 会自动生成凭证文件：

```bash
# macOS/Linux
ls -la ~/.aws/sso/cache/

# 应该能看到类似这样的文件:
# kiro-auth-token.json
# a1b2c3d4e5f6.json (其他凭证文件)

# 查看文件内容 (示例)
cat ~/.aws/sso/cache/kiro-auth-token.json
```

凭证文件格式:
```json
{
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHk...",
  "expiresAt": "2025-02-07T12:00:00.000Z",
  "region": "us-east-1",
  "profileArn": "arn:aws:iam::123456789012:...",
  "clientId": "client-id-here",
  "clientSecret": "client-secret-here",
  "authMethod": "social"
}
```

### 步骤 4: 安装 AIClient-2-API

```bash
# 克隆项目
git clone https://github.com/yourusername/AIClient-2-API.git
cd AIClient-2-API

# 安装依赖
npm install

# 验证安装
npm run test
```

---

## 配置指南

### 配置文件: `config.json`

#### 最小配置 (推荐新手)

```json
{
  "REQUIRED_API_KEY": "your-secret-key-here",
  "SERVER_PORT": 3000,
  "HOST": "localhost",
  "MODEL_PROVIDER": "claude-kiro-oauth"
}
```

这个配置会自动从默认位置 `~/.aws/sso/cache/` 加载凭证。

#### 完整配置 (推荐生产环境)

```json
{
  "REQUIRED_API_KEY": "your-secret-key-here",
  "SERVER_PORT": 3000,
  "HOST": "0.0.0.0",
  "MODEL_PROVIDER": "claude-kiro-oauth",
  
  "KIRO_OAUTH_CREDS_FILE_PATH": "/Users/username/.aws/sso/cache/kiro-auth-token.json",
  "KIRO_OAUTH_CREDS_DIR_PATH": null,
  "KIRO_OAUTH_CREDS_BASE64": null,
  
  "REQUEST_MAX_RETRIES": 3,
  "REQUEST_BASE_DELAY": 1000,
  "CRON_NEAR_MINUTES": 15,
  "CRON_REFRESH_TOKEN": true,
  
  "SYSTEM_PROMPT_FILE_PATH": "input_system_prompt.txt",
  "SYSTEM_PROMPT_MODE": "overwrite",
  "PROMPT_LOG_MODE": "none",
  
  "PROVIDER_POOLS_FILE_PATH": null
}
```

### 配置选项详解

| 选项 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `REQUIRED_API_KEY` | API 访问密钥 | 无 | `"123456"` |
| `SERVER_PORT` | 服务端口 | `3000` | `3000` |
| `HOST` | 监听地址 | `"localhost"` | `"0.0.0.0"` |
| `MODEL_PROVIDER` | 模型提供商 | 无 | `"claude-kiro-oauth"` |
| `KIRO_OAUTH_CREDS_FILE_PATH` | 凭证文件路径 | `null` | `"/path/to/token.json"` |
| `KIRO_OAUTH_CREDS_BASE64` | Base64 编码凭证 | `null` | `"eyJ...=="` |
| `REQUEST_MAX_RETRIES` | 最大重试次数 | `3` | `3` |
| `REQUEST_BASE_DELAY` | 重试基础延迟(ms) | `1000` | `1000` |
| `CRON_NEAR_MINUTES` | Token 提前刷新时间 | `15` | `15` |
| `CRON_REFRESH_TOKEN` | 启用定时刷新 | `true` | `true` |

### Docker 部署配置

#### 使用 Base64 环境变量 (推荐)

```bash
# 1. 将凭证转换为 Base64
KIRO_CREDS_BASE64=$(cat ~/.aws/sso/cache/kiro-auth-token.json | base64)

# 2. 启动容器
docker run -d \
  -p 3000:3000 \
  -e MODEL_PROVIDER=claude-kiro-oauth \
  -e KIRO_OAUTH_CREDS_BASE64="$KIRO_CREDS_BASE64" \
  -e REQUIRED_API_KEY=your-secret-key \
  aiclient-2-api:latest
```

#### 使用卷挂载

```bash
docker run -d \
  -p 3000:3000 \
  -v ~/.aws/sso/cache:/root/.aws/sso/cache:ro \
  -e MODEL_PROVIDER=claude-kiro-oauth \
  -e REQUIRED_API_KEY=your-secret-key \
  aiclient-2-api:latest
```

---

## 实战案例

### 案例 1: 基本对话

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 123456" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {"role": "user", "content": "用中文介绍一下你自己"}
    ]
  }'
```

响应示例:
```json
{
  "id": "msg_01abc123",
  "type": "message",
  "role": "assistant",
  "model": "claude-sonnet-4-20250514",
  "content": [
    {
      "type": "text",
      "text": "你好！我是 Claude，一个由 Anthropic 开发的 AI 助手..."
    }
  ],
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 0,
    "output_tokens": 50
  }
}
```

### 案例 2: 流式对话

```bash
curl -N http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 123456" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {"role": "user", "content": "写一首关于春天的诗"}
    ],
    "stream": true
  }'
```

响应示例 (SSE 格式):
```
data: {"type":"message_start","message":{"id":"msg_01abc","role":"assistant"}}

data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"春"}}

data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"风"}}

...

data: {"type":"message_stop"}
```

### 案例 3: 多轮对话

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 123456" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {"role": "user", "content": "我叫张三"},
      {"role": "assistant", "content": "你好，张三！很高兴认识你。"},
      {"role": "user", "content": "我叫什么名字？"}
    ]
  }'
```

### 案例 4: 工具调用 (Function Calling)

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 123456" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {"role": "user", "content": "北京今天天气怎么样？"}
    ],
    "tools": [
      {
        "name": "get_weather",
        "description": "获取指定城市的天气信息",
        "input_schema": {
          "type": "object",
          "properties": {
            "city": {
              "type": "string",
              "description": "城市名称"
            },
            "unit": {
              "type": "string",
              "enum": ["celsius", "fahrenheit"],
              "description": "温度单位"
            }
          },
          "required": ["city"]
        }
      }
    ]
  }'
```

响应 (包含工具调用):
```json
{
  "id": "msg_01abc",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01xyz",
      "name": "get_weather",
      "input": {
        "city": "北京",
        "unit": "celsius"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

返回工具结果:
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 123456" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {"role": "user", "content": "北京今天天气怎么样？"},
      {
        "role": "assistant",
        "content": [
          {
            "type": "tool_use",
            "id": "toolu_01xyz",
            "name": "get_weather",
            "input": {"city": "北京", "unit": "celsius"}
          }
        ]
      },
      {
        "role": "user",
        "content": [
          {
            "type": "tool_result",
            "tool_use_id": "toolu_01xyz",
            "content": "北京今天晴天，温度25°C，湿度60%"
          }
        ]
      }
    ],
    "tools": [...]
  }'
```

### 案例 5: 图片理解

```bash
# 先将图片转为 Base64
IMAGE_BASE64=$(base64 -i image.jpg)

curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 123456" \
  -d "{
    \"model\": \"claude-sonnet-4-20250514\",
    \"messages\": [
      {
        \"role\": \"user\",
        \"content\": [
          {
            \"type\": \"text\",
            \"text\": \"这张图片里有什么？\"
          },
          {
            \"type\": \"image\",
            \"source\": {
              \"type\": \"base64\",
              \"media_type\": \"image/jpeg\",
              \"data\": \"$IMAGE_BASE64\"
            }
          }
        ]
      }
    ]
  }"
```

### 案例 6: PDF 文档分析

```bash
# 先将 PDF 转为 Base64
PDF_BASE64=$(base64 -i document.pdf)

curl http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 123456" \
  -H "anthropic-version: 2023-06-01" \
  -d "{
    \"model\": \"claude-sonnet-4-20250514\",
    \"messages\": [
      {
        \"role\": \"user\",
        \"content\": [
          {
            \"type\": \"document\",
            \"source\": {
              \"type\": \"base64\",
              \"media_type\": \"application/pdf\",
              \"data\": \"$PDF_BASE64\"
            }
          },
          {
            \"type\": \"text\",
            \"text\": \"请总结这份 PDF 文档的主要内容\"
          }
        ]
      }
    ]
  }"
```

---

## 客户端集成

### 1. Cline (VSCode Extension)

#### 安装
```bash
# 在 VSCode 中搜索并安装 "Cline" 扩展
```

#### 配置
```json
// settings.json
{
  "cline.anthropicApiKey": "123456",
  "cline.anthropicBaseUrl": "http://localhost:3000/claude-kiro-oauth"
}
```

#### 使用
1. 打开 VSCode
2. 按 `Cmd+Shift+P` (macOS) 或 `Ctrl+Shift+P` (Windows/Linux)
3. 输入 "Cline: New Chat"
4. 开始与 Claude Sonnet 4 对话

### 2. Cursor

#### 配置
```json
// Cursor Settings → Advanced → API Configuration
{
  "models": [
    {
      "name": "Claude Sonnet 4 (Kiro)",
      "provider": "anthropic",
      "apiKey": "123456",
      "baseUrl": "http://localhost:3000/claude-kiro-oauth"
    }
  ]
}
```

### 3. LobeChat

#### Docker 部署
```bash
docker run -d \
  -p 3210:3210 \
  -e OPENAI_API_KEY=123456 \
  -e OPENAI_PROXY_URL=http://host.docker.internal:3000/v1 \
  -e ACCESS_CODE=your-access-code \
  lobehub/lobe-chat:latest
```

#### 配置
1. 访问 http://localhost:3210
2. 进入设置 → 模型提供商
3. 添加自定义提供商:
   - 名称: Kiro Claude
   - API Key: 123456
   - API Endpoint: http://localhost:3000/v1
4. 在模型列表中选择 `claude-sonnet-4-20250514`

### 4. NextChat

#### 安装
```bash
# 克隆项目
git clone https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web.git
cd ChatGPT-Next-Web

# 配置环境变量
cat > .env.local << EOF
OPENAI_API_KEY=123456
BASE_URL=http://localhost:3000/v1
EOF

# 启动
npm install
npm run dev
```

### 5. OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    api_key="123456",
    base_url="http://localhost:3000/v1"
)

response = client.chat.completions.create(
    model="claude-sonnet-4-20250514",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### 6. OpenAI SDK (Node.js)

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '123456',
  baseURL: 'http://localhost:3000/v1'
});

async function main() {
  const response = await client.chat.completions.create({
    model: 'claude-sonnet-4-20250514',
    messages: [
      { role: 'user', content: 'Hello!' }
    ]
  });
  
  console.log(response.choices[0].message.content);
}

main();
```

---

## 常见问题

### Q1: 如何获取 Kiro 凭证？

**A:** 
1. 下载并安装 Kiro 客户端
2. 使用 Google/GitHub 账号登录
3. 凭证会自动保存到 `~/.aws/sso/cache/kiro-auth-token.json`

### Q2: Token 多久会过期？

**A:** 通常 1 小时。服务会自动在过期前 15 分钟刷新 Token。

### Q3: 支持哪些模型？

**A:** 
- `claude-sonnet-4-20250514` (推荐)
- `claude-3-7-sonnet-20250219`
- `amazonq-claude-sonnet-4-20250514`
- `amazonq-claude-3-7-sonnet-20250219`

### Q4: 是否支持真正的流式响应？

**A:** Kiro API 本身不支持真正的流式，但本项目实现了"伪流式"，客户端体验与真实流式一致。

### Q5: 工具调用是否稳定？

**A:** 是的。项目实现了多种工具调用格式的解析，包括结构化 JSON 和括号式标记。

### Q6: 如何处理速率限制？

**A:** 
- 配置多个账号（账号池）
- 增加 `REQUEST_MAX_RETRIES`
- 使用指数退避策略

### Q7: Docker 部署如何传递凭证？

**A:** 推荐使用 Base64 环境变量:
```bash
KIRO_CREDS_BASE64=$(cat kiro-auth-token.json | base64)
docker run -e KIRO_OAUTH_CREDS_BASE64="$KIRO_CREDS_BASE64" ...
```

### Q8: 可以同时使用多个模型提供商吗？

**A:** 可以。通过不同的路由路径:
- `/claude-kiro-oauth` - Kiro
- `/claude-custom` - 官方 Claude API
- `/gemini-cli-oauth` - Gemini
- `/openai-custom` - OpenAI

### Q9: 支持多模态输入吗？

**A:** 支持。可以传递文本、图片 (Base64)、PDF 文档等。

### Q10: 如何监控服务状态？

**A:** 
```bash
# 健康检查
curl http://localhost:3000/health

# 模型列表
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer 123456"
```

---

## 故障排除

### 问题 1: 403 Forbidden 错误

**症状:**
```json
{"error": {"message": "Forbidden", "type": "authorization_error"}}
```

**原因:**
- Token 已过期
- Token 无效
- 未正确登录 Kiro 客户端

**解决方案:**
```bash
# 1. 重新登录 Kiro 客户端
# 2. 检查凭证文件
cat ~/.aws/sso/cache/kiro-auth-token.json

# 3. 手动刷新 Token（重启服务）
npm restart

# 4. 查看日志
tail -f logs/app.log | grep Kiro
```

### 问题 2: 429 Too Many Requests

**症状:**
```json
{"error": {"message": "Rate limit exceeded", "type": "rate_limit_error"}}
```

**原因:**
- 请求过于频繁
- 单账号额度用尽

**解决方案:**
```bash
# 1. 等待一段时间后重试

# 2. 配置多账号池
# 编辑 provider_pools.json
{
  "claude-kiro-oauth": {
    "accounts": [
      {"KIRO_OAUTH_CREDS_FILE_PATH": "/path/to/account1.json"},
      {"KIRO_OAUTH_CREDS_FILE_PATH": "/path/to/account2.json"}
    ]
  }
}

# 3. 增加重试配置
# 编辑 config.json
{
  "REQUEST_MAX_RETRIES": 5,
  "REQUEST_BASE_DELAY": 2000
}
```

### 问题 3: 工具调用未被识别

**症状:**
响应中没有 `tool_use` 块，只有文本。

**原因:**
- 工具定义格式不正确
- 模型未理解工具意图
- 解析器未捕获工具调用

**解决方案:**
```bash
# 1. 检查工具定义格式
# 确保符合 Claude 规范

# 2. 查看原始响应
# 编辑 config.json
{
  "PROMPT_LOG_MODE": "full"
}

# 3. 重启服务并测试
npm restart

# 4. 检查日志中的工具调用解析
grep "tool call" logs/app.log
```

### 问题 4: 流式响应中断

**症状:**
流式响应突然停止，没有收到完整内容。

**原因:**
- 网络超时
- 客户端超时
- 响应过长

**解决方案:**
```bash
# 1. 增加超时时间
# 编辑 config.json
{
  "AXIOS_TIMEOUT": 180000  # 3 分钟
}

# 2. 客户端也需要增加超时
# 例如在 curl 中:
curl --max-time 180 ...

# 3. 检查网络连接
ping codewhisperer.us-east-1.amazonaws.com
```

### 问题 5: 凭证文件找不到

**症状:**
```
[Kiro Auth] Credential file not found: /path/to/kiro-auth-token.json
```

**原因:**
- 路径配置错误
- 未登录 Kiro 客户端
- 文件被删除

**解决方案:**
```bash
# 1. 检查文件是否存在
ls -la ~/.aws/sso/cache/

# 2. 使用正确的路径
# macOS/Linux
"KIRO_OAUTH_CREDS_FILE_PATH": "/Users/username/.aws/sso/cache/kiro-auth-token.json"

# Windows
"KIRO_OAUTH_CREDS_FILE_PATH": "C:\\Users\\username\\.aws\\sso\\cache\\kiro-auth-token.json"

# 3. 或者使用默认目录扫描
"KIRO_OAUTH_CREDS_FILE_PATH": null,
"KIRO_OAUTH_CREDS_DIR_PATH": "/Users/username/.aws/sso/cache"
```

### 问题 6: Docker 容器无法访问凭证

**症状:**
```
[Kiro Auth] Could not read credential directory
```

**原因:**
- 卷挂载路径错误
- 权限不足

**解决方案:**
```bash
# 方法 1: 使用 Base64 环境变量（推荐）
KIRO_CREDS=$(cat ~/.aws/sso/cache/kiro-auth-token.json | base64)
docker run -e KIRO_OAUTH_CREDS_BASE64="$KIRO_CREDS" ...

# 方法 2: 正确挂载卷
docker run -v ~/.aws/sso/cache:/root/.aws/sso/cache:ro ...

# 方法 3: 复制到容器
docker cp ~/.aws/sso/cache/kiro-auth-token.json container_id:/app/
```

### 问题 7: 响应格式不兼容

**症状:**
客户端无法解析响应，报格式错误。

**原因:**
- 使用了错误的 API 端点
- 客户端期望不同的格式

**解决方案:**
```bash
# OpenAI 格式使用:
http://localhost:3000/v1/chat/completions

# Claude 格式使用:
http://localhost:3000/v1/messages

# 检查响应格式
curl -v http://localhost:3000/v1/chat/completions ... | jq
```

---

## 性能优化

### 1. 连接池配置

```javascript
// config.json
{
  "AXIOS_TIMEOUT": 120000,
  "REQUEST_MAX_RETRIES": 3,
  "REQUEST_BASE_DELAY": 1000
}
```

### 2. 启用缓存 (可选)

```javascript
// 自定义实现 Redis 缓存
import Redis from 'ioredis';

const redis = new Redis();

async function cachedRequest(key, ttl, fn) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const result = await fn();
  await redis.setex(key, ttl, JSON.stringify(result));
  return result;
}
```

### 3. 并发控制

```bash
# 使用 PM2 集群模式
npm install -g pm2

pm2 start src/api-server.js -i 4  # 4 个实例
```

### 4. 负载均衡

```nginx
# Nginx 配置
upstream aiclient_backend {
    least_conn;
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
}

server {
    listen 80;
    location / {
        proxy_pass http://aiclient_backend;
    }
}
```

### 5. 监控和指标

```javascript
// 添加 Prometheus 指标