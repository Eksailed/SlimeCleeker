// Yandex Games SDK Integration Wrapper
// Full support for Cloud Saves, Interstitial Ads, Rewarded Ads, Leaderboards, and Local Testing Mock

class YandexSDKManager {
  constructor() {
    this.ysdk = null;
    this.player = null;
    this.lb = null;
    this.isInitialized = false;
    this.isMock = false;
    this.lastInterstitialTime = 0;
    this.interstitialCooldown = 60 * 1000; // 60 seconds interval for moderation compliance
  }

  async init() {
    return new Promise((resolve) => {
      if (typeof YaGames === 'undefined') {
        console.warn('[YandexSDK] YaGames SDK script not found. Running in MOCK / LOCAL mode.');
        this.isMock = true;
        this.isInitialized = true;
        resolve(false);
        return;
      }

      YaGames.init()
        .then(async (sdk) => {
          this.ysdk = sdk;
          this.isInitialized = true;
          console.log('[YandexSDK] Initialized successfully.');

          // Tell Yandex platform that game is ready
          try {
            if (this.ysdk.features.LoadingAPI) {
              this.ysdk.features.LoadingAPI.ready();
            }
          } catch (e) {
            console.warn('[YandexSDK] LoadingAPI error:', e);
          }

          // Try to initialize player for cloud saves
          try {
            this.player = await this.ysdk.getPlayer({ scopes: false });
          } catch (err) {
            console.log('[YandexSDK] Guest/unauthorized player:', err);
          }

          // Try to init leaderboards
          try {
            this.lb = await this.ysdk.getLeaderboards();
          } catch (err) {
            console.log('[YandexSDK] Leaderboards not available:', err);
          }

          // Automatically show Sticky Banner ad if supported
          this.initStickyBanner();

          resolve(true);
        })
        .catch((err) => {
          console.warn('[YandexSDK] Failed to init Yandex SDK, using local fallback:', err);
          this.isMock = true;
          this.isInitialized = true;
          resolve(false);
        });
    });
  }

  // Sticky Banner (Баннерная реклама внизу/вверху экрана)
  initStickyBanner() {
    if (!this.ysdk || !this.ysdk.adv || typeof this.ysdk.adv.getBannerAdvStatus !== 'function') {
      return;
    }

    this.ysdk.adv.getBannerAdvStatus()
      .then(({ stickyAdvIsShowing, reason }) => {
        if (!stickyAdvIsShowing) {
          this.ysdk.adv.showBannerAdv()
            .then(() => console.log('[YandexSDK] Sticky Banner shown successfully.'))
            .catch(err => console.warn('[YandexSDK] Sticky Banner error:', err));
        } else {
          console.log('[YandexSDK] Sticky Banner already showing:', reason);
        }
      })
      .catch(err => console.warn('[YandexSDK] Sticky Banner status error:', err));
  }

