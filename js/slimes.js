// Slime definitions and High-Definition Sprite / Procedural Vector Rendering
const SLIME_DATA = [
  {
    tier: 1,
    name: "Капельник",
    desc: "Маленький зелёный росток. Обожает свежую росу и солнечный свет.",
    baseIncome: 1,
    color: "#52b788",
    secondaryColor: "#2d6a4f"
  },
  {
    tier: 2,
    name: "Ледышка",
    desc: "Сверкающий кристальный алмаз. Излучает морозную свежесть.",
    baseIncome: 3,
    color: "#a0c4ff",
    secondaryColor: "#00b4d8"
  },
  {
    tier: 3,
    name: "Огонёк",
    desc: "Пылкий и озорной дракончик с огненными рожками.",
    baseIncome: 8,
    color: "#f77f00",
    secondaryColor: "#d62828"
  },
  {
    tier: 4,
    name: "Искорка",
    desc: "Электрический сгусток энергии. Быстрее молнии!",
    baseIncome: 20,
    color: "#4cc9f0",
    secondaryColor: "#4361ee"
  },
  {
    tier: 5,
    name: "Искатель",
    desc: "Стимпанк-путешественник в защитных очках и с компасом.",
    baseIncome: 50,
    color: "#2ec4b6",
    secondaryColor: "#0077b6"
  },
  {
    tier: 6,
    name: "Чародей",
    desc: "Мудрый волшебник в шляпе мага со светящимся посохом.",
    baseIncome: 120,
    color: "#3a0ca3",
    secondaryColor: "#4cc9f0"
  },
  {
    tier: 7,
    name: "Ведьмочка",
    desc: "Аметистовая колдунья с древней книгой звёздных заклинаний.",
    baseIncome: 300,
    color: "#9d4edd",
    secondaryColor: "#5a189a"
  },
  {
    tier: 8,
    name: "Викинг",
    desc: "Отважный гладиатор со щитом и крылатым шлемом.",
    baseIncome: 750,
    color: "#fb8500",
    secondaryColor: "#b27900"
  },
  {
    tier: 9,
    name: "Тень",
    desc: "Загадочный сумеречный ниндзя с крыльями летучей мыши.",
    baseIncome: 1800,
    color: "#2b2d42",
    secondaryColor: "#d90429"
  },
  {
    tier: 10,
    name: "Медок",
    desc: "Сладкий пухляш-мишка из янтаря, окруженный пчёлками.",
    baseIncome: 4500,
    color: "#ffb700",
    secondaryColor: "#e85d04"
  },
  {
    tier: 11,
    name: "Радужник",
    desc: "Переливается всеми красками северного сияния.",
    baseIncome: 11000,
    color: "#06d6a0",
    secondaryColor: "#ff007f"
  },
  {
    tier: 12,
    name: "Дракоша",
    desc: "Огненный дракон с крылышками и пылающим хвостиком.",
    baseIncome: 28000,
    color: "#e63946",
    secondaryColor: "#9e2a2b"
  },
  {
    tier: 13,
    name: "Космо-слайм",
    desc: "Хранит в себе целую галактику с кольцами планет и туманностями.",
    baseIncome: 70000,
    color: "#1e1b4b",
    secondaryColor: "#7c3aed"
  },
  {
    tier: 14,
    name: "Кибер-неон",
    desc: "Высокотехнологичный киборг со световыми неоновыми цепями.",
    baseIncome: 180000,
    color: "#05f140",
    secondaryColor: "#f72585"
  },
  {
    tier: 15,
    name: "Ангелок",
    desc: "Чистый хранитель поляны с сияющим розовым нимбом и крыльями.",
    baseIncome: 450000,
    color: "#ffafcc",
    secondaryColor: "#b5179e"
  },
  {
    tier: 16,
    name: "Демонёнок",
    desc: "Владыка подземных огней с раскалёнными магматическими трещинами.",
    baseIncome: 1200000,
    color: "#0f0f14",
    secondaryColor: "#ff0055"
  },
  {
    tier: 17,
    name: "Звездочёт",
    desc: "Повелитель гравитации, повелевающий орбитами сверхновых звёзд.",
    baseIncome: 3200000,
    color: "#311042",
    secondaryColor: "#ff007f"
  },
  {
    tier: 18,
    name: "Монарх",
    desc: "Царственный владыка в рубиновой короне и королевской мантии.",
    baseIncome: 9000000,
    color: "#ffb703",
    secondaryColor: "#c1121f"
  },
  {
    tier: 19,
    name: "Хронос",
    desc: "Золотой титан времени, владеющий тайнами вечности.",
    baseIncome: 25000000,
    color: "#e0a96d",
    secondaryColor: "#d4af37"
  },
  {
    tier: 20,
    name: "Абсолют",
    desc: "Божественная вершина эволюции с лучезарной солнечной короной!",
    baseIncome: 75000000,
    color: "#ffffff",
    secondaryColor: "#ffd60a"
  }
];

