# PDF 与多模态文档支持 / PDF and Multimodal Document Support

[中文](#中文文档) | [English](#english-documentation)

---

## 中文文档

### 📄 概述

AIClient-2-API 现已全面支持 PDF 和其他文档格式的多模态处理，允许您在与 AI 模型交互时上传和分析文档内容。本功能支持在不同 API 格式（OpenAI、Claude、Gemini）之间无缝转换文档数据。

### ✨ 主要特性

- ✅ **PDF 文档支持**：处理 PDF 文件的文本和视觉内容
- ✅ **多种文档格式**：支持 PDF、Word、Excel 等多种文档类型
- ✅ **Base64 编码**：支持直接通过 base64 编码传输文档
- ✅ **URL 引用**：支持通过 URL 引用在线文档
- ✅ **混合内容**：可在同一请求中混合文本、图片和文档
- ✅ **格式转换**：在 OpenAI、Claude、Gemini 格式间自动转换
- ✅ **多文档处理**：单个请求可包含多个文档

### 🎯 支持的文档类型

| 文档类型 | MIME Type | 说明 |
|---------|-----------|------|
| PDF | `application/pdf` | Adobe PDF 文档 |
| Word | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Microsoft Word (.docx) |
| Excel | `application/vnd.ms-excel` | Microsoft Excel |
| Plain Text | `text/plain` | 纯文本文档 |

### 📋 API 格式规范

#### OpenAI 格式

在 OpenAI 兼容格式中，使用 `document_url` 类型传递文档：

```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "请分析这份 PDF 文档的内容"
        },
        {
          "type": "document_url",
          "document_url": {
            "url": "data:application/pdf;base64,JVBERi0xLjQK..."
          }
        }
      ]
    }
  ]
}
```

**替代格式（也支持）：**

```json
{
  "type": "document",
  "document": {
    "url": "data:application/pdf;base64,..."
  }
}
```

#### Claude 格式

Claude API 原生支持文档类型：

```json
{
  "model": "claude-3-opus-20240229",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "总结这份文档的要点"
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
  ]
}
```

**URL 方式：**

```json
{
  "type": "document",
  "source": {
    "type": "url",
    "url": "https://example.com/document.pdf"
  }
}
```

#### Gemini 格式

Gemini 使用 `inlineData` 或 `fileData` 处理文档：

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "分析这个文档"
        },
        {
          "inlineData": {
            "mimeType": "application/pdf",
            "data": "JVBERi0xLjQK..."
          }
        }
      ]
    }
  ]
}
```

**URL 方式：**

```json
{
  "fileData": {
    "mimeType": "application/pdf",
    "fileUri": "https://storage.googleapis.com/doc.pdf"
  }
}
```

### 💡 使用示例

#### 示例 1：上传本地 PDF 文件

```python
import base64
import requests

# 读取并编码 PDF 文件
with open('report.pdf', 'rb') as f:
    pdf_data = base64.b64encode(f.read()).decode('utf-8')

# 构建请求
response = requests.post('http://localhost:3000/v1/chat/completions', 
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={
        'model': 'claude-sonnet-4',
        'messages': [
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'text',
                        'text': '请总结这份 PDF 报告的主要内容'
                    },
                    {
                        'type': 'document_url',
                        'document_url': {
                            'url': f'data:application/pdf;base64,{pdf_data}'
                        }
                    }
                ]
            }
        ]
    }
)

print(response.json()['choices'][0]['message']['content'])
```

#### 示例 2：使用 URL 引用文档

```javascript
const response = await fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '请分析这份在线文档'
          },
          {
            type: 'document_url',
            document_url: {
              url: 'https://example.com/quarterly-report.pdf'
            }
          }
        ]
      }
    ]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

#### 示例 3：混合多种内容类型

```python
response = requests.post('http://localhost:3000/v1/chat/completions',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={
        'model': 'claude-sonnet-4',
        'messages': [
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'text',
                        'text': '请对比这张图表和PDF文档中的数据'
                    },
                    {
                        'type': 'image_url',
                        'image_url': {
                            'url': 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
                        }
                    },
                    {
                        'type': 'document_url',
                        'document_url': {
                            'url': 'data:application/pdf;base64,JVBERi0x...'
                        }
                    }
                ]
            }
        ]
    }
)
```

### 🔄 格式转换

AIClient-2-API 会自动在不同格式之间转换文档内容：

