/**
 * Claude Code 工具调用转换测试
 * 直接测试格式转换逻辑，不依赖后端提供商
 */

import { toClaudeRequestFromOpenAI, toOpenAIRequestFromClaude, toGeminiRequestFromOpenAI } from './src/convert.js';

console.log('============================================================');
console.log('Claude Code 工具调用转换测试');
console.log('============================================================\n');

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    testsRun++;
    console.log(`\n[测试 #${testsRun}] ${name}`);
    try {
        fn();
        testsPassed++;
        console.log('✓ 通过');
        return true;
    } catch (error) {
        testsFailed++;
        console.log(`✗ 失败: ${error.message}`);
        console.log(error.stack);
        return false;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertExists(value, name) {
    assert(value !== undefined && value !== null, `${name} 应该存在`);
}

function assertType(value, type, name) {
    assert(typeof value === type, `${name} 应该是 ${type} 类型`);
}

// ============================================================
// 测试 1: OpenAI → Claude 工具定义转换
// ============================================================
test('OpenAI → Claude 工具定义转换', () => {
    const openaiRequest = {
        model: 'gpt-4',
        messages: [
            { role: 'user', content: '北京的天气如何？' }
        ],
        tools: [
            {
                type: 'function',
                function: {
                    name: 'get_weather',
                    description: '获取指定城市的天气',
                    parameters: {
                        type: 'object',
                        properties: {
                            location: {
                                type: 'string',
                                description: '城市名称'
                            },
                            unit: {
                                type: 'string',
                                enum: ['celsius', 'fahrenheit']
                            }
                        },
                        required: ['location']
                    }
                }
            }
        ],
        tool_choice: 'auto'
    };

    const claudeRequest = toClaudeRequestFromOpenAI(openaiRequest);

    // 验证工具转换
    assertExists(claudeRequest.tools, 'claudeRequest.tools');
    assert(Array.isArray(claudeRequest.tools), '工具应该是数组');
    assert(claudeRequest.tools.length === 1, '应该有 1 个工具');

    const tool = claudeRequest.tools[0];
    assertExists(tool.name, 'tool.name');
    assertExists(tool.description, 'tool.description');
    assertExists(tool.input_schema, 'tool.input_schema');

    assert(tool.name === 'get_weather', '工具名称应该是 get_weather');
    assertExists(tool.input_schema.properties, 'input_schema.properties');
    assertExists(tool.input_schema.properties.location, 'location 参数');
    assertExists(tool.input_schema.required, 'required 字段');

    console.log('  → 工具定义转换正确');
    console.log(`  → 工具名称: ${tool.name}`);
    console.log(`  → 参数数量: ${Object.keys(tool.input_schema.properties).length}`);
});

// ============================================================
// 测试 2: 多工具转换
// ============================================================
test('多工具转换', () => {
    const openaiRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: '测试' }],
        tools: [
            {
                type: 'function',
                function: {
                    name: 'read_file',
                    description: '读取文件',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string' }
                        },
                        required: ['path']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'write_file',
                    description: '写入文件',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string' },
                            content: { type: 'string' }
                        },
                        required: ['path', 'content']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'execute_command',
                    description: '执行命令',
                    parameters: {
                        type: 'object',
                        properties: {
                            command: { type: 'string' }
                        },
                        required: ['command']
                    }
                }
            }
        ]
    };

    const claudeRequest = toClaudeRequestFromOpenAI(openaiRequest);

    assert(claudeRequest.tools.length === 3, '应该有 3 个工具');
    assert(claudeRequest.tools[0].name === 'read_file', '第一个工具应该是 read_file');
    assert(claudeRequest.tools[1].name === 'write_file', '第二个工具应该是 write_file');
    assert(claudeRequest.tools[2].name === 'execute_command', '第三个工具应该是 execute_command');

    console.log('  → 多工具转换正确');
    console.log(`  → 工具列表: ${claudeRequest.tools.map(t => t.name).join(', ')}`);
});

