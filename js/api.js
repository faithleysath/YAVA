import { apiSettings } from './state.js';
import { showToast, setLoading } from './ui.js';

export async function callLLM(prompt, options = {}) {
    const { retries = 3, delay = 1000, useGlobalLoader = true } = options;

    if (!apiSettings.apiKey || !apiSettings.baseUrl) {
        showToast('请点击"我的单词列表"旁边的设置按钮，填入 API Key 和 Base URL！', 'warning', { duration: 6000, persistent: true });
        if (useGlobalLoader) setLoading(false);
        return null;
    }

    // 检查是 Gemini 还是 OpenAI 格式
    const isGemini = apiSettings.baseUrl.includes('generativelanguage.googleapis.com');
    const isCompatibleOpenAI = apiSettings.baseUrl.endsWith('/v1');

    let API_URL, requestBody, headers;

    if (isGemini) {
        API_URL = `${apiSettings.baseUrl}/${apiSettings.modelName}:generateContent?key=${apiSettings.apiKey}`;
        headers = { 'Content-Type': 'application/json' };
        requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        };
    } else { // 假设是 OpenAI 或兼容格式
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
                console.log(`Rate limited. Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                return callLLM(prompt, { retries: retries - 1, delay: delay * 2, useGlobalLoader });
            }
            const errorBody = await response.text();
            console.error("API Error Body:", errorBody);
            throw new Error(`API 请求失败，状态码: ${response.status}`);
        }

        const data = await response.json();
        let content = null;

        if (isGemini) {
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts) {
                content = data.candidates[0].content.parts[0].text;
            } else if (data.promptFeedback && data.promptFeedback.blockReason) {
                showToast(`请求被 Gemini 阻止，原因: ${data.promptFeedback.blockReason}`, 'error');
                return null;
            }
        } else { // OpenAI or compatible
            if (data.choices && data.choices.length > 0 && data.choices[0].message.content) {
                content = data.choices[0].message.content;
            }
        }

        if (content) {
            try {
                // 1. 移除可能的 markdown 代码块标记
                let cleanedContent = content.trim().replace(/^```json\s*|```\s*$/g, '');
                
                // 2. 找到第一个 '{'，这是我们认为 JSON 开始的地方
                const firstBrace = cleanedContent.indexOf('{');
                if (firstBrace === -1) {
                    throw new Error("响应中未找到 JSON 对象的起始 '{'。");
                }

                // 从第一个 '{' 开始截取字符串
                let potentialJson = cleanedContent.substring(firstBrace);
                
                // 3. 寻找一个有效的 JSON 对象
                let openBraces = 0;
                let lastBraceIndex = -1;

                for (let i = 0; i < potentialJson.length; i++) {
                    if (potentialJson[i] === '{') {
                        openBraces++;
                    } else if (potentialJson[i] === '}') {
                        openBraces--;
                    }

                    if (openBraces === 0 && i > 0) {
                        lastBraceIndex = i;
                        break; // 找到了第一个闭合的完整对象
                    }
                }

                if (lastBraceIndex === -1) {
                    throw new Error("响应中未找到完整的 JSON 对象。");
                }

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
