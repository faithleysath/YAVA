import { apiSettings } from './state.js';
import { showToast, setLoading } from './ui.js';

async function handleStreamResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    // 1. Read the entire stream
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, { stream: true });
    }

    // 2. Process the buffered text to extract JSON data from SSE messages
    const lines = buffer.split('\n');
    const jsonChunks = [];
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const dataContent = line.substring(6).trim();
            if (dataContent) {
                jsonChunks.push(dataContent);
            }
        }
    }

    // 3. Combine the JSON chunks into a single valid JSON array string
    // The Gemini stream sends multiple JSON objects. We need to wrap them in an array.
    try {
        const jsonArrayString = `[${jsonChunks.join(',')}]`;
        const chunks = JSON.parse(jsonArrayString);
        
        let combinedContent = '';
        let finalData = {};

        // 4. Iterate through the chunks to build the final response object
        chunks.forEach((chunk, index) => {
            if (chunk.candidates && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
                combinedContent += chunk.candidates[0].content.parts[0].text;
            }
            // Use the last chunk for metadata (like safety ratings)
            if (index === chunks.length - 1) {
                finalData = chunk;
            }
        });
        
        // 5. Construct the final object in a format compatible with the non-streaming response
        if (finalData.candidates && finalData.candidates[0]) {
             finalData.candidates[0].content.parts[0].text = combinedContent;
        } else {
            // Create a fallback structure if the stream was empty or invalid
            finalData = {
                candidates: [{
                    content: {
                        parts: [{ text: combinedContent }]
                    }
                }]
            };
        }
        return finalData;

    } catch (e) {
        console.error("Error processing combined stream:", e, "Combined JSON string:", `[${jsonChunks.join(',')}]`);
        if (e instanceof SyntaxError) {
             throw new Error("Failed to parse streamed response. The data from the API might be incomplete or malformed.");
        }
        throw new Error("Failed to parse streamed JSON response.");
    }
}


export async function callLLM(prompt, options = {}) {
    const { retries = 3, delay = 1000, useGlobalLoader = true } = options;

    const isOfficialGemini = apiSettings.baseUrl.includes('generativelanguage.googleapis.com');
    const isCompatibleOpenAI = apiSettings.baseUrl.endsWith('/v1');

    let API_URL, requestBody, headers;

    if (isOfficialGemini) {
        API_URL = '/api/callGemini';
        headers = { 'Content-Type': 'application/json' };
        requestBody = {
            prompt: prompt,
            apiKey: apiSettings.apiKey,
            modelName: apiSettings.modelName
        };
    } else {
        if (!apiSettings.apiKey || !apiSettings.baseUrl) {
            showToast('请点击"我的单词列表"旁边的设置按钮，填入 API Key 和 Base URL！', 'warning', { duration: 6000, persistent: true });
            if (useGlobalLoader) setLoading(false);
            return null;
        }
        API_URL = isCompatibleOpenAI ? `${apiSettings.baseUrl}/chat/completions` : apiSettings.baseUrl;
        headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiSettings.apiKey}`
        };
        requestBody = {
            model: apiSettings.modelName,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" }
        };
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            if (response.status === 429 && retries > 0) {
                await new Promise(res => setTimeout(res, delay));
                return callLLM(prompt, { retries: retries - 1, delay: delay * 2, useGlobalLoader });
            }
            const errorBody = await response.text();
            console.error("API Error Body:", errorBody);
            throw new Error(`API 请求失败，状态码: ${response.status}`);
        }

        let data;
        if (isOfficialGemini) {
            data = await handleStreamResponse(response);
        } else {
            data = await response.json();
        }

        let content = null;

        if (isOfficialGemini) {
            if (data.candidates && data.candidates[0].content.parts) {
                content = data.candidates[0].content.parts[0].text;
            } else if (data.promptFeedback) {
                showToast(`请求被 Gemini 阻止，原因: ${data.promptFeedback.blockReason}`, 'error');
                return null;
            } else if (data.error) {
                showToast(`API 错误: ${data.error} - ${data.details || ''}`, 'error');
                return null;
            }
        } else {
            if (data.choices && data.choices[0].message.content) {
                content = data.choices[0].message.content;
            }
        }

        if (content) {
            try {
                let cleanedContent = content.trim().replace(/^```json\s*|```\s*$/g, '');
                const firstBrace = cleanedContent.indexOf('{');
                if (firstBrace === -1) throw new Error("响应中未找到 JSON 对象的起始 '{'。");
                let potentialJson = cleanedContent.substring(firstBrace);
                
                let openBraces = 0;
                let lastBraceIndex = -1;
                for (let i = 0; i < potentialJson.length; i++) {
                    if (potentialJson[i] === '{') openBraces++;
                    else if (potentialJson[i] === '}') openBraces--;
                    if (openBraces === 0 && i > 0) {
                        lastBraceIndex = i;
                        break;
                    }
                }
                if (lastBraceIndex === -1) throw new Error("响应中未找到完整的 JSON 对象。");

                const jsonString = potentialJson.substring(0, lastBraceIndex + 1);
                return JSON.parse(jsonString);

            } catch (e) {
                console.error("Failed to parse JSON response:", content, e);
                showToast(`AI 返回了无效的 JSON 格式: ${e.message}`, 'error');
                return null;
            }
        } else {
            console.warn('AI 返回内容为空或格式不符:', data);
            return null;
        }
    } catch (error) {
        console.error('LLM API 调用出错:', error);
        showToast(`与 AI 通信时发生错误: ${error.message}`, 'error');
        if (useGlobalLoader) setLoading(false);
        return null;
    }
}