| 转换方向 | 支持状态 | 说明 |
|---------|---------|------|
| OpenAI → Claude | ✅ 完全支持 | 自动转换为 Claude document 格式 |
| Claude → OpenAI | ✅ 完全支持 | 转换为 OpenAI document_url 格式 |
| OpenAI → Gemini | ✅ 完全支持 | 转换为 Gemini inlineData/fileData |
| Gemini → OpenAI | ⚠️ 有限支持 | 视觉内容转为 image_url |
| Claude → Gemini | ⚠️ 有限支持 | 文档作为 inlineData 处理 |
| Gemini → Claude | ⚠️ 有限支持 | inlineData 转为图片格式 |

### 📊 提供商支持情况

| 提供商 | PDF 支持 | 文档类型 | 最大文件大小 | 备注 |
|-------|---------|---------|-------------|------|
| Claude (Anthropic) | ✅ 原生支持 | PDF, Word, Excel | 32MB | 最多 100 页 |
| OpenAI GPT-4V | ⚠️ 间接支持 | 需转换为图片 | 20MB | 通过视觉理解 |
| Gemini | ✅ 支持 | PDF, 多种格式 | 视型号而定 | 使用 File API |
| Kiro (Claude) | ✅ 支持 | 同 Claude | 同 Claude | 代理 Claude API |

### 🛠️ 配置要求

无需额外配置！PDF 和文档支持已内置在转换层中，会自动处理。

### ⚠️ 注意事项

1. **文件大小限制**：
   - Base64 编码会增加约 33% 的数据大小
   - 建议大文件使用 URL 引用方式
   - 注意各提供商的大小限制

2. **页数限制**：
   - Claude: 最多 100 页
   - 超过限制的文档可能被截断

3. **性能考虑**：
   - 大型文档会增加 token 消耗
   - 使用 prompt caching 优化重复查询

4. **URL 访问**：
   - URL 引用的文档必须公开可访问
   - 或者提供商能够访问的内网地址

### 🐛 故障排除

#### 问题：文档内容无法识别

**解决方案**：
- 检查 base64 编码是否正确
- 确认 MIME type 设置正确
- 验证 PDF 文件未加密或损坏

#### 问题：请求失败 "payload too large"

**解决方案**：
- 减小文档大小或拆分文档
- 使用 URL 引用代替 base64 编码
- 压缩 PDF 文件

#### 问题：部分提供商不支持文档

**解决方案**：
- 检查提供商兼容性表
- 使用支持文档的模型（如 Claude Sonnet 4）
- 考虑先提取文档文本再发送

### 📝 最佳实践

1. **优先使用 URL 引用**：对于大型文档，URL 比 base64 更高效
2. **明确说明需求**：在提示词中清楚说明需要分析文档的哪些部分
3. **合理使用缓存**：重复查询同一文档时使用 prompt caching
4. **分段处理**：超大文档考虑分段处理
5. **格式预检**：确保文档格式完整，避免损坏文件

---

## English Documentation

### 📄 Overview

AIClient-2-API now fully supports multimodal processing of PDFs and other document formats, allowing you to upload and analyze document content when interacting with AI models. This feature supports seamless conversion of document data between different API formats (OpenAI, Claude, Gemini).

### ✨ Key Features

- ✅ **PDF Document Support**: Process text and visual content from PDF files
- ✅ **Multiple Document Formats**: Support for PDF, Word, Excel, and more
- ✅ **Base64 Encoding**: Direct document transmission via base64 encoding
- ✅ **URL References**: Support for referencing online documents via URL
- ✅ **Mixed Content**: Combine text, images, and documents in a single request
- ✅ **Format Conversion**: Automatic conversion between OpenAI, Claude, and Gemini formats
- ✅ **Multiple Documents**: Include multiple documents in a single request

### 🎯 Supported Document Types

| Document Type | MIME Type | Description |
|--------------|-----------|-------------|
| PDF | `application/pdf` | Adobe PDF documents |
| Word | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Microsoft Word (.docx) |
| Excel | `application/vnd.ms-excel` | Microsoft Excel |
| Plain Text | `text/plain` | Plain text documents |

### 📋 API Format Specifications

#### OpenAI Format

In OpenAI-compatible format, use the `document_url` type to pass documents:

```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Please analyze the content of this PDF document"
        },
        {
          "type": "document_url",
          "document_url": {
            "url": "data:application/pdf;base64,JVBERi0xLjQK..."
          }
        }
      ]
    }
  ]
}
```

#### Claude Format

Claude API has native document type support:

