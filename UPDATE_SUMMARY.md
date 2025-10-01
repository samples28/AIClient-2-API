# AIClient-2-API 多模态支持更新说明

**更新日期**: 2025-01-XX  
**版本**: v1.1.0  
**更新类型**: 功能增强

---

## 📋 更新概述 / Update Overview

本次更新全面增强了 AIClient-2-API 的多模态支持能力，特别是针对 **PDF 文档**和 **Claude 协议**的支持进行了重大改进。

This update comprehensively enhances AIClient-2-API's multimodal capabilities, with major improvements specifically for **PDF documents** and **Claude protocol** support.

---

## 🐛 解决的问题 / Issues Resolved

### 问题 1: PDF 文档不支持
**现象**: 项目对多模态支持有限，无法处理 PDF 等文档类型  
**原因**: `convert.js` 中的内容转换函数缺少对 `document` 类型的处理逻辑

### 问题 2: Claude Code 支持不完整  
**现象**: Claude 的 document content block 无法正确转换  
**原因**: 各转换函数中缺少对 Claude `document` 类型的识别和转换

---

## ✨ 新增功能 / New Features

### 1. 完整的 PDF 文档支持

#### OpenAI 格式支持
```json
{
  "type": "document_url",
  "document_url": {
    "url": "data:application/pdf;base64,..."
  }
}
```

#### Claude 格式支持
```json
{
  "type": "document",
  "source": {
    "type": "base64",
    "media_type": "application/pdf",
    "data": "..."
  }
}
```

#### Gemini 格式支持
```json
{
  "inlineData": {
    "mimeType": "application/pdf",
    "data": "..."
  }
}
```

### 2. 多种文档类型支持

- ✅ PDF (`application/pdf`)
- ✅ Word 文档 (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
- ✅ Excel 表格 (`application/vnd.ms-excel`)
- ✅ 纯文本 (`text/plain`)

### 3. 灵活的传输方式

- ✅ **Base64 编码**: 直接在请求中嵌入文档内容
- ✅ **URL 引用**: 通过 URL 引用在线或本地可访问的文档
- ✅ **混合内容**: 在同一消息中结合文本、图片和文档

### 4. 完善的格式转换

| 转换方向 | 支持状态 |
|---------|---------|
| OpenAI → Claude | ✅ 完全支持 |
| Claude → OpenAI | ✅ 完全支持 |
| OpenAI → Gemini | ✅ 完全支持 |
| Claude → Gemini | ⚠️ 部分支持 |
| Gemini → OpenAI | ⚠️ 部分支持 |
| Gemini → Claude | ⚠️ 部分支持 |

---

## 🔧 技术改进 / Technical Improvements

### 修改的文件

#### `src/convert.js`
**改进内容**:
1. ✅ `toClaudeRequestFromOpenAI()` - 新增 document/document_url 类型处理
2. ✅ `processClaudeContentToOpenAIContent()` - 新增 Claude document 块转换
3. ✅ `processOpenAIContentToGeminiParts()` - 新增文档到 Gemini 格式转换
4. ✅ 完善 MIME type 识别和处理
5. ✅ 支持 base64 数据和 URL 两种传输方式
6. ✅ 改进空值和边界情况处理

**关键代码片段**:
```javascript
case "document":
case "document_url":
  if (item.document || item.document_url) {
    const documentUrl = item.document_url
      ? typeof item.document_url === "string"
        ? item.document_url
        : item.document_url.url
      : typeof item.document === "string"
        ? item.document
        : item.document.url;

    if (documentUrl && documentUrl.startsWith("data:")) {
      // Base64 处理
      const [header, data] = documentUrl.split(",");
      const mediaType = header.match(/data:([^;]+)/)?.[1] || "application/pdf";
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: mediaType,
          data: data,
        },
      });
    } else if (documentUrl) {
      // URL 处理
      content.push({
        type: "document",
        source: {
          type: "url",
          url: documentUrl,
        },
      });
    }
  }
  break;
```

### 新增的文件

#### `tests/test-pdf-support.js`
- ✅ 484 行全面测试代码
- ✅ 覆盖所有转换场景
- ✅ 包含边界情况测试
- ✅ 往返转换验证

#### `PDF_MULTIMODAL_SUPPORT.md`
- ✅ 570 行详细文档
- ✅ 中英文双语说明
- ✅ 完整的使用示例
- ✅ 最佳实践指南

---

## 💡 使用方法 / Usage

### Python 示例

```python
import base64
import requests

# 读取 PDF 文件
with open('document.pdf', 'rb') as f:
    pdf_data = base64.b64encode(f.read()).decode('utf-8')

# 发送请求
response = requests.post('http://localhost:3000/v1/chat/completions',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={
        'model': 'claude-sonnet-4',
        'messages': [{
            'role': 'user',
            'content': [
                {'type': 'text', 'text': '请分析这份PDF'},
                {
                    'type': 'document_url',
                    'document_url': {
                        'url': f'data:application/pdf;base64,{pdf_data}'
                    }
                }
            ]
        }]
    }
)
```

### Node.js 示例

```javascript
const fs = require('fs');

// 读取 PDF
const pdfBuffer = fs.readFileSync('document.pdf');
const pdfBase64 = pdfBuffer.toString('base64');

// 发送请求
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
        { type: 'text', text: '分析这个PDF' },
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

### cURL 示例

```bash
# Base64 编码 PDF
PDF_BASE64=$(base64 -i document.pdf | tr -d '\n')

# 发送请求
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "总结这份PDF"},
        {
          "type": "document_url",
          "document_url": {
            "url": "data:application/pdf;base64,'$PDF_BASE64'"
          }
        }
      ]
    }]
  }'
