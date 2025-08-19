// 游戏配置
const GAME_CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    PLAYER_SIZE: 30,
    BULLET_SIZE: 5,
    SNAKE_SEGMENT_SIZE: 20,
    SNAKE_SPEED: 0.005,
    BULLET_SPEED: 8,
    TREASURE_INTERVAL: 4,
    BASE_SNAKE_HEALTH: 5,
    HEALTH_INCREASE_PER_SEGMENT: 20,
    // 敌方子弹配置
    ENEMY_BULLET_SIZE: 4,
    ENEMY_BULLET_SPEED: 4.0,
    BOSS_FIRE_BASE_INTERVAL_MS: 1200,
    BOSS_FIRE_MIN_INTERVAL_MS: 450,
    BOSS_SPREAD_STEP_RAD: 0.12
};

// Boss名字配置
const BOSS_NAMES = {
    1: "🐍 恶魔蛇王 🐍",
    2: "🔥 烈焰巨蟒 🔥",
    3: "⚡ 雷霆毒蛇 ⚡",
    4: "🌙 暗影魔蛇 🌙",
    5: "👑 终极蛇皇 👑"
};

// 游戏状态
let gameState = {
    score: 0,
    level: 1,
    playerHealth: 100000000000,
    isGameOver: false,
    isUpgradeMenuOpen: false,
    lastTime: 0,
    bulletCooldown: 0,
    totalSegments: 0,
    defeatedSegments: 0,
    bossFireCooldownMs: 0,
    spawnInvincibleUntil: 0,
    nowMs: 0
};

// 玩家状态
let player = {
    x: GAME_CONFIG.CANVAS_WIDTH / 2,
    y: GAME_CONFIG.CANVAS_HEIGHT - 50,
    size: GAME_CONFIG.PLAYER_SIZE,
    bullets: 5,
    fireRate: 5,
    penetration: 5,
    shieldActive: false,
    shieldUntil: 0,
    shieldCooldownUntil: 0,
    // 新增属性：减速概率、吸血、护盾时长加成
    slowOnHitChance: 0,
    lifesteal: 0,
    shieldBonusMs: 0,
    lifestealBank: 0
};

// 游戏对象
let bullets = [];
let snake = [];
let particles = [];
let enemyBullets = [];

// Canvas 和 Context
let canvas, ctx;
let devicePixelRatioScale = 1;

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    setupCanvasForHiDPI();
    ensurePlayerAtBottom();
    setupTouchControls();
    bindSkillControls();
    
    // 启动游戏
    initSnake();
    ensurePlayerAtBottom();
    // 某些移动端DOM还未完成布局，再次矫正一次尺寸与位置
    setTimeout(() => {
        setupCanvasForHiDPI();
        ensurePlayerAtBottom();
    }, 50);
    gameLoop(performance.now());
});

// 适配高分屏与全屏自适应
function setupCanvasForHiDPI() {
    const dpr = window.devicePixelRatio || 1;
    devicePixelRatioScale = dpr;
    // 逻辑尺寸依据容器可见尺寸
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(480, Math.floor(rect.height));
    // 设置实际像素尺寸
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    // 将坐标系缩放回CSS像素
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 更新游戏内配置供渲染/边界判断
    GAME_CONFIG.CANVAS_WIDTH = width;
    GAME_CONFIG.CANVAS_HEIGHT = height;
}

// 将玩家固定在屏幕底部上方一定距离
function ensurePlayerAtBottom() {
    const marginBottom = Math.max(40, Math.floor(GAME_CONFIG.CANVAS_HEIGHT * 0.08));
    player.y = GAME_CONFIG.CANVAS_HEIGHT - marginBottom;
    player.x = Math.min(Math.max(player.x, player.size), GAME_CONFIG.CANVAS_WIDTH - player.size);
}

window.addEventListener('resize', () => {
    if (!canvas || !ctx) return;
    setupCanvasForHiDPI();
    ensurePlayerAtBottom();
});

