// Main Game Engine: Merge, Clicker, Upgrades, Quests, Offline Earnings & Visual Effects

class SlimeGame {
  constructor() {
    this.coins = 0;
    this.totalCoinsEarned = 0;
    this.grid = new Array(16).fill(0); // 4x4 grid (0 = empty, 1..20 = slime tier)
    this.maxTierUnlocked = 1;
    this.totalMerges = 0;
    this.totalClicks = 0;
    this.lastSaveTime = Date.now();
    this.boostEndTime = 0;
    this.newTiersUnlockedSinceAd = 0;

    // Upgrades (scaled 10x for balanced progression)
    this.upgrades = {
      spawnSpeed: { level: 1, baseCost: 150, costMult: 1.6, maxLevel: 25 },
      clickPower: { level: 1, baseCost: 100, costMult: 1.55, maxLevel: 50 },
      incomeMultiplier: { level: 1, baseCost: 500, costMult: 1.75, maxLevel: 40 },
      eggQuality: { level: 1, baseCost: 2000, costMult: 2.3, maxLevel: 10 },
      autoMerge: { level: 0, baseCost: 5000, costMult: 2.6, maxLevel: 5 }
    };

    // Quests
    this.quests = [
      { id: 'm5', title: 'Первые шаги', desc: 'Сделай 5 слияний слаймов', type: 'merge', target: 5, reward: 25, claimed: false },
      { id: 't3', title: 'Огненное тепло', desc: 'Открой слайма 3-го уровня', type: 'tier', target: 3, reward: 40, claimed: false },
      { id: 'c50', title: 'Быстрые пальчики', desc: 'Нажми на яйцо 50 раз', type: 'click', target: 50, reward: 60, claimed: false },
      { id: 'm25', title: 'Опытный селекционер', desc: 'Сделай 25 слияний', type: 'merge', target: 25, reward: 200, claimed: false },
      { id: 't5', title: 'Сладкая жизнь', desc: 'Открой Зефирку (уровень 5)', type: 'tier', target: 5, reward: 500, claimed: false },
      { id: 'e10k', title: 'Золотая лихорадка', desc: 'Заработай 10 000 монет', type: 'coins', target: 10000, reward: 1000, claimed: false },
      { id: 't8', title: 'Медвежья услуга', desc: 'Открой Медка (уровень 8)', type: 'tier', target: 8, reward: 3000, claimed: false },
      { id: 'm100', title: 'Мастер эволюции', desc: 'Сделай 100 слияний', type: 'merge', target: 100, reward: 8000, claimed: false },
      { id: 't12', title: 'Повелитель драконов', desc: 'Открой Дракончика (уровень 12)', type: 'tier', target: 12, reward: 30000, claimed: false },
      { id: 't15', title: 'Небесный свет', desc: 'Открой Ангелка (уровень 15)', type: 'tier', target: 15, reward: 250000, claimed: false },
      { id: 't20', title: 'Абсолютная гармония', desc: 'Достигни максимального 20-го уровня!', type: 'tier', target: 20, reward: 5000000, claimed: false }
    ];

    // Incubator egg state
    this.eggProgress = 0;
    this.dragSourceIdx = null;
    this.dragItemElement = null;

    // Particles
    this.particles = [];
    this.floatingTexts = [];
    this.animTime = 0;

    // Pending offline & gift coins
    this.pendingOfflineCoins = 0;
    this.pendingGiftCoins = 0;
    this.isPaused = false;
    this.eggTapPulse = 0;
    this.shockwaves = [];
    this.isResetting = false;
  }

  // Format large numbers with suffixes
  static formatNumber(num) {
    if (num < 1000) return Math.floor(num).toLocaleString('ru-RU');
    const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    const i = Math.floor(Math.log10(num) / 3);
    if (i >= suffixes.length) return num.toExponential(2);
    const formatted = (num / Math.pow(10, i * 3)).toFixed(1);
    return formatted.replace('.0', '') + suffixes[i];
  }

