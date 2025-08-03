import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    const { word } = req.query;

    if (!word) {
        return res.status(400).json({ error: 'Word parameter is required' });
    }

    const normalizedWord = word.trim().toLowerCase();
    const cacheKey = `dict:${normalizedWord}`;
    
    // 检查KV环境变量是否存在，决定是否使用缓存
    const useCache = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

    try {
        // 1. 如果配置了缓存，则检查缓存
        if (useCache) {
            const cachedData = await kv.get(cacheKey);
            if (cachedData) {
                console.log(`[CACHE HIT] Returning cached data for: ${normalizedWord}`);
                res.setHeader('X-Vercel-Cache', 'HIT');
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.status(200).json(cachedData);
            }
            console.log(`[CACHE MISS] No cache found for: ${normalizedWord}. Fetching from source.`);
            res.setHeader('X-Vercel-Cache', 'MISS');
        } else {
            console.log(`[NO CACHE] KV not configured. Fetching directly for: ${normalizedWord}.`);
        }

        // 2. 如果未命中缓存或未配置缓存，请求源API
        const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${normalizedWord}`;
        const apiResponse = await fetch(apiUrl);

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            return res.status(apiResponse.status).json(errorData);
        }

        const data = await apiResponse.json();

        // 3. 如果配置了缓存，将新数据存入
        if (useCache) {
            console.log(`[CACHE SET] Storing data for: ${normalizedWord}`);
            await kv.set(cacheKey, data, { ex: 604800 }); // 7天过期
        }

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