class SlimeRenderer {
  static eggImg = null;
  static eggLoaded = false;
  static slimeSprites = {};

  static init() {
    // Preload Egg Sprite
    this.eggImg = new Image();
    this.eggImg.src = 'egg.png';
    this.eggImg.onload = () => {
      this.eggLoaded = true;
    };

    // Preload all 20 Slime Sprites
    for (let t = 1; t <= 20; t++) {
      const img = new Image();
      img.src = `sprites/slime_${t}.png`;
      img.onload = () => {
        this.slimeSprites[t] = img;
      };
    }
  }

  // Render a specific slime tier onto any canvas
  static renderSlime(canvas, tier, animProgress = 0) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const sprite = this.slimeSprites[tier];

    // Squish bounce animation calculation
    const squishY = Math.sin(animProgress * Math.PI * 2) * 0.05;
    const squishX = -squishY * 0.7;

    const cx = width / 2;
    const cy = height * 0.48; // Centered above the tier badge

    ctx.save();

    // 1. Soft Ambient Drop Shadow underneath
    ctx.beginPath();
    ctx.ellipse(cx, height * 0.82, width * 0.35, height * 0.11, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    // 2. High Tier Glowing Aura (Tier 10+)
    if (tier >= 10) {
      const auraGlow = ctx.createRadialGradient(cx, cy, width * 0.1, cx, cy, width * 0.52);
      const data = SLIME_DATA[tier - 1] || SLIME_DATA[0];
      auraGlow.addColorStop(0, data.color + '66');
      auraGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, width * 0.52, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Render 3D Sprite if ready
    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      ctx.translate(cx, cy);
      ctx.scale(1 + squishX, 1 + squishY);
      const drawSize = width * 0.92;
      ctx.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    } else {
      // Fallback Procedural Vector Renderer
      this.renderProceduralSlime(ctx, tier, width, height, squishX, squishY);
    }

    ctx.restore();
  }

