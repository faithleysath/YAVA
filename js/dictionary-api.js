// js/dictionary-api.js
/**
 * 从自托管的 DictionaryAPI 获取单词的音标和发音信息
 * @param {string} word 要查询的单词
 * @returns {Promise<object|null>} 包含音标和音频URL的对象，或在失败时返回null
 */
export async function getWordPhonetics(word) {
    try {
        // 指向新的自托管API端点，使用路径参数
        const response = await fetch(`/api/dictionary/${encodeURIComponent(word)}`);
        if (!response.ok) {
            // 如果API返回404或其他错误，静默失败
            console.warn(`Could not find definition for ${word}. Status: ${response.status}`);
            return null;
        }
        const data = await response.json();
        
        // 检查返回的数据是否有效
        if (!data || data.length === 0) {
            return null;
        }

        const wordData = data[0];

        // 适配新的数据结构来提取音标和音频
        const phoneticText = wordData.phonetic || (wordData.phonetics.find(p => p.text) || {}).text;
        const audioUrl = (wordData.phonetics.find(p => p.audio) || {}).audio;

        // 确保返回的audioUrl是完整的URL
        const fullAudioUrl = audioUrl && !audioUrl.startsWith('http') ? `https:${audioUrl}` : audioUrl;

        return {
            phonetic: phoneticText || '',
            audioUrl: fullAudioUrl || ''
        };
    } catch (error) {
        console.error(`Failed to fetch phonetics for ${word} from self-hosted API:`, error);
        return null;
    }
}
