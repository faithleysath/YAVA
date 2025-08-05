import { appState } from './state.js';
import { showToast, switchView, renderWordList, updateUnmasteredCount } from './ui.js';
import { callLLM } from './api.js';

export function startTest(mode) {
    appState.currentTestMode = mode;
    appState.testPool = [];
    appState.prefetchCache = {}; // 重置缓存
    for (const word in appState.masteryState) {
        for (const meaning in appState.masteryState[word]) {
            if (!appState.masteryState[word][meaning]) {
                appState.testPool.push({ word, meaning });
            }
        }
    }
    if (appState.testPool.length === 0) { showToast('太棒了！所有考点都已掌握，无需测试！', 'success', { duration: 5000 }); return; }
    appState.testPool.sort(() => Math.random() - 0.5);
    appState.currentTestIndex = 0;
    switchView('test');
    loadTestQuestion();
}

async function loadTestQuestion() {
    if (appState.currentTestIndex >= appState.testPool.length) {
        showToast('🎉 测试完成！', 'success', { duration: 5000 });
        switchView('home');
        return;
    }

    const answerArea = document.getElementById('test-answer-area');
    answerArea.innerHTML = '';
    let title = '', questionText = '', data;

    if (appState.currentTestMode === 'multi-word-challenge') {
        const groupSize = Math.min(appState.testPool.length - appState.currentTestIndex, 5);
        appState.currentTestGroup = appState.testPool.slice(appState.currentTestIndex, appState.currentTestIndex + groupSize);
    }
    
    const currentTestItem = appState.testPool[appState.currentTestIndex];
    const { word, meaning } = currentTestItem;

    const prefetchKey = getTestPrefetchKey(appState.currentTestIndex);
    const cachedData = appState.prefetchCache[prefetchKey];

    if (cachedData) {
        data = cachedData;
        delete appState.prefetchCache[prefetchKey];
    } else {
        document.getElementById('test-question').innerHTML = `<div class="flex items-center"><div class="loader !w-6 !h-6 !border-2"></div><p class="ml-3 text-slate-500">AI 正在出题...</p></div>`;
        let prompt = '';
        switch (appState.currentTestMode) {
            case 'construction':
                prompt = `你是一个严格遵守格式的 JSON API。你的唯一任务是根据输入生成一个包含特定单词的句子，并以指定的 JSON 格式返回。\n\n**输入:**\n- 单词: "${word}"\n- 含义: "${meaning}"\n\n**任务:**\n创建一个英文例句，该例句能清晰地展示单词 "${word}" 的 "${meaning}" 这个含义。\n\n**输出 (必须是纯粹的 JSON，不含任何注释或 markdown):**\n{"sentence": "Your sentence here."}`;
                break;
            case 'reverse-translation':
                prompt = `你是一个严格遵守格式的 JSON API。你的唯一任务是根据输入生成一个用于翻译挑战的句子，并以指定的 JSON 格式返回。\n\n**输入:**\n- 单词: "${word}"\n- 含义: "${meaning}"\n\n**任务:**\n创建一个自然的中文句子，该句子适合作为对 "${word}" (${meaning}) 的逆向翻译挑战。\n\n**输出 (必须是纯粹的 JSON，不含任何注释或 markdown):**\n{"question": "你的中文句子。"}`;
                break;
            case 'cloze-test':
                prompt = `你是一位专业的英语出题老师，擅长提供深入、透彻的题目解析。\n\n任务: 请为单词 "${word}" (释义: "${meaning}") 创建一个高质量的完形填空题。\n\n**要求:**\n1.  **句子 (sentence):** 创建一个包含 "_____" 的英文句子，这个句子能有效考察对 "${word}" 的理解。\n2.  **选项 (options):** 提供四个选项，包括正确答案 "${word}" 和三个词性相同但词义明显不符的干扰项。干扰项不应是正确答案的近义词。\n3.  **正确答案 (correctAnswer):** 指明哪个选项是正确答案。\n4.  **解析 (explanations):** 为每一个选项提供详细、有启发性的中文解析。\n    *   **对于正确答案:** 必须详细解释为什么它是最佳选项。解析应包含:\n        1.  该词的核心词义和用法。\n        2.  分析句子语境，说明空格处需要什么性质的词。\n        3.  阐述该词如何与句子中的关键词或逻辑关系完美匹配。\n    *   **对于错误答案:** 必须清晰地解释为什么该选项是错误的。解析应指出具体的错误原因（如：词义不符、感情色彩冲突、逻辑错误、常见搭配错误等），避免使用“与句意相反”或“与语境无关”这类过于笼统的描述。\n\n**输出格式要求:**\n请严格按照以下 JSON 格式返回，不要包含任何额外的解释、注释或 markdown 标记。\n\n{\n  "sentence": "As a doctor, she is a strong _____ for preventative healthcare.",\n  "options": ["advocate", "critic", "judge", "opponent"],\n  "correctAnswer": "advocate",\n  "explanations": {\n    "advocate": "正确。'Advocate' 作为名词意为“拥护者，提倡者”。句子语境是“作为一名医生，她对预防性医疗保健...”，空格前有 'strong' (坚定的)，说明需要一个表示支持态度的词。'Advocate' 完美符合语境，表示她是一位“坚定的拥护者”。",\n    "critic": "错误。'Critic' 意为“批评者，评论家”。这与句中“作为一名医生”的身份以及对“预防性医疗”这种积极事物的态度在逻辑上是冲突的。",\n    "judge": "错误。'Judge' 意为“法官，裁判”。虽然也是一种身份，但与医疗领域的语境完全不符，属于词义不匹配。",\n    "opponent": "错误。'Opponent' 意为“反对者，对手”。这与句意完全相反，医生通常会支持而非反对预防性医疗。"\n  }\n}`;
                break;
            case 'multi-word-challenge':
                const wordsToTest = appState.currentTestGroup.map(item => `"${item.word}" (含义: ${item.meaning})`).join(', ');
                prompt = `你是一位专业的英语出题老师，擅长将多个知识点融合在一个场景中进行考察。\n\n**任务:**\n请根据以下提供的一组单词及其目标释义，创建一个高质量、连贯、自然的英文句子，这个句子必须巧妙地将所有提供的单词都包含在内，并清晰地展示它们各自的目标含义。\n\n**提供的单词列表:**\n${wordsToTest}\n\n**核心要求:**\n1.  **全部包含 (All-Inclusive):** 句子必须包含所有提供的单词。\n2.  **精准释义 (Precision):** 每个单词在句子中的用法必须准确对应其给定的目标释义。\n3.  **自然流畅 (Natural Flow):** 句子必须读起来通顺、地道，不能是生硬的单词堆砌。整个句子应该构成一个有逻辑、有意义的场景。\n4.  **复杂度适中 (Appropriate Complexity):** 句子应具有一定的复杂度，以匹配高级英语学习者的水平，但不能过分晦涩。\n\n**输出格式要求:**\n请严格按照以下 JSON 格式返回，不要包含任何额外的解释、注释或 markdown 标记。\n\n{\n  "sentence": "A high-quality, natural-sounding English sentence that incorporates all the given words with their specified meanings."\n}`;
                break;
        }
        data = await callLLM(prompt, { useGlobalLoader: false });
    }

    if (!data) {
        document.getElementById('test-question').textContent = '出题失败，将自动跳过此题。';
        showToast('AI 出题失败，将自动跳过此题。', 'warning', { duration: 3000 });
        setTimeout(() => {
            appState.currentTestIndex++;
            loadTestQuestion();
        }, 1500);
        return;
    }

    switch (appState.currentTestMode) {
        case 'construction':
            title = '创意造句';
            if (data.sentence) {
                questionText = `
                    <div class="space-y-3">
                        <div><p class="text-sm font-semibold text-slate-500">目标单词</p><p class="text-xl font-bold text-blue-600">${word}</p></div>
                        <div><p class="text-sm font-semibold text-slate-500">目标释义</p><p class="text-lg">${meaning}</p></div>
                        <div><p class="text-sm font-semibold text-slate-500">参考例句 (由AI生成)</p><p class="text-slate-600 italic">"${data.sentence}"</p></div>
                        <p class="text-sm font-semibold text-slate-500 pt-2">请在下方造出你自己的句子：</p>
                    </div>`;
                answerArea.innerHTML = `<textarea id="test-answer-input" class="w-full p-3 border border-slate-300 rounded-lg" rows="4" placeholder="在这里输入你的句子..."></textarea><button onclick="submitTestAnswer()" class="mt-4 bg-green-600 text-white py-2 px-6 rounded-lg">提交答案</button>`;
                setTimeout(() => document.getElementById('test-answer-input')?.focus(), 100);
            }
            break;
        case 'multi-word-challenge':
            title = '关联造句';
            if (data.sentence) {
                const wordsHtml = appState.currentTestGroup.map(item => 
                    `<div class="p-2 bg-teal-50 rounded-md"><p class="font-bold text-teal-800">${item.word}</p><p class="text-xs text-teal-600">${item.meaning}</p></div>`
                ).join('');
                questionText = `
                    <div class="space-y-4">
                        <div>
                            <p class="text-sm font-semibold text-slate-500 mb-2">请在翻译中体现以下所有单词及释义：</p>
                            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${wordsHtml}</div>
                        </div>
                        <div>
                            <p class="text-sm font-semibold text-slate-500 mb-2">情景例句 (由AI生成):</p>
                            <p class="text-slate-600 text-lg bg-indigo-50 p-4 rounded-lg">"${data.sentence}"</p>
                        </div>
                    </div>`;
                answerArea.innerHTML = `<textarea id="test-answer-input" class="w-full p-3 border border-slate-300 rounded-lg" rows="4" placeholder="请在此输入你的翻译..."></textarea><button onclick="submitTestAnswer()" class="mt-4 bg-green-600 text-white py-2 px-6 rounded-lg">提交答案</button>`;
                setTimeout(() => document.getElementById('test-answer-input')?.focus(), 100);
            }
            break;
        case 'reverse-translation':
            title = '逆向翻译';
            if (data.question) {
                questionText = data.question;
                answerArea.innerHTML = `<textarea id="test-answer-input" class="w-full p-3 border border-slate-300 rounded-lg" rows="4" placeholder="在这里输入你的翻译..."></textarea><button onclick="submitTestAnswer()" class="mt-4 bg-green-600 text-white py-2 px-6 rounded-lg">提交答案</button>`;
                setTimeout(() => document.getElementById('test-answer-input')?.focus(), 100);
            }
            break;
        case 'cloze-test':
            title = '完形填空';
            if (data.sentence && data.explanations) {
                questionText = data.sentence;
                appState.currentTestExplanations = data.explanations;
                const options = data.options.sort(() => Math.random() - 0.5);
                const optionsHtml = options.map(opt => `<button class="w-full text-left p-3 rounded-lg cloze-option-btn" onclick="submitTestAnswer('${opt}', '${data.correctAnswer}')">${opt}</button>`).join('');
                answerArea.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">${optionsHtml}</div>`;
            }
            break;
    }

    if (!questionText) {
        document.getElementById('test-question').textContent = '出题失败，将自动跳过此题。';
        showToast('AI 出题失败，将自动跳过此题。', 'warning', { duration: 3000 });
        setTimeout(() => {
            appState.currentTestIndex++;
            loadTestQuestion();
        }, 1500);
        return;
    }

    if (appState.currentTestMode === 'construction' || appState.currentTestMode === 'multi-word-challenge') {
        document.getElementById('test-question').innerHTML = questionText;
    } else {
        document.getElementById('test-question').textContent = questionText.trim();
    }
    document.getElementById('test-title').textContent = title;
    document.getElementById('test-progress').textContent = `第 ${appState.currentTestIndex + 1} / ${appState.testPool.length} 题`;
    document.getElementById('test-question-container').style.display = 'block';
    document.getElementById('test-feedback-container').style.display = 'none';

    // 确保输入框和按钮状态被重置
    const answerInput = document.getElementById('test-answer-input');
    if (answerInput) answerInput.disabled = false;
    const submitButton = document.querySelector('#test-answer-area button');
    if (submitButton) submitButton.style.display = 'block';
    
    prefetchNextTestItem();
}