  // Fallback Procedural Vector Slime
  static renderProceduralSlime(ctx, tier, width, height, squishX, squishY) {
    const data = SLIME_DATA[tier - 1] || SLIME_DATA[0];
    const centerX = width / 2;
    const centerY = height * 0.54;
    const baseRadius = width * 0.33;

    const rX = baseRadius * (1 + squishX);
    const rY = baseRadius * (1 + squishY);

    const grad = ctx.createRadialGradient(
      centerX - rX * 0.3, centerY - rY * 0.4, rX * 0.15,
      centerX, centerY, rX * 1.1
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, data.color);
    grad.addColorStop(1, data.secondaryColor);

    ctx.beginPath();
    ctx.moveTo(centerX, centerY - rY * 1.15);
    ctx.bezierCurveTo(centerX + rX * 0.9, centerY - rY * 0.9, centerX + rX * 1.25, centerY + rY * 0.85, centerX, centerY + rY * 0.95);
    ctx.bezierCurveTo(centerX - rX * 1.25, centerY + rY * 0.85, centerX - rX * 0.9, centerY - rY * 0.9, centerX, centerY - rY * 1.15);
    ctx.closePath();

    ctx.fillStyle = grad;
    ctx.fill();

    // Glossy reflection
    ctx.beginPath();
    ctx.ellipse(centerX - rX * 0.45, centerY - rY * 0.5, rX * 0.26, rY * 0.16, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();

    // Kawaii Eyes
    const eyeSpacing = rX * 0.36;
    const eyeY = centerY - rY * 0.05;
    const eyeRadius = rX * 0.16;

    const drawEye = (x) => {
      ctx.beginPath();
      ctx.arc(x, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, eyeY, eyeRadius * 0.68, 0, Math.PI * 2);
      ctx.fillStyle = '#1e1e24';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - eyeRadius * 0.25, eyeY - eyeRadius * 0.25, eyeRadius * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    };

    drawEye(centerX - eyeSpacing);
    drawEye(centerX + eyeSpacing);

    // Mouth
    ctx.beginPath();
    ctx.arc(centerX, centerY + rY * 0.18, rX * 0.16, 0.1 * Math.PI, 0.9 * Math.PI, false);
    ctx.lineWidth = Math.max(2, width * 0.022);
    ctx.strokeStyle = '#222222';
    ctx.stroke();
  }

  // Render Magic Egg Incubator with Smooth Organic Squash & Stretch
  static renderEgg(canvas, progress = 0, tapPulse = 0) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h * 0.52;

    // Smooth idle breathing
    const time = Date.now() / 320;
    const breathe = 1 + Math.sin(time) * 0.025;

    // Organic Jelly Squash: smooth single pulse without jitter
    const squash = Math.sin(Math.min(1, tapPulse) * Math.PI) * 0.16;
    const scaleX = breathe * (1 + squash * 0.9);
    const scaleY = breathe * (1 - squash * 1.15);

    ctx.save();

    // 1. Soft glowing aura behind the egg
    const auraRadius = (w * 0.4) * (1 + progress * 0.25 + tapPulse * 0.2);
    const auraGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, auraRadius);
    auraGrad.addColorStop(0, `rgba(255, 214, 10, ${Math.min(0.9, 0.35 + progress * 0.4 + tapPulse * 0.5)})`);
    auraGrad.addColorStop(0.55, `rgba(255, 112, 166, ${Math.min(0.7, 0.2 + progress * 0.35 + tapPulse * 0.3)})`);
    auraGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. High Definition Egg & Nest Sprite with grounded bottom pivot
    if (this.eggLoaded && this.eggImg.complete) {
      const drawW = w * 0.94;
      const drawH = h * 0.94;
      const pivotY = cy + drawH * 0.36; // Nest base pivot

      ctx.translate(cx, pivotY);
      ctx.scale(scaleX, scaleY);

      // Draw egg image centered above pivot
      ctx.drawImage(this.eggImg, -drawW / 2, -drawH * 0.88, drawW, drawH);

      // Glowing cracks overlay if near ready or tapping
      if (progress > 0.65 || tapPulse > 0.4) {
        ctx.strokeStyle = '#ffd166';
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-15, -drawH * 0.45);
        ctx.lineTo(5, -drawH * 0.35);
        ctx.lineTo(-4, -drawH * 0.22);
        ctx.lineTo(10, -drawH * 0.12);
        ctx.stroke();
      }
    } else {
      this.renderProceduralEgg(ctx, w, h, cx, cy, progress, 0);
    }

    ctx.restore();
  }

  // Fallback Procedural Egg
  static renderProceduralEgg(ctx, w, h, cx, cy, progress, wobble) {
    const rx = w * 0.28;
    const ry = h * 0.36;

    ctx.translate(cx, cy);
    ctx.rotate(wobble);

    const eggGrad = ctx.createRadialGradient(-rx * 0.3, -ry * 0.4, rx * 0.2, 0, 0, rx * 1.2);
    eggGrad.addColorStop(0, '#ffffff');
    eggGrad.addColorStop(0.3, '#ffe3e0');
    eggGrad.addColorStop(0.8, '#ffafcc');
    eggGrad.addColorStop(1, '#b5179e');

    ctx.beginPath();
    ctx.moveTo(0, -ry);
    ctx.bezierCurveTo(rx * 0.9, -ry * 0.85, rx * 1.05, ry * 0.8, 0, ry);
    ctx.bezierCurveTo(-rx * 1.05, ry * 0.8, -rx * 0.9, -ry * 0.85, 0, -ry);
    ctx.closePath();

    ctx.fillStyle = eggGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

// Auto-initialize sprite preloading
SlimeRenderer.init();

window.SLIME_DATA = SLIME_DATA;
window.SlimeRenderer = SlimeRenderer;
