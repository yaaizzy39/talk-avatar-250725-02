class TextToSpeechApp {
    constructor() {
        this.currentAudio = null;
        this.isPlaying = false;
        this.chatHistory = [];
        this.geminiApiKeyValue = localStorage.getItem('gemini_api_key') || '';
        this.audioContext = null;
        this.audioSource = null;
        this.gainNode = null;
        this.audioCache = new Map(); // 音声キャッシュ
        this.initializeElements();
        this.attachEventListeners();
        this.updateSliderValues();
        this.loadApiKey();
        this.loadSettings();
        this.loadAvailableModels();
    }

    initializeElements() {
        this.textInput = document.getElementById('textInput');
        this.charCount = document.getElementById('charCount');
        this.chatHistoryEl = document.getElementById('chatHistory');
        this.sendBtn = document.getElementById('sendBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.modelSelect = document.getElementById('modelSelect');
        this.modelInfo = document.getElementById('modelInfo');
        this.refreshModelsBtn = document.getElementById('refreshModelsBtn');
        this.customModelId = document.getElementById('customModelId');
        this.addModelBtn = document.getElementById('addModelBtn');
        this.availableModels = [];
        this.speedSlider = document.getElementById('speedSlider');
        this.speedValue = document.getElementById('speedValue');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.geminiApiKey = document.getElementById('geminiApiKey');
        this.maxLength = document.getElementById('maxLength');
        this.audioQuality = document.getElementById('audioQuality');
        
        // 音声入力要素の初期化
        this.voiceInputBtn = document.getElementById('voiceInputBtn');
        this.continuousVoiceBtn = document.getElementById('continuousVoiceBtn');
        this.voiceStatus = document.getElementById('voiceStatus');
        this.recognition = null;
        this.continuousRecognition = null;
        this.isListening = false;
        this.isContinuousMode = false;
        this.initializeSpeechRecognition();
        
        // 設定変更の監視
        this.maxLength.addEventListener('input', () => {
            this.saveSettings();
        });
        
        this.audioQuality.addEventListener('change', () => {
            this.saveSettings();
        });
        this.saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
        this.apiStatus = document.getElementById('apiStatus');
        this.stopBtn = document.getElementById('stopBtn');
        this.stopContinuousBtn = document.getElementById('stopContinuousBtn');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.errorMessage = document.getElementById('errorMessage');
    }

    attachEventListeners() {
        // テキスト入力の文字数カウント
        this.textInput.addEventListener('input', () => {
            this.updateCharacterCount();
        });

        // メッセージ送信
        this.sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        // 履歴クリア
        this.clearBtn.addEventListener('click', () => {
            this.clearChatHistory();
        });

        // APIキー保存
        this.saveApiKeyBtn.addEventListener('click', () => {
            this.saveApiKey();
        });

        // モデル選択変更
        this.modelSelect.addEventListener('change', () => {
            this.updateModelInfo();
            this.saveSettings();
        });

        // モデル更新ボタン
        this.refreshModelsBtn.addEventListener('click', () => {
            this.loadAvailableModels();
        });

        // カスタムモデル追加
        this.addModelBtn.addEventListener('click', () => {
            this.addCustomModel();
        });

        // スライダーの値更新
        this.speedSlider.addEventListener('input', () => {
            this.speedValue.textContent = this.speedSlider.value;
            if (this.currentAudio) {
                this.currentAudio.playbackRate = parseFloat(this.speedSlider.value);
            }
            this.saveSettings();
        });

        this.volumeSlider.addEventListener('input', () => {
            this.volumeValue.textContent = this.volumeSlider.value;
            if (this.currentAudio) {
                this.currentAudio.volume = parseFloat(this.volumeSlider.value);
            }
            this.saveSettings();
        });

        // 音声停止ボタン
        this.stopBtn.addEventListener('click', () => {
            this.stopSpeech();
        });

        // 音声入力ボタン
        this.voiceInputBtn.addEventListener('click', () => {
            this.toggleVoiceInput();
        });

        // 常時待機モードボタン
        this.continuousVoiceBtn.addEventListener('click', () => {
            this.toggleContinuousMode();
        });

        // 常時待機停止ボタン
        this.stopContinuousBtn.addEventListener('click', () => {
            this.stopContinuousMode();
        });

        // キーボードショートカット
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    updateCharacterCount() {
        const length = this.textInput.value.length;
        this.charCount.textContent = length;
    }

    loadApiKey() {
        if (this.geminiApiKeyValue) {
            this.geminiApiKey.value = this.geminiApiKeyValue;
            this.updateApiStatus(true);
        } else {
            this.updateApiStatus(false);
        }
    }

    saveApiKey() {
        const apiKey = this.geminiApiKey.value.trim();
        if (!apiKey) {
            this.showError('APIキーを入力してください');
            return;
        }

        localStorage.setItem('gemini_api_key', apiKey);
        this.geminiApiKeyValue = apiKey;
        this.updateApiStatus(true);
        this.showStatus('APIキーを保存しました');
    }

    updateApiStatus(connected) {
        if (connected) {
            this.apiStatus.textContent = 'APIキーが設定されています';
            this.apiStatus.className = 'api-status connected';
            this.sendBtn.disabled = false;
        } else {
            this.apiStatus.textContent = 'APIキーが設定されていません';
            this.apiStatus.className = 'api-status disconnected';
            this.sendBtn.disabled = true;
        }
    }

    async sendMessage() {
        const message = this.textInput.value.trim();
        
        if (!message) {
            this.showError('メッセージを入力してください');
            return;
        }

        if (!this.geminiApiKeyValue) {
            this.showError('Gemini APIキーを設定してください');
            return;
        }

        // ユーザーメッセージを追加
        this.addMessageToChat('user', message);
        this.textInput.value = '';
        this.updateCharacterCount();

        // AIの返答を取得
        this.setLoadingState(true);
        this.hideError();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    apiKey: this.geminiApiKeyValue,
                    maxLength: parseInt(this.maxLength.value) || 100
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.status === 'error') {
                throw new Error(data.message);
            }

            // AIメッセージを追加
            this.addMessageToChat('assistant', data.response);
            
            // 自動音声再生
            await this.playTextToSpeech(data.response);

        } catch (error) {
            console.error('チャットエラー:', error);
            this.showError(`チャットエラー: ${error.message}`);
        } finally {
            this.setLoadingState(false);
        }
    }

    addMessageToChat(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${role}-message`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;
        
        messageDiv.appendChild(messageContent);
        
        // AIメッセージには再生ボタンを追加
        if (role === 'assistant') {
            const controls = document.createElement('div');
            controls.className = 'message-controls';
            
            const playBtn = document.createElement('button');
            playBtn.className = 'play-message-btn';
            playBtn.textContent = '🔊 再生';
            playBtn.addEventListener('click', () => {
                this.playTextToSpeech(content);
            });
            
            controls.appendChild(playBtn);
            messageDiv.appendChild(controls);
        }
        
        this.chatHistoryEl.appendChild(messageDiv);
        
        // 確実に最新メッセージにスクロール
        setTimeout(() => {
            this.chatHistoryEl.scrollTop = this.chatHistoryEl.scrollHeight;
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
    }

    clearChatHistory() {
        // ウェルカムメッセージ以外を削除
        const messages = this.chatHistoryEl.querySelectorAll('.user-message, .assistant-message:not(.welcome-message .assistant-message)');
        messages.forEach(message => message.remove());
    }

    async playTextToSpeech(text) {
        try {
            // モデル選択の検証
            if (!this.modelSelect.value) {
                console.error('モデルが選択されていません');
                this.showError('音声モデルが選択されていません');
                return;
            }

            // キャッシュキーを生成（テキスト + モデルID）
            const cacheKey = `${text}_${this.modelSelect.value}`;
            
            // キャッシュから音声データを確認
            if (this.audioCache.has(cacheKey)) {
                console.log('キャッシュから音声を再生:', text.substring(0, 20) + '...');
                const cachedAudioUrl = this.audioCache.get(cacheKey);
                await this.playAudioFromUrl(cachedAudioUrl);
                return;
            }

            console.log('新規音声生成 (直接AIVIS API):', text.substring(0, 20) + '...');
            console.log('使用モデル:', this.modelSelect.value);
            
            // AIVIS APIに直接アクセス（ストリーミング対応）
            await this.playTextToSpeechDirect(text, this.modelSelect.value);

        } catch (error) {
            console.error('音声再生エラー:', error);
            this.showError(`音声再生に失敗しました: ${error.message}`);
        } finally {
            this.setLoadingState(false);
        }
    }

    async playTextToSpeechDirect(text, modelId) {
        // AIVIS Cloud APIに直接アクセス（高速・ストリーミング対応）
        const response = await fetch('https://api.aivis-project.com/v1/tts/synthesize', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer aivis_SmA482mYEy2tQH3UZBKjFnNW9yEM3AaQ',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model_uuid: modelId,
                text: text,
                use_ssml: true,
                output_format: 'mp3', // ストリーミング対応のためMP3を使用
                output_sampling_rate: this.getOptimalSamplingRate(),
                output_bitrate: this.getOptimalBitrate(),
                speaking_rate: parseFloat(this.speedSlider.value) || 1.0,
                volume: parseFloat(this.volumeSlider.value) || 1.0,
                // 追加の最適化パラメータ
                leading_silence_seconds: 0.05, // 開始前の無音を短縮
                trailing_silence_seconds: 0.05, // 終了後の無音を短縮
                line_break_silence_seconds: 0.2 // 改行時の無音を短縮
            })
        });

        if (!response.ok) {
            let errorMessage = `AIVIS API error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    errorMessage += ` - ${errorData.detail}`;
                }
            } catch (e) {
                // JSON解析エラーは無視
            }
            throw new Error(errorMessage);
        }

        // ストリーミング再生の実装
        console.log('ストリーミング音声再生を開始...');
        await this.playStreamingAudio(response, text, modelId);
    }

    getOptimalSamplingRate() {
        // 音声品質設定に基づいて最適なサンプリングレートを選択
        const quality = this.audioQuality.value;
        switch (quality) {
            case 'high': return 48000;   // 高品質: 48kHz
            case 'medium': return 44100; // 標準品質: 44.1kHz
            case 'low': return 24000;    // 低品質（高速）: 24kHz
            default: return 44100;
        }
    }

    getOptimalBitrate() {
        // 音声品質設定に基づいて最適なビットレートを選択
        const quality = this.audioQuality.value;
        switch (quality) {
            case 'high': return 320;     // 高品質: 320kbps
            case 'medium': return 192;   // 標準品質: 192kbps
            case 'low': return 128;      // 低品質（高速）: 128kbps
            default: return 192;
        }
    }

    async playStreamingAudio(response, text, modelId) {
        try {
            // 既存の音声を停止
            this.stopSpeech();
            
            // MediaSource / ManagedMediaSource でストリーミング再生
            // iOS Safari は MediaSource 非対応だが、iOS 17.1 以降では代わりに ManagedMediaSource を利用
            const MediaSourceClass = window.MediaSource || window.ManagedMediaSource;
            
            if (!MediaSourceClass) {
                // ストリーミング非対応の場合はフォールバック
                console.warn('MediaSource未対応: 通常再生にフォールバック');
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                await this.playAudioFromUrl(audioUrl);
                return;
            }

            const mediaSource = new MediaSourceClass();
            this.currentAudio = new Audio(URL.createObjectURL(mediaSource));
            this.currentAudio.disableRemotePlayback = true; // ManagedMediaSource での再生に必要
            this.currentAudio.volume = parseFloat(this.volumeSlider.value) || 1.0;
            this.currentAudio.playbackRate = parseFloat(this.speedSlider.value) || 1.0;
            
            // 音声再生開始イベント
            this.currentAudio.addEventListener('play', () => {
                this.isPlaying = true;
                this.stopBtn.disabled = false;
                this.pauseContinuousMode(); // 常時待機モードを一時停止
                console.log('ストリーミング音声再生開始');
            });

            this.currentAudio.addEventListener('ended', () => {
                this.isPlaying = false;
                this.stopBtn.disabled = true;
                this.resumeContinuousMode(); // 常時待機モードを再開
                console.log('ストリーミング音声再生終了');
            });

            this.currentAudio.addEventListener('error', (e) => {
                console.error('ストリーミング音声再生エラー:', e);
                this.isPlaying = false;
                this.stopBtn.disabled = true;
                this.resumeContinuousMode();
            });

            // 音声再生を開始（データがまだ不完全でも開始）
            this.currentAudio.play().catch(console.error);

            mediaSource.addEventListener('sourceopen', async () => {
                const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
                
                // updating フラグが立っていたら updateend まで待つ
                const waitForIdle = () => 
                    sourceBuffer.updating ? 
                    new Promise(resolve => sourceBuffer.addEventListener('updateend', resolve, {once: true})) : 
                    Promise.resolve();

                const reader = response.body.getReader();
                
                try {
                    for (;;) {
                        const { value, done } = await reader.read();
                        
                        if (done) {
                            await waitForIdle(); // 最後の書き込みを待つ
                            console.log('ストリーミングデータ受信完了');
                            mediaSource.endOfStream();
                            
                            // ストリーミング完了後はキャッシュ処理をスキップ
                            // （ストリーミングは一度きりの再生のため）
                            break;
                        }
                        
                        await waitForIdle();
                        sourceBuffer.appendBuffer(value);
                        await waitForIdle();
                    }
                } catch (error) {
                    console.error('ストリーミングデータ処理エラー:', error);
                    if (mediaSource.readyState === 'open') {
                        mediaSource.endOfStream('network');
                    }
                }
            });

        } catch (error) {
            console.error('ストリーミング再生エラー:', error);
            // フォールバック: 通常の再生方式
            try {
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                await this.playAudioFromUrl(audioUrl);
            } catch (fallbackError) {
                console.error('フォールバック再生も失敗:', fallbackError);
                this.showError('音声再生に失敗しました');
            }
        }
    }

    async playAudioFromUrl(audioUrl) {
        try {
            // 既存の音声を停止
            this.stopSpeech();

            // 新しい音声を作成・再生（プリロード有効）
            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.preload = 'auto'; // プリロード有効化
            this.currentAudio.volume = parseFloat(this.volumeSlider.value);
            this.currentAudio.playbackRate = parseFloat(this.speedSlider.value);
            
            // 音声再生イベントリスナー
            this.currentAudio.addEventListener('loadstart', () => {
                console.log('音声読み込み開始');
            });

            this.currentAudio.addEventListener('canplaythrough', () => {
                console.log('音声再生可能');
            });

            this.currentAudio.addEventListener('play', () => {
                console.log('音声再生開始');
                this.isPlaying = true;
                this.stopBtn.disabled = false;
                
                // 音声再生中は常時待機モードを一時停止
                if (this.isContinuousMode) {
                    this.pauseContinuousMode();
                }
            });

            this.currentAudio.addEventListener('ended', () => {
                console.log('音声再生終了');
                this.resetPlaybackState();
            });

            this.currentAudio.addEventListener('error', (e) => {
                console.error('音声再生エラー:', e);
                this.showError('音声の再生に失敗しました');
                this.resetPlaybackState();
            });

            // 音声再生開始
            await this.currentAudio.play();

        } catch (error) {
            console.error('音声再生処理エラー:', error);
            this.showError(`音声再生に失敗しました: ${error.message}`);
            this.resetPlaybackState();
        }
    }

    updateSliderValues() {
        this.speedValue.textContent = this.speedSlider.value;
        this.volumeValue.textContent = this.volumeSlider.value;
    }

    saveSettings() {
        const settings = {
            speed: this.speedSlider.value,
            volume: this.volumeSlider.value,
            selectedModel: this.modelSelect.value,
            maxLength: this.maxLength.value,
            audioQuality: this.audioQuality.value,
            customModels: this.getCustomModels() // カスタムモデルも保存
        };
        
        localStorage.setItem('tts_app_settings', JSON.stringify(settings));
        console.log('設定を保存しました:', settings);
    }

    getCustomModels() {
        // カスタムモデル（手動追加されたもの）を取得
        const customModels = [];
        Array.from(this.modelSelect.options).forEach(option => {
            if (option.textContent.includes('カスタムモデル')) {
                customModels.push({
                    uuid: option.value,
                    name: option.textContent
                });
            }
        });
        return customModels;
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('tts_app_settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                console.log('設定を読み込みました:', settings);
                
                // 音声設定を復元
                if (settings.speed) {
                    this.speedSlider.value = settings.speed;
                    this.speedValue.textContent = settings.speed;
                }
                
                if (settings.volume) {
                    this.volumeSlider.value = settings.volume;
                    this.volumeValue.textContent = settings.volume;
                }
                
                // AI設定を復元
                if (settings.maxLength) {
                    this.maxLength.value = settings.maxLength;
                }
                
                if (settings.audioQuality) {
                    this.audioQuality.value = settings.audioQuality;
                }
                
                // モデル選択とカスタムモデルは後で復元（モデル一覧読み込み後）
                this.savedModelId = settings.selectedModel;
                this.savedCustomModels = settings.customModels || [];
            }
        } catch (error) {
            console.error('設定の読み込みに失敗:', error);
        }
    }

    restoreModelSelection() {
        // カスタムモデルを復元
        if (this.savedCustomModels && this.savedCustomModels.length > 0) {
            this.savedCustomModels.forEach(customModel => {
                // 既に存在しないかチェック
                const exists = Array.from(this.modelSelect.options).some(opt => opt.value === customModel.uuid);
                if (!exists) {
                    const option = document.createElement('option');
                    option.value = customModel.uuid;
                    option.textContent = customModel.name;
                    this.modelSelect.appendChild(option);
                    console.log('カスタムモデルを復元:', customModel.name);
                }
            });
            this.savedCustomModels = null; // 使用後はクリア
        }

        // モデル選択を復元
        if (this.savedModelId) {
            const option = Array.from(this.modelSelect.options).find(opt => opt.value === this.savedModelId);
            if (option) {
                this.modelSelect.value = this.savedModelId;
                this.updateModelInfo();
                console.log('モデル選択を復元しました:', this.savedModelId);
            } else {
                console.warn('保存されたモデルが見つかりません:', this.savedModelId);
            }
            this.savedModelId = null; // 使用後はクリア
        }
    }

    async loadAvailableModels() {
        try {
            this.modelSelect.innerHTML = '<option value="">モデルを読み込み中...</option>';
            this.refreshModelsBtn.disabled = true;

            // サーバー経由でモデル一覧を取得
            const response = await fetch('/api/models');
            if (response.ok) {
                const models = await response.json();
                this.availableModels = models;
                this.populateModelSelect();
            } else {
                // フォールバック: デフォルトモデルを使用
                this.useDefaultModels();
            }
        } catch (error) {
            console.error('モデル一覧の取得に失敗:', error);
            this.useDefaultModels();
        } finally {
            this.refreshModelsBtn.disabled = false;
            // モデル一覧読み込み完了後に保存されたモデルを復元
            this.restoreModelSelection();
        }
    }

    useDefaultModels() {
        // デフォルトモデル（動作確認済みのモデルのみ）
        this.availableModels = [
            {
                uuid: 'a59cb814-0083-4369-8542-f51a29e72af7',
                name: 'デフォルトモデル',
                description: '標準的な音声モデル（動作確認済み）',
                voice_type: 'female',
                styles: ['normal']
            }
        ];
        this.populateModelSelect();
    }

    populateModelSelect() {
        this.modelSelect.innerHTML = '';
        
        // モデルを声のタイプ別にグループ化
        const groupedModels = {};
        this.availableModels.forEach(model => {
            const group = this.getVoiceTypeLabel(model.voice_type);
            if (!groupedModels[group]) {
                groupedModels[group] = [];
            }
            groupedModels[group].push(model);
        });

        // グループごとにオプションを追加
        Object.keys(groupedModels).forEach(groupName => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = groupName;
            
            groupedModels[groupName].forEach(model => {
                const option = document.createElement('option');
                option.value = model.uuid;
                option.textContent = model.name;
                option.dataset.modelData = JSON.stringify(model);
                optgroup.appendChild(option);
            });
            
            this.modelSelect.appendChild(optgroup);
        });

        // 最初のモデルを選択（復元は後で行う）
        if (this.availableModels.length > 0) {
            this.modelSelect.value = this.availableModels[0].uuid;
            this.updateModelInfo();
        } else {
            // フォールバック: デフォルトモデルを設定
            this.modelSelect.innerHTML = '<option value="a59cb814-0083-4369-8542-f51a29e72af7">デフォルトモデル</option>';
            this.modelSelect.value = 'a59cb814-0083-4369-8542-f51a29e72af7';
        }
    }

    getVoiceTypeLabel(voiceType) {
        const labels = {
            'female': '女性の声',
            'male': '男性の声',
            'young_female': '若い女性の声',
            'young_male': '若い男性の声',
            'adult_female': '大人の女性の声',
            'adult_male': '大人の男性の声',
            'elderly_female': '年配の女性の声',
            'elderly_male': '年配の男性の声'
        };
        return labels[voiceType] || 'その他';
    }

    updateModelInfo() {
        const selectedOption = this.modelSelect.selectedOptions[0];
        if (selectedOption && selectedOption.dataset.modelData) {
            const model = JSON.parse(selectedOption.dataset.modelData);
            const stylesText = model.styles ? model.styles.join(', ') : 'normal';
            
            this.modelInfo.innerHTML = `
                <div class="model-details">
                    <strong>${model.name}</strong><br>
                    ${model.description}<br>
                    <small>声の種類: ${this.getVoiceTypeLabel(model.voice_type)} | スタイル: ${stylesText}</small>
                </div>
            `;
        } else {
            this.modelInfo.innerHTML = '<span class="model-description">モデルを選択すると詳細が表示されます</span>';
        }
    }

    addCustomModel() {
        const customId = this.customModelId.value.trim();
        
        if (!customId) {
            this.showError('有効なモデルUUIDを入力してください');
            return;
        }

        // UUID形式の簡単なチェック（8-4-4-4-12文字のパターン）
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(customId)) {
            this.showError('正しいUUID形式で入力してください（例: a59cb814-0083-4369-8542-f51a29e72af7）');
            return;
        }
        
        // 既存の選択肢をチェック
        const existingOptions = Array.from(this.modelSelect.options);
        const exists = existingOptions.some(option => option.value === customId);
        
        if (exists) {
            this.showError('このモデルUUIDは既に追加されています');
            return;
        }

        // 新しい選択肢を追加
        const option = document.createElement('option');
        option.value = customId;
        option.textContent = `カスタムモデル (${customId.substring(0, 8)}...)`;
        this.modelSelect.appendChild(option);
        
        // 追加したモデルを選択
        this.modelSelect.value = customId;
        this.updateModelInfo();
        
        // 入力フィールドをクリア
        this.customModelId.value = '';
        
        // 設定を保存
        this.saveSettings();
        
        this.hideError();
    }

    async generateAndPlaySpeech() {
        const text = this.textInput.value.trim();
        
        if (!text) {
            this.showError('読み上げるテキストを入力してください');
            return;
        }

        if (text.length > 200) {
            this.showError('テキストは200文字以内で入力してください');
            return;
        }

        this.setLoadingState(true);
        this.hideError();

        try {
            const requestData = {
                text: text,
                modelId: this.modelSelect.value,
                quality: this.audioQuality.value
            };

            console.log('AIVIS Cloud APIにリクエスト送信:', requestData);

            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            // レスポンスのContent-Typeをチェック
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('audio/')) {
                // 音声データの場合、直接再生
                console.log('音声データを受信:', contentType);
                const audioBlob = await response.blob();
                await this.playAudioFromBlob(audioBlob);
            } else {
                // JSONレスポンスの場合
                const data = await response.json();
                console.log('APIレスポンス:', data);

                if (data.status === 'error') {
                    throw new Error(data.message || 'APIエラーが発生しました');
                }

                if (data.audioData) {
                    // Base64音声データの場合
                    await this.playAudioFromBase64(data.audioData);
                } else if (data.data) {
                    // その他のデータ形式の場合
                    console.log('データを受信しましたが、音声形式が不明です');
                    this.showError('音声データの形式が不明です');
                } else {
                    throw new Error('音声データを取得できませんでした');
                }
            }

        } catch (error) {
            console.error('音声生成エラー:', error);
            this.showError(`音声生成に失敗しました: ${error.message}`);
        } finally {
            this.setLoadingState(false);
        }
    }

    async playAudioFromBlob(audioBlob) {
        try {
            // BlobからURLを作成
            const audioUrl = URL.createObjectURL(audioBlob);

            // 既存の音声を停止
            this.stopSpeech();

            // 新しい音声を作成・再生（プリロード有効）
            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.preload = 'auto'; // プリロード有効化
            this.currentAudio.volume = parseFloat(this.volumeSlider.value);
            this.currentAudio.playbackRate = parseFloat(this.speedSlider.value);
            
            // 音声再生イベントリスナー
            this.currentAudio.addEventListener('loadstart', () => {
                console.log('音声読み込み開始');
            });

            this.currentAudio.addEventListener('canplaythrough', () => {
                console.log('音声再生可能');
            });

            this.currentAudio.addEventListener('play', () => {
                console.log('音声再生開始');
                this.isPlaying = true;
                this.stopBtn.disabled = false;
                
                // 音声再生中は常時待機モードを一時停止
                if (this.isContinuousMode) {
                    this.pauseContinuousMode();
                }
            });

            this.currentAudio.addEventListener('ended', () => {
                console.log('音声再生終了');
                this.resetPlaybackState();
                URL.revokeObjectURL(audioUrl);
                
                // 常時待機モードが有効な場合は再開を試行
                if (this.isContinuousMode) {
                    setTimeout(() => {
                        this.resumeContinuousMode();
                    }, 1500);
                }
            });

            this.currentAudio.addEventListener('error', (e) => {
                console.error('音声再生エラー:', e);
                this.showError('音声の再生に失敗しました');
                this.resetPlaybackState();
                URL.revokeObjectURL(audioUrl);
            });

            // 音声再生開始
            await this.currentAudio.play();

        } catch (error) {
            console.error('音声再生処理エラー:', error);
            this.showError(`音声再生に失敗しました: ${error.message}`);
            this.resetPlaybackState();
        }
    }

    async playAudioFromBase64(base64Data) {
        try {
            // Base64データからバイナリデータに変換
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Blobオブジェクトを作成
            const audioBlob = new Blob([bytes], { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);

            // 既存の音声を停止
            this.stopSpeech();

            // 新しい音声を作成・再生（プリロード有効）
            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.preload = 'auto'; // プリロード有効化
            this.currentAudio.volume = parseFloat(this.volumeSlider.value);
            this.currentAudio.playbackRate = parseFloat(this.speedSlider.value);
            
            // 音声再生イベントリスナー
            this.currentAudio.addEventListener('loadstart', () => {
                console.log('音声読み込み開始');
            });

            this.currentAudio.addEventListener('canplaythrough', () => {
                console.log('音声再生可能');
            });

            this.currentAudio.addEventListener('play', () => {
                console.log('音声再生開始');
                this.isPlaying = true;
                this.stopBtn.disabled = false;
                
                // 音声再生中は常時待機モードを一時停止
                if (this.isContinuousMode) {
                    this.pauseContinuousMode();
                }
            });

            this.currentAudio.addEventListener('ended', () => {
                console.log('音声再生終了');
                this.resetPlaybackState();
                URL.revokeObjectURL(audioUrl);
                
                // 常時待機モードが有効な場合は再開を試行
                if (this.isContinuousMode) {
                    setTimeout(() => {
                        this.resumeContinuousMode();
                    }, 1500);
                }
            });

            this.currentAudio.addEventListener('error', (e) => {
                console.error('音声再生エラー:', e);
                this.showError('音声の再生に失敗しました');
                this.resetPlaybackState();
                URL.revokeObjectURL(audioUrl);
            });

            // 音声再生開始
            await this.currentAudio.play();

        } catch (error) {
            console.error('音声再生処理エラー:', error);
            this.showError(`音声再生に失敗しました: ${error.message}`);
            this.resetPlaybackState();
        }
    }

    stopSpeech() {
        if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
        }
        this.resetPlaybackState();
    }

    resetPlaybackState() {
        this.isPlaying = false;
        this.stopBtn.disabled = true;
        
        // 音声再生終了時に常時待機モードを再開
        if (this.isContinuousMode) {
            console.log('音声再生終了 - 常時待機モードを再開します');
            setTimeout(() => {
                this.resumeContinuousMode();
            }, 2000); // 少し長めの待機時間
        }
    }

    setLoadingState(isLoading) {
        if (isLoading) {
            this.loadingIndicator.classList.remove('hidden');
            this.sendBtn.disabled = true;
        } else {
            this.loadingIndicator.classList.add('hidden');
            if (this.geminiApiKeyValue) {
                this.sendBtn.disabled = false;
            }
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');
        
        // 5秒後に自動で非表示
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    showStatus(message) {
        // 簡単な実装：エラーメッセージ領域を一時的に使用
        this.errorMessage.textContent = message;
        this.errorMessage.style.background = '#d4edda';
        this.errorMessage.style.color = '#155724';
        this.errorMessage.style.border = '1px solid #c3e6cb';
        this.errorMessage.classList.remove('hidden');
        
        // 3秒後に自動で非表示
        setTimeout(() => {
            this.hideError();
            // 元の色に戻す
            this.errorMessage.style.background = '';
            this.errorMessage.style.color = '';
            this.errorMessage.style.border = '';
        }, 3000);
    }

    hideError() {
        this.errorMessage.classList.add('hidden');
    }

    // 音声認識の初期化
    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            // 通常の音声認識
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'ja-JP';
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            
            // 常時待機モード用の音声認識
            this.continuousRecognition = new SpeechRecognition();
            this.continuousRecognition.lang = 'ja-JP';
            this.continuousRecognition.continuous = true;
            this.continuousRecognition.interimResults = true;
            this.continuousRecognition.maxAlternatives = 1;
            
            // 音声認識イベントの設定
            this.recognition.onstart = () => {
                console.log('音声認識を開始しました');
                this.isListening = true;
                this.updateVoiceStatus('listening', '聞いています...');
                this.voiceInputBtn.classList.add('recording');
                this.voiceInputBtn.disabled = false;
            };
            
            this.recognition.onresult = (event) => {
                let transcript = '';
                let isFinal = false;
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        transcript += event.results[i][0].transcript;
                        isFinal = true;
                    } else {
                        transcript += event.results[i][0].transcript;
                    }
                }
                
                if (isFinal) {
                    console.log('音声認識結果:', transcript);
                    this.textInput.value = transcript;
                    this.updateCharacterCount();
                    this.updateVoiceStatus('processing', '音声を認識しました');
                } else {
                    // 暫定結果の表示
                    this.updateVoiceStatus('listening', `認識中: ${transcript}`);
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('音声認識エラー:', event.error);
                this.isListening = false;
                this.voiceInputBtn.classList.remove('recording');
                this.voiceInputBtn.disabled = false;
                
                let errorMessage = '音声認識でエラーが発生しました';
                switch (event.error) {
                    case 'no-speech':
                        errorMessage = '音声が検出されませんでした';
                        break;
                    case 'audio-capture':
                        errorMessage = 'マイクにアクセスできませんでした';
                        break;
                    case 'not-allowed':
                        errorMessage = 'マイクの使用が許可されていません';
                        break;
                    case 'network':
                        errorMessage = 'ネットワークエラーが発生しました';
                        break;
                }
                
                this.updateVoiceStatus('error', errorMessage);
            };
            
            this.recognition.onend = () => {
                console.log('音声認識を終了しました');
                this.isListening = false;
                this.voiceInputBtn.classList.remove('recording');
                this.voiceInputBtn.disabled = false;
                
                if (!this.voiceStatus.classList.contains('error')) {
                    this.updateVoiceStatus('', '音声入力: マイクボタンを押して話してください');
                }
            };
            
            console.log('音声認識が利用可能です');
            this.setupContinuousRecognition();
            this.updateVoiceStatus('', '音声入力: マイクボタンを押して話してください');
        } else {
            console.warn('音声認識がサポートされていません');
            this.voiceInputBtn.disabled = true;
            this.continuousVoiceBtn.disabled = true;
            this.updateVoiceStatus('error', '音声認識がサポートされていません');
        }
    }

    // 音声入力の開始/停止切り替え
    toggleVoiceInput() {
        if (!this.recognition) {
            this.updateVoiceStatus('error', '音声認識が利用できません');
            return;
        }
        
        if (this.isListening) {
            this.stopVoiceInput();
        } else {
            this.startVoiceInput();
        }
    }

    // 音声入力開始
    startVoiceInput() {
        try {
            this.voiceInputBtn.disabled = true;
            this.updateVoiceStatus('processing', '音声認識を開始しています...');
            this.recognition.start();
        } catch (error) {
            console.error('音声認識の開始に失敗:', error);
            this.updateVoiceStatus('error', '音声認識の開始に失敗しました');
            this.voiceInputBtn.disabled = false;
        }
    }

    // 音声入力停止
    stopVoiceInput() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    // 音声入力状態の更新
    updateVoiceStatus(type, message) {
        this.voiceStatus.className = `voice-status ${type}`;
        this.voiceStatus.innerHTML = message;
        
        // エラーの場合は5秒後に元に戻す
        if (type === 'error') {
            setTimeout(() => {
                this.voiceStatus.className = 'voice-status';
                this.voiceStatus.innerHTML = '<span class="voice-info">音声入力: マイクボタンを押して話してください</span>';
            }, 5000);
        }
    }

    // 常時待機モード用音声認識の設定
    setupContinuousRecognition() {
        this.continuousRecognition.onstart = () => {
            console.log('常時待機モード開始');
            this.isContinuousMode = true;
            this.updateVoiceStatus('listening', '常時待機中 - 話しかけてください');
        };

        this.continuousRecognition.onresult = (event) => {
            let transcript = '';
            let isFinal = false;
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    transcript += event.results[i][0].transcript;
                    isFinal = true;
                }
            }
            
            if (isFinal && transcript.trim()) {
                console.log('常時待機モード - 音声認識結果:', transcript);
                this.textInput.value = transcript;
                this.updateCharacterCount();
                this.updateVoiceStatus('processing', '音声を認識しました - 自動送信中...');
                
                // 1秒後に自動送信
                setTimeout(() => {
                    this.sendMessage();
                }, 1000);
            }
        };

        this.continuousRecognition.onerror = (event) => {
            console.error('常時待機モード - 音声認識エラー:', event.error);
            
            if (event.error === 'no-speech') {
                // 無音エラーの場合は再開
                if (this.isContinuousMode) {
                    setTimeout(() => {
                        this.restartContinuousRecognition();
                    }, 1000);
                }
            } else {
                this.stopContinuousMode();
                let errorMessage = '常時待機モードでエラーが発生しました';
                switch (event.error) {
                    case 'audio-capture':
                        errorMessage = 'マイクにアクセスできませんでした';
                        break;
                    case 'not-allowed':
                        errorMessage = 'マイクの使用が許可されていません';
                        break;
                    case 'network':
                        errorMessage = 'ネットワークエラーが発生しました';
                        break;
                }
                this.updateVoiceStatus('error', errorMessage);
            }
        };

        this.continuousRecognition.onend = () => {
            console.log('常時待機モード - 音声認識終了');
            if (this.isContinuousMode && !this.isPlaying) {
                // 音声再生中でなければ自動的に再開
                setTimeout(() => {
                    this.restartContinuousRecognition();
                }, 1000);
            }
        };
    }

    // 常時待機モードの開始/停止切り替え
    toggleContinuousMode() {
        if (!this.continuousRecognition) {
            this.updateVoiceStatus('error', '音声認識が利用できません');
            return;
        }

        if (this.isContinuousMode) {
            this.stopContinuousMode();
        } else {
            this.startContinuousMode();
        }
    }

    // 常時待機モード開始
    startContinuousMode() {
        try {
            // 通常の音声入力を停止
            if (this.isListening) {
                this.stopVoiceInput();
            }
            
            this.continuousVoiceBtn.style.display = 'none';
            this.stopContinuousBtn.style.display = 'flex';
            this.voiceInputBtn.disabled = true;
            this.updateVoiceStatus('processing', '常時待機モードを開始しています...');
            this.continuousRecognition.start();
        } catch (error) {
            console.error('常時待機モードの開始に失敗:', error);
            this.updateVoiceStatus('error', '常時待機モードの開始に失敗しました');
            this.continuousVoiceBtn.style.display = 'flex';
            this.stopContinuousBtn.style.display = 'none';
            this.voiceInputBtn.disabled = false;
        }
    }

    // 常時待機モード停止
    stopContinuousMode() {
        this.isContinuousMode = false;
        if (this.continuousRecognition) {
            try {
                this.continuousRecognition.stop();
            } catch (error) {
                console.error('常時待機モード停止エラー:', error);
            }
        }
        this.continuousVoiceBtn.classList.remove('active');
        this.continuousVoiceBtn.style.display = 'flex';
        this.stopContinuousBtn.style.display = 'none';
        this.voiceInputBtn.disabled = false;
        this.updateVoiceStatus('', '音声入力: マイクボタンを押して話してください');
    }

    // 常時待機モードの再開
    restartContinuousRecognition() {
        if (this.isContinuousMode && !this.isPlaying) {
            console.log('常時待機モード再開を試行中...');
            try {
                // 既存の認識が動作中でないことを確認
                if (this.continuousRecognition) {
                    this.continuousRecognition.start();
                    console.log('常時待機モード再開成功');
                }
            } catch (error) {
                console.error('常時待機モード再開エラー:', error);
                // 少し待ってから再試行
                if (error.name === 'InvalidStateError') {
                    setTimeout(() => {
                        if (this.isContinuousMode) {
                            this.restartContinuousRecognition();
                        }
                    }, 2000);
                } else {
                    // その他のエラーの場合は停止
                    this.stopContinuousMode();
                }
            }
        }
    }

    // 常時待機モードの一時停止
    pauseContinuousMode() {
        if (this.isContinuousMode && this.continuousRecognition) {
            try {
                this.continuousRecognition.stop();
                this.updateVoiceStatus('processing', '音声再生中 - 待機モード一時停止');
            } catch (error) {
                console.error('常時待機モード一時停止エラー:', error);
            }
        }
    }

    // 常時待機モードの再開
    resumeContinuousMode() {
        if (this.isContinuousMode && !this.isPlaying) {
            console.log('常時待機モード再開 - 音声再生終了後');
            try {
                this.continuousRecognition.start();
                this.updateVoiceStatus('listening', '常時待機中 - 話しかけてください');
                console.log('常時待機モード再開成功 - 音声再生終了後');
            } catch (error) {
                console.error('常時待機モード再開エラー:', error);
                // InvalidStateErrorの場合は少し待ってから再試行
                if (error.name === 'InvalidStateError') {
                    setTimeout(() => {
                        if (this.isContinuousMode && !this.isPlaying) {
                            this.resumeContinuousMode();
                        }
                    }, 1500);
                } else {
                    // その他のエラーの場合は停止
                    this.stopContinuousMode();
                }
            }
        }
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('テキスト読み上げアプリを初期化中...');
    new TextToSpeechApp();
    console.log('アプリケーション初期化完了');
});