```

---

## 🧪 测试情况 / Testing Status

### 测试覆盖

| 测试类别 | 测试用例数 | 状态 |
|---------|-----------|------|
| OpenAI → Claude 转换 | 4 | ✅ 通过 |
| Claude → OpenAI 转换 | 3 | ✅ 通过 |
| OpenAI → Gemini 转换 | 3 | ✅ 通过 |
| Claude → Gemini 转换 | 1 | ✅ 通过 |
| 边界情况处理 | 5 | ✅ 通过 |
| 往返转换 | 1 | ✅ 通过 |

### 测试命令

```bash
# 运行 PDF 支持测试
npm test tests/test-pdf-support.js

# 运行所有测试
npm test
```

---

## 📊 性能影响 / Performance Impact

### Token 消耗

- **纯文本**: 基准
- **+ 图片**: +1,500-3,000 tokens/页
- **+ PDF**: +1,500-3,000 tokens/页（文本） + 图片 token（如果处理视觉内容）

### 建议

1. ✅ 对于重复查询，使用 **prompt caching** 减少 token 消耗
2. ✅ 大型文档优先使用 **URL 引用**而非 base64
3. ✅ 合理拆分超大文档（>100页）

---

## 📝 兼容性说明 / Compatibility

### 向后兼容
✅ **完全兼容** - 本次更新不影响现有功能，完全向后兼容

### 提供商支持

| 提供商 | 原生 PDF 支持 | 通过转换支持 |
|-------|--------------|-------------|
| Claude Sonnet 4/4.5 | ✅ | N/A |
| Claude Opus 4 | ✅ | N/A |
| OpenAI GPT-4V | ❌ | ⚠️ 有限 |
| Gemini Pro/Flash | ✅ | ✅ |
| Kiro (Claude) | ✅ | N/A |

---

## 🚀 后续计划 / Future Plans

### 短期（v1.2.0）
- [ ] 增强 Gemini ↔ Claude 文档转换
- [ ] 支持更多文档格式（Markdown, HTML）
- [ ] 添加文档预处理选项（压缩、OCR）

### 中期（v1.3.0）
- [ ] 文档缓存机制
- [ ] 批量文档处理
- [ ] 文档分析统计

### 长期（v2.0.0）
- [ ] 本地文档处理引擎
- [ ] 智能文档分段
- [ ] 跨文档引用和对比

---

## 🙏 致谢 / Acknowledgments

感谢所有提供反馈和建议的用户！

特别感谢：
- Claude API 官方文档团队
- OpenAI 和 Anthropic 社区
- 所有贡献者

---

## 📚 相关文档 / Related Documentation

- [PDF_MULTIMODAL_SUPPORT.md](./PDF_MULTIMODAL_SUPPORT.md) - 完整的 PDF 支持文档
- [README.md](./README.md) - 项目主文档
- [tests/test-pdf-support.js](./tests/test-pdf-support.js) - 测试用例参考

---

## ❓ FAQ

### Q: 是否需要更新配置？
A: 不需要，PDF 支持已内置，无需额外配置。

### Q: 是否支持加密的 PDF？
A: 不支持，请先解密 PDF 再上传。

### Q: 最大文件大小是多少？
A: 取决于提供商：Claude 32MB（100页）、Gemini 视模型而定。

### Q: 是否支持 OCR？
A: 提供商会自动进行 OCR，无需客户端处理。

### Q: URL 引用是否安全？
A: 建议使用 HTTPS，确保文档访问权限控制。

---

## 📞 支持 / Support

如有问题或建议，请：
1. 查阅 [PDF_MULTIMODAL_SUPPORT.md](./PDF_MULTIMODAL_SUPPORT.md)
2. 提交 Issue 到 GitHub
3. 参与社区讨论

---

**Last Updated**: 2025-01-XX  
**Maintainer**: AIClient-2-API Team  
**License**: GPL v3