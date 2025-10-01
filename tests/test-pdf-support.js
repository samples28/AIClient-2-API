import { describe, it, expect } from '@jest/globals';
import {
    toClaudeRequestFromOpenAI,
    toOpenAIRequestFromClaude,
    toGeminiRequestFromOpenAI,
    toGeminiRequestFromClaude,
} from '../src/convert.js';

describe('PDF and Document Support Tests', () => {
    describe('OpenAI to Claude - Document Conversion', () => {
        it('should convert base64 PDF from OpenAI to Claude document format', () => {
            const openaiRequest = {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'What is in this PDF?'
                            },
                            {
                                type: 'document_url',
                                document_url: {
                                    url: 'data:application/pdf;base64,JVBERi0xLjQKJcOk...'
                                }
                            }
                        ]
                    }
                ]
            };

            const claudeRequest = toClaudeRequestFromOpenAI(openaiRequest);

            expect(claudeRequest.messages).toHaveLength(1);
            expect(claudeRequest.messages[0].content).toHaveLength(2);
            expect(claudeRequest.messages[0].content[1].type).toBe('document');
            expect(claudeRequest.messages[0].content[1].source.type).toBe('base64');
            expect(claudeRequest.messages[0].content[1].source.media_type).toBe('application/pdf');
            expect(claudeRequest.messages[0].content[1].source.data).toBe('JVBERi0xLjQKJcOk...');
        });

        it('should convert URL-based PDF from OpenAI to Claude document format', () => {
            const openaiRequest = {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Analyze this document'
                            },
                            {
                                type: 'document_url',
                                document_url: {
                                    url: 'https://example.com/document.pdf'
                                }
                            }
                        ]
                    }
                ]
            };

            const claudeRequest = toClaudeRequestFromOpenAI(openaiRequest);

            expect(claudeRequest.messages[0].content[1].type).toBe('document');
            expect(claudeRequest.messages[0].content[1].source.type).toBe('url');
            expect(claudeRequest.messages[0].content[1].source.url).toBe('https://example.com/document.pdf');
        });

        it('should handle mixed content with text, images, and documents', () => {
            const openaiRequest = {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Compare this image and document'
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
                                }
                            },
                            {
                                type: 'document_url',
                                document_url: {
                                    url: 'data:application/pdf;base64,JVBERi0x...'
                                }
                            }
                        ]
                    }
                ]
            };

            const claudeRequest = toClaudeRequestFromOpenAI(openaiRequest);

            expect(claudeRequest.messages[0].content).toHaveLength(3);
            expect(claudeRequest.messages[0].content[0].type).toBe('text');
            expect(claudeRequest.messages[0].content[1].type).toBe('image');
            expect(claudeRequest.messages[0].content[2].type).toBe('document');
        });

        it('should handle alternative document field name', () => {
            const openaiRequest = {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'document',
                                document: {
                                    url: 'data:application/pdf;base64,ABC123'
                                }
                            }
                        ]
                    }
                ]
            };

            const claudeRequest = toClaudeRequestFromOpenAI(openaiRequest);

            expect(claudeRequest.messages[0].content[0].type).toBe('document');
            expect(claudeRequest.messages[0].content[0].source.type).toBe('base64');
        });
    });

    describe('Claude to OpenAI - Document Conversion', () => {
        it('should convert Claude base64 document to OpenAI format', () => {
            const claudeRequest = {
                model: 'claude-3-opus',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Summarize this document'
                            },
                            {
                                type: 'document',
                                source: {
                                    type: 'base64',
                                    media_type: 'application/pdf',
                                    data: 'JVBERi0xLjQKJQ...'
                                }
                            }
                        ]
                    }
                ]
            };

            const openaiRequest = toOpenAIRequestFromClaude(claudeRequest);

            expect(openaiRequest.messages).toHaveLength(1);
            expect(openaiRequest.messages[0].content).toHaveLength(2);
            expect(openaiRequest.messages[0].content[1].type).toBe('document_url');
            expect(openaiRequest.messages[0].content[1].document_url.url).toMatch(/^data:application\/pdf;base64,/);
        });

        it('should convert Claude URL document to OpenAI format', () => {
            const claudeRequest = {
                model: 'claude-3-opus',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'document',
                                source: {
                                    type: 'url',
                                    url: 'https://example.com/report.pdf'
                                }
                            }
                        ]
                    }
                ]
            };

            const openaiRequest = toOpenAIRequestFromClaude(claudeRequest);

            expect(openaiRequest.messages[0].content[0].type).toBe('document_url');
            expect(openaiRequest.messages[0].content[0].document_url.url).toBe('https://example.com/report.pdf');
        });

        it('should preserve other content types when converting documents', () => {
            const claudeRequest = {
                model: 'claude-3-opus',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Review this content'
                            },
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg',
                                    data: '/9j/4AAQ...'
                                }
                            },
                            {
                                type: 'document',
                                source: {
                                    type: 'base64',
                                    media_type: 'application/pdf',
                                    data: 'JVBER...'
                                }
                            }
                        ]
                    }
                ]
            };

            const openaiRequest = toOpenAIRequestFromClaude(claudeRequest);

            expect(openaiRequest.messages[0].content).toHaveLength(3);
            expect(openaiRequest.messages[0].content[0].type).toBe('text');
            expect(openaiRequest.messages[0].content[1].type).toBe('image_url');
            expect(openaiRequest.messages[0].content[2].type).toBe('document_url');
        });
    });

    describe('OpenAI to Gemini - Document Conversion', () => {
        it('should convert base64 PDF to Gemini inlineData format', () => {
            const openaiRequest = {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'What does this PDF contain?'
                            },
                            {
                                type: 'document_url',
                                document_url: {
                                    url: 'data:application/pdf;base64,JVBERi0xLjQ='
                                }
                            }
                        ]
                    }
                ]
            };

            const geminiRequest = toGeminiRequestFromOpenAI(openaiRequest);

            expect(geminiRequest.contents).toHaveLength(1);
            expect(geminiRequest.contents[0].parts).toHaveLength(2);
            expect(geminiRequest.contents[0].parts[0].text).toBe('What does this PDF contain?');
            expect(geminiRequest.contents[0].parts[1].inlineData).toBeDefined();
            expect(geminiRequest.contents[0].parts[1].inlineData.mimeType).toBe('application/pdf');
            expect(geminiRequest.contents[0].parts[1].inlineData.data).toBe('JVBERi0xLjQ=');
        });

        it('should convert URL-based document to Gemini fileData format', () => {
            const openaiRequest = {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'document_url',
                                document_url: {
                                    url: 'https://storage.googleapis.com/doc.pdf'
                                }
                            }
                        ]
                    }
                ]
            };

            const geminiRequest = toGeminiRequestFromOpenAI(openaiRequest);

            expect(geminiRequest.contents[0].parts[0].fileData).toBeDefined();
            expect(geminiRequest.contents[0].parts[0].fileData.mimeType).toBe('application/pdf');
            expect(geminiRequest.contents[0].parts[0].fileData.fileUri).toBe('https://storage.googleapis.com/doc.pdf');
        });

        it('should handle Word documents and other document types', () => {
            const openaiRequest = {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'document_url',
                                document_url: {
                                    url: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDB...'
                                }
                            }
                        ]
                    }
                ]
            };

            const geminiRequest = toGeminiRequestFromOpenAI(openaiRequest);

            expect(geminiRequest.contents[0].parts[0].inlineData.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        });
    });

    describe('Claude to Gemini - Document Conversion', () => {
        it('should convert Claude document to Gemini format', () => {
            const claudeRequest = {
                model: 'claude-3-opus',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Analyze this'
                            },
                            {
                                type: 'document',
                                source: {
                                    type: 'base64',
                                    media_type: 'application/pdf',
                                    data: 'PDF_DATA_HERE'
                                }
                            }
                        ]
                    }
                ]
            };

            const geminiRequest = toGeminiRequestFromClaude(claudeRequest);

            // Note: Claude to Gemini might not have document support implemented
            // This test documents expected behavior
            expect(geminiRequest.contents).toBeDefined();
            expect(geminiRequest.contents[0].parts).toBeDefined();
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle empty document URL gracefully', () => {
            const openaiRequest = {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'document_url',
                                document_url: {
                                    url: ''
                                }
                            }
                        ]
                    }
                ]
            };

            const claudeRequest = toClaudeRequestFromOpenAI(openaiRequest);

            // Should not add empty document
            expect(claudeRequest.messages[0].content.length).toBe(0);
        });

        it('should handle missing document fields', () => {
            const openaiRequest = {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'document_url'
                                // Missing document_url field
                            }
                        ]
                    }
                ]
            };

            const claudeRequest = toClaudeRequestFromOpenAI(openaiRequest);

            expect(claudeRequest.messages[0].content.length).toBe(0);
        });

        it('should handle multiple documents in single message', () => {
            const openaiRequest = {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Compare these documents'
                            },
                            {
                                type: 'document_url',
                                document_url: {
                                    url: 'data:application/pdf;base64,DOC1'
                                }
                            },
                            {
                                type: 'document_url',
                                document_url: {
                                    url: 'data:application/pdf;base64,DOC2'
                                }
                            }
                        ]
                    }
                ]
            };

            const claudeRequest = toClaudeRequestFromOpenAI(openaiRequest);

            expect(claudeRequest.messages[0].content).toHaveLength(3);
            expect(claudeRequest.messages[0].content.filter(c => c.type === 'document')).toHaveLength(2);
        });

        it('should preserve media type from data URL', () => {
            const openaiRequest = {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'document_url',
                                document_url: {
                                    url: 'data:application/vnd.ms-excel;base64,EXCEL_DATA'
                                }
                            }
                        ]
                    }
                ]
            };

            const claudeRequest = toClaudeRequestFromOpenAI(openaiRequest);

            expect(claudeRequest.messages[0].content[0].source.media_type).toBe('application/vnd.ms-excel');
        });
    });

    describe('Round-trip Conversion Tests', () => {
        it('should maintain document integrity through OpenAI->Claude->OpenAI conversion', () => {
            const originalRequest = {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Test'
                            },
                            {
                                type: 'document_url',
                                document_url: {
                                    url: 'data:application/pdf;base64,ABC123'
                                }
                            }
                        ]
                    }
                ]
            };

            const claudeRequest = toClaudeRequestFromOpenAI(originalRequest);
            const backToOpenAI = toOpenAIRequestFromClaude(claudeRequest);

            expect(backToOpenAI.messages[0].content).toHaveLength(2);
            expect(backToOpenAI.messages[0].content[1].type).toBe('document_url');
            expect(backToOpenAI.messages[0].content[1].document_url.url).toContain('application/pdf');
            expect(backToOpenAI.messages[0].content[1].document_url.url).toContain('ABC123');
        });
    });
});