// 触控支持：手指横向位置控制玩家x，单指轻点发射
function setupTouchControls() {
    let lastTouchX = null;
    const updateFromTouch = (clientX) => {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        player.x = Math.max(player.size, Math.min(GAME_CONFIG.CANVAS_WIDTH - player.size, x));
    };
    canvas.addEventListener('touchstart', (e) => {
        if (gameState.isGameOver || gameState.isUpgradeMenuOpen) return;
        const t = e.changedTouches[0];
        lastTouchX = t.clientX;
        updateFromTouch(t.clientX);
        createBullet();
        e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        if (gameState.isGameOver || gameState.isUpgradeMenuOpen) return;
        const t = e.changedTouches[0];
        if (t) updateFromTouch(t.clientX);
        e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
        lastTouchX = null;
        e.preventDefault();
    }, { passive: false });
}

// 绑定技能输入（E键与移动端按钮）
function bindSkillControls() {
    // 桌面端：E键释放护盾
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'e') {
            tryActivateShield();
        }
    });
    // 移动端按钮
    const btn = document.getElementById('skillBtn');
    if (btn) {
        const tryClick = () => {
            tryActivateShield();
            renderSkillBtn();
        };
        btn.addEventListener('click', tryClick);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); tryClick(); }, { passive: false });
    }
}

function renderSkillBtn() {
    const btn = document.getElementById('skillBtn');
    if (!btn) return;
    const now = gameState.nowMs || performance.now();
    const onCooldown = now < player.shieldCooldownUntil;
    btn.classList.toggle('cooldown', onCooldown);
    if (player.shieldActive && now < player.shieldUntil) {
        btn.textContent = '盾*';
    } else if (onCooldown) {
        const remain = Math.ceil((player.shieldCooldownUntil - now) / 1000);
        btn.textContent = remain.toString();
    } else {
        btn.textContent = '盾';
    }
}

function tryActivateShield() {
    const now = gameState.nowMs || performance.now();
    if (now < player.shieldCooldownUntil) return;
    // 激活护盾：持续3s，冷却15s
    const baseMs = 3000;
    const bonus = player.shieldBonusMs || 0;
    player.shieldActive = true;
    player.shieldUntil = now + baseMs + bonus;
    player.shieldCooldownUntil = now + 15000;
}

// 初始化蛇
function initSnake() {
    snake = [];
    const segments = 80 + gameState.level * 15;  // 增加基础段数和每级增加段数
    
    // 重置关卡进度
    gameState.totalSegments = segments;
    gameState.defeatedSegments = 0;
    // 清空敌方子弹与Boss冷却
    enemyBullets = [];
    gameState.bossFireCooldownMs = 600; // 首次稍后开火
    
    for (let i = 0; i < segments; i++) {
        const segment = {
            x: GAME_CONFIG.CANVAS_WIDTH / 2,
            y: -i * 6,  // 调整段间距，让圆角矩形蛇身更连贯
            health: GAME_CONFIG.BASE_SNAKE_HEALTH + i * GAME_CONFIG.HEALTH_INCREASE_PER_SEGMENT,
            maxHealth: GAME_CONFIG.BASE_SNAKE_HEALTH + i * GAME_CONFIG.HEALTH_INCREASE_PER_SEGMENT,
            isTreasure: (i % GAME_CONFIG.TREASURE_INTERVAL === 0) && i > 0,
            treasureType: null
        };
        
        if (segment.isTreasure) {
            const rand = Math.random();
            if (rand < 0.6) segment.treasureType = 'common';
            else if (rand < 0.85) segment.treasureType = 'epic';
            else segment.treasureType = 'legendary';
        }
        
        snake.push(segment);
    }
    
    // 更新boss名字
    updateBossName();
}

