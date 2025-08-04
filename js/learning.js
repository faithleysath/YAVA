import { appState } from './state.js';
import { showToast, switchView, renderWordList, updateUnmasteredCount } from './ui.js';
import { callLLM } from './api.js';
import { getWordPhonetics } from './dictionary-api.js';

export function initializeMasteryState() {
    appState.masteryState = {};
    appState.allWords.forEach(wordObj => {
        const word = wordObj['单词'];
        const meanings = (wordObj['常见含义'] || '').split(/;|；/).map(m => m.trim()).filter(Boolean);
        appState.masteryState[word] = {};
        meanings.forEach(meaning => { appState.masteryState[word][meaning] = false; });
    });
}

export function selectMeaning(word, meaningIndex) {
    appState.currentWord = appState.allWords.find(w => w['单词'] === word);
    appState.currentMeaningIndex = meaningIndex;
    switchView('learning');
    startLearningMeaning();
}

async function startLearningMeaning() {
    const wordObj = appState.currentWord;
    const word = wordObj['单词'];
    const meanings = (wordObj['常见含义'] || '').split(/;|；/).map(m => m.trim()).filter(Boolean);
    const currentMeaning = meanings[appState.currentMeaningIndex];

    document.getElementById('learning-word').textContent = word;

    const wordDetailsContainer = document.getElementById('learning-word-details');
    wordDetailsContainer.innerHTML = ''; // 清空旧内容

    // 如果是词组，则不进行音标查询
    if (word && !word.includes(' ')) {
        getWordPhonetics(word).then(phonetics => {
            if (phonetics && phonetics.phonetic) {
                const phoneticEl = document.createElement('span');
            phoneticEl.className = 'phonetic-text';
            phoneticEl.textContent = `[${phonetics.phonetic}]`;
            wordDetailsContainer.appendChild(phoneticEl);
        }
        if (phonetics && phonetics.audioUrl) {
            const audioBtn = document.createElement('button');
            audioBtn.className = 'audio-btn';
            audioBtn.title = '播放发音';
            audioBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>`;
            audioBtn.onclick = () => {
                try {
                    const audio = new Audio(phonetics.audioUrl);
                    audio.play().catch(e => console.error("音频播放失败:", e));
                } catch (e) {
                    console.error("创建音频对象失败:", e);
                    showToast('无法播放音频文件', 'error');
                }
            };
            wordDetailsContainer.appendChild(audioBtn);
            }
        });
    }

    document.getElementById('learning-progress').textContent = `正在学习释义 ${appState.currentMeaningIndex + 1}/${meanings.length}: ${currentMeaning}`;
    
    document.getElementById('user-notes-content').innerHTML = `
        <p><strong>词性:</strong> ${wordObj['词性'] || 'N/A'}</p>
        <p><strong>常见含义:</strong> ${wordObj['常见含义'] || 'N/A'}</p>
        <p><strong>考研高频考法:</strong> ${wordObj['考研高频考法'] || 'N/A'}</p>
        <p><strong>巧记方法:</strong> ${wordObj['巧记方法（仅供参考）'] || 'N/A'}</p>
    `;
    
    document.getElementById('challenge-container').style.display = 'block';
    document.getElementById('feedback-container').style.display = 'none';
    
    // 重置输入区域状态
    const translationInput = document.getElementById('translation-input');
    translationInput.value = '';
    translationInput.disabled = false;
    const submitButton = document.querySelector('#challenge-container button[onclick="submitTranslation()"]');
    if (submitButton) submitButton.style.display = 'block';
    
    setTimeout(() => translationInput.focus(), 100); // 延迟聚焦以确保元素可见

    const challengeSentenceEl = document.getElementById('challenge-sentence');
    const prefetchKey = getLearningPrefetchKey(word, appState.currentMeaningIndex);
    const cachedResponse = appState.prefetchCache[prefetchKey];

    if (cachedResponse) {
        challengeSentenceEl.textContent = cachedResponse.sentence.trim();
        delete appState.prefetchCache[prefetchKey]; // Use it and remove it
        prefetchNextLearningItem(); // Prefetch for the next one
        return;
    }

    challengeSentenceEl.innerHTML = `<div class="flex items-center"><div class="loader !w-6 !h-6 !border-2"></div><p class="ml-3 text-slate-500">AI 正在生成新例句...</p></div>`;

    const genPrompt = `你是一位为高级英语学习者设计课程的专家。

**任务:**
为学习单词 "${word}"，请生成一个高质量的英文例句，这个例句必须精准且清晰地展示其 "${currentMeaning}" 这个特定释义。

**核心要求:**
1.  **精准聚焦 (Precision Focus):** 例句的核心目的，是让学习者在没有额外上下文的情况下，也能清晰地理解 "${word}" 在此处表达的正是 "${currentMeaning}" 的意思。句子本身就应是最好的线索。
2.  **自然地道 (Natural & Idiomatic):** 例句必须听起来自然，符合英语母语者的日常表达习惯，避免生硬或不常见的用法。
3.  **复杂度适中 (Appropriate Complexity):** 句子结构不应过于简单，也不应过分复杂。它应该是一个能体现该词用法的典型、优质例句，适合考有同等水平的学习者。
4.  **独立完整 (Self-Contained):** 例句本身应包含足够的信息来理解其含义，不应依赖于某个特定的、未说明的故事情节或背景。

**输出格式要求:**
请严格按照以下 JSON 格式返回，不要包含任何额外的解释、注释或 markdown 标记。

{
  "sentence": "A high-quality, natural-sounding English sentence that perfectly illustrates the intended meaning."
}`;
    
    const response = await callLLM(genPrompt, { useGlobalLoader: false });
    
    if (response && response.sentence) {
        challengeSentenceEl.textContent = response.sentence.trim();
        prefetchNextLearningItem(); // Prefetch for the next one
    } else {
        challengeSentenceEl.textContent = '例句加载失败，请检查 API 设置或网络后重试。';
    }
}

export async function submitTranslation() {
    const userTranslation = document.getElementById('translation-input').value;
    if (!userTranslation.trim()) { showToast('请输入你的翻译！', 'warning'); return; }

    const originalSentence = document.getElementById('challenge-sentence').textContent;
    const word = appState.currentWord['单词'];

    const currentMeaning = (appState.currentWord['常见含义'] || '').split(/;|；/)[appState.currentMeaningIndex].trim();
    const prompt = `你是一位顶级的双语翻译专家和语言导师，你的任务是像一位严格而富有洞察力的老师一样，评估用户将一个英文句子翻译成中文的质量。

**任务:**
请根据以下信息、核心原则和评分标准，对用户的翻译进行严格评估，并提供精准、有深度、有建设性的反馈。

**背景信息:**
- 学习单词: "${word}"
- 目标释义: "${currentMeaning}"
- 原始英文例句: "${originalSentence}"
- 用户的中文翻译: "${userTranslation}"

**核心评估原则:**
1.  **词义精准度 (Precision):** 评估的重中之重。不仅要看字面意思，更要深入考察翻译是否精准地传达了单词在特定语境下的**深层含义、微妙差别和情感色彩**。
    - *反例*: 对于 "inner turmoil"，翻译成 "内在混乱" 只能算勉强及格，因为它丢失了 "turmoil" 所蕴含的 "挣扎"、"痛苦" 和 "动荡" 的感觉。更精准的翻译是 "内心挣扎" 或 "内心煎熬"。
2.  **语境契合度 (Contextual Fit):** 评估翻译是否与整个句子的语境、语气和风格完美融合。
3.  **语言自然度 (Idiomaticity):** 评估翻译是否符合中文的表达习惯，读起来是否流畅、地道，要坚决避免生硬的“翻译腔”。

**评分标准 (1-5分):**
- **5分 (卓越):** 翻译精准、优雅、地道。不仅完美传达了原文的所有信息和微妙情感，而且语言表达优美自然，堪称典范。对核心词的理解和运用出神入化。
- **4分 (良好):** 准确传达了核心词义和句子大意，但在词语的精妙选择或句式流畅度上略有欠缺。整体质量高，但离完美还有一小步。
- **3分 (及格):** 基本传达了核心词义，但翻译存在一些不够精准或生硬的地方（例如出现“翻译腔”），或者对句子部分细节有误解。读者能理解大意，但能明显感觉到是翻译。
- **2分 (较差):** 对核心词义有较大误解，或翻译存在严重错误，导致句子意思被扭曲。
- **1分 (错误):** 完全没理解核心词义，或提交了无效内容（如原文、非中文等）。

**重要规则:**
- 如果用户提交了非中文内容，请直接给出 1 分，并在 "evaluation" 中明确指出“输入无效，请输入中文翻译。”，无需提供其他反馈。

**评估要求:**
1.  **评分 (score):** 根据上述标准，给出1-5分的整数评分。
2.  **核心评估 (evaluation):** 一句话精准总结翻译的质量，点出主要问题或亮点。
3.  **优点 (strengths):** 实事求是地指出翻译中的亮点（如果存在）。如果翻译质量低于3分，此项可省略或指出最基本的优点。
4.  **改进建议 (suggestions):** 提出具体、可操作的改进建议。要解释**为什么**要这样改，帮助用户理解背后的语言逻辑。
5.  **参考翻译 (model_translation):** 提供一到两个高质量的参考翻译，展示不同的地道表达方式。

**输出格式要求:**
请严格按照以下 JSON 格式返回，不要包含任何额外的解释、注释或 markdown 标记。

{
  "score": 4,
  "evaluation": "准确传达了核心词义，但句式稍显生硬。",
  "feedback": {
    "strengths": "抓住了单词'${word}'的基本意思。",
    "suggestions": "可以将'...'替换为'...'，这样更符合中文表达习惯。",
    "model_translation": "这是一个高质量的参考翻译。"
  }
}`;

    // 禁用输入框并隐藏提交按钮，而不是隐藏整个容器
    document.getElementById('translation-input').disabled = true;
    const submitButton = document.querySelector('#challenge-container button[onclick="submitTranslation()"]');
    if (submitButton) submitButton.style.display = 'none';

    const feedbackContainer = document.getElementById('feedback-container');
    const feedbackContentEl = document.getElementById('feedback-content');
    
    feedbackContainer.style.display = 'block';
    feedbackContentEl.innerHTML = `<div class="flex items-center"><div class="loader !w-6 !h-6 !border-2"></div><p class="ml-3 text-slate-500">AI 正在评判...</p></div>`;
    
    const response = await callLLM(prompt, { useGlobalLoader: false });

    if (!response || typeof response.score === 'undefined' || !response.evaluation || !response.feedback) {
        showToast('AI 返回数据格式错误，请稍后重试。', 'error');
        feedbackContainer.style.display = 'none';
        document.getElementById('challenge-container').style.display = 'block';
        return;
    }

    let bgColor = '';
    let scoreText = `评分: ${response.score} / 5`;
    switch (response.score) {
        case 5: bgColor = 'bg-green-100 text-green-800'; break;
        case 4: bgColor = 'bg-lime-100 text-lime-800'; break;
        case 3: bgColor = 'bg-yellow-100 text-yellow-800'; break;
        case 2: bgColor = 'bg-orange-100 text-orange-800'; break;
        default: bgColor = 'bg-red-100 text-red-800';
    }

    if (response.score >= 4) {
        const currentMeaning = (appState.currentWord['常见含义'] || '').split(/;|；/)[appState.currentMeaningIndex].trim();
        appState.masteryState[word][currentMeaning] = true;
        renderWordList();
        updateUnmasteredCount();
    }
    
    const feedbackHtml = `
        <p class="font-bold text-lg mb-2">${scoreText} - ${response.evaluation}</p>
        <div class="space-y-3 text-left">
            ${response.feedback.strengths ? `<div><h5 class="font-semibold text-sm">✅ 优点</h5><p class="text-sm">${response.feedback.strengths}</p></div>` : ''}
            ${response.feedback.suggestions ? `<div><h5 class="font-semibold text-sm">💡 改进建议</h5><p class="text-sm">${response.feedback.suggestions}</p></div>` : ''}
            ${response.feedback.model_translation ? `<div><h5 class="font-semibold text-sm">📖 参考翻译</h5><p class="text-sm">${response.feedback.model_translation}</p></div>` : ''}
        </div>
    `;

    document.getElementById('feedback-content').className = `p-4 rounded-lg ${bgColor}`;
    document.getElementById('feedback-content').innerHTML = feedbackHtml;
}

export function nextStep() {
    const wordObj = appState.currentWord;
    const meanings = (wordObj['常见含义'] || '').split(/;|；/).map(m => m.trim()).filter(Boolean);
    
    if (appState.currentMeaningIndex < meanings.length - 1) {
        appState.currentMeaningIndex++;
        startLearningMeaning();
    } else {
        const wordIndex = appState.allWords.findIndex(w => w['单词'] === wordObj['单词']);
        if (wordIndex < appState.allWords.length - 1) {
            const nextWord = appState.allWords[wordIndex + 1];
            selectMeaning(nextWord['单词'], 0);
        } else {
            showToast('🎉 恭喜！您已学完列表中的所有单词！', 'success', { duration: 5000 });
            switchView('home');
        }
    }
}

function getLearningPrefetchKey(word, meaningIndex) {
    return `learning_${word}_${meaningIndex}`;
}

async function prefetchNextLearningItem() {
    if (appState.isPrefetching) return;

    const wordObj = appState.currentWord;
    const meanings = (wordObj['常见含义'] || '').split(/;|；/).map(m => m.trim()).filter(Boolean);
    
    let nextWord, nextMeaningIndex;

    if (appState.currentMeaningIndex < meanings.length - 1) {
        nextWord = wordObj['单词'];
        nextMeaningIndex = appState.currentMeaningIndex + 1;
    } else {
        const wordIndex = appState.allWords.findIndex(w => w['单词'] === wordObj['单词']);
        if (wordIndex < appState.allWords.length - 1) {
            const nextWordObj = appState.allWords[wordIndex + 1];
            nextWord = nextWordObj['单词'];
            nextMeaningIndex = 0;
        } else {
            return; // No more words to prefetch
        }
    }
    
    const prefetchKey = getLearningPrefetchKey(nextWord, nextMeaningIndex);
    if (appState.prefetchCache[prefetchKey]) return; // Already prefetched

    appState.isPrefetching = true;
    
    const nextWordObj = appState.allWords.find(w => w['单词'] === nextWord);
    const nextMeaning = (nextWordObj['常见含义'] || '').split(/;|；/).map(m => m.trim()).filter(Boolean)[nextMeaningIndex];

    const genPrompt = `你是一位为高级英语学习者设计课程的专家。

**任务:**
为学习单词 "${nextWord}"，请生成一个高质量的英文例句，这个例句必须精准且清晰地展示其 "${nextMeaning}" 这个特定释义。

**核心要求:**
1.  **精准聚焦 (Precision Focus):** 例句的核心目的，是让学习者在没有额外上下文的情况下，也能清晰地理解 "${nextWord}" 在此处表达的正是 "${nextMeaning}" 的意思。句子本身就应是最好的线索。
2.  **自然地道 (Natural & Idiomatic):** 例句必须听起来自然，符合英语母语者的日常表达习惯，避免生硬或不常见的用法。
3.  **复杂度适中 (Appropriate Complexity):** 句子结构不应过于简单，也不应过分复杂。它应该是一个能体现该词用法的典型、优质例句，适合考有同等水平的学习者。
4.  **独立完整 (Self-Contained):** 例句本身应包含足够的信息来理解其含义，不应依赖于某个特定的、未说明的故事情节或背景。

**输出格式要求:**
请严格按照以下 JSON 格式返回，不要包含任何额外的解释、注释或 markdown 标记。

{
  "sentence": "A high-quality, natural-sounding English sentence that perfectly illustrates the intended meaning."
}`;

    const response = await callLLM(genPrompt, { useGlobalLoader: false, retries: 1 });
    if (response && response.sentence) {
        appState.prefetchCache[prefetchKey] = response;
    }
    appState.isPrefetching = false;
}
