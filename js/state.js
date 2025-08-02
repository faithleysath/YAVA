export const apiSettings = {
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta', // 用户必须在设置中配置
    modelName: 'gemini-2.5-flash-lite'
};

export const appState = {
    allWords: [],
    headers: [],
    masteryState: {},
    currentWord: null,
    currentMeaningIndex: 0,
    currentView: 'home',
    isLoading: false,
    testPool: [],
    currentTestIndex: 0,
    currentTestMode: '',
    currentTestExplanations: null,
    prefetchCache: {},
    isPrefetching: false
};
