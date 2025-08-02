export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // 处理CORS预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // 立即返回流式响应，满足25秒初始响应要求
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          const requestData = await request.json();
          const { apiKey, modelName, prompt } = requestData;
          
          if (!apiKey || !modelName || !prompt) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({
              error: true,
              message: 'Missing required parameters: apiKey, modelName, or prompt'
            })));
            controller.close();
            return;
          }
          
          // 构建Gemini API请求，确保模型名称有正确的前缀
          const fullModelName = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/${fullModelName}:generateContent?key=${apiKey}`;
          const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          };

          // 普通HTTP请求到Gemini API（非流式）
          const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            const errorText = await response.text();
            controller.enqueue(new TextEncoder().encode(JSON.stringify({
              error: true,
              status: response.status,
              message: `Gemini API Error: ${errorText}`
            })));
          } else {
            const data = await response.json();
            // 将完整的Gemini响应通过流返回
            controller.enqueue(new TextEncoder().encode(JSON.stringify(data)));
          }
          
          controller.close();
        } catch (error) {
          // 错误处理
          console.error('Edge Function Error:', error);
          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            error: true,
            message: error.message || 'Internal server error'
          })));
          controller.close();
        }
      }
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    }
  );
}