  // Cloud Save
  async savePlayerData(data) {
    // Always backup to localStorage
    try {
      localStorage.setItem('slime_evolution_savedata', JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // Save to Yandex Cloud if available
    if (this.player && typeof this.player.setData === 'function') {
      try {
        await this.player.setData(data, true);
        console.log('[YandexSDK] Cloud save successful.');
      } catch (e) {
        console.warn('[YandexSDK] Cloud save failed:', e);
      }
    }
  }

  // Cloud Load
  async loadPlayerData() {
    let cloudData = null;
    if (this.player && typeof this.player.getData === 'function') {
      try {
        cloudData = await this.player.getData();
        if (cloudData && Object.keys(cloudData).length > 0) {
          console.log('[YandexSDK] Cloud save loaded.');
          return cloudData;
        }
      } catch (e) {
        console.warn('[YandexSDK] Cloud load error:', e);
      }
    }

    // Fallback to localStorage
    try {
      const local = localStorage.getItem('slime_evolution_savedata');
      if (local) {
        return JSON.parse(local);
      }
    } catch (e) {
      console.warn('LocalStorage load error:', e);
    }
    return null;
  }

  // Interstitial Ad (Межстраничная реклама)
  showInterstitial(force = false) {
    const now = Date.now();
    if (!force && (now - this.lastInterstitialTime < this.interstitialCooldown)) {
      console.log('[YandexSDK] Interstitial skipped due to cooldown.');
      return;
    }

    // Pause game loop
    if (window.slimeGame) window.slimeGame.isPaused = true;
    const wasMuted = !window.soundManager.enabled;
    if (!wasMuted) window.soundManager.stopBgMusic();

    const resumeGame = () => {
      this.lastInterstitialTime = Date.now();
      if (window.slimeGame) window.slimeGame.isPaused = false;
      if (!wasMuted && window.soundManager.enabled) {
        window.soundManager.startBgMusic();
      }
    };

    if (this.isMock || !this.ysdk) {
      console.log('[YandexSDK Mock] Show Interstitial Ad (Simulated)');
      this.showMockAdModal('Межстраничная реклама (Яндекс)', 2, () => {
        resumeGame();
      });
      return;
    }

    this.ysdk.adv.showFullscreenAdv({
      callbacks: {
        onOpen: () => {
          console.log('[YandexSDK] Interstitial opened');
        },
        onClose: (wasShown) => {
          console.log('[YandexSDK] Interstitial closed, wasShown:', wasShown);
          resumeGame();
        },
        onError: (err) => {
          console.warn('[YandexSDK] Interstitial error:', err);
          resumeGame();
        }
      }
    });
  }

  // Rewarded Video Ad (Реклама с вознаграждением)
  showRewardedAd(onRewardedCallback) {
    // Pause game loop
    if (window.slimeGame) window.slimeGame.isPaused = true;
    const wasMuted = !window.soundManager.enabled;
    if (!wasMuted) window.soundManager.stopBgMusic();

    const resumeGame = () => {
      if (window.slimeGame) window.slimeGame.isPaused = false;
      if (!wasMuted && window.soundManager.enabled) {
        window.soundManager.startBgMusic();
      }
    };

    if (this.isMock || !this.ysdk) {
      console.log('[YandexSDK Mock] Rewarded Ad triggered (Local simulation)');
      this.showMockAdModal('Реклама за вознаграждение (Яндекс)', 2, () => {
        resumeGame();
        if (typeof onRewardedCallback === 'function') {
          onRewardedCallback();
        }
      });
      return;
    }

    let rewarded = false;

    this.ysdk.adv.showRewardedVideo({
      callbacks: {
        onOpen: () => {
          console.log('[YandexSDK] Rewarded video opened');
        },
        onRewarded: () => {
          console.log('[YandexSDK] Rewarded video finished, reward earned!');
          rewarded = true;
          if (typeof onRewardedCallback === 'function') {
            onRewardedCallback();
          }
        },
        onClose: () => {
          console.log('[YandexSDK] Rewarded video closed');
          resumeGame();
        },
        onError: (e) => {
          console.warn('[YandexSDK] Rewarded video error:', e);
          resumeGame();
        }
      }
    });
  }

  // Stylish Mock Ad Modal for local development testing
  showMockAdModal(title, seconds, onClose) {
    const existing = document.getElementById('mock-ad-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'mock-ad-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.88); z-index: 99999;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: white; font-family: 'Nunito', sans-serif; text-align: center; padding: 20px;
    `;

    let timeLeft = seconds;
    modal.innerHTML = `
      <div style="background: #1e293b; border: 2px solid #ffb703; border-radius: 20px; padding: 26px; max-width: 340px; box-shadow: 0 0 30px rgba(255, 183, 3, 0.4);">
        <div style="font-size: 11px; color: #ffd166; font-weight: 800; letter-spacing: 1px;">ЯНДЕКС ИГРЫ • РЕКЛАМНЫЙ БЛОК</div>
        <h3 style="margin: 12px 0 8px; font-size: 18px; font-weight: 900;">${title}</h3>
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 16px;">(Тестовая симуляция при локальном запуске игры)</p>
        <div id="mock-ad-timer" style="font-size: 24px; font-weight: 900; color: #06d6a0; margin-bottom: 16px;">⏱️ ${timeLeft} сек...</div>
        <button id="mock-ad-close-btn" disabled style="background: #334155; color: #64748b; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 900; font-size: 14px; cursor: not-allowed; width: 100%;">
          Подождите...
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    const timerEl = document.getElementById('mock-ad-timer');
    const closeBtn = document.getElementById('mock-ad-close-btn');

    const interval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        if (timerEl) timerEl.innerText = `⏱️ ${timeLeft} сек...`;
      } else {
        clearInterval(interval);
        if (timerEl) timerEl.innerText = `✅ Просмотр завершён!`;
        if (closeBtn) {
          closeBtn.disabled = false;
          closeBtn.style.background = '#06d6a0';
          closeBtn.style.color = '#0f172a';
          closeBtn.style.cursor = 'pointer';
          closeBtn.innerText = 'Забрать награду / Продолжить';
          closeBtn.onclick = () => {
            modal.remove();
            if (typeof onClose === 'function') onClose();
          };
        }
      }
    }, 1000);
  }

  // Submit Score to Leaderboard
  setLeaderboardScore(leaderboardName, score) {
    if (this.lb && !this.isMock) {
      this.lb.setLeaderboardScore(leaderboardName, score)
        .then(() => console.log(`[YandexSDK] Score ${score} sent to ${leaderboardName}`))
        .catch(err => console.warn('[YandexSDK] Leaderboard set error:', err));
    }
  }

  // Prompt rating / review
  promptReview() {
    if (this.ysdk && this.ysdk.feedback && typeof this.ysdk.feedback.canReview === 'function') {
      this.ysdk.feedback.canReview()
        .then(({ value, reason }) => {
          if (value) {
            this.ysdk.feedback.requestReview();
          } else {
            console.log('[YandexSDK] Cannot review yet:', reason);
          }
        })
        .catch(err => console.log('[YandexSDK] Review error:', err));
    }
  }
}

window.yandexSDK = new YandexSDKManager();
