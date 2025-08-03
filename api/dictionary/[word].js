import { kv } from '@vercel/kv';

// Vercel KV需要Node.js运行时，所以我们不再使用Edge配置
// export const config = { runtime: 'edge' };

export default async function handler(req, res) {
    // 从请求URL中获取单词
    const { word } = req.query;

    if (!word) {
        return res.status(400).json({ error: 'Word parameter is required' });
    }

    const normalizedWord = word.trim().toLowerCase();
    const cacheKey = `dict:${normalizedWord}`;

    try {
        // 1. 检查缓存
        const cachedData = await kv.get(cacheKey);
        if (cachedData) {
            // 如果命中缓存，直接返回
            res.setHeader('X-Vercel-Cache', 'HIT');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(200).json(cachedData);
        }

        // 2. 如果未命中缓存，请求源API
        res.setHeader('X-Vercel-Cache', 'MISS');
        const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${normalizedWord}`;
        const apiResponse = await fetch(apiUrl);

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            return res.status(apiResponse.status).json(errorData);
        }

        const data = await apiResponse.json();

        // 3. 将新数据存入缓存，设置过期时间为7天 (604800秒)
        await kv.set(cacheKey, data, { ex: 604800 });

        // 4. 返回数据
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json(data);

    } catch (error) {
        console.error('Error in dictionary API with KV:', error);
        res.status(500).json({ 
            title: 'Internal Server Error',
            message: 'An error occurred while fetching the word definition.',
            resolution: 'Please try again later.'
        });
    }
}