// 进入下一关
function nextLevel() {
    if (gameState.level < 5) {
        gameState.level++;
        
        // 重置玩家升级状态
        resetPlayerUpgrades();
        
        // 显示关卡切换提示
        showLevelTransition();
        
        // 延迟一秒后初始化新关卡
        setTimeout(() => {
            initSnake();
        }, 2000);
    } else {
        // 通关
        gameWin();
    }
}

// 重置玩家升级状态
function resetPlayerUpgrades() {
    player = {
        x: GAME_CONFIG.CANVAS_WIDTH / 2,
        y: GAME_CONFIG.CANVAS_HEIGHT - 50,
        size: GAME_CONFIG.PLAYER_SIZE,
        bullets: 5,
        fireRate: 5,
        penetration: 5
    };
}

// 显示关卡切换提示
function showLevelTransition() {
    const bossName = BOSS_NAMES[gameState.level] || "未知Boss";
    const transitionDiv = document.createElement('div');
    transitionDiv.id = 'levelTransition';
    transitionDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            border: 3px solid #FFD700;
            border-radius: 15px;
            padding: 30px;
            text-align: center;
            z-index: 1000;
            color: #FFD700;
            font-size: 24px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        ">
            <div style="margin-bottom: 20px;">🎉 第${gameState.level - 1}关完成！ 🎉</div>
            <div style="margin-bottom: 15px;">下一个Boss:</div>
            <div style="font-size: 28px; color: #FF4500; margin-bottom: 15px;">${bossName}</div>
            <div style="font-size: 18px; color: #FF6B6B;">⚠️ 升级已重置，重新收集宝箱！</div>
        </div>
    `;
    document.body.appendChild(transitionDiv);
    
    // 2秒后移除提示
    setTimeout(() => {
        if (transitionDiv.parentNode) {
            transitionDiv.parentNode.removeChild(transitionDiv);
        }
    }, 2000);
}

// 更新boss名字
function updateBossName() {
    const bossTitle = document.querySelector('.boss-title h2');
    if (bossTitle) {
        const bossName = BOSS_NAMES[gameState.level] || "未知Boss";
        bossTitle.textContent = bossName;
    }
}

// 游戏胜利
function gameWin() {
    gameState.isGameOver = true;
    const winDiv = document.createElement('div');
    winDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            border: 4px solid #FFD700;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            z-index: 1000;
            color: #FFD700;
            font-size: 28px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        ">
            <div style="margin-bottom: 20px;">🎊 恭喜通关！ 🎊</div>
            <div style="margin-bottom: 20px;">最终分数: ${gameState.score}</div>
            <button onclick="restartGame()" style="
                background: #FF4500;
                color: white;
                border: none;
                padding: 15px 30px;
                border-radius: 10px;
                font-size: 18px;
                cursor: pointer;
                margin-top: 20px;
            ">重新开始</button>
        </div>
    `;
    document.body.appendChild(winDiv);
}

// 生成S形路径
function generateSPath(segment, index) {
    const amplitude =200 + index * 0.5;  // 减小振幅，让S形更扁
    const frequency = 0.1;  // 减小频率，让波动更缓慢
    const baseX = GAME_CONFIG.CANVAS_WIDTH / 2;
    segment.x = baseX + Math.sin(segment.y * frequency) * amplitude;
}

// 更新蛇的位置
function updateSnake(deltaTime) {
    // 计算当前蛇速（考虑全局减速）
    const speed = getCurrentSnakeSpeed();
    snake.forEach((segment, index) => {
        segment.y += speed * deltaTime;
        generateSPath(segment, index);
        
        if (segment.y >= player.y - player.size && segment.y <= player.y + player.size) {
            if (Math.abs(segment.x - player.x) < player.size + GAME_CONFIG.SNAKE_SEGMENT_SIZE / 2) {
                if (segment.health > 0) {
                    gameState.playerHealth -= 10;
                    createParticles(segment.x, segment.y, '#e74c3c');
                }
            }
        }
    });
    
    snake = snake.filter(segment => segment.y < GAME_CONFIG.CANVAS_HEIGHT + 50);
}

