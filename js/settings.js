import { apiSettings } from './state.js';
import { showToast } from './ui.js';

const settingsModal = document.getElementById('settings-modal');
const apiKeyInput = document.getElementById('api-key-input');
const baseUrlInput = document.getElementById('base-url-input');
const modelNameInput = document.getElementById('model-name-input');

const presets = {
    gemini: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        modelName: 'gemini-2.5-flash-lite'
    },
    'gemini-proxy': {
        baseUrl: '/api/callGemini',
        modelName: 'gemini-2.5-flash-lite'
    },
    deepseek: {
        baseUrl: 'https://api.deepseek.com/v1',
        modelName: 'deepseek-chat'
    }
};

export function openSettingsModal() {
    apiKeyInput.value = apiSettings.apiKey;
    baseUrlInput.value = apiSettings.baseUrl;
    modelNameInput.value = apiSettings.modelName;
    updatePresetButtons(); // This will also set the initial disabled state
    settingsModal.style.display = 'flex';
}

export function closeSettingsModal() {
    settingsModal.style.display = 'none';
}

export function saveSettings() {
    apiSettings.apiKey = apiKeyInput.value.trim();
    apiSettings.baseUrl = baseUrlInput.value.trim();
    apiSettings.modelName = modelNameInput.value.trim();
    
    if (!apiSettings.apiKey || !apiSettings.baseUrl || !apiSettings.modelName) {
        showToast('API Key, Base URL 和模型名称均为必填项。', 'warning');
        return;
    }

    localStorage.setItem('apiSettings', JSON.stringify(apiSettings));
    showToast('设置已保存！', 'success');
    closeSettingsModal();
}

export function loadSettings() {
    const savedSettings = localStorage.getItem('apiSettings');
    if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        Object.assign(apiSettings, parsedSettings);
    }
}

export function applyPreset(presetName) {
    if (presetName === 'custom') {
        // When custom is explicitly selected, enable inputs and set UI state directly.
        baseUrlInput.disabled = false;
        modelNameInput.disabled = false;
        
        const activeClass = 'border-2 border-blue-600 bg-blue-50 text-blue-700';
        const inactiveClass = 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50';
        const baseClasses = 'preset-btn font-semibold py-2 px-4 rounded-lg transition-colors text-sm';
        
        document.getElementById('preset-gemini').className = `${baseClasses} ${inactiveClass}`;
        const geminiProxyBtn = document.getElementById('preset-gemini-proxy');
        if (geminiProxyBtn) geminiProxyBtn.className = `${baseClasses} ${inactiveClass}`;
        document.getElementById('preset-deepseek').className = `${baseClasses} ${inactiveClass}`;
        document.getElementById('preset-custom').className = `${baseClasses} ${activeClass}`;

        baseUrlInput.focus();
    } else if (presets[presetName]) {
        baseUrlInput.value = presets[presetName].baseUrl;
        modelNameInput.value = presets[presetName].modelName;
        
        // 对于Gemini相关预设，只锁定Base URL，允许用户修改模型
        if (presetName === 'gemini-proxy' || presetName === 'gemini') {
            baseUrlInput.disabled = true;
            modelNameInput.disabled = false; // 允许修改模型
            modelNameInput.focus(); // 聚焦到模型输入框
        } else {
            // After setting values, let updatePresetButtons sync the UI.
            updatePresetButtons();
        }
    }
}

function updatePresetButtons() {
    const currentBaseUrl = baseUrlInput.value.trim();
    const currentModelName = modelNameInput.value.trim();

    const geminiBtn = document.getElementById('preset-gemini');
    const geminiProxyBtn = document.getElementById('preset-gemini-proxy');
    const deepseekBtn = document.getElementById('preset-deepseek');
    const customBtn = document.getElementById('preset-custom');

    const activeClass = 'border-2 border-blue-600 bg-blue-50 text-blue-700';
    const inactiveClass = 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50';
    
    const baseClasses = 'preset-btn font-semibold py-2 px-4 rounded-lg transition-colors text-sm';

    // Reset all buttons to inactive
    geminiBtn.className = `${baseClasses} ${inactiveClass}`;
    if (geminiProxyBtn) geminiProxyBtn.className = `${baseClasses} ${inactiveClass}`;
    deepseekBtn.className = `${baseClasses} ${inactiveClass}`;
    customBtn.className = `${baseClasses} ${inactiveClass}`;

    let isPresetMatch = false;
    let isGeminiWithCustomModel = false;
    
    if (currentBaseUrl === presets.gemini.baseUrl) {
        if (currentModelName === presets.gemini.modelName) {
            // 标准Gemini预设
            geminiBtn.className = `${baseClasses} ${activeClass}`;
            isPresetMatch = true;
        } else {
            // Gemini直连但使用自定义模型
            isGeminiWithCustomModel = true;
        }
    } else if (currentBaseUrl === presets['gemini-proxy'].baseUrl) {
        if (currentModelName === presets['gemini-proxy'].modelName) {
            // 标准中转预设
            if (geminiProxyBtn) geminiProxyBtn.className = `${baseClasses} ${activeClass}`;
            isPresetMatch = true;
        } else {
            // 中转服务但使用自定义模型
            isGeminiWithCustomModel = true;
        }
    } else if (currentBaseUrl === presets.deepseek.baseUrl && currentModelName === presets.deepseek.modelName) {
        deepseekBtn.className = `${baseClasses} ${activeClass}`;
        isPresetMatch = true;
    }

    if (isPresetMatch) {
        baseUrlInput.disabled = true;
        modelNameInput.disabled = true;
    } else if (isGeminiWithCustomModel) {
        // Gemini服务 + 自定义模型：锁定Base URL，允许修改模型
        customBtn.className = `${baseClasses} ${activeClass}`;
        baseUrlInput.disabled = true;
        modelNameInput.disabled = false;
    } else {
        // 完全自定义
        customBtn.className = `${baseClasses} ${activeClass}`;
        baseUrlInput.disabled = false;
        modelNameInput.disabled = false;
    }
}
