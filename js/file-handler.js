import { appState } from './state.js';
import { showToast, renderWordList, updateUnmasteredCount } from './ui.js';
import { initializeMasteryState } from './learning.js';

const fileInfo = document.getElementById('file-info');
const fileInput = document.getElementById('file-input');

export function handleFile(file) {
    const reader = new FileReader();
    if (file.name.endsWith('.csv')) {
        reader.onload = (e) => parseCSV(e.target.result);
        reader.readAsText(new Blob([file], { type: "text/csv;charset=utf-8" }));
    } else if (file.name.endsWith('.json')) {
        reader.onload = (e) => loadProgress(e.target.result);
        reader.readAsText(file);
    } else {
        showToast('不支持的文件类型。请上传 .csv 或 .json 文件。', 'error');
    }
}

function processLoadedData() {
    renderWordList();
    updateUnmasteredCount();
    document.getElementById('test-controls').classList.remove('hidden');
    document.getElementById('data-controls').classList.remove('hidden');
}

export function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 3) {
        showToast('CSV 文件格式不正确，至少需要3行（标题、表头、数据）。', 'error');
        return;
    }
    appState.headers = lines[1].split(',').map(h => h.trim());
    const wordIndex = appState.headers.indexOf('单词');
    if (wordIndex === -1) {
        showToast('CSV 文件必须包含 "单词" 列。', 'error');
        return;
    }
    appState.allWords = lines.slice(2).map(line => {
        const values = line.split(',');
        const wordObject = {};
        appState.headers.forEach((header, i) => { wordObject[header] = values[i] ? values[i].trim() : ''; });
        return wordObject;
    }).filter(wordObj => wordObj['单词']);
    initializeMasteryState();
    fileInfo.textContent = `成功加载 ${appState.allWords.length} 个单词！`;
    processLoadedData();
}

function loadProgress(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (data.allWords && data.masteryState && data.headers) {
            appState.allWords = data.allWords;
            appState.masteryState = data.masteryState;
            appState.headers = data.headers;
            renderWordList();
            updateUnmasteredCount();
            fileInfo.textContent = `成功导入 ${appState.allWords.length} 个单词的进度！`;
            document.getElementById('test-controls').classList.remove('hidden');
        } else {
            showToast('导入的文件格式不正确。', 'error');
        }
    } catch (error) {
        showToast('解析进度文件失败，请确保文件是正确的JSON格式。', 'error');
        console.error("JSON Parse Error:", error);
    }
}

export function exportData() {
    if (appState.allWords.length === 0) { showToast('没有数据可以导出。', 'warning'); return; }
    const dataToExport = {
        allWords: appState.allWords,
        masteryState: appState.masteryState,
        headers: appState.headers
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'word_learner_progress.json';
    a.click();
    URL.revokeObjectURL(url);
}

export function importData() {
    fileInput.click();
}

export function downloadTemplate() {
    const title = "AI 智能单词陪练 - 单词导入模板";
    const headers = "单词,常见含义,词性,考研高频考法,巧记方法（仅供参考）";
    const example = "example,an instance serving for illustration;a particular case,n,This is a frequent usage.,e.g.";
    
    const csvContent = `${title}\n${headers}\n${example}`;
    
    // 使用 \uFEFF (BOM) 确保 Excel 正确识别 UTF-8 编码
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'word_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