// 全局减速：在一段时间内降低蛇速到特定值
let slowEffectUntil = 0;
let slowSpeedValue = GAME_CONFIG.SNAKE_SPEED;
function applyGlobalSlow(durationMs, speedValue) {
    const now = gameState.nowMs || performance.now();
    slowEffectUntil = Math.max(slowEffectUntil, now + durationMs);
    slowSpeedValue = speedValue;
}
function getCurrentSnakeSpeed() {
    const now = gameState.nowMs || performance.now();
    if (now < slowEffectUntil) return slowSpeedValue;
    return GAME_CONFIG.SNAKE_SPEED;
}

// 获取当前蛇头段（第一个还活着的段）
function getHeadSegment() {
    for (let i = 0; i < snake.length; i++) {
        if (snake[i].health > 0) return snake[i];
    }
    return null;
}

// Boss（第一关）开火逻辑：蛇头对玩家散射
function updateBossAttack(deltaTime) {
    if (gameState.level !== 1) return; // 仅第一关启用
    if (gameState.isUpgradeMenuOpen) return;
    if (gameState.isGameOver) return;

    if (gameState.bossFireCooldownMs === undefined) {
        gameState.bossFireCooldownMs = GAME_CONFIG.BOSS_FIRE_BASE_INTERVAL_MS;
    }

    gameState.bossFireCooldownMs -= deltaTime;
    if (gameState.bossFireCooldownMs > 0) return;

    const head = getHeadSegment();
    if (!head) return;

    // 计算散射数量：每击破5段+1（最少1，最多7）
    const extra = Math.floor(gameState.defeatedSegments / 20);
    const count = Math.min(1 + extra, 7);

    // 计算朝向
    // 以玩家方向的单位向量为基，做小角度旋转形成散射
    const dx = player.x - head.x;
    const dy = player.y - head.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const step = GAME_CONFIG.BOSS_SPREAD_STEP_RAD;
    const mid = Math.floor(count / 2);
    for (let i = 0; i < count; i++) {
        const offsetIndex = i - mid;
        const rot = offsetIndex * step;
        const cosr = Math.cos(rot);
        const sinr = Math.sin(rot);
        // 旋转(ux, uy)
        const rx = ux * cosr - uy * sinr;
        const ry = ux * sinr + uy * cosr;
        const vx = rx * GAME_CONFIG.ENEMY_BULLET_SPEED;
        const vy = ry * GAME_CONFIG.ENEMY_BULLET_SPEED;
        enemyBullets.push({ x: head.x, y: head.y, vx, vy, damage: 12 });
    }

    // 动态冷却：随击破段数缩短，但有下限
    const interval = Math.max(
        GAME_CONFIG.BOSS_FIRE_MIN_INTERVAL_MS,
        GAME_CONFIG.BOSS_FIRE_BASE_INTERVAL_MS - gameState.defeatedSegments * 30
    );
    gameState.bossFireCooldownMs = interval;
}

// 敌方子弹更新
function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.x += b.vx;
        b.y += b.vy;

        // 与玩家碰撞
        const dx = b.x - player.x;
        const dy = b.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < GAME_CONFIG.ENEMY_BULLET_SIZE + player.size) {
            // 刚重生的短暂无敌
            if (gameState.spawnInvincibleUntil && gameState.nowMs < gameState.spawnInvincibleUntil) {
                // 无敌期间忽略伤害但移除子弹
                enemyBullets.splice(i, 1);
                continue;
            }
            // 护盾生效时抵挡伤害
            if (player.shieldActive && gameState.nowMs < player.shieldUntil) {
                createParticles(b.x, b.y, '#66ccff');
                enemyBullets.splice(i, 1);
                continue;
            }
            gameState.playerHealth -= b.damage;
            createParticles(b.x, b.y, '#ff5555');
            enemyBullets.splice(i, 1);
            continue;
        }

        // 出界移除
        if (b.x < -20 || b.x > GAME_CONFIG.CANVAS_WIDTH + 20 || b.y < -20 || b.y > GAME_CONFIG.CANVAS_HEIGHT + 20) {
            enemyBullets.splice(i, 1);
        }
    }
}

