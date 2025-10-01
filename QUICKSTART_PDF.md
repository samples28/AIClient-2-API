# PDF 支持快速入门 / PDF Support Quick Start

[中文](#快速开始) | [English](#quick-start)

---

## 快速开始

### 🚀 5 分钟上手

#### 步骤 1: 准备 PDF 文件

```bash
# 将 PDF 转换为 base64
base64 -i your_document.pdf | tr -d '\n' > pdf_base64.txt
```

#### 步骤 2: 发送请求

```python
import base64
import requests

# 读取 PDF
with open('your_document.pdf', 'rb') as f:
    pdf_base64 = base64.b64encode(f.read()).decode('utf-8')

# 发送到 AIClient-2-API
response = requests.post(
    'http://localhost:3000/v1/chat/completions',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={
        'model': 'claude-sonnet-4',
        'messages': [{
            'role': 'user',
            'content': [
                {
                    'type': 'text',
                    'text': '请总结这份 PDF 的主要内容'
                },
                {
                    'type': 'document_url',
                    'document_url': {
                        'url': f'data:application/pdf;base64,{pdf_base64}'
                    }
                }
            ]
        }]
    }
)

print(response.json()['choices'][0]['message']['content'])
```

#### 步骤 3: 查看结果

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "这份 PDF 文档主要讨论了..."
    }
  }]
}
```

---

## 常见场景

### 场景 1: 分析本地 PDF 文件

```javascript
const fs = require('fs');
const fetch = require('node-fetch');

const pdfBase64 = fs.readFileSync('report.pdf').toString('base64');

const response = await fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: '提取这份报告的关键数据' },
        {
          type: 'document_url',
          document_url: {
            url: `data:application/pdf;base64,${pdfBase64}`
          }
        }
      ]
    }]
  })
});
```

### 场景 2: 使用在线 PDF URL

```python
response = requests.post(
    'http://localhost:3000/v1/chat/completions',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={
        'model': 'claude-sonnet-4',
        'messages': [{
            'role': 'user',
            'content': [
                {
                    'type': 'text',
                    'text': '分析这份在线文档'
                },
                {
                    'type': 'document_url',
                    'document_url': {
                        'url': 'https://example.com/report.pdf'
                    }
                }
            ]
        }]
    }
)
```

### 场景 3: 混合图片和 PDF

```python
response = requests.post(
    'http://localhost:3000/v1/chat/completions',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={
        'model': 'claude-sonnet-4',
        'messages': [{
            'role': 'user',
            'content': [
                {
                    'type': 'text',
                    'text': '对比这张图表和 PDF 中的数据'
                },
                {
                    'type': 'image_url',
                    'image_url': {
                        'url': f'data:image/jpeg;base64,{image_base64}'
                    }
                },
                {
                    'type': 'document_url',
                    'document_url': {
                        'url': f'data:application/pdf;base64,{pdf_base64}'
                    }
                }
            ]
        }]
    }
)
```

### 场景 4: 批量处理多个 PDF

```python
import os
import base64

pdf_files = ['doc1.pdf', 'doc2.pdf', 'doc3.pdf']
results = []

for pdf_file in pdf_files:
    with open(pdf_file, 'rb') as f:
        pdf_base64 = base64.b64encode(f.read()).decode('utf-8')
    
    response = requests.post(
        'http://localhost:3000/v1/chat/completions',
        headers={'Authorization': 'Bearer YOUR_API_KEY'},
        json={
            'model': 'claude-sonnet-4',
            'messages': [{
                'role': 'user',
                'content': [
                    {
                        'type': 'text',
                        'text': f'总结 {pdf_file} 的主要内容'
                    },
                    {
                        'type': 'document_url',
                        'document_url': {
                            'url': f'data:application/pdf;base64,{pdf_base64}'
                        }
                    }
                ]
            }]
        }
    )
    
    results.append({
        'file': pdf_file,
        'summary': response.json()['choices'][0]['message']['content']
    })

for result in results:
    print(f"\n{result['file']}:")
    print(result['summary'])
```

---

## 支持的模型

| 模型 | PDF 支持 | 推荐度 |
|------|---------|--------|
| claude-sonnet-4 | ✅ 原生支持 | ⭐⭐⭐⭐⭐ |
| claude-sonnet-4.5 | ✅ 原生支持 | ⭐⭐⭐⭐⭐ |
| claude-opus-4 | ✅ 原生支持 | ⭐⭐⭐⭐⭐ |
| gemini-pro | ✅ 支持 | ⭐⭐⭐⭐ |
| gpt-4-vision | ⚠️ 有限支持 | ⭐⭐⭐ |

---

## 快速故障排除

### ❌ 错误: "File too large"

**原因**: PDF 文件超过大小限制

**解决方案**:
```python
# 方案 1: 压缩 PDF
# 使用 ghostscript 或在线工具压缩