// ============================================================
// 测试 3: 复杂嵌套参数转换
// ============================================================
test('复杂嵌套参数转换', () => {
    const openaiRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: '测试' }],
        tools: [
            {
                type: 'function',
                function: {
                    name: 'create_user',
                    description: '创建用户',
                    parameters: {
                        type: 'object',
                        properties: {
                            username: { type: 'string' },
                            preferences: {
                                type: 'object',
                                properties: {
                                    theme: { 
                                        type: 'string',
                                        enum: ['light', 'dark']
                                    },
                                    notifications: { type: 'boolean' }
                                }
                            },
                            tags: {
                                type: 'array',
                                items: { type: 'string' }
                            }
                        },
                        required: ['username']
                    }
                }
            }
        ]
    };

    const claudeRequest = toClaudeRequestFromOpenAI(openaiRequest);

    const tool = claudeRequest.tools[0];
    assertExists(tool.input_schema.properties.preferences, 'preferences 嵌套对象');
    assertExists(tool.input_schema.properties.tags, 'tags 数组');

    const prefs = tool.input_schema.properties.preferences;
    assertExists(prefs.properties, 'preferences.properties');
    assertExists(prefs.properties.theme, 'theme 属性');
    assertExists(prefs.properties.notifications, 'notifications 属性');

    console.log('  → 嵌套对象处理正确');
    console.log('  → 数组类型处理正确');
});

// ============================================================
// 测试 4: 工具调用消息转换 (assistant with tool_calls)
// ============================================================
test('工具调用消息转换', () => {
    const openaiRequest = {
        model: 'gpt-4',
        messages: [
            { role: 'user', content: '查询天气' },
            {
                role: 'assistant',
                content: null,
                tool_calls: [
                    {
                        id: 'call_123',
                        type: 'function',
                        function: {
                            name: 'get_weather',
                            arguments: '{"location": "Beijing"}'
                        }
                    }
                ]
            }
        ],
        tools: [
            {
                type: 'function',
                function: {
                    name: 'get_weather',
                    parameters: { type: 'object', properties: {} }
                }
            }
        ]
    };

    const claudeRequest = toClaudeRequestFromOpenAI(openaiRequest);

    assert(claudeRequest.messages.length >= 2, '应该有至少 2 条消息');

    // 查找 assistant 消息
    const assistantMsg = claudeRequest.messages.find(m => m.role === 'assistant');
    assertExists(assistantMsg, 'assistant 消息');
    assert(Array.isArray(assistantMsg.content), 'content 应该是数组');

    // 检查 tool_use 块
    const toolUseBlock = assistantMsg.content.find(c => c.type === 'tool_use');
    assertExists(toolUseBlock, 'tool_use 块');
    assert(toolUseBlock.name === 'get_weather', '工具名称应该是 get_weather');
    assert(toolUseBlock.id === 'call_123', '工具 ID 应该是 call_123');
    assertExists(toolUseBlock.input, 'tool input');

    console.log('  → 工具调用消息转换正确');
    console.log(`  → 工具名称: ${toolUseBlock.name}`);
    console.log(`  → 工具参数: ${JSON.stringify(toolUseBlock.input)}`);
});

// ============================================================
// 测试 5: 工具结果消息转换
// ============================================================
test('工具结果消息转换', () => {
    const openaiRequest = {
        model: 'gpt-4',
        messages: [
            { role: 'user', content: '查询天气' },
            {
                role: 'assistant',
                content: null,
                tool_calls: [
                    {
                        id: 'call_123',
                        type: 'function',
                        function: {
                            name: 'get_weather',
                            arguments: '{"location": "Beijing"}'
                        }
                    }
                ]
            },
            {
                role: 'tool',
                tool_call_id: 'call_123',
                content: '{"temperature": 22, "condition": "sunny"}'
            }
        ],
        tools: [
            {
                type: 'function',
                function: {
                    name: 'get_weather',
                    parameters: { type: 'object', properties: {} }
                }
            }
        ]
    };

    const claudeRequest = toClaudeRequestFromOpenAI(openaiRequest);

    // 查找包含 tool_result 的消息
    const toolResultMsg = claudeRequest.messages.find(m => 
        m.role === 'user' && 
        Array.isArray(m.content) && 
        m.content.some(c => c.type === 'tool_result')
    );

    assertExists(toolResultMsg, 'tool_result 消息');

    const toolResultBlock = toolResultMsg.content.find(c => c.type === 'tool_result');
    assertExists(toolResultBlock, 'tool_result 块');
    assert(toolResultBlock.tool_use_id === 'call_123', 'tool_use_id 应该匹配');
    assertExists(toolResultBlock.content, 'tool_result content');

    console.log('  → 工具结果消息转换正确');
    console.log(`  → tool_use_id: ${toolResultBlock.tool_use_id}`);
});