// 创建子弹
function createBullet() {
    if (gameState.bulletCooldown <= 0) {
        for (let i = 0; i < player.bullets; i++) {
            const spread = (i - (player.bullets - 1) / 2) * 10;
            bullets.push({
                x: player.x + spread,
                y: player.y - player.size / 2,
                vx: spread * 0.1,
                vy: -GAME_CONFIG.BULLET_SPEED,
                penetration: player.penetration,
                damage: 25
            });
        }
        gameState.bulletCooldown = 1000 / player.fireRate;
    }
}

// 更新子弹
function updateBullets(deltaTime) {
    bullets.forEach((bullet, bulletIndex) => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        
        snake.forEach((segment, segmentIndex) => {
            if (segment.health > 0) {
                const dx = bullet.x - segment.x;
                const dy = bullet.y - segment.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < GAME_CONFIG.SNAKE_SEGMENT_SIZE / 2 + GAME_CONFIG.BULLET_SIZE) {
                    const oldHealth = segment.health;
                    segment.health -= bullet.damage;
                    bullet.penetration--;
                    createParticles(segment.x, segment.y, '#f39c12');
                    // 吸血（小数累积银行）
                    const dealt = Math.max(0, Math.min(oldHealth, bullet.damage));
                    if (player.lifesteal > 0 && dealt > 0) {
                        player.lifestealBank = (player.lifestealBank || 0) + dealt * player.lifesteal;
                        const heal = Math.floor(player.lifestealBank);
                        if (heal > 0) {
                            player.lifestealBank -= heal;
                            gameState.playerHealth = Math.min(100, gameState.playerHealth + heal);
                        }
                    }
                    // 减速判定
                    if (player.slowOnHitChance > 0 && Math.random() < player.slowOnHitChance) {
                        applyGlobalSlow(1000, 0.0035);
                    }
                    
                    if (segment.health <= 0) {
                        gameState.score += 10;
                        gameState.defeatedSegments++;
                        
                        if (segment.isTreasure) {
                            showUpgradeMenu(segment.treasureType);
                        }
                        
                        // 检查是否击败所有蛇段
                        if (gameState.defeatedSegments >= gameState.totalSegments) {
                            nextLevel();
                        }
                    }
                    
                    if (bullet.penetration <= 0) {
                        bullets.splice(bulletIndex, 1);
                    }
                }
            }
        });
    });
    
    bullets = bullets.filter(bullet => 
        bullet.y > -GAME_CONFIG.BULLET_SIZE && 
        bullet.y < GAME_CONFIG.CANVAS_HEIGHT + GAME_CONFIG.BULLET_SIZE &&
        bullet.x > -GAME_CONFIG.BULLET_SIZE && 
        bullet.x < GAME_CONFIG.CANVAS_WIDTH + GAME_CONFIG.BULLET_SIZE
    );
}

// 创建粒子特效
function createParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1.0,
            decay: 0.02,
            color: color,
            size: Math.random() * 3 + 1
        });
    }
}

// 更新粒子
function updateParticles() {
    particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= particle.decay;
        
        if (particle.life <= 0) {
            particles.splice(index, 1);
        }
    });
}

