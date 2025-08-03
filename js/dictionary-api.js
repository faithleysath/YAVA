// js/dictionary-api.js
/**
 * 从 DictionaryAPI 获取单词的音标和发音信息
 * @param {string} word 要查询的单词
 * @returns {Promise<object|null>} 包含音标和音频URL的对象，或在失败时返回null
 */
export async function getWordPhonetics(word) {
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        if (!response.ok) {
            return null; // 单词未找到或API错误
        }
        const data = await response.json();
        const wordData = data[0];

        // 提取音标和音频
        const phoneticText = wordData.phonetic || (wordData.phonetics.find(p => p.text) || {}).text;
        const audioUrl = (wordData.phonetics.find(p => p.audio) || {}).audio;

        return {
            phonetic: phoneticText || '',
            audioUrl: audioUrl || ''
        };
    } catch (error) {
        console.error(`Failed to fetch phonetics for ${word}:`, error);
        return null;
    }
}
