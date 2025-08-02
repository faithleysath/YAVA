import { appState } from './state.js';
import { handleFile, exportData, importData, downloadTemplate } from './file-handler.js';
import { submitTranslation, nextStep } from './learning.js';
import { startTest, submitTestAnswer, nextTestQuestion } from './testing.js';
import { openSettingsModal, closeSettingsModal, saveSettings, loadSettings, applyPreset } from './settings.js';
import { checkVersionUpdate, showChangelogManually } from './version.js';

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const baseUrlInput = document.getElementById('base-url-input');
const modelNameInput = document.getElementById('model-name-input');

// Initial setup
document.addEventListener('DOMContentLoaded', async () => {
    loadSettings();
    
    // 检查版本更新
    await checkVersionUpdate();

    // Event Listeners
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drop-zone-active'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drop-zone-active'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-zone-active');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFile(files[0]);
    });
    fileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) handleFile(e.target.files[0]); });

    baseUrlInput.addEventListener('input', () => applyPreset('custom'));
    modelNameInput.addEventListener('input', () => applyPreset('custom'));

    window.addEventListener('beforeunload', (event) => {
        if (appState.allWords.length > 0) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
});

// Expose functions to global scope for inline event handlers
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
window.applyPreset = applyPreset;
window.importData = importData;
window.exportData = exportData;
window.downloadTemplate = downloadTemplate;
window.startTest = startTest;
window.submitTranslation = submitTranslation;
window.nextStep = nextStep;
window.submitTestAnswer = submitTestAnswer;
window.nextTestQuestion = nextTestQuestion;
window.showChangelogManually = showChangelogManually;