// 显示升级菜单
function showUpgradeMenu(treasureType) {
    gameState.isUpgradeMenuOpen = true;
    const upgradeMenu = document.getElementById('upgradeMenu');
    const upgradeOptions = document.getElementById('upgradeOptions');
    
    const allUpgrades = [
        { key: 'bullets', name: '子弹数量 +', values: [3, 4, 5], apply: (v)=>{ player.bullets += v; } },
        { key: 'fireRate', name: '连发速度 +', values: [3, 4, 5], apply: (v)=>{ player.fireRate += v; } },
        { key: 'penetration', name: '子弹穿透 +', values: [3, 4, 5], apply: (v)=>{ player.penetration += v; } },
        // 新增：攻击附带减速几率（蓝/紫/橙：5%/10%/15%）
        { key: 'slowOnHit', name: '减速几率 +', values: [0.05, 0.10, 0.15], apply: (v)=>{ player.slowOnHitChance += v; } },
        // 新增：吸血（1%/2%/3%）
        { key: 'lifesteal', name: '吸血 +', values: [0.01, 0.02, 0.03], apply: (v)=>{ player.lifesteal += v; } },
        // 新增：护盾时长加成（+0.5/1/1.5秒）
        { key: 'shieldBonus', name: '护盾时长 +', values: [500, 1000, 1500], apply: (v)=>{ player.shieldBonusMs += v; } },
    ];

    // 从6个里随机取3个不同的条目
    const indices = [...Array(allUpgrades.length).keys()];
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const pick = indices.slice(0, 3).map(idx => allUpgrades[idx]);
    
    upgradeOptions.innerHTML = '';

    pick.forEach(upg => {
        const value = upg.values[treasureType === 'common' ? 0 : treasureType === 'epic' ? 1 : 2];
        const div = document.createElement('div');
        div.className = `upgrade-option ${treasureType}`;
        // 名称展示根据不同单位格式化
        let label = upg.name;
        if (upg.key === 'slowOnHit') label += `${Math.round(value*100)}%`;
        else if (upg.key === 'lifesteal') label += `${Math.round(value*100)}%`;
        else if (upg.key === 'shieldBonus') label += `${Math.round(value/100)/10}s`;
        else label += `${value}`;
        div.innerHTML = label;
        div.onclick = () => {
            upg.apply(value);
            upgradeMenu.style.display = 'none';
            gameState.isUpgradeMenuOpen = false;
        };
        upgradeOptions.appendChild(div);
    });
    
    upgradeMenu.style.display = 'block';
}

