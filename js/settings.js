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

// 存储每个预设的API Key
let presetApiKeys = {
    'gemini': '',
    'gemini-proxy': '',
    'deepseek': '',
    'custom': ''
};

// 当前选中的预设
let currentPreset = 'gemini';

export function openSettingsModal() {
    // 根据当前预设加载对应的API Key
    apiKeyInput.value = presetApiKeys[currentPreset] || '';
    baseUrlInput.value = apiSettings.baseUrl;
    modelNameInput.value = apiSettings.modelName;
    updatePresetButtons(); // This will also set the initial disabled state
    settingsModal.style.display = 'flex';
    
    // 自动focus到API Key输入框
    setTimeout(() => {
        apiKeyInput.focus();
    }, 100);
}

export function closeSettingsModal() {
    settingsModal.style.display = 'none';
}

export function saveSettings() {
    // 保存当前预设的API Key
    presetApiKeys[currentPreset] = apiKeyInput.value.trim();
    
    apiSettings.apiKey = apiKeyInput.value.trim();
    apiSettings.baseUrl = baseUrlInput.value.trim();
    apiSettings.modelName = modelNameInput.value.trim();
    
    if (!apiSettings.apiKey || !apiSettings.baseUrl || !apiSettings.modelName) {
        showToast('API Key, Base URL 和模型名称均为必填项。', 'warning');
        return;
    }

    // 保存API设置和预设API Key
    localStorage.setItem('apiSettings', JSON.stringify(apiSettings));
    localStorage.setItem('presetApiKeys', JSON.stringify(presetApiKeys));
    localStorage.setItem('currentPreset', currentPreset);
    
    showToast('设置已保存！', 'success');
    closeSettingsModal();
}

export function loadSettings() {
    const savedSettings = localStorage.getItem('apiSettings');
    if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        Object.assign(apiSettings, parsedSettings);
    }
    
    // 加载预设API Key
    const savedPresetApiKeys = localStorage.getItem('presetApiKeys');
    if (savedPresetApiKeys) {
        const parsedPresetApiKeys = JSON.parse(savedPresetApiKeys);
        Object.assign(presetApiKeys, parsedPresetApiKeys);
    }
    
    // 加载当前预设
    const savedCurrentPreset = localStorage.getItem('currentPreset');
    if (savedCurrentPreset) {
        currentPreset = savedCurrentPreset;
    }
}

export function applyPreset(presetName) {
    // 保存当前预设的API Key
    presetApiKeys[currentPreset] = apiKeyInput.value.trim();
    
    // 更新当前预设
    currentPreset = presetName;
    
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

        // 加载自定义预设的API Key
        apiKeyInput.value = presetApiKeys[presetName] || '';
        apiKeyInput.focus();
    } else if (presets[presetName]) {
        baseUrlInput.value = presets[presetName].baseUrl;
        modelNameInput.value = presets[presetName].modelName;
        
        // 所有预设都只锁定Base URL，允许用户自定义模型名称
        baseUrlInput.disabled = true;
        modelNameInput.disabled = false;
        
        // 加载对应预设的API Key
        apiKeyInput.value = presetApiKeys[presetName] || '';
        apiKeyInput.focus();
        
        // 更新按钮状态
        updatePresetButtons();
    }
}

function updatePresetButtons() {
    const currentBaseUrl = baseUrlInput.value.trim();

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

    let matchedPreset = false;
    
    // 检查是否匹配预设的 Base URL
    if (currentBaseUrl === presets.gemini.baseUrl) {
        // Gemini 直连
        geminiBtn.className = `${baseClasses} ${activeClass}`;
        baseUrlInput.disabled = true;
        modelNameInput.disabled = false;
        currentPreset = 'gemini';
        matchedPreset = true;
    } else if (currentBaseUrl === presets['gemini-proxy'].baseUrl) {
        // Gemini 中转
        if (geminiProxyBtn) geminiProxyBtn.className = `${baseClasses} ${activeClass}`;
        baseUrlInput.disabled = true;
        modelNameInput.disabled = false;
        currentPreset = 'gemini-proxy';
        matchedPreset = true;
    } else if (currentBaseUrl === presets.deepseek.baseUrl) {
        // DeepSeek
        deepseekBtn.className = `${baseClasses} ${activeClass}`;
        baseUrlInput.disabled = true;
        modelNameInput.disabled = false;
        currentPreset = 'deepseek';
        matchedPreset = true;
    }
    
    if (!matchedPreset) {
        // 完全自定义
        customBtn.className = `${baseClasses} ${activeClass}`;
        baseUrlInput.disabled = false;
        modelNameInput.disabled = false;
        currentPreset = 'custom';
    }
}