```json
{
  "model": "claude-3-opus-20240229",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Summarize the key points of this document"
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
  ]
}
```

#### Gemini Format

Gemini uses `inlineData` or `fileData` to handle documents:

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Analyze this document"
        },
        {
          "inlineData": {
            "mimeType": "application/pdf",
            "data": "JVBERi0xLjQK..."
          }
        }
      ]
    }
  ]
}
```

### 💡 Usage Examples

#### Example 1: Upload Local PDF File

```python
import base64
import requests

# Read and encode PDF file
with open('report.pdf', 'rb') as f:
    pdf_data = base64.b64encode(f.read()).decode('utf-8')

# Build request
response = requests.post('http://localhost:3000/v1/chat/completions', 
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={
        'model': 'claude-sonnet-4',
        'messages': [
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'text',
                        'text': 'Please summarize the main content of this PDF report'
                    },
                    {
                        'type': 'document_url',
                        'document_url': {
                            'url': f'data:application/pdf;base64,{pdf_data}'
                        }
                    }
                ]
            }
        ]
    }
)

print(response.json()['choices'][0]['message']['content'])
```

### 🔄 Format Conversion

AIClient-2-API automatically converts document content between different formats:

| Conversion Direction | Support Status | Notes |
|---------------------|----------------|-------|
| OpenAI → Claude | ✅ Full Support | Auto-converts to Claude document format |
| Claude → OpenAI | ✅ Full Support | Converts to OpenAI document_url format |
| OpenAI → Gemini | ✅ Full Support | Converts to Gemini inlineData/fileData |
| Gemini → OpenAI | ⚠️ Limited | Visual content as image_url |
| Claude → Gemini | ⚠️ Limited | Documents as inlineData |
| Gemini → Claude | ⚠️ Limited | inlineData as image format |

### 📊 Provider Support Matrix

| Provider | PDF Support | Document Types | Max File Size | Notes |
|----------|-------------|----------------|---------------|-------|
| Claude (Anthropic) | ✅ Native | PDF, Word, Excel | 32MB | Max 100 pages |
| OpenAI GPT-4V | ⚠️ Indirect | Via image conversion | 20MB | Through vision |
| Gemini | ✅ Supported | PDF, various formats | Model-dependent | Via File API |
| Kiro (Claude) | ✅ Supported | Same as Claude | Same as Claude | Proxies Claude API |

### 🛠️ Configuration

No additional configuration required! PDF and document support is built into the conversion layer and handles everything automatically.

### ⚠️ Important Notes

1. **File Size Limits**:
   - Base64 encoding increases data size by ~33%
   - Use URL references for large files
   - Note provider-specific size limits

2. **Page Limits**:
   - Claude: Max 100 pages
   - Documents exceeding limits may be truncated

3. **Performance Considerations**:
   - Large documents increase token consumption
   - Use prompt caching for repeated queries

4. **URL Access**:
   - URL-referenced documents must be publicly accessible
   - Or accessible on provider's network

### 📝 Best Practices

1. **Prefer URL References**: For large documents, URLs are more efficient than base64
2. **Clear Instructions**: Specify which parts of the document need analysis
3. **Use Caching**: Leverage prompt caching for repeated queries on the same document
4. **Split Large Documents**: Consider segmenting very large documents
5. **Format Validation**: Ensure document format is intact and not corrupted

---

## 更新日志 / Changelog

### v1.1.0 (2025-01-XX)
- ✅ 新增完整的 PDF 和文档支持
- ✅ 支持 OpenAI ↔ Claude ↔ Gemini 文档格式转换
- ✅ 支持 base64 和 URL 两种文档传输方式
- ✅ 添加混合内容（文本+图片+文档）支持
- ✅ 完善文档类型 MIME type 处理

---

## 技术实现 / Technical Implementation

文档支持在 `src/convert.js` 中实现，主要涉及以下函数：

- `toClaudeRequestFromOpenAI()` - OpenAI → Claude 文档转换
- `toOpenAIRequestFromClaude()` - Claude → OpenAI 文档转换
- `toGeminiRequestFromOpenAI()` - OpenAI → Gemini 文档转换
- `processOpenAIContentToGeminiParts()` - 多模态内容处理
- `processClaudeContentToOpenAIContent()` - Claude 内容转换

详细实现请参考源代码。

---

## 贡献 / Contributing

欢迎提交 Issue 和 Pull Request 来改进文档支持功能！

## 许可 / License

遵循项目主许可协议 GPL v3