// 渲染游戏
function render() {
    // 清空画布
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
    
    // 渲染蛇
    let firstVisibleSegment = null;
    
    snake.forEach((segment, index) => {
        if (segment.health > 0) {
            // 找到第一个可见的蛇段作为蛇头
            if (firstVisibleSegment === null) {
                firstVisibleSegment = segment;
            }
            
            const healthPercent = segment.health / segment.maxHealth;
            const r = Math.floor(255 * (1 - healthPercent));
            const g = Math.floor(255 * healthPercent);
            ctx.fillStyle = `rgb(${r}, ${g}, 0)`;
            
            if (segment.isTreasure) {
                switch (segment.treasureType) {
                    case 'common': ctx.fillStyle = '#4a90e2'; break;
                    case 'epic': ctx.fillStyle = '#9b59b6'; break;
                    case 'legendary': ctx.fillStyle = '#e67e22'; break;
                }
            }
            
            // 检查是否是蛇头
            const isHead = (segment === firstVisibleSegment);
            
            if (isHead) {
                // 渲染蛇头 - 更大的圆角矩形
                ctx.fillStyle = '#e74c3c';  // 红色蛇头
                const headWidth = 36;   // 蛇头宽度
                const headHeight = 22;  // 蛇头高度
                const headRadius = 8;   // 蛇头圆角半径
                
                const hx = segment.x - headWidth/2;
                const hy = segment.y - headHeight/2;
                
                // 绘制圆角矩形蛇头
                ctx.beginPath();
                ctx.moveTo(hx + headRadius, hy);
                ctx.lineTo(hx + headWidth - headRadius, hy);
                ctx.quadraticCurveTo(hx + headWidth, hy, hx + headWidth, hy + headRadius);
                ctx.lineTo(hx + headWidth, hy + headHeight - headRadius);
                ctx.quadraticCurveTo(hx + headWidth, hy + headHeight, hx + headWidth - headRadius, hy + headHeight);
                ctx.lineTo(hx + headRadius, hy + headHeight);
                ctx.quadraticCurveTo(hx, hy + headHeight, hx, hy + headHeight - headRadius);
                ctx.lineTo(hx, hy + headRadius);
                ctx.quadraticCurveTo(hx, hy, hx + headRadius, hy);
                ctx.closePath();
                ctx.fill();
                
                // 蛇头眼睛
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(segment.x - 5, segment.y - 3, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(segment.x + 5, segment.y - 3, 2, 0, Math.PI * 2);
                ctx.fill();
                
                // 蛇头瞳孔
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(segment.x - 5, segment.y - 3, 1, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(segment.x + 5, segment.y - 3, 1, 0, Math.PI * 2);
                ctx.fill();
                
                // 恶魔角
                ctx.fillStyle = '#8B0000';  // 深红色恶魔角
                
                // 左角
                ctx.beginPath();
                ctx.moveTo(segment.x - 8, segment.y - 8);
                ctx.lineTo(segment.x - 12, segment.y - 15);
                ctx.lineTo(segment.x - 10, segment.y - 18);
                ctx.lineTo(segment.x - 6, segment.y - 12);
                ctx.closePath();
                ctx.fill();
                
                // 右角
                ctx.beginPath();
                ctx.moveTo(segment.x + 8, segment.y - 8);
                ctx.lineTo(segment.x + 12, segment.y - 15);
                ctx.lineTo(segment.x + 10, segment.y - 18);
                ctx.lineTo(segment.x + 6, segment.y - 12);
                ctx.closePath();
                ctx.fill();
                
                // 恶魔角高光
                ctx.fillStyle = '#FF4500';
                ctx.beginPath();
                ctx.moveTo(segment.x - 9, segment.y - 10);
                ctx.lineTo(segment.x - 11, segment.y - 14);
                ctx.lineTo(segment.x - 8, segment.y - 14);
                ctx.closePath();
                ctx.fill();
                
                ctx.beginPath();
                ctx.moveTo(segment.x + 9, segment.y - 10);
                ctx.lineTo(segment.x + 11, segment.y - 14);
                ctx.lineTo(segment.x + 8, segment.y - 14);
                ctx.closePath();
                ctx.fill();
            } else {
                // 渲染普通蛇身 - 圆角矩形
                const segmentWidth = 30;  // 蛇身宽度
                const segmentHeight = 18; // 蛇身高度
                const radius = 6;         // 圆角半径
                
                // 绘制圆角矩形蛇身（兼容性方法）
                const x = segment.x - segmentWidth/2;
                const y = segment.y - segmentHeight/2;
                
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + segmentWidth - radius, y);
                ctx.quadraticCurveTo(x + segmentWidth, y, x + segmentWidth, y + radius);
                ctx.lineTo(x + segmentWidth, y + segmentHeight - radius);
                ctx.quadraticCurveTo(x + segmentWidth, y + segmentHeight, x + segmentWidth - radius, y + segmentHeight);
                ctx.lineTo(x + radius, y + segmentHeight);
                ctx.quadraticCurveTo(x, y + segmentHeight, x, y + segmentHeight - radius);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();
                ctx.fill();
            }
            
            // 血条
            const barWidth = isHead ? 20 : 16;  // 根据蛇头或蛇身调整血条宽度
            const barHeight = 3;
            const barY = isHead ? segment.y - 12 : segment.y - 10;  // 调整血条位置
            ctx.fillStyle = '#333';
            ctx.fillRect(segment.x - barWidth / 2, barY, barWidth, barHeight);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(segment.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);
        }
    });
    
    // 渲染子弹
    ctx.fillStyle = '#f39c12';
    bullets.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, GAME_CONFIG.BULLET_SIZE, 0, Math.PI * 2);
        ctx.fill();
    });

    // 渲染敌方子弹
    enemyBullets.forEach(b => {
        ctx.fillStyle = '#ff5555';
        ctx.beginPath();
        ctx.arc(b.x, b.y, GAME_CONFIG.ENEMY_BULLET_SIZE, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // 渲染玩家
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
    ctx.fill();
    // 护盾可视化
    if (player.shieldActive && gameState.nowMs < player.shieldUntil) {
        ctx.strokeStyle = '#66ccff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size + 6, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // 渲染粒子
    particles.forEach(particle => {
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
    
    // 更新UI
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('level').textContent = gameState.level;
    document.getElementById('health').textContent = gameState.playerHealth;
    renderSkillBtn();
}

// 游戏主循环
function gameLoop(currentTime) {
    if (gameState.isGameOver) return;
    
    const deltaTime = currentTime - gameState.lastTime;
    gameState.lastTime = currentTime;
    gameState.nowMs = currentTime;
    
    if (!gameState.isUpgradeMenuOpen) {
        gameState.bulletCooldown -= deltaTime;
        updateSnake(deltaTime);
        updateBossAttack(deltaTime);
        updateBullets(deltaTime);
        updateEnemyBullets();
        updateParticles();
        createBullet();
        
        if (gameState.playerHealth <= 0) {
            gameOver();
            return;
        }
    }
    
    render();
    requestAnimationFrame(gameLoop);
}

// 游戏结束
function gameOver() {
    gameState.isGameOver = true;
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('gameOver').style.display = 'block';
}

// 重新开始游戏
function restartGame() {
    gameState = {
        score: 0,
        level: 1,
        playerHealth: 100,
        isGameOver: false,
        isUpgradeMenuOpen: false,
        lastTime: 0,
        bulletCooldown: 0,
        totalSegments: 0,
        defeatedSegments: 0,
        bossFireCooldownMs: 0,
        spawnInvincibleUntil: 0,
        nowMs: 0
    };
    
    player = {
        x: GAME_CONFIG.CANVAS_WIDTH / 2,
        y: GAME_CONFIG.CANVAS_HEIGHT - 50,
        size: GAME_CONFIG.PLAYER_SIZE,
        bullets: 5,
        fireRate: 5,
        penetration: 5
    };
    
    bullets = [];
    enemyBullets = [];
    particles = [];
    
    // 重置玩家升级状态
    resetPlayerUpgrades();
    
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('upgradeMenu').style.display = 'none';
    
    initSnake();
    ensurePlayerAtBottom();
    gameState.spawnInvincibleUntil = gameState.nowMs + 800; // 重生短暂无敌
    gameLoop(performance.now());
}

// 键盘控制
document.addEventListener('keydown', (e) => {
    if (gameState.isGameOver || gameState.isUpgradeMenuOpen) return;
    
    const moveSpeed = 5;
    switch (e.key) {
        case 'ArrowLeft':
        case 'a':
            player.x = Math.max(player.size, player.x - moveSpeed);
            break;
        case 'ArrowRight':
        case 'd':
            player.x = Math.min(GAME_CONFIG.CANVAS_WIDTH - player.size, player.x + moveSpeed);
            break;
        case ' ':
            createBullet();
            break;
    }
});

// 等待DOM加载完成后添加事件监听器
document.addEventListener('DOMContentLoaded', function() {
    // 鼠标控制
    canvas.addEventListener('mousemove', (e) => {
        if (gameState.isGameOver || gameState.isUpgradeMenuOpen) return;
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        player.x = Math.max(player.size, Math.min(GAME_CONFIG.CANVAS_WIDTH - player.size, mouseX));
    });

    canvas.addEventListener('click', () => {
        if (!gameState.isGameOver && !gameState.isUpgradeMenuOpen) {
            createBullet();
        }
    });
});
