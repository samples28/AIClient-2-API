import { promises as fs } from "fs";
import * as path from "path";
import * as http from "http"; // Add http for IncomingMessage and ServerResponse types
import * as crypto from "crypto"; // Import crypto for MD5 hashing
import { ApiServiceAdapter } from "./adapter.js"; // Import ApiServiceAdapter
import { convertData, getOpenAIStreamChunkStop } from "./convert.js";
import { ProviderStrategyFactory } from "./provider-strategies.js";

export const API_ACTIONS = {
  GENERATE_CONTENT: "generateContent",
  STREAM_GENERATE_CONTENT: "streamGenerateContent",
};

export const MODEL_PROTOCOL_PREFIX = {
  // Model provider constants
  GEMINI: "gemini",
  OPENAI: "openai",
  CLAUDE: "claude",
};

export const MODEL_PROVIDER = {
  // Model provider constants
  GEMINI_CLI: "gemini-cli-oauth",
  OPENAI_CUSTOM: "openai-custom",
  CLAUDE_CUSTOM: "claude-custom",
  KIRO_API: "claude-kiro-oauth",
  QWEN_API: "openai-qwen-oauth",
};

/**
 * Extracts the protocol prefix from a given model provider string.
 * This is used to determine if two providers belong to the same underlying protocol (e.g., gemini, openai, claude).
 * @param {string} provider - The model provider string (e.g., 'gemini-cli', 'openai-custom').
 * @returns {string} The protocol prefix (e.g., 'gemini', 'openai', 'claude').
 */
export function getProtocolPrefix(provider) {
  const hyphenIndex = provider.indexOf("-");
  if (hyphenIndex !== -1) {
    return provider.substring(0, hyphenIndex);
  }
  return provider; // Return original if no hyphen is found
}

export const ENDPOINT_TYPE = {
  OPENAI_CHAT: "openai_chat",
  GEMINI_CONTENT: "gemini_content",
  CLAUDE_MESSAGE: "claude_message",
  OPENAI_MODEL_LIST: "openai_model_list",
  GEMINI_MODEL_LIST: "gemini_model_list",
};

export const FETCH_SYSTEM_PROMPT_FILE = path.join(
  process.cwd(),
  "fetch_system_prompt.txt",
);
export const INPUT_SYSTEM_PROMPT_FILE = path.join(
  process.cwd(),
  "input_system_prompt.txt",
);

export function formatExpiryTime(expiryTimestamp) {
  if (!expiryTimestamp || typeof expiryTimestamp !== "number")
    return "No expiry date available";
  const diffMs = expiryTimestamp - Date.now();
  if (diffMs <= 0) return "Token has expired";
  let totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pad = (num) => String(num).padStart(2, "0");
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

/**
 * Ensures that all content parts in a request body have a 'role' property.
 * If 'systemInstruction' is present and lacks a role, it defaults to 'user'.
 * If any 'contents' entry lacks a role, it defaults to 'user'.
 * @param {Object} requestBody - The request body object.
 * @returns {Object} The modified request body with roles ensured.
 */
export function ensureRolesInContents(requestBody) {
  if (requestBody.system_instruction) {
    requestBody.systemInstruction = requestBody.system_instruction;
    delete requestBody.system_instruction;
  }

  if (requestBody.systemInstruction && !requestBody.systemInstruction.role) {
    requestBody.systemInstruction.role = "user";
  }

  if (requestBody.contents && Array.isArray(requestBody.contents)) {
    requestBody.contents.forEach((content) => {
      if (!content.role) {
        content.role = "user";
      }
    });
  }
  return requestBody;
}

/**
 * Reads the entire request body from an HTTP request.
 * @param {http.IncomingMessage} req - The HTTP request object.
 * @returns {Promise<Object>} A promise that resolves with the parsed JSON request body.
 * @throws {Error} If the request body is not valid JSON.
 */
export function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      if (!body) {
        return resolve({});
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON in request body."));
      }
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
}

export async function logConversation(type, content, logMode, logFilename) {
  if (logMode === "none") return;
  if (!content) return;

  const timestamp = new Date().toLocaleString();
  const logEntry = `${timestamp} [${type.toUpperCase()}]:\n${content}\n--------------------------------------\n`;

  if (logMode === "console") {
    console.log(logEntry);
  } else if (logMode === "file") {
    try {
      // Append to the file
      await fs.appendFile(logFilename, logEntry);
    } catch (err) {
      console.error(
        `[Error] Failed to write conversation log to ${logFilename}:`,
        err,
      );
    }
  }
}

/**
 * Checks if the request is authorized based on API key.
 * @param {http.IncomingMessage} req - The HTTP request object.
 * @param {URL} requestUrl - The parsed URL object.
 * @param {string} REQUIRED_API_KEY - The API key required for authorization.
 * @returns {boolean} True if authorized, false otherwise.
 */
export function isAuthorized(req, requestUrl, REQUIRED_API_KEY) {
  const authHeader = req.headers["authorization"];
  const queryKey = requestUrl.searchParams.get("key");
  const googApiKey = req.headers["x-goog-api-key"];
  const claudeApiKey = req.headers["x-api-key"]; // Claude-specific header

  // Check for Bearer token in Authorization header (OpenAI style)
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token === REQUIRED_API_KEY) {
      return true;
    }
  }

  // Check for API key in URL query parameter (Gemini style)
  if (queryKey === REQUIRED_API_KEY) {
    return true;
  }

  // Check for API key in x-goog-api-key header (Gemini style)
  if (googApiKey === REQUIRED_API_KEY) {
    return true;
  }

  // Check for API key in x-api-key header (Claude style)
  if (claudeApiKey === REQUIRED_API_KEY) {
    return true;
  }

  console.log(
    `[Auth] Unauthorized request denied. Bearer: "${authHeader ? "present" : "N/A"}", Query Key: "${queryKey}", x-goog-api-key: "${googApiKey}", x-api-key: "${claudeApiKey}"`,
  );
  return false;
}

/**
 * Handles the common logic for sending API responses (unary and stream).
 * This includes writing response headers, logging conversation, and logging auth token expiry.
 * @param {http.ServerResponse} res - The HTTP response object.
 * @param {Object} responsePayload - The actual response payload (string for unary, object for stream chunks).
 * @param {boolean} isStream - Whether the response is a stream.
 */
export async function handleUnifiedResponse(res, responsePayload, isStream) {
  if (isStream) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Transfer-Encoding": "chunked",
    });
  } else {
    res.writeHead(200, { "Content-Type": "application/json" });
  }

  if (isStream) {
    // Stream chunks are handled by the calling function that iterates the stream
  } else {
    res.end(responsePayload);
  }
}

export async function handleStreamRequest(
  res,
  service,
  model,
  requestBody,
  fromProvider,
  toProvider,
  PROMPT_LOG_MODE,
  PROMPT_LOG_FILENAME,
  providerPoolManager,
  pooluuid,
) {
  let fullResponseText = "";
  let fullResponseJson = "";
  let fullOldResponseJson = "";
  let responseClosed = false;

  await handleUnifiedResponse(res, "", true);

  // fs.writeFile('request'+Date.now()+'.json', JSON.stringify(requestBody));
  // The service returns a stream in its native format (toProvider).
  const nativeStream = await service.generateContentStream(model, requestBody);
  const needsConversion =
    getProtocolPrefix(fromProvider) !== getProtocolPrefix(toProvider);
  const addEvent =
    getProtocolPrefix(fromProvider) === MODEL_PROTOCOL_PREFIX.CLAUDE;
  const openStop =
    getProtocolPrefix(fromProvider) === MODEL_PROTOCOL_PREFIX.OPENAI;

  try {
    for await (const nativeChunk of nativeStream) {
      // Convert chunk to the client's format (fromProvider), if necessary.
      const chunkText = extractResponseText(nativeChunk, toProvider);
      if (chunkText && !Array.isArray(chunkText)) {
        fullResponseText += chunkText;
      }

      const chunkToSend = needsConversion
        ? convertData(chunkText, "streamChunk", toProvider, fromProvider, model)
        : nativeChunk;

      if (!chunkToSend) {
        continue;
      }

      if (addEvent) {
        res.write(`event: ${chunkToSend.type}\n`);
        // console.log(`event: ${chunkToSend.type}\n`);
      }

      // fullOldResponseJson += JSON.stringify(nativeChunk)+"\n";
      // fullResponseJson += JSON.stringify(chunkToSend)+"\n";
      res.write(`data: ${JSON.stringify(chunkToSend)}\n\n`);
      // console.log(`data: ${JSON.stringify(chunkToSend)}\n`);
    }
    if (openStop && needsConversion) {
      res.write(`data: ${JSON.stringify(getOpenAIStreamChunkStop(model))}\n\n`);
      // console.log(`data: ${JSON.stringify(getOpenAIStreamChunkStop(model))}\n`);
    }
  } catch (error) {
    console.error("\n[Server] Error during stream processing:", error.stack);
    if (providerPoolManager) {
      console.log(
        `[Provider Pool] Marking ${toProvider} as unhealthy due to stream error`,
      );
      // 如果是号池模式，并且请求处理失败，则标记当前使用的提供者为不健康
      providerPoolManager.markProviderUnhealthy(toProvider, {
        uuid: pooluuid,
      });
    }

    if (!res.writableEnded) {
      const errorPayload = {
        error: {
          message: "An error occurred during streaming.",
          details: error.message,
        },
      };
      res.end(JSON.stringify(errorPayload));
      responseClosed = true;
    }
  } finally {
    if (!responseClosed) {
      res.end();
    }
    await logConversation(
      "output",
      fullResponseText,
      PROMPT_LOG_MODE,
      PROMPT_LOG_FILENAME,
    );
    // fs.writeFile('oldResponse'+Date.now()+'.json', fullOldResponseJson);
    // fs.writeFile('response'+Date.now()+'.json', fullResponseJson);
  }
}

export async function handleUnaryRequest(
  res,
  service,
  model,
  requestBody,
  fromProvider,
  toProvider,
  PROMPT_LOG_MODE,
  PROMPT_LOG_FILENAME,
  providerPoolManager,
  pooluuid,
) {
  try {
    console.log(`[Unary Request] Generating content with model: ${model}`);

    // The service returns the response in its native format (toProvider).
    const nativeResponse = await service.generateContent(model, requestBody);

    if (!nativeResponse) {
      throw new Error("Empty response received from service");
    }

    console.log(`[Unary Request] Content generation successful`);
    const responseText = extractResponseText(nativeResponse, toProvider);

    // Convert the response back to the client's format (fromProvider), if necessary.
    let clientResponse = nativeResponse;
    if (getProtocolPrefix(fromProvider) !== getProtocolPrefix(toProvider)) {
      console.log(
        `[Response Convert] Converting response from ${toProvider} to ${fromProvider}`,
      );
      clientResponse = convertData(
        nativeResponse,
        "response",
        toProvider,
        fromProvider,
        model,
      );
      console.log(`[Response Convert] Conversion successful`);
    }

    // Special handling for Claude Messages API
    if (fromProvider === MODEL_PROTOCOL_PREFIX.CLAUDE) {
      // Ensure required fields are present
      if (!clientResponse.id) {
        console.warn(
          `[Claude Response] Missing 'id' field, adding generated ID`,
        );
        clientResponse.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      if (!clientResponse.type) {
        clientResponse.type = "message";
      }
      if (!clientResponse.role) {
        clientResponse.role = "assistant";
      }
      console.log(
        `[Claude Response] Response validated with id: ${clientResponse.id}`,
      );
    }

    //console.log(`[Response] Sending response to client: ${JSON.stringify(clientResponse)}`);
    await handleUnifiedResponse(res, JSON.stringify(clientResponse), false);
    await logConversation(
      "output",
      responseText,
      PROMPT_LOG_MODE,
      PROMPT_LOG_FILENAME,
    );
  } catch (error) {
    console.error("\n[Unary Request] Error during processing:");
    console.error(`  Error message: ${error.message}`);
    console.error(`  Stack trace: ${error.stack}`);
    console.error(
      `  From provider: ${fromProvider}, To provider: ${toProvider}`,
    );

    if (providerPoolManager) {
      // 如果是号池模式，并且请求处理失败，则标记当前使用的提供者为不健康
      providerPoolManager.markProviderUnhealthy(toProvider, {
        uuid: pooluuid,
      });
    }

    // Re-throw to be handled by outer error handler
    throw error;
  }
}

/**
 * Handles requests for listing available models. It fetches models from the
 * service, transforms them to the format expected by the client (OpenAI, Claude, etc.),
 * and sends the JSON response.
 * @param {http.IncomingMessage} req The HTTP request object.
 * @param {http.ServerResponse} res The HTTP response object.
 * @param {ApiServiceAdapter} service The API service adapter.
 * @param {string} endpointType The type of endpoint being called (e.g., OPENAI_MODEL_LIST).
 * @param {Object} CONFIG - The server configuration object.
 */
export async function handleModelListRequest(
  req,
  res,
  service,
  endpointType,
  CONFIG,
  providerPoolManager,
  pooluuid,
) {
  try {
    const clientProviderMap = {
      [ENDPOINT_TYPE.OPENAI_MODEL_LIST]: MODEL_PROTOCOL_PREFIX.OPENAI,
      [ENDPOINT_TYPE.GEMINI_MODEL_LIST]: MODEL_PROTOCOL_PREFIX.GEMINI,
    };

    const fromProvider = clientProviderMap[endpointType];
    const toProvider = CONFIG.MODEL_PROVIDER;

    if (!fromProvider) {
      throw new Error(
        `Unsupported endpoint type for model list: ${endpointType}`,
      );
    }

    // 1. Get the model list in the backend's native format.
    const nativeModelList = await service.listModels();

    // 2. Convert the model list to the client's expected format, if necessary.
    let clientModelList = nativeModelList;
    if (getProtocolPrefix(fromProvider) !== getProtocolPrefix(toProvider)) {
      console.log(
        `[ModelList Convert] Converting model list from ${toProvider} to ${fromProvider}`,
      );
      clientModelList = convertData(
        nativeModelList,
        "modelList",
        toProvider,
        fromProvider,
      );
    } else {
      console.log(
        `[ModelList Convert] Model list format matches. No conversion needed.`,
      );
    }

    console.log(
      `[ModelList Response] Sending model list to client: ${JSON.stringify(clientModelList)}`,
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(clientModelList));
  } catch (error) {
    console.error(
      "\n[Server] Error during model list processing:",
      error.stack,
    );
    if (providerPoolManager) {
      // 如果是号池模式，并且请求处理失败，则标记当前使用的提供者为不健康
      providerPoolManager.markProviderUnhealthy(toProvider, {
        uuid: pooluuid,
      });
    }
  }
}

/**
 * Handles requests for content generation (both unary and streaming). This function
 * orchestrates request body parsing, conversion to the internal Gemini format,
 * logging, and dispatching to the appropriate stream or unary handler.
 * @param {http.IncomingMessage} req The HTTP request object.
 * @param {http.ServerResponse} res The HTTP response object.
 * @param {ApiServiceAdapter} service The API service adapter.
 * @param {string} endpointType The type of endpoint being called (e.g., OPENAI_CHAT).
 * @param {Object} CONFIG - The server configuration object.
 * @param {string} PROMPT_LOG_FILENAME - The prompt log filename.
 */
export async function handleContentGenerationRequest(
  req,
  res,
  service,
  endpointType,
  CONFIG,
  PROMPT_LOG_FILENAME,
  providerPoolManager,
  pooluuid,
) {
  let originalRequestBody;
  try {
    originalRequestBody = await getRequestBody(req);
    if (!originalRequestBody) {
      throw new Error("Request body is missing for content generation.");
    }

    // Enhanced validation for Claude Messages API
    if (endpointType === ENDPOINT_TYPE.CLAUDE_MESSAGE) {
      console.log(
        `[Claude Messages API] Received request with model: ${originalRequestBody.model || "not specified"}`,
      );
      if (
        !originalRequestBody.messages ||
        !Array.isArray(originalRequestBody.messages)
      ) {
        throw new Error(
          "Invalid Claude request: 'messages' field is required and must be an array.",
        );
      }
      if (!originalRequestBody.max_tokens) {
        console.warn(
          `[Claude Messages API] Warning: 'max_tokens' not specified, using default.`,
        );
      }
    }
  } catch (error) {
    console.error(
      `[Request Validation] Error parsing or validating request:`,
      error.message,
    );
    handleError(res, { message: error.message, statusCode: 400 });
    return;
  }

  const clientProviderMap = {
    [ENDPOINT_TYPE.OPENAI_CHAT]: MODEL_PROTOCOL_PREFIX.OPENAI,
    [ENDPOINT_TYPE.CLAUDE_MESSAGE]: MODEL_PROTOCOL_PREFIX.CLAUDE,
    [ENDPOINT_TYPE.GEMINI_CONTENT]: MODEL_PROTOCOL_PREFIX.GEMINI,
  };

  const fromProvider = clientProviderMap[endpointType];
  const toProvider = CONFIG.MODEL_PROVIDER;

  if (!fromProvider) {
    console.error(
      `[Request Handler] Unsupported endpoint type: ${endpointType}`,
    );
    handleError(res, {
      message: `Unsupported endpoint type: ${endpointType}`,
      statusCode: 400,
    });
    return;
  }

  // 1. Convert request body from client format to backend format, if necessary.
  let processedRequestBody = originalRequestBody;
  try {
    // fs.writeFile('originalRequestBody'+Date.now()+'.json', JSON.stringify(originalRequestBody));
    if (getProtocolPrefix(fromProvider) !== getProtocolPrefix(toProvider)) {
      console.log(
        `[Request Convert] Converting request from ${fromProvider} to ${toProvider}`,
      );
      processedRequestBody = convertData(
        originalRequestBody,
        "request",
        fromProvider,
        toProvider,
      );
      console.log(`[Request Convert] Conversion successful`);
    } else {
      console.log(
        `[Request Convert] Request format matches backend provider. No conversion needed.`,
      );
    }
  } catch (error) {
    console.error(`[Request Convert] Error during conversion:`, error.message);
    console.error(`[Request Convert] Stack trace:`, error.stack);
    handleError(res, {
      message: `Request conversion failed: ${error.message}`,
      statusCode: 400,
    });
    return;
  }

  // 2. Extract model and determine if the request is for streaming.
  let model, isStream;
  try {
    const extractedInfo = _extractModelAndStreamInfo(
      req,
      originalRequestBody,
      fromProvider,
    );
    model = extractedInfo.model;
    isStream = extractedInfo.isStream;

    if (!model) {
      throw new Error("Could not determine the model from the request.");
    }
    console.log(`[Content Generation] Model: ${model}, Stream: ${isStream}`);
  } catch (error) {
    console.error(`[Model Extraction] Error:`, error.message);
    handleError(res, {
      message: `Failed to extract model information: ${error.message}`,
      statusCode: 400,
    });
    return;
  }

  // 3. Apply system prompt from file if configured.
  try {
    processedRequestBody = await _applySystemPromptFromFile(
      CONFIG,
      processedRequestBody,
      toProvider,
    );
    await _manageSystemPrompt(processedRequestBody, toProvider);
  } catch (error) {
    console.error(
      `[System Prompt] Error applying system prompt:`,
      error.message,
    );
    // Non-fatal, continue processing
  }

  // 4. Log the incoming prompt (after potential conversion to the backend's format).
  try {
    const promptText = extractPromptText(processedRequestBody, toProvider);
    await logConversation(
      "input",
      promptText,
      CONFIG.PROMPT_LOG_MODE,
      PROMPT_LOG_FILENAME,
    );
  } catch (error) {
    console.error(`[Prompt Logging] Error:`, error.message);
    // Non-fatal, continue processing
  }

  // 5. Call the appropriate stream or unary handler, passing the provider info.
  try {
    if (isStream) {
      await handleStreamRequest(
        res,
        service,
        model,
        processedRequestBody,
        fromProvider,
        toProvider,
        CONFIG.PROMPT_LOG_MODE,
        PROMPT_LOG_FILENAME,
        providerPoolManager,
        pooluuid,
      );
    } else {
      await handleUnaryRequest(
        res,
        service,
        model,
        processedRequestBody,
        fromProvider,
        toProvider,
        CONFIG.PROMPT_LOG_MODE,
        PROMPT_LOG_FILENAME,
        providerPoolManager,
        pooluuid,
      );
    }
  } catch (error) {
    console.error(
      `[Request Handler] Error during request processing:`,
      error.message,
    );
    console.error(`[Request Handler] Stack trace:`, error.stack);
    handleError(res, error);
  }
}

/**
 * Helper function to extract model and stream information from the request.
 * @param {http.IncomingMessage} req The HTTP request object.
 * @param {Object} requestBody The parsed request body.
 * @param {string} fromProvider The type of endpoint being called.
 * @returns {{model: string, isStream: boolean}} An object containing the model name and stream status.
 */
function _extractModelAndStreamInfo(req, requestBody, fromProvider) {
  const strategy = ProviderStrategyFactory.getStrategy(
    getProtocolPrefix(fromProvider),
  );
  return strategy.extractModelAndStreamInfo(req, requestBody);
}

async function _applySystemPromptFromFile(config, requestBody, toProvider) {
  const strategy = ProviderStrategyFactory.getStrategy(
    getProtocolPrefix(toProvider),
  );
  return strategy.applySystemPromptFromFile(config, requestBody);
}

export async function _manageSystemPrompt(requestBody, provider) {
  const strategy = ProviderStrategyFactory.getStrategy(
    getProtocolPrefix(provider),
  );
  await strategy.manageSystemPrompt(requestBody);
}

// Helper functions for content extraction and conversion (from convert.js, but needed here)
export function extractResponseText(response, provider) {
  const strategy = ProviderStrategyFactory.getStrategy(
    getProtocolPrefix(provider),
  );
  return strategy.extractResponseText(response);
}

export function extractPromptText(requestBody, provider) {
  const strategy = ProviderStrategyFactory.getStrategy(
    getProtocolPrefix(provider),
  );
  return strategy.extractPromptText(requestBody);
}

export function handleError(res, error) {
  const statusCode =
    error.statusCode || error.response?.status || error.status || 500;
  let errorMessage = error.message || "An unknown error occurred";
  let suggestions = [];
  let errorType = "api_error";

  // Provide detailed information and suggestions for different error types
  switch (statusCode) {
    case 400:
      errorType = "invalid_request_error";
      suggestions = [
        "Check your request format and parameters",
        "Ensure all required fields are present",
        "Verify the model name is correct",
      ];
      break;
    case 401:
      errorType = "authentication_error";
      errorMessage = "Authentication failed. Please check your credentials.";
      suggestions = [
        "Verify your OAuth credentials are valid",
        "Try re-authenticating by deleting the credentials file",
        "Check if your Google Cloud project has the necessary permissions",
      ];
      break;
    case 403:
      errorType = "permission_error";
      errorMessage = "Access forbidden. Insufficient permissions.";
      suggestions = [
        "Ensure your Google Cloud project has the Code Assist API enabled",
        "Check if your account has the necessary permissions",
        "Verify the project ID is correct",
      ];
      break;
    case 404:
      errorType = "not_found_error";
      errorMessage = "The requested resource was not found.";
      suggestions = [
        "Verify the endpoint URL is correct",
        "Check if the model name exists",
      ];
      break;
    case 429:
      errorType = "rate_limit_error";
      errorMessage = "Too many requests. Rate limit exceeded.";
      suggestions = [
        "The request has been automatically retried with exponential backoff",
        "If the issue persists, try reducing the request frequency",
        "Consider upgrading your API quota if available",
      ];
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      errorType = "api_error";
      errorMessage = "Server error occurred. This is usually temporary.";
      suggestions = [
        "The request has been automatically retried",
        "If the issue persists, try again in a few minutes",
        "Check service status page for outages",
      ];
      break;
    default:
      if (statusCode >= 400 && statusCode < 500) {
        errorType = "invalid_request_error";
        errorMessage = `Client error (${statusCode}): ${error.message}`;
        suggestions = ["Check your request format and parameters"];
      } else if (statusCode >= 500) {
        errorType = "api_error";
        errorMessage = `Server error (${statusCode}): ${error.message}`;
        suggestions = ["This is a server-side issue, please try again later"];
      }
  }

  console.error(
    `\n[Error Handler] Request failed (${statusCode}): ${errorMessage}`,
  );
  console.error(`[Error Handler] Error type: ${errorType}`);
  if (suggestions.length > 0) {
    console.error("[Error Handler] Suggestions:");
    suggestions.forEach((suggestion, index) => {
      console.error(`  ${index + 1}. ${suggestion}`);
    });
  }
  if (error.stack) {
    console.error("[Error Handler] Stack trace:", error.stack);
  }

  if (!res.headersSent) {
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
  }

  // Use Claude API error format for better compatibility
  const errorPayload = {
    type: "error",
    error: {
      type: errorType,
      message: errorMessage,
    },
  };

  // Add optional fields
  if (statusCode) {
    errorPayload.error.code = statusCode;
  }
  if (suggestions.length > 0) {
    errorPayload.error.suggestions = suggestions;
  }
  if (error.response?.data) {
    errorPayload.error.details = error.response.data;
  }

  res.end(JSON.stringify(errorPayload));
}

/**
 * 从请求体中提取系统提示词。
 * @param {Object} requestBody - 请求体对象。
 * @param {string} provider - 提供商类型（'openai', 'gemini', 'claude'）。
 * @returns {string} 提取到的系统提示词字符串。
 */
export function extractSystemPromptFromRequestBody(requestBody, provider) {
  let incomingSystemText = "";
  switch (provider) {
    case MODEL_PROTOCOL_PREFIX.OPENAI:
      const openaiSystemMessage = requestBody.messages?.find(
        (m) => m.role === "system",
      );
      if (openaiSystemMessage?.content) {
        incomingSystemText = openaiSystemMessage.content;
      } else if (requestBody.messages?.length > 0) {
        // Fallback to first user message if no system message
        const userMessage = requestBody.messages.find((m) => m.role === "user");
        if (userMessage) {
          incomingSystemText = userMessage.content;
        }
      }
      break;
    case MODEL_PROTOCOL_PREFIX.GEMINI:
      const geminiSystemInstruction =
        requestBody.system_instruction || requestBody.systemInstruction;
      if (geminiSystemInstruction?.parts) {
        incomingSystemText = geminiSystemInstruction.parts
          .filter((p) => p?.text)
          .map((p) => p.text)
          .join("\n");
      } else if (requestBody.contents?.length > 0) {
        // Fallback to first user content if no system instruction
        const userContent = requestBody.contents[0];
        if (userContent?.parts) {
          incomingSystemText = userContent.parts
            .filter((p) => p?.text)
            .map((p) => p.text)
            .join("\n");
        }
      }
      break;
    case MODEL_PROTOCOL_PREFIX.CLAUDE:
      if (typeof requestBody.system === "string") {
        incomingSystemText = requestBody.system;
      } else if (typeof requestBody.system === "object") {
        incomingSystemText = JSON.stringify(requestBody.system);
      } else if (requestBody.messages?.length > 0) {
        // Fallback to first user message if no system property
        const userMessage = requestBody.messages.find((m) => m.role === "user");
        if (userMessage) {
          if (Array.isArray(userMessage.content)) {
            incomingSystemText = userMessage.content
              .map((block) => block.text)
              .join("");
          } else {
            incomingSystemText = userMessage.content;
          }
        }
      }
      break;
    default:
      console.warn(`[System Prompt] Unknown provider: ${provider}`);
      break;
  }
  return incomingSystemText;
}

/**
 * Generates an MD5 hash for a given object by first converting it to a JSON string.
 * @param {object} obj - The object to hash.
 * @returns {string} The MD5 hash of the object's JSON string representation.
 */
export function getMD5Hash(obj) {
  const jsonString = JSON.stringify(obj);
  return crypto.createHash("md5").update(jsonString).digest("hex");
}