// ============================================================
// 测试 6: OpenAI → Gemini 工具转换
// ============================================================
test('OpenAI → Gemini 工具转换', () => {
    const openaiRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: '测试' }],
        tools: [
            {
                type: 'function',
                function: {
                    name: 'search_code',
                    description: '搜索代码',
                    parameters: {
                        type: 'object',
                        properties: {
                            pattern: {
                                type: 'string',
                                description: '搜索模式'
                            },
                            file_type: {
                                type: 'string',
                                description: '文件类型'
                            }
                        },
                        required: ['pattern']
                    }
                }
            }
        ]
    };

    const geminiRequest = toGeminiRequestFromOpenAI(openaiRequest);

    assertExists(geminiRequest.tools, 'geminiRequest.tools');
    assert(Array.isArray(geminiRequest.tools), 'tools 应该是数组');
    assert(geminiRequest.tools.length > 0, '应该有至少一个工具');

    const toolDef = geminiRequest.tools[0];
    assertExists(toolDef.functionDeclarations, 'functionDeclarations');
    assert(Array.isArray(toolDef.functionDeclarations), 'functionDeclarations 应该是数组');

    const func = toolDef.functionDeclarations[0];
    assertExists(func.name, 'function name');
    assertExists(func.description, 'function description');
    assertExists(func.parameters, 'function parameters');

    assert(func.name === 'search_code', '函数名称应该是 search_code');

    console.log('  → Gemini 工具转换正确');
    console.log(`  → 函数名称: ${func.name}`);
    console.log(`  → 参数数量: ${Object.keys(func.parameters.properties || {}).length}`);
});

// ============================================================
// 测试 7: Claude → OpenAI 工具转换
// ============================================================
test('Claude → OpenAI 工具转换', () => {
    const claudeRequest = {
        model: 'claude-3-opus',
        max_tokens: 1024,
        messages: [{ role: 'user', content: '测试' }],
        tools: [
            {
                name: 'list_files',
                description: '列出文件',
                input_schema: {
                    type: 'object',
                    properties: {
                        directory: {
                            type: 'string',
                            description: '目录路径'
                        }
                    },
                    required: ['directory']
                }
            }
        ]
    };

    const openaiRequest = toOpenAIRequestFromClaude(claudeRequest);

    assertExists(openaiRequest.tools, 'openaiRequest.tools');
    assert(Array.isArray(openaiRequest.tools), 'tools 应该是数组');
    assert(openaiRequest.tools.length === 1, '应该有 1 个工具');

    const tool = openaiRequest.tools[0];
    assert(tool.type === 'function', 'type 应该是 function');
    assertExists(tool.function, 'function 对象');
    assert(tool.function.name === 'list_files', '函数名称应该是 list_files');
    assertExists(tool.function.parameters, 'parameters');

    console.log('  → Claude → OpenAI 工具转换正确');
    console.log(`  → 函数名称: ${tool.function.name}`);
});

// ============================================================
// 测试 8: 工具选择策略转换
// ============================================================
test('工具选择策略转换', () => {
    // 测试 auto
    const request1 = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: '测试' }],
        tools: [{ type: 'function', function: { name: 'test', parameters: { type: 'object', properties: {} } } }],
        tool_choice: 'auto'
    };
    const claude1 = toClaudeRequestFromOpenAI(request1);
    assert(claude1.tool_choice.type === 'auto' || !claude1.tool_choice, 'auto 应该转换为 {type: "auto"}');

    // 测试强制工具
    const request2 = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: '测试' }],
        tools: [{ type: 'function', function: { name: 'specific_tool', parameters: { type: 'object', properties: {} } } }],
        tool_choice: {
            type: 'function',
            function: { name: 'specific_tool' }
        }
    };
    const claude2 = toClaudeRequestFromOpenAI(request2);
    assertExists(claude2.tool_choice, 'tool_choice 应该存在');

    console.log('  → 工具选择策略转换正确');
});

// ============================================================
// 打印总结
// ============================================================
console.log('\n============================================================');
console.log('测试总结');
console.log('============================================================');
console.log(`总测试数: ${testsRun}`);
console.log(`✓ 通过: ${testsPassed}`);
console.log(`✗ 失败: ${testsFailed}`);
console.log('============================================================\n');

if (testsFailed === 0) {
    console.log('🎉 所有测试通过！');
    console.log('✅ Claude Code 工具调用格式转换功能完全正常');
    console.log('============================================================\n');
    process.exit(0);
} else {
    console.log(`⚠ 有 ${testsFailed} 个测试失败`);
    console.log('============================================================\n');
    process.exit(1);
}
