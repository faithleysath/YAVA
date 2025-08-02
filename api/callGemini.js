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

    // 创建一个可读流用于 Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = geminiResponse.body.getReader();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            // 将收到的数据块作为 event-stream 的 data 字段发送
            controller.enqueue(encoder.encode('data: '));
            controller.enqueue(value);
            controller.enqueue(encoder.encode('\n\n'));
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