  async start() {
    this.setupUI();
    this.setupGrid();
    this.setupTouchAndDrag();
    this.setupEffectsCanvas();

    // Init Yandex SDK
    await window.yandexSDK.init();

    // Load save data (check version === 4 to force clean reset to new rebalanced economy)
    const savedData = await window.yandexSDK.loadPlayerData();
    if (savedData && savedData.version === 4) {
      this.loadState(savedData);
      this.checkOfflineProgress();
    } else {
      // Discard previous saves and start completely clean!
      console.log('[SlimeGame] Initializing fresh new game state (Version 4 Rebalance)');
      this.isResetting = true;
      localStorage.removeItem('slime_evolution_savedata');
      if (window.yandexSDK && window.yandexSDK.player && typeof window.yandexSDK.player.setData === 'function') {
        try { window.yandexSDK.player.setData({}, true); } catch(e){}
      }
      this.resetGameToInitialState();
      this.isResetting = false;
      this.save();
    }

    // Start Main Loops
    this.lastLoopTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));

    // Auto-save every 10 seconds
    setInterval(() => {
      if (!this.isResetting) this.save();
    }, 10000);

    // Auto-merge timer if unlocked
    setInterval(() => this.runAutoMergePassive(), 3000);

    // Save on tab close (only if not resetting)
    window.addEventListener('beforeunload', () => {
      if (!this.isResetting) this.save();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.isResetting) {
        this.save();
      }
    });

    // Schedule periodic floating bonus gift balloons
    this.scheduleFloatingGift();

    console.log('[SlimeGame] Started successfully.');
  }

  // Calculate offline earnings when opening game
  checkOfflineProgress() {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((now - this.lastSaveTime) / 1000));
    if (elapsedSeconds > 15) {
      // Max 12 hours offline
      const cappedSeconds = Math.min(elapsedSeconds, 12 * 3600);
      const perSec = this.calculateIncomePerSecond();
      const offlineCoins = Math.floor(cappedSeconds * perSec * 0.7); // 70% offline efficiency

      if (offlineCoins > 5) {
        this.pendingOfflineCoins = offlineCoins;
        document.getElementById('offline-coins-val').innerText = '+' + SlimeGame.formatNumber(offlineCoins);
        document.getElementById('modal-offline').classList.remove('hidden');
      }
    }
  }

  // Calculate coins per second generated by all slimes on board
  calculateIncomePerSecond() {
    let base = 0;
    for (let i = 0; i < 16; i++) {
      const tier = this.grid[i];
      if (tier > 0) {
        const slimeData = SLIME_DATA[tier - 1];
        if (slimeData) {
          base += slimeData.baseIncome;
        }
      }
    }

    // Apply upgrade multiplier (+8% per level instead of +22%)
    const upgMult = Math.pow(1.08, this.upgrades.incomeMultiplier.level - 1);
    // Apply temporary 2x boost if active
    const boostMult = (Date.now() < this.boostEndTime) ? 2 : 1;

    return Math.floor(base * upgMult * boostMult);
  }

  // Main game tick loop (60 FPS)
  gameLoop(currentTime) {
    if (this.isPaused) {
      this.lastLoopTime = currentTime;
      requestAnimationFrame(this.gameLoop.bind(this));
      return;
    }

    const dt = Math.min((currentTime - this.lastLoopTime) / 1000, 0.2); // seconds
    this.lastLoopTime = currentTime;
    this.animTime += dt;

    // Decay egg tap pulse spring
    if (this.eggTapPulse > 0) {
      this.eggTapPulse = Math.max(0, this.eggTapPulse - dt * 3.4);
    }

    // 1. Passive Income Generation
    const incomeRate = this.calculateIncomePerSecond();
    if (incomeRate > 0) {
      const earned = incomeRate * dt;
      this.addCoins(earned, false);
    }

    // 2. Incubator Egg Progress (Base: 20 seconds, scaled with upgrades)
    const spawnSpeedLvl = this.upgrades.spawnSpeed.level;
    const eggDuration = Math.max(4.0, 20.0 - (spawnSpeedLvl * 0.6));
    this.eggProgress += dt / eggDuration;
    if (this.eggProgress >= 1) {
      this.eggProgress = 0;
      this.trySpawnSlime();
    }

    // 3. Update UI
    this.updateHeaderStats();
    this.renderIncubator();
    this.updateBoostTimer();
    this.renderEffects(dt);

    requestAnimationFrame(this.gameLoop.bind(this));
  }

  addCoins(amount, countForStats = true) {
    this.coins += amount;
    if (countForStats) {
      this.totalCoinsEarned += amount;
      this.checkQuests('coins', this.totalCoinsEarned);
    }
  }

  updateHeaderStats() {
    document.getElementById('coins-display').innerText = SlimeGame.formatNumber(this.coins);
    const income = this.calculateIncomePerSecond();
    document.getElementById('income-display').innerText = `+${SlimeGame.formatNumber(income)}/сек`;

    // Slimes count on grid
    const count = this.grid.filter(t => t > 0).length;
    document.getElementById('slots-count').innerText = count;

    // Update upgrade buy buttons disabled/enabled state
    this.refreshUpgradesUI();
  }

  updateBoostTimer() {
    const boostBadge = document.getElementById('boost-indicator');
    const timerSpan = document.getElementById('boost-timer');
    const now = Date.now();
    if (now < this.boostEndTime) {
      const remainingSec = Math.ceil((this.boostEndTime - now) / 1000);
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      timerSpan.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      boostBadge.classList.remove('hidden');
    } else {
      boostBadge.classList.add('hidden');
    }
  }

  // Render Magic Egg
  renderIncubator() {
    const canvas = document.getElementById('incubator-canvas');
    SlimeRenderer.renderEgg(canvas, this.eggProgress, this.eggTapPulse);

    const progressBar = document.getElementById('incubator-progress');
    if (progressBar) {
      progressBar.style.width = `${Math.min(100, Math.floor(this.eggProgress * 100))}%`;
    }
  }

  // Click on Incubator
  handleIncubatorClick(e) {
    window.soundManager.playTap();
    this.totalClicks++;
    this.checkQuests('click', this.totalClicks);

    // Boost egg progress (~50-60 clicks per egg initially, ~8-10x slower)
    const clickPowerLvl = this.upgrades.clickPower.level;
    this.eggProgress += 0.016 + (clickPowerLvl * 0.002);

    // Trigger elastic tap bounce
    this.eggTapPulse = 1.0;

    // Earn click coins
    const clickCoins = Math.max(1, Math.floor(this.calculateIncomePerSecond() * 0.005 * clickPowerLvl + clickPowerLvl));
    this.addCoins(clickCoins, true);

    // Floating text effect and particles relative to fxCanvas
    const cRect = this.fxCanvas.getBoundingClientRect();
    const eggEl = document.getElementById('incubator-canvas') || e.currentTarget;
    const eggRect = eggEl.getBoundingClientRect();
    const clientX = e.clientX || (eggRect.left + eggRect.width / 2);
    const clientY = e.clientY || (eggRect.top + eggRect.height / 2);

    const x = clientX - cRect.left;
    const y = clientY - cRect.top;

    this.spawnFloatingText(`+${SlimeGame.formatNumber(clickCoins)}`, x, y - 10, '#ffd166');

    // Spawn fountain of sparkling star particles and shockwave exactly at egg center
    this.spawnParticle(x, y, '#ffd166', 14);
    this.spawnParticle(x, y, '#ffafcc', 10);
    this.spawnShockwave(x, y, '#ffd166', 70);

    if (this.eggProgress >= 1) {
      this.eggProgress = 0;
      this.trySpawnSlime();
    }
  }

  // Spawn new slime into first empty slot
  trySpawnSlime() {
    const emptyIndices = [];
    for (let i = 0; i < 16; i++) {
      if (this.grid[i] === 0) emptyIndices.push(i);
    }

    if (emptyIndices.length === 0) {
      // Board is full!
      return false;
    }

    // Pick random empty slot
    const slotIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];

    // Determine tier based on egg quality upgrade
    let spawnTier = 1;
    const qualityLvl = this.upgrades.eggQuality.level;
    if (qualityLvl > 1 && this.maxTierUnlocked >= 3) {
      const roll = Math.random();
      if (roll < 0.35 && qualityLvl >= 3) {
        spawnTier = Math.min(this.maxTierUnlocked - 1, 3);
      } else if (roll < 0.65 && qualityLvl >= 2) {
        spawnTier = Math.min(this.maxTierUnlocked - 1, 2);
      }
    }

    this.grid[slotIdx] = spawnTier;
    this.renderCell(slotIdx);
    window.soundManager.playCoin();

    // Spawn hatching explosion on target cell!
    const cellEl = document.querySelector(`[data-cell-index="${slotIdx}"]`);
    if (cellEl) {
      cellEl.classList.remove('cell-evolve-flash');
      void cellEl.offsetWidth; // trigger reflow
      cellEl.classList.add('cell-evolve-flash');

      const rect = cellEl.getBoundingClientRect();
      const cRect = this.fxCanvas.getBoundingClientRect();
      const cx = (rect.left + rect.width / 2) - cRect.left;
      const cy = (rect.top + rect.height / 2) - cRect.top;
      this.spawnParticle(cx, cy, '#48cae4', 18);
      this.spawnParticle(cx, cy, '#ffd166', 12);
      this.spawnShockwave(cx, cy, '#4cc9f0', 75);
    }
    return true;
  }

  // Setup 4x4 Grid in DOM
  setupGrid() {
    const gridContainer = document.getElementById('merge-grid');
    gridContainer.innerHTML = '';
    for (let i = 0; i < 16; i++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.cellIndex = i;
      gridContainer.appendChild(cell);
    }
  }

  renderGrid() {
    for (let i = 0; i < 16; i++) {
      this.renderCell(i);
    }
  }

  renderCell(index) {
    const cell = document.querySelector(`[data-cell-index="${index}"]`);
    if (!cell) return;
    cell.innerHTML = '';

    const tier = this.grid[index];
    if (tier > 0) {
      const item = document.createElement('div');
      item.className = 'slime-item';
      item.dataset.index = index;

      const canvas = document.createElement('canvas');
      canvas.className = 'slime-canvas';
      canvas.width = 120;
      canvas.height = 120;
      SlimeRenderer.renderSlime(canvas, tier, 0);
      item.appendChild(canvas);

      const badge = document.createElement('div');
      badge.className = 'slime-tier-badge';
      badge.innerText = `Ур. ${tier}`;
      item.appendChild(badge);

      cell.appendChild(item);
    }
  }

  // Touch and Mouse Drag & Drop
  setupTouchAndDrag() {
    const gridContainer = document.getElementById('merge-grid');

    const getCellFromPoint = (x, y) => {
      const elements = document.elementsFromPoint(x, y);
      for (const el of elements) {
        if (el.classList && el.classList.contains('grid-cell')) {
          return parseInt(el.dataset.cellIndex, 10);
        }
      }
      return null;
    };

    let startX = 0;
    let startY = 0;
    let activeItem = null;
    let originalCell = null;
    let currentDragIndex = null;

    const onPointerDown = (e) => {
      const target = e.target.closest('.slime-item');
      if (!target) return;

      e.preventDefault();
      activeItem = target;
      currentDragIndex = parseInt(target.dataset.index, 10);
      originalCell = target.parentElement;

      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      startX = clientX;
      startY = clientY;

      activeItem.classList.add('dragging');
      document.body.appendChild(activeItem);
      activeItem.style.position = 'fixed';
      activeItem.style.left = `${clientX - 45}px`;
      activeItem.style.top = `${clientY - 45}px`;
      activeItem.style.width = '90px';
      activeItem.style.height = '90px';

      // Highlight matching slimes on grid
      const currentTier = this.grid[currentDragIndex];
      document.querySelectorAll('.grid-cell').forEach(cell => {
        const idx = parseInt(cell.dataset.cellIndex, 10);
        if (idx !== currentDragIndex && this.grid[idx] === currentTier) {
          cell.classList.add('highlight-match');
        }
      });
    };

    const onPointerMove = (e) => {
      if (!activeItem) return;
      e.preventDefault();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);

      activeItem.style.left = `${clientX - 45}px`;
      activeItem.style.top = `${clientY - 45}px`;

      // Highlight hover cell
      document.querySelectorAll('.grid-cell').forEach(c => c.classList.remove('drag-over'));
      const hoverIndex = getCellFromPoint(clientX, clientY);
      if (hoverIndex !== null && hoverIndex !== currentDragIndex) {
        const cellEl = document.querySelector(`[data-cell-index="${hoverIndex}"]`);
        if (cellEl) cellEl.classList.add('drag-over');
      }
    };

    const onPointerUp = (e) => {
      if (!activeItem) return;

      const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
      const clientY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);

      document.querySelectorAll('.grid-cell').forEach(c => {
        c.classList.remove('drag-over');
        c.classList.remove('highlight-match');
      });

      const targetIndex = getCellFromPoint(clientX, clientY);

      if (targetIndex !== null && targetIndex !== currentDragIndex) {
        this.handleDrop(currentDragIndex, targetIndex, clientX, clientY);
      } else {
        // Return to source
        this.renderCell(currentDragIndex);
      }

      if (activeItem.parentElement === document.body) {
        document.body.removeChild(activeItem);
      }
      activeItem = null;
      currentDragIndex = null;
    };

    gridContainer.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    gridContainer.addEventListener('touchstart', onPointerDown, { passive: false });
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('touchcancel', onPointerUp);
  }

  // Handle Drag & Drop Logic (Merge or Move)
  handleDrop(fromIdx, toIdx, dropX, dropY) {
    const fromTier = this.grid[fromIdx];
    const toTier = this.grid[toIdx];

    if (toTier === 0) {
      // Move to empty cell
      this.grid[toIdx] = fromTier;
      this.grid[fromIdx] = 0;
      window.soundManager.playTap();
    } else if (fromTier === toTier && fromTier < 20) {
      // Successful MERGE / EVOLUTION!
      const newTier = fromTier + 1;
      this.grid[fromIdx] = 0;
      this.grid[toIdx] = newTier;
      this.totalMerges++;
      this.checkQuests('merge', this.totalMerges);

      window.soundManager.playMerge();

      // Bonus Coins for merge (scaled 10x slower)
      const bonusCoins = Math.max(2, SLIME_DATA[newTier - 1].baseIncome * 2);
      this.addCoins(bonusCoins, true);

      // Trigger cell evolution flash
      const targetCell = document.querySelector(`[data-cell-index="${toIdx}"]`);
      if (targetCell) {
        targetCell.classList.remove('cell-evolve-flash');
        void targetCell.offsetWidth; // force reflow
        targetCell.classList.add('cell-evolve-flash');
      }

      // Calculate container-relative coordinates
      const targetRect = targetCell ? targetCell.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
      const cRect = this.fxCanvas.getBoundingClientRect();
      const fxX = (dropX || (targetRect.left + targetRect.width / 2)) - cRect.left;
      const fxY = (dropY || (targetRect.top + targetRect.height / 2)) - cRect.top;

      // Spectacular Evolution Explosion!
      const slimeColor = SLIME_DATA[newTier - 1].color;
      this.spawnShockwave(fxX, fxY, slimeColor, 120);
      this.spawnShockwave(fxX, fxY, '#ffd166', 75);
      this.spawnParticle(fxX, fxY, slimeColor, 32);
      this.spawnParticle(fxX, fxY, '#ffffff', 16);
      this.spawnFloatingText(`✨ ЭВОЛЮЦИЯ! +${SlimeGame.formatNumber(bonusCoins)} 🪙`, fxX, fxY - 24, '#ffd166');

      // Check if this tier is discovered for the first time!
      if (newTier > this.maxTierUnlocked) {
        this.maxTierUnlocked = newTier;
        this.newTiersUnlockedSinceAd++;
        this.checkQuests('tier', this.maxTierUnlocked);
        this.showNewSlimeUnlockedModal(newTier);

        // Submit to Yandex Leaderboard
        window.yandexSDK.setLeaderboardScore('highest_tier', newTier);

        // After unlocking tier 7, prompt review
        if (newTier === 7) {
          window.yandexSDK.promptReview();
        }

        // Show interstitial ad after every 2-3 new tiers
        if (this.newTiersUnlockedSinceAd >= 2) {
          this.newTiersUnlockedSinceAd = 0;
          setTimeout(() => {
            window.yandexSDK.showInterstitial();
          }, 800);
        }
      }
    } else {
      // Swap positions
      this.grid[fromIdx] = toTier;
      this.grid[toIdx] = fromTier;
      window.soundManager.playTap();
    }

    this.renderCell(fromIdx);
    this.renderCell(toIdx);
  }

  // Auto-Merge Button Action
  autoMergeAll() {
    let mergedAny = false;
    for (let t = 1; t < 20; t++) {
      const matchIndices = [];
      for (let i = 0; i < 16; i++) {
        if (this.grid[i] === t) matchIndices.push(i);
      }
      while (matchIndices.length >= 2) {
        const idx1 = matchIndices.pop();
        const idx2 = matchIndices.pop();
        const targetCell = document.querySelector(`[data-cell-index="${idx2}"]`);
        const rect = targetCell ? targetCell.getBoundingClientRect() : { left: 200, top: 300, width: 60, height: 60 };
        this.handleDrop(idx1, idx2, rect.left + rect.width / 2, rect.top + rect.height / 2);
        mergedAny = true;
      }
    }
    if (mergedAny) {
      window.soundManager.playMerge();
    }
  }

  // Passive auto-merge tick based on upgrade level
  runAutoMergePassive() {
    if (this.upgrades.autoMerge.level <= 0) return;
    for (let t = 1; t < 20; t++) {
      const matches = [];
      for (let i = 0; i < 16; i++) {
        if (this.grid[i] === t) matches.push(i);
      }
      if (matches.length >= 2) {
        const idx1 = matches[0];
        const idx2 = matches[1];
        const targetCell = document.querySelector(`[data-cell-index="${idx2}"]`);
        const rect = targetCell ? targetCell.getBoundingClientRect() : { left: 200, top: 300, width: 60, height: 60 };
        this.handleDrop(idx1, idx2, rect.left + rect.width / 2, rect.top + rect.height / 2);
        break; // merge one pair per tick
      }
    }
  }

  // New Slime Celebratory Modal
  showNewSlimeUnlockedModal(tier) {
    const data = SLIME_DATA[tier - 1];
    window.soundManager.playUnlock();

    document.getElementById('unlock-slime-name').innerText = data.name;
    document.getElementById('unlock-slime-tier').innerText = tier;
    document.getElementById('unlock-slime-income').innerText = SlimeGame.formatNumber(data.baseIncome);
    document.getElementById('unlock-slime-desc').innerText = data.desc;

    const canvas = document.getElementById('unlock-slime-canvas');
    SlimeRenderer.renderSlime(canvas, tier, 0);

    // Confetti explosion
    this.spawnConfetti();

    document.getElementById('modal-unlock').classList.remove('hidden');
  }

  // Visual Effects & Floating Numbers Canvas
  setupEffectsCanvas() {
    this.fxCanvas = document.getElementById('effects-canvas');
    this.fxCtx = this.fxCanvas.getContext('2d');
    const resize = () => {
      const container = document.getElementById('game-container');
      const rect = container ? container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
      this.fxCanvas.width = rect.width;
      this.fxCanvas.height = rect.height;
    };
    window.addEventListener('resize', resize);
    resize();
  }

  spawnParticle(x, y, color, count = 15) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        color: color || '#ffd166',
        radius: Math.random() * 4 + 3,
        alpha: 1,
        life: 1
      });
    }
  }

  spawnConfetti() {
    const colors = ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0', '#06d6a0', '#ffd166'];
    const w = this.fxCanvas.width;
    for (let i = 0; i < 70; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: -10,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        radius: Math.random() * 5 + 4,
        alpha: 1,
        life: 2.5
      });
    }
  }

  spawnShockwave(x, y, color = '#ffd166', maxRadius = 90) {
    this.shockwaves.push({
      x,
      y,
      radius: 12,
      maxRadius,
      color,
      alpha: 1,
      life: 0.45
    });
  }

  spawnFloatingText(text, x, y, color = '#ffd166') {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -2.2,
      color,
      alpha: 1,
      life: 0.85
    });
  }

  renderEffects(dt) {
    const ctx = this.fxCtx;
    ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);

    // 1. Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      const progress = 1 - Math.max(0, sw.life / 0.45);
      sw.radius = 12 + progress * (sw.maxRadius - 12);
      sw.alpha = Math.max(0, sw.life / 0.45);

      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = Math.max(1.5, 6 * sw.alpha);
      ctx.globalAlpha = sw.alpha;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();

      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    // 2. Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 4.5 * dt; // gravity
      p.life -= dt;
      p.alpha = Math.max(0, p.life);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 3. Floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y += t.vy;
      t.life -= dt;
      t.alpha = Math.max(0, t.life / 0.85);

      ctx.save();
      ctx.font = 'bold 20px Nunito, sans-serif';
      ctx.fillStyle = t.color;
      ctx.globalAlpha = t.alpha;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 6;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();

      if (t.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    ctx.globalAlpha = 1;
  }

  // Upgrades System
  getUpgradeCost(key) {
    const upg = this.upgrades[key];
    return Math.floor(upg.baseCost * Math.pow(upg.costMult, upg.level - 1));
  }

  buyUpgrade(key) {
    const upg = this.upgrades[key];
    if (upg.level >= upg.maxLevel) return;
    const cost = this.getUpgradeCost(key);
    if (this.coins >= cost) {
      this.coins -= cost;
      upg.level++;
      window.soundManager.playUpgrade();
      this.refreshUpgradesUI();
      this.updateHeaderStats();
    }
  }

  refreshUpgradesUI() {
    const list = document.getElementById('upgrades-list');
    if (!list) return;

    const upgDefs = [
      { key: 'spawnSpeed', icon: '⏱️', name: 'Скорость Инкубатора', desc: 'Ускоряет автоматическое созревание яиц' },
      { key: 'clickPower', icon: '👆', name: 'Сила Клика', desc: 'Больше монет и прогресса при нажатии' },
      { key: 'incomeMultiplier', icon: '💰', name: 'Множитель Дохода', desc: 'Увеличивает весь доход поляны на +8%' },
      { key: 'eggQuality', icon: '✨', name: 'Качество Яиц', desc: 'Шанс сразу получить слайма высшего уровня' },
      { key: 'autoMerge', icon: '🧲', name: 'Авто-Слияние', desc: 'Помощник автоматически соединяет слаймов' }
    ];

    let hasAffordable = false;

    // Check if innerHTML needs to be built
    if (list.children.length === 0) {
      list.innerHTML = upgDefs.map(u => `
        <div class="upgrade-card" id="upg-card-${u.key}">
          <div class="upgrade-icon-box">${u.icon}</div>
          <div class="upgrade-details">
            <div class="upgrade-title">${u.name}</div>
            <div class="upgrade-desc">${u.desc}</div>
            <div class="upgrade-level" id="upg-lvl-${u.key}">Ур. 1</div>
          </div>
          <button class="buy-btn" id="upg-btn-${u.key}">
            <span class="buy-text">Купить</span>
            <span class="buy-cost" id="upg-cost-${u.key}">0</span>
          </button>
        </div>
      `).join('');

      upgDefs.forEach(u => {
        const btn = document.getElementById(`upg-btn-${u.key}`);
        if (btn) btn.addEventListener('click', () => this.buyUpgrade(u.key));
      });
    }

    upgDefs.forEach(u => {
      const upg = this.upgrades[u.key];
      const isMax = upg.level >= upg.maxLevel;
      const cost = isMax ? 0 : this.getUpgradeCost(u.key);
      const canAfford = !isMax && this.coins >= cost;

      if (canAfford) hasAffordable = true;

      const lvlEl = document.getElementById(`upg-lvl-${u.key}`);
      const costEl = document.getElementById(`upg-cost-${u.key}`);
      const btn = document.getElementById(`upg-btn-${u.key}`);
      const card = document.getElementById(`upg-card-${u.key}`);

      if (lvlEl) lvlEl.innerText = isMax ? 'МАКС' : `Ур. ${upg.level}/${upg.maxLevel}`;
      if (costEl) costEl.innerText = isMax ? 'МАКС' : `${SlimeGame.formatNumber(cost)} 🪙`;
      if (btn) btn.disabled = !canAfford;
      if (card) {
        if (canAfford) card.classList.add('affordable');
        else card.classList.remove('affordable');
      }
    });

    const badge = document.getElementById('upgrades-badge');
    if (badge) {
      if (hasAffordable) badge.classList.remove('hidden');
      else badge.classList.add('hidden');
    }
  }

  // Collection View
  renderCollection() {
    const container = document.getElementById('collection-list');
    if (!container) return;
    container.innerHTML = '';

    document.getElementById('collection-unlocked-count').innerText = this.maxTierUnlocked;

    for (let t = 1; t <= 20; t++) {
      const unlocked = t <= this.maxTierUnlocked;
      const data = SLIME_DATA[t - 1];

      const card = document.createElement('div');
      card.className = `collection-card ${unlocked ? '' : 'locked'}`;

      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      SlimeRenderer.renderSlime(canvas, t, 0);
      card.appendChild(canvas);

      const name = document.createElement('div');
      name.className = 'collection-name';
      name.innerText = unlocked ? data.name : '???';
      card.appendChild(name);

      const inc = document.createElement('div');
      inc.className = 'collection-income';
      inc.innerText = unlocked ? `+${SlimeGame.formatNumber(data.baseIncome)}/сек` : `Ур. ${t}`;
      card.appendChild(inc);

      container.appendChild(card);
    }
  }

  // Quests & Achievements
  checkQuests(type, currentVal) {
    let hasUnclaimed = false;
    this.quests.forEach(q => {
      if (!q.claimed && q.type === type) {
        if (currentVal >= q.target) {
          hasUnclaimed = true;
        }
      }
    });
    const badge = document.getElementById('quests-badge');
    if (badge) {
      if (hasUnclaimed) badge.classList.remove('hidden');
      else badge.classList.add('hidden');
    }
  }

  renderQuests() {
    const list = document.getElementById('quests-list');
    if (!list) return;
    list.innerHTML = '';

    this.quests.forEach(q => {
      let currentVal = 0;
      if (q.type === 'merge') currentVal = this.totalMerges;
      else if (q.type === 'tier') currentVal = this.maxTierUnlocked;
      else if (q.type === 'click') currentVal = this.totalClicks;
      else if (q.type === 'coins') currentVal = this.totalCoinsEarned;

      const progress = Math.min(100, Math.floor((currentVal / q.target) * 100));
      const canClaim = !q.claimed && currentVal >= q.target;

      const item = document.createElement('div');
      item.className = 'quest-card';
      item.innerHTML = `
        <div class="quest-info" style="flex:1">
          <h4>${q.title}</h4>
          <div class="quest-desc">${q.desc}</div>
          <div class="quest-progress-bar">
            <div class="quest-progress-fill" style="width: ${progress}%"></div>
          </div>
          <div style="font-size: 10px; color: #b8c1ec; margin-top: 3px;">
            ${q.claimed ? 'Выполнено' : `${SlimeGame.formatNumber(currentVal)} / ${SlimeGame.formatNumber(q.target)}`}
          </div>
        </div>
        <div>
          ${q.claimed 
            ? '<span style="font-size:12px; color:#06d6a0; font-weight:800">✓ Забрано</span>'
            : `<button class="claim-btn" ${canClaim ? '' : 'disabled style="opacity:0.5"'}>
                 +${SlimeGame.formatNumber(q.reward)} 🪙
               </button>`
          }
        </div>
      `;

      if (canClaim) {
        const btn = item.querySelector('.claim-btn');
        btn.addEventListener('click', () => {
          q.claimed = true;
          this.addCoins(q.reward, true);
          window.soundManager.playBonus();
          this.renderQuests();
          this.checkQuests('check', 0);
          this.updateHeaderStats();
        });
      }

      list.appendChild(item);
    });
  }

  // Setup UI event listeners
  setupUI() {
    // Incubator Click
    document.getElementById('incubator-box').addEventListener('click', (e) => this.handleIncubatorClick(e));

    // Auto merge button
    document.getElementById('btn-auto-merge').addEventListener('click', () => this.autoMergeAll());

    // Sound toggle
    const soundBtn = document.getElementById('btn-sound');
    soundBtn.addEventListener('click', () => {
      const enabled = window.soundManager.toggleSound();
      document.getElementById('sound-icon').innerText = enabled ? '🔊' : '🔇';
    });
    // Set initial sound icon
    document.getElementById('sound-icon').innerText = window.soundManager.enabled ? '🔊' : '🔇';

    // Fullscreen toggle
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Main Menu Trigger Button
    const menuBtn = document.getElementById('btn-menu');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => this.openMainMenu());
    }

    // Main Menu Buttons
    const menuPlayBtn = document.getElementById('btn-menu-play');
    if (menuPlayBtn) {
      menuPlayBtn.addEventListener('click', () => {
        document.getElementById('modal-main-menu').classList.add('hidden');
        window.soundManager.playTap();
      });
    }

    const menuSettingsBtn = document.getElementById('btn-menu-settings');
    if (menuSettingsBtn) {
      menuSettingsBtn.addEventListener('click', () => {
        this.openSettingsModal();
      });
    }

    const menuStatsBtn = document.getElementById('btn-menu-stats');
    if (menuStatsBtn) {
      menuStatsBtn.addEventListener('click', () => {
        this.openStatsModal();
      });
    }

    const menuHelpBtn = document.getElementById('btn-menu-help');
    if (menuHelpBtn) {
      menuHelpBtn.addEventListener('click', () => {
        document.getElementById('modal-help').classList.remove('hidden');
      });
    }

    // Settings Toggle Handlers
    const soundToggle = document.getElementById('setting-sound');
    if (soundToggle) {
      soundToggle.addEventListener('change', (e) => {
        if (window.soundManager.enabled !== e.target.checked) {
          const enabled = window.soundManager.toggleSound();
          document.getElementById('sound-icon').innerText = enabled ? '🔊' : '🔇';
        }
      });
    }

    const musicToggle = document.getElementById('setting-music');
    if (musicToggle) {
      musicToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          window.soundManager.init();
          window.soundManager.startBgMusic();
        } else {
          window.soundManager.stopBgMusic();
        }
      });
    }

    // Reset Progress Handler - In-Game Modal
    const resetBtn = document.getElementById('btn-reset-data');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const confirmModal = document.getElementById('modal-confirm-reset');
        if (confirmModal) confirmModal.classList.remove('hidden');
      });
    }

    const confirmResetYes = document.getElementById('btn-confirm-reset-yes');
    if (confirmResetYes) {
      confirmResetYes.addEventListener('click', async () => {
        this.isResetting = true;
        // Clear local storage
        localStorage.removeItem('slime_evolution_savedata');
        // Clear cloud save in Yandex SDK if available
        if (window.yandexSDK && window.yandexSDK.player && typeof window.yandexSDK.player.setData === 'function') {
          try {
            await window.yandexSDK.player.setData({}, true);
          } catch (e) {
            console.warn('Reset cloud save error:', e);
          }
        }
        this.resetGameToInitialState();
        window.location.reload();
      });
    }

    // Close buttons for modals & sheets
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.close;
        const target = document.getElementById(targetId);
        if (target) target.classList.add('hidden');
      });
    });

    // Claim unlock celebration
    document.getElementById('btn-claim-unlock').addEventListener('click', () => {
      document.getElementById('modal-unlock').classList.add('hidden');
    });

    // Offline dialog buttons
    document.getElementById('btn-offline-collect').addEventListener('click', () => {
      this.addCoins(this.pendingOfflineCoins, true);
      this.pendingOfflineCoins = 0;
      document.getElementById('modal-offline').classList.add('hidden');
      window.soundManager.playCoin();
    });

    document.getElementById('btn-offline-double').addEventListener('click', () => {
      window.yandexSDK.showRewardedAd(() => {
        // Double reward
        this.addCoins(this.pendingOfflineCoins * 2, true);
        window.soundManager.playBonus();
        this.spawnFloatingText(`+${SlimeGame.formatNumber(this.pendingOfflineCoins * 2)} 💎`, this.fxCanvas.width / 2, this.fxCanvas.height / 2);
        this.pendingOfflineCoins = 0;
        document.getElementById('modal-offline').classList.add('hidden');
      });
    });

    // Quick Rewarded Ads: 2x Boost
    document.getElementById('btn-ad-boost').addEventListener('click', () => {
      window.yandexSDK.showRewardedAd(() => {
        // 2 minutes boost
        this.boostEndTime = Math.max(Date.now(), this.boostEndTime) + (2 * 60 * 1000);
        window.soundManager.playBonus();
        this.spawnConfetti();
        alert('⚡ Буст x2 активирован на 2 минуты!');
      });
    });

    // Quick Rewarded Ads: Coin Chest (1.5 minutes of income)
    document.getElementById('btn-ad-chest').addEventListener('click', () => {
      window.yandexSDK.showRewardedAd(() => {
        const bonus = Math.max(50, this.calculateIncomePerSecond() * 90); // 1.5 mins
        this.addCoins(bonus, true);
        window.soundManager.playBonus();
        this.spawnConfetti();
        this.spawnFloatingText(`+${SlimeGame.formatNumber(bonus)} 🪙`, this.fxCanvas.width / 2, this.fxCanvas.height / 2);
      });
    });

    // Navigation Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // Close all modal sheets
        document.getElementById('view-upgrades').classList.add('hidden');
        document.getElementById('view-collection').classList.add('hidden');
        document.getElementById('view-quests').classList.add('hidden');

        if (tabName === 'upgrades') {
          this.refreshUpgradesUI();
          document.getElementById('view-upgrades').classList.remove('hidden');
        } else if (tabName === 'collection') {
          this.renderCollection();
          document.getElementById('view-collection').classList.remove('hidden');
        } else if (tabName === 'quests') {
          this.renderQuests();
          document.getElementById('view-quests').classList.remove('hidden');
        }
      });
    });

    // Gift Dialog Claim with Rewarded Ad
    const giftClaimBtn = document.getElementById('btn-gift-claim');
    if (giftClaimBtn) {
      giftClaimBtn.addEventListener('click', () => {
        window.yandexSDK.showRewardedAd(() => {
          this.addCoins(this.pendingGiftCoins, true);
          window.soundManager.playBonus();
          this.spawnConfetti();
          this.spawnFloatingText(`+${SlimeGame.formatNumber(this.pendingGiftCoins)} 🎁`, this.fxCanvas.width / 2, this.fxCanvas.height / 2);
          this.pendingGiftCoins = 0;
          document.getElementById('modal-gift').classList.add('hidden');
        });
      });
    }
  }

  // Floating Bonus Gift Balloon (Rewarded Ad)
  scheduleFloatingGift() {
    const delay = Math.random() * 20000 + 35000; // 35-55 seconds
    setTimeout(() => {
      this.spawnFloatingGiftBalloon();
      this.scheduleFloatingGift();
    }, delay);
  }

  spawnFloatingGiftBalloon() {
    const existing = document.getElementById('floating-gift-balloon');
    if (existing) return;

    const balloon = document.createElement('div');
    balloon.id = 'floating-gift-balloon';
    balloon.className = 'floating-gift';
    balloon.innerHTML = '🎁';
    balloon.style.top = `${Math.floor(Math.random() * 35 + 20)}%`;

    balloon.onclick = () => {
      balloon.remove();
      this.showGiftModal();
    };

    const container = document.getElementById('game-container');
    if (container) container.appendChild(balloon);

    setTimeout(() => {
      if (balloon.parentElement) balloon.remove();
    }, 20500);
  }

  showGiftModal() {
    const reward = Math.max(50, Math.floor(this.calculateIncomePerSecond() * 35));
    this.pendingGiftCoins = reward;
    const coinsEl = document.getElementById('gift-coins-val');
    if (coinsEl) coinsEl.innerText = '+' + SlimeGame.formatNumber(reward);
    const modal = document.getElementById('modal-gift');
    if (modal) modal.classList.remove('hidden');
  }

  openMainMenu() {
    const canvas = document.getElementById('menu-slime-canvas');
    if (canvas) {
      SlimeRenderer.renderSlime(canvas, this.maxTierUnlocked, 0);
    }
    const tierEl = document.getElementById('menu-slime-tier');
    if (tierEl) tierEl.innerText = `Уровень ${this.maxTierUnlocked}`;
    const nameEl = document.getElementById('menu-slime-name');
    const slimeData = SLIME_DATA[this.maxTierUnlocked - 1];
    if (nameEl && slimeData) nameEl.innerText = slimeData.name;

    const menu = document.getElementById('modal-main-menu');
    if (menu) menu.classList.remove('hidden');
    window.soundManager.playTap();
  }

  openSettingsModal() {
    const soundToggle = document.getElementById('setting-sound');
    if (soundToggle) soundToggle.checked = window.soundManager.enabled;
    const musicToggle = document.getElementById('setting-music');
    if (musicToggle) musicToggle.checked = window.soundManager.bgMusicPlaying;

    const modal = document.getElementById('modal-settings');
    if (modal) modal.classList.remove('hidden');
    window.soundManager.playTap();
  }

  openStatsModal() {
    const maxTierEl = document.getElementById('stat-max-tier');
    if (maxTierEl) maxTierEl.innerText = `${this.maxTierUnlocked} / 20`;
    const mergesEl = document.getElementById('stat-merges');
    if (mergesEl) mergesEl.innerText = SlimeGame.formatNumber(this.totalMerges);
    const clicksEl = document.getElementById('stat-clicks');
    if (clicksEl) clicksEl.innerText = SlimeGame.formatNumber(this.totalClicks);
    const coinsEl = document.getElementById('stat-total-coins');
    if (coinsEl) coinsEl.innerText = SlimeGame.formatNumber(this.totalCoinsEarned);

    const modal = document.getElementById('modal-stats');
    if (modal) modal.classList.remove('hidden');
    window.soundManager.playTap();
  }

  // Save State
  save() {
    if (this.isResetting) return;
    this.lastSaveTime = Date.now();
    const data = {
      version: 4,
      coins: this.coins,
      totalCoinsEarned: this.totalCoinsEarned,
      grid: this.grid,
      maxTierUnlocked: this.maxTierUnlocked,
      totalMerges: this.totalMerges,
      totalClicks: this.totalClicks,
      lastSaveTime: this.lastSaveTime,
      upgrades: {
        spawnSpeed: this.upgrades.spawnSpeed.level,
        clickPower: this.upgrades.clickPower.level,
        incomeMultiplier: this.upgrades.incomeMultiplier.level,
        eggQuality: this.upgrades.eggQuality.level,
        autoMerge: this.upgrades.autoMerge.level
      },
      quests: this.quests.map(q => ({ id: q.id, claimed: q.claimed }))
    };

    window.yandexSDK.savePlayerData(data);
  }

  resetGameToInitialState() {
    this.coins = 0;
    this.totalCoinsEarned = 0;
    this.grid = new Array(16).fill(0);
    this.grid[0] = 1;
    this.grid[1] = 1;
    this.maxTierUnlocked = 1;
    this.totalMerges = 0;
    this.totalClicks = 0;
    this.lastSaveTime = Date.now();
    this.boostEndTime = 0;
    this.eggProgress = 0;
    this.eggTapPulse = 0;
    this.upgrades = {
      spawnSpeed: { level: 1, baseCost: 150, costMult: 1.6, maxLevel: 25 },
      clickPower: { level: 1, baseCost: 100, costMult: 1.55, maxLevel: 50 },
      incomeMultiplier: { level: 1, baseCost: 500, costMult: 1.75, maxLevel: 40 },
      eggQuality: { level: 1, baseCost: 2000, costMult: 2.3, maxLevel: 10 },
      autoMerge: { level: 0, baseCost: 5000, costMult: 2.6, maxLevel: 5 }
    };
    if (Array.isArray(this.quests)) {
      this.quests.forEach(q => q.claimed = false);
    }
    this.renderGrid();
    this.updateHeaderStats();
    if (typeof this.refreshUpgradesUI === 'function') {
      this.refreshUpgradesUI();
    }
  }

  // Load State
  loadState(data) {
    if (!data) return;
    if (typeof data.coins === 'number') this.coins = data.coins;
    if (typeof data.totalCoinsEarned === 'number') this.totalCoinsEarned = data.totalCoinsEarned;
    if (Array.isArray(data.grid) && data.grid.length === 16) this.grid = data.grid;
    if (typeof data.maxTierUnlocked === 'number') this.maxTierUnlocked = data.maxTierUnlocked;
    if (typeof data.totalMerges === 'number') this.totalMerges = data.totalMerges;
    if (typeof data.totalClicks === 'number') this.totalClicks = data.totalClicks;
    if (typeof data.lastSaveTime === 'number') this.lastSaveTime = data.lastSaveTime;

    if (data.upgrades) {
      if (data.upgrades.spawnSpeed) this.upgrades.spawnSpeed.level = data.upgrades.spawnSpeed;
      if (data.upgrades.clickPower) this.upgrades.clickPower.level = data.upgrades.clickPower;
      if (data.upgrades.incomeMultiplier) this.upgrades.incomeMultiplier.level = data.upgrades.incomeMultiplier;
      if (data.upgrades.eggQuality) this.upgrades.eggQuality.level = data.upgrades.eggQuality;
      if (data.upgrades.autoMerge) this.upgrades.autoMerge.level = data.upgrades.autoMerge;
    }

    if (Array.isArray(data.quests)) {
      data.quests.forEach(sq => {
        const quest = this.quests.find(q => q.id === sq.id);
        if (quest) quest.claimed = sq.claimed;
      });
    }

    this.renderGrid();
  }
}

// Bootstrap Game on Window Load
window.addEventListener('DOMContentLoaded', () => {
  window.slimeGame = new SlimeGame();
  window.slimeGame.start();
});