# 方案 2: 拆分 PDF
from PyPDF2 import PdfReader, PdfWriter

reader = PdfReader('large.pdf')
for i in range(0, len(reader.pages), 50):
    writer = PdfWriter()
    for page in reader.pages[i:i+50]:
        writer.add_page(page)
    with open(f'part_{i//50}.pdf', 'wb') as f:
        writer.write(f)

# 方案 3: 使用 URL 而非 base64
```

### ❌ 错误: "Invalid base64"

**原因**: Base64 编码不正确

**解决方案**:
```python
# 正确的编码方式
with open('document.pdf', 'rb') as f:
    pdf_base64 = base64.b64encode(f.read()).decode('utf-8')

# 确保没有换行符
pdf_base64 = pdf_base64.replace('\n', '').replace('\r', '')
```

### ❌ 错误: "Model does not support documents"

**原因**: 选择的模型不支持文档

**解决方案**:
```python
# 改用支持文档的模型
'model': 'claude-sonnet-4'  # ✅ 支持
# 而不是
'model': 'gpt-3.5-turbo'    # ❌ 不支持
```

---

## 最佳实践

### ✅ DO

- ✅ 使用 Claude Sonnet 4/4.5 获得最佳 PDF 支持
- ✅ 大文件（>5MB）优先使用 URL 引用
- ✅ 在提示词中明确说明需要分析的内容
- ✅ 使用 prompt caching 处理重复查询
- ✅ 检查 PDF 文件是否完整且未加密

### ❌ DON'T

- ❌ 不要上传加密的 PDF
- ❌ 不要上传超过 100 页的 PDF（Claude 限制）
- ❌ 不要在 base64 字符串中包含换行符
- ❌ 不要忘记设置正确的 MIME type
- ❌ 不要对每个小查询都重新上传文档

---

## Quick Start

### 🚀 Get Started in 5 Minutes

#### Step 1: Prepare PDF File

```bash
# Convert PDF to base64
base64 -i your_document.pdf | tr -d '\n' > pdf_base64.txt
```

#### Step 2: Send Request

```python
import base64
import requests

# Read PDF
with open('your_document.pdf', 'rb') as f:
    pdf_base64 = base64.b64encode(f.read()).decode('utf-8')

# Send to AIClient-2-API
response = requests.post(
    'http://localhost:3000/v1/chat/completions',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={
        'model': 'claude-sonnet-4',
        'messages': [{
            'role': 'user',
            'content': [
                {
                    'type': 'text',
                    'text': 'Please summarize the main content of this PDF'
                },
                {
                    'type': 'document_url',
                    'document_url': {
                        'url': f'data:application/pdf;base64,{pdf_base64}'
                    }
                }
            ]
        }]
    }
)

print(response.json()['choices'][0]['message']['content'])
```

---

## Common Use Cases

### Use Case 1: Analyze Local PDF

```javascript
const fs = require('fs');

const pdfBase64 = fs.readFileSync('report.pdf').toString('base64');

fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Extract key data from this report' },
        {
          type: 'document_url',
          document_url: {
            url: `data:application/pdf;base64,${pdfBase64}`
          }
        }
      ]
    }]
  })
});
```

### Use Case 2: Use Online PDF URL

```python
response = requests.post(
    'http://localhost:3000/v1/chat/completions',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={
        'model': 'claude-sonnet-4',
        'messages': [{
            'role': 'user',
            'content': [
                {
                    'type': 'text',
                    'text': 'Analyze this online document'
                },
                {
                    'type': 'document_url',
                    'document_url': {
                        'url': 'https://example.com/report.pdf'
                    }
                }
            ]
        }]
    }
)
```

---

## Troubleshooting

### ❌ Error: "File too large"

**Cause**: PDF file exceeds size limit

**Solution**:
- Compress PDF using ghostscript or online tools
- Split PDF into smaller parts
- Use URL reference instead of base64

### ❌ Error: "Invalid base64"

**Cause**: Incorrect base64 encoding

**Solution**:
```python
# Correct encoding method
with open('document.pdf', 'rb') as f:
    pdf_base64 = base64.b64encode(f.read()).decode('utf-8')

# Remove any newlines
pdf_base64 = pdf_base64.replace('\n', '').replace('\r', '')
```

---

## Need Help?

- 📖 Full Documentation: [PDF_MULTIMODAL_SUPPORT.md](./PDF_MULTIMODAL_SUPPORT.md)
- 🧪 Test Examples: [tests/test-pdf-support.js](./tests/test-pdf-support.js)
- 📋 Main README: [README.md](./README.md)
- 🐛 Report Issues: GitHub Issues

---

**Last Updated**: 2025-01-XX  
**Version**: v1.1.0