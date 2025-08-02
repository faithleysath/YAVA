export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const incomingData = await request.json();
    
    const apiKey = incomingData.apiKey || process.env.GEMINI_API_KEY;
    const modelName = incomingData.modelName || process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash-lite';
    const prompt = incomingData.prompt;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key is not provided or configured.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is missing.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 使用 Gemini 的流式生成 API
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const geminiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error('Gemini API Error:', errorBody);
      return new Response(JSON.stringify({ 
          error: 'Failed to fetch from Gemini API.',
          status: geminiResponse.status,
          details: errorBody 
      }), {
          status: geminiResponse.status,
          headers: { 'Content-Type': 'application/json' },
      });
    }

    // 创建一个可读流，将 Gemini 的响应转换为 Server-Sent Events (SSE)
    const stream = new ReadableStream({
      async start(controller) {
        const reader = geminiResponse.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            // 将从 Gemini 收到的每个数据块解码为文本
            const textChunk = decoder.decode(value);
            // 将文本块格式化为标准的 Server-Sent Event 消息
            // 每条消息都是 "data: <chunk>\n\n"
            const sseMessage = `data: ${textChunk}\n\n`;
            controller.enqueue(encoder.encode(sseMessage));
          }
        } catch (err) {
          console.error('Stream reading error:', err);
          controller.error(err);
        } finally {
          controller.close();
        }
      }
    });

    // 返回 event-stream 响应
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: 'An internal server error occurred.', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