export async function submitTestAnswer(userAnswer, correctAnswer) {
    if (appState.currentTestMode !== 'cloze-test') {
        userAnswer = document.getElementById('test-answer-input').value;
        if (!userAnswer.trim()) { showToast('请输入答案！', 'warning'); return; }
    }

    const question = document.getElementById('test-question').textContent;
    let prompt = '', response = null;

    if (appState.currentTestMode === 'cloze-test') {
        const currentTestItem = appState.testPool[appState.currentTestIndex];
        const { word, meaning } = currentTestItem;
        const correct = userAnswer === correctAnswer;
        let feedbackHtml = '';
        const userExplanation = appState.currentTestExplanations[userAnswer] || `没有找到对 '${userAnswer}' 的解析。`;

        if (correct) {
            feedbackHtml = `<p>${userExplanation}</p>`;
        } else {
            const correctExplanation = appState.currentTestExplanations[correctAnswer] || `没有找到对正确答案 '${correctAnswer}' 的解析。`;
            feedbackHtml = `
                <div class="space-y-3 text-left">
                    <div>
                        <h5 class="font-semibold text-sm text-red-700">你的选择 (${userAnswer}):</h5>
                        <p class="text-sm">${userExplanation}</p>
                    </div>
                    <hr class="border-slate-300/50 my-2">
                    <div>
                        <h5 class="font-semibold text-sm text-green-700">正确答案 (${correctAnswer}):</h5>
                        <p class="text-sm text-green-800">${correctExplanation}</p>
                    </div>
                </div>
            `;
        }
        
        response = { correct, feedback: feedbackHtml };

        // Highlight options
        const buttons = document.querySelectorAll('.cloze-option-btn');
        buttons.forEach(btn => {
            btn.disabled = true;
            if (btn.textContent === correctAnswer) btn.classList.add('correct');
            else if (btn.textContent === userAnswer) btn.classList.add('incorrect');
        });
    } else {
        let currentTestItem, word, meaning;
        if (appState.currentTestMode !== 'multi-word-challenge') {
            currentTestItem = appState.testPool[appState.currentTestIndex];
            word = currentTestItem.word;
            meaning = currentTestItem.meaning;
        }

        if (appState.currentTestMode === 'construction') {
            prompt = `你是一位英语老师。
任务: 评估用户为单词 "${word}" (目标释义: "${meaning}") 造的句子。
用户的句子: "${userAnswer}"

评估标准:
1. 语法是否正确？
2. 是否自然地使用了 "${word}"？
3. 是否清晰地表达了 "${meaning}" 的含义？

输出格式要求:
请严格按照以下 JSON 格式返回。'correct' 字段仅当所有三点都基本满足时为 true。'feedback' 字段提供简洁、有针对性的中文反馈，如果句子有误，请指出关键问题并给出修改建议。

{
  "correct": true,
  "feedback": "句子语法正确，清晰地表达了目标含义。"
}`;
        } else if (appState.currentTestMode === 'reverse-translation') {
            prompt = `你是一位翻译考官。
任务: 评估一个逆向翻译挑战（中译英）。
- 中文原句: "${question}"
- 目标单词: "${word}" (应体现 "${meaning}" 的意思)
- 用户的英文翻译: "${userAnswer}"

**重要规则:**
- **用户的输入必须是英文翻译。** 如果用户直接提交了原始的中文句子，或提交了非英文内容，请将 'correct' 字段设为 false，并在 'feedback' 中明确指出“输入无效，请输入英文翻译。”

**评估标准:**
用户的翻译是否准确、地道地还原了中文原句的意思，并且正确使用了目标单词。

输出格式要求:
请严格按照以下 JSON 格式返回。'correct' 字段当翻译质量高时为 true。'feedback' 字段提供简洁、有针对性的中文反馈，如果翻译有误，请指出关键问题并给出参考翻译。

{
  "correct": true,
  "feedback": "翻译准确，地道地使用了目标单词。"
}`;
        } else if (appState.currentTestMode === 'multi-word-challenge') {
            const wordsToTest = appState.currentTestGroup.map(item => `"${item.word}" (含义: ${item.meaning})`).join(', ');
            const originalSentence = document.querySelector('#test-question .text-slate-600').textContent.replace(/"/g, '');
            prompt = `你是一位顶级的双语翻译专家和语言导师，任务是评估用户将一个包含多个核心单词的复杂英文句子翻译成中文的质量。\n\n**背景信息:**\n- **核心单词列表:** ${wordsToTest}\n- **原始英文例句:** "${originalSentence}"\n- **用户的中文翻译:** "${userAnswer}"\n\n**核心评估原则:**\n1.  **词义精准度 (Precision):** 评估的重中之重。翻译是否精准地传达了**每一个核心单词**在特定语境下的确切含义？\n2.  **完整性 (Completeness):** 翻译是否包含了原文的所有关键信息点，没有遗漏？\n3.  **语言自然度 (Idiomaticity):** 翻译是否符合中文的表达习惯，读起来是否流畅、地道，避免生硬的“翻译腔”。\n\n**评估要求:**\n1.  **评分 (correct):** 如果翻译精准传达了所有核心词义且无重大错误，则为 \`true\`，否则为 \`false\`。\n2.  **反馈 (feedback):** 提供一段简洁、有建设性的中文反馈。如果翻译正确，请予以肯定。如果翻译有误，请具体指出哪个（或哪些）单词的理解有偏差，并提供更优的翻译建议或完整的参考翻译。\n\n**输出格式要求:**\n请严格按照以下 JSON 格式返回，不要包含任何额外的解释、注释或 markdown 标记。\n\n{\n  "correct": true,\n  "feedback": "翻译非常出色，精准地表达了所有核心单词的含义，并且语句流畅自然。"\n}`;
        }
        
        const feedbackContainer = document.getElementById('test-feedback-container');
        const feedbackContentEl = document.getElementById('test-feedback-content');
        feedbackContainer.style.display = 'block';
        feedbackContentEl.innerHTML = `<div class="flex items-center"><div class="loader !w-6 !h-6 !border-2"></div><p class="ml-3 text-slate-500">AI 正在评判...</p></div>`;

        response = await callLLM(prompt, { useGlobalLoader: false });
    }

    if (!response || typeof response.correct === 'undefined' || !response.feedback) {
        showToast('AI 返回数据格式错误，请稍后重试。', 'error');
        document.getElementById('test-feedback-container').style.display = 'none';
        return;
    }

    document.getElementById('test-feedback-container').style.display = 'block';
    if (appState.currentTestMode !== 'cloze-test') {
        const answerArea = document.getElementById('test-answer-area');
        const input = answerArea.querySelector('textarea');
        const button = answerArea.querySelector('button');
        if (input) input.disabled = true;
        if (button) button.style.display = 'none';
    }

    let bgColor = '';
    if (response.correct) {
        bgColor = 'bg-green-100 text-green-800';
        if (appState.currentTestMode === 'multi-word-challenge') {
            appState.currentTestGroup.forEach(item => {
                appState.masteryState[item.word][item.meaning] = true;
            });
        } else {
            const currentTestItem = appState.testPool[appState.currentTestIndex];
            const { word, meaning } = currentTestItem;
            appState.masteryState[word][meaning] = true;
        }
        renderWordList();
        updateUnmasteredCount();
    } else {
        bgColor = 'bg-red-100 text-red-800';
    }
    document.getElementById('test-feedback-content').className = `p-4 rounded-lg ${bgColor}`;
    const title = `<p class="font-bold text-lg mb-2">${response.correct ? '回答正确' : '有待改进'}</p>`;
    document.getElementById('test-feedback-content').innerHTML = title + response.feedback;
}

export function nextTestQuestion() {
    if (appState.currentTestMode === 'multi-word-challenge') {
        appState.currentTestIndex += appState.currentTestGroup.length;
    } else {
        appState.currentTestIndex++;
    }
    loadTestQuestion();
}

function getTestPrefetchKey(index) {
    return `test_${appState.currentTestMode}_${index}`;
}

async function prefetchNextTestItem() {
    if (appState.isPrefetching) return;
    
    const nextIndex = (appState.currentTestMode === 'multi-word-challenge')
        ? appState.currentTestIndex + appState.currentTestGroup.length
        : appState.currentTestIndex + 1;
    if (nextIndex >= appState.testPool.length) return;

    const prefetchKey = getTestPrefetchKey(nextIndex);
    if (appState.prefetchCache[prefetchKey]) return;

    appState.isPrefetching = true;

    const nextTestItem = appState.testPool[nextIndex];
    const { word, meaning } = nextTestItem;
    let prompt = '';

    switch (appState.currentTestMode) {
        case 'construction':
            prompt = `你是一个严格遵守格式的 JSON API。你的唯一任务是根据输入生成一个包含特定单词的句子，并以指定的 JSON 格式返回。\n\n**输入:**\n- 单词: "${word}"\n- 含义: "${meaning}"\n\n**任务:**\n创建一个英文例句，该例句能清晰地展示单词 "${word}" 的 "${meaning}" 这个含义。\n\n**输出 (必须是纯粹的 JSON，不含任何注释或 markdown):**\n{"sentence": "Your sentence here."}`;
            break;
        case 'reverse-translation':
            prompt = `你是一个严格遵守格式的 JSON API。你的唯一任务是根据输入生成一个用于翻译挑战的句子，并以指定的 JSON 格式返回。\n\n**输入:**\n- 单词: "${word}"\n- 含义: "${meaning}"\n\n**任务:**\n创建一个自然的中文句子，该句子适合作为对 "${word}" (${meaning}) 的逆向翻译挑战。\n\n**输出 (必须是纯粹的 JSON，不含任何注释或 markdown):**\n{"question": "你的中文句子。"}`;
            break;
        case 'cloze-test':
            prompt = `你是一位专业的英语出题老师，擅长提供深入、透彻的题目解析。\n\n任务: 请为单词 "${word}" (释义: "${meaning}") 创建一个高质量的完形填空题。\n\n**要求:**\n1.  **句子 (sentence):** 创建一个包含 "_____" 的英文句子，这个句子能有效考察对 "${word}" 的理解。\n2.  **选项 (options):** 提供四个选项，包括正确答案 "${word}" 和三个词性相同但词义明显不符的干扰项。干扰项不应是正确答案的近义词。\n3.  **正确答案 (correctAnswer):** 指明哪个选项是正确答案。\n4.  **解析 (explanations):** 为每一个选项提供详细、有启发性的中文解析。\n    *   **对于正确答案:** 必须详细解释为什么它是最佳选项。解析应包含:\n        1.  该词的核心词义和用法。\n        2.  分析句子语境，说明空格处需要什么性质的词。\n        3.  阐述该词如何与句子中的关键词或逻辑关系完美匹配。\n    *   **对于错误答案:** 必须清晰地解释为什么该选项是错误的。解析应指出具体的错误原因（如：词义不符、感情色彩冲突、逻辑错误、常见搭配错误等），避免使用“与句意相反”或“与语境无关”这类过于笼统的描述。\n\n**输出格式要求:**\n请严格按照以下 JSON 格式返回，不要包含任何额外的解释、注释或 markdown 标记。\n\n{\n  "sentence": "As a doctor, she is a strong _____ for preventative healthcare.",\n  "options": ["advocate", "critic", "judge", "opponent"],\n  "correctAnswer": "advocate",\n  "explanations": {\n    "advocate": "正确。'Advocate' 作为名词意为“拥护者，提倡者”。句子语境是“作为一名医生，她对预防性医疗保健...”，空格前有 'strong' (坚定的)，说明需要一个表示支持态度的词。'Advocate' 完美符合语境，表示她是一位“坚定的拥护者”。",\n    "critic": "错误。'Critic' 意为“批评者，评论家”。这与句中“作为一名医生”的身份以及对“预防性医疗”这种积极事物的态度在逻辑上是冲突的。",\n    "judge": "错误。'Judge' 意为“法官，裁判”。虽然也是一种身份，但与医疗领域的语境完全不符，属于词义不匹配。",\n    "opponent": "错误。'Opponent' 意为“反对者，对手”。这与句意完全相反，医生通常会支持而非反对预防性医疗。"\n  }\n}`;
            break;
        case 'multi-word-challenge':
            const groupSize = Math.min(appState.testPool.length - nextIndex, 5);
            if (groupSize <= 0) break;
            const group = appState.testPool.slice(nextIndex, nextIndex + groupSize);
            const wordsToTest = group.map(item => `"${item.word}" (含义: ${item.meaning})`).join(', ');
            prompt = `你是一位专业的英语出题老师，擅长将多个知识点融合在一个场景中进行考察。\n\n**任务:**\n请根据以下提供的一组单词及其目标释义，创建一个高质量、连贯、自然的英文句子，这个句子必须巧妙地将所有提供的单词都包含在内，并清晰地展示它们各自的目标含义。\n\n**提供的单词列表:**\n${wordsToTest}\n\n**核心要求:**\n1.  **全部包含 (All-Inclusive):** 句子必须包含所有提供的单词。\n2.  **精准释义 (Precision):** 每个单词在句子中的用法必须准确对应其给定的目标释义。\n3.  **自然流畅 (Natural Flow):** 句子必须读起来通顺、地道，不能是生硬的单词堆砌。整个句子应该构成一个有逻辑、有意义的场景。\n4.  **复杂度适中 (Appropriate Complexity):** 句子应具有一定的复杂度，以匹配高级英语学习者的水平，但不能过分晦涩。\n\n**输出格式要求:**\n请严格按照以下 JSON 格式返回，不要包含任何额外的解释、注释或 markdown 标记。\n\n{\n  "sentence": "A high-quality, natural-sounding English sentence that incorporates all the given words with their specified meanings."\n}`;
            break;
    }
    
    const response = await callLLM(prompt, { useGlobalLoader: false, retries: 1 });
    if (response) {
        appState.prefetchCache[prefetchKey] = response;
    }
    appState.isPrefetching = false;
}
