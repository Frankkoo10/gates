// ==========================================
// 1. CONFIGURACIÓN DE SUPABASE
// ==========================================
const supabaseUrl = 'https://wgqqbahoalozgfukioza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndncXFiYWhvYWxvemdmdWtpb3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNTA3OTYsImV4cCI6MjA5OTgyNjc5Nn0.v_kpYceS8ceIUBNaLLHjfyBeFA2Y3lDRy7Yn6cb5Uz8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;

// Símbolos oficiales con pagos MUY reducidos (Volatilidad de Casino Real)
const symbols = [
    { id: 'corona', img: 'corona.png', val: 2.5 },    
    { id: 'reloj', img: 'reloj.png', val: 1.2 },       
    { id: 'anillo', img: 'anillo.png', val: 0.8 },     
    { id: 'caliz', img: 'caliz.png', val: 0.5 },       
    { id: 'roja', img: 'roja.png', val: 0.4 },         
    { id: 'morada', img: 'morada.png', val: 0.3 },   
    { id: 'amarilla', img: 'amarilla.png', val: 0.2 }, 
    { id: 'verde', img: 'verde.png', val: 0.15 },     
    { id: 'azul', img: 'azul.png', val: 0.1 },       
    { id: 'zeus', img: 'zeus.png', val: 1.5 }         
];

// Estado General
let credit = 0; 
let baseBet = 2.00;
let actualBet = 2.00;
let doubleChance = false;
let isSpinning = false;
const MAX_WIN_MULT = 5000;

// Estado AutoPlay y Velocidad
let autoSpinActive = false;
let autoSpinsLeft = 0;
let stopOnBonus = false;
let stopWinLimit = 0;
let speedMult = 1; 

// Estado de Giros Gratis
let isFreeSpinsMode = false;
let isSuperBonusMode = false; 
let freeSpinsLeft = 0;
let totalFsWin = 0;
let globalMultiplier = 1;

// Grilla
let gridState = [];

// DOM Elements
const gridContainer = document.getElementById('slot-grid');
const spinBtn = document.getElementById('spin-button');
const creditDisplay = document.getElementById('credit-display');
const betDisplay = document.getElementById('bet-display');
const winDisplay = document.getElementById('win-display');
const statusMessage = document.getElementById('status-message');
const betMinus = document.getElementById('bet-minus');
const betPlus = document.getElementById('bet-plus');
const doubleChanceToggle = document.getElementById('double-chance-toggle');
const doubleBetDisplay = document.getElementById('double-bet-display');
const btnBuyFree = document.getElementById('btn-buy-free');
const btnBuySuper = document.getElementById('btn-buy-super');
const buyFsCost = document.getElementById('buy-fs-cost');
const buySuperCost = document.getElementById('buy-super-cost');
const fsOverlay = document.getElementById('fs-overlay');
const fsOverlayTitle = document.getElementById('fs-overlay-title');
const fsCountText = document.getElementById('fs-count');

const bonusHeaderContainer = document.getElementById('bonus-header-container');
const bonusTotalAmount = document.getElementById('bonus-total-amount');
const globalMultValue = document.getElementById('global-mult-value');
const spinWinAccumulator = document.getElementById('spin-win-accumulator');
const accumValue = document.getElementById('accum-value');
const accumMult = document.getElementById('accum-mult');

const infoBtn = document.getElementById('info-btn');
const infoModal = document.getElementById('info-modal');
const closeModal = document.getElementById('close-modal');

// DOM Elements AutoPlay y Velocidad
const mainSpeedBtn = document.getElementById('main-speed-btn');
let currentSpeedMode = 0; 

const autoBtn = document.getElementById('open-auto-modal');
const stopAutoBtn = document.getElementById('stop-auto-btn');
const autoModal = document.getElementById('auto-play-modal');
const closeAutoModalBtn = document.getElementById('close-auto');
const autoSpeedSelect = document.getElementById('auto-speed-select');
const autoStopBonus = document.getElementById('auto-stop-bonus');
const autoStopWin = document.getElementById('auto-stop-win');

// Delay con Multiplicador de Velocidad
const delay = ms => new Promise(resolve => setTimeout(resolve, ms * speedMult));

// ==========================================
// PANTALLA DE CARGA
// ==========================================
window.onload = () => {
    // Exactamente 4 segundos de carga
    setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
            verificarSesionYJugar();
        }, 500);
    }, 4000); 
};


// ==========================================
// 2. LÓGICA DE AUTENTICACIÓN Y SALDOS DE SUPABASE
// ==========================================

async function verificarSesionYJugar() {
    statusMessage.innerText = "CARGANDO SALDO...";
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'index.html'; 
        return;
    }
    
    currentUser = session.user;
    const { data: perfilData } = await supabaseClient.from('perfiles').select('saldo').eq('id', currentUser.id).single();

    if (perfilData) {
        credit = parseFloat(perfilData.saldo);
    } else {
        credit = 10000; 
        await guardarSaldoEnBD(); 
    }

    statusMessage.innerText = "¡QUE LOS DIOSES TE BENDIGAN!";
    
    if(!loadBonusState()) {
        initGrid();
    }
}

async function guardarSaldoEnBD() {
    if(!currentUser) return;
    await supabaseClient.from('perfiles').upsert({ id: currentUser.id, saldo: credit });
}

// ==========================================
// 3. GUARDADO DEL ESTADO (Para Bonus interrumpidos)
// ==========================================
function saveGameState() {
    if (isFreeSpinsMode) {
        const state = {
            isSuperBonusMode,
            freeSpinsLeft,
            totalFsWin,
            globalMultiplier,
            baseBet,
            actualBet,
            doubleChance
        };
        localStorage.setItem('olympusBonusState', JSON.stringify(state));
    } else {
        localStorage.removeItem('olympusBonusState');
    }
}

function loadBonusState() {
    const saved = localStorage.getItem('olympusBonusState');
    if (saved) {
        const state = JSON.parse(saved);
        isFreeSpinsMode = true;
        isSuperBonusMode = state.isSuperBonusMode;
        freeSpinsLeft = state.freeSpinsLeft;
        totalFsWin = state.totalFsWin;
        globalMultiplier = state.globalMultiplier;
        baseBet = state.baseBet;
        actualBet = state.actualBet;
        
        if (state.doubleChance !== undefined) {
            doubleChance = state.doubleChance;
            doubleChanceToggle.checked = doubleChance;
        }
        
        calculateActualBet();

        bonusHeaderContainer.style.display = 'flex';
        bonusTotalAmount.innerText = `$${totalFsWin.toFixed(2)}`;
        globalMultValue.innerText = `x${globalMultiplier}`;
        updateUI();
        initGrid();

        statusMessage.innerText = "⚡ RECUPERANDO BONUS DIVINO ⚡";
        setTimeout(() => {
            executeFreeSpinsLoop();
        }, 2500);
        return true;
    }
    return false;
}

// ==========================================
// 4. FUNCIONES DEL JUEGO Y APUESTAS
// ==========================================

function initGrid() {
    gridContainer.innerHTML = '';
    gridState = [];
    for (let i = 0; i < 30; i++) {
        const randomSym = symbols[4 + Math.floor(Math.random() * 5)]; 
        gridState.push({ ...randomSym });
    }
    renderGridDOM();
    updateUI();
}

function renderGridDOM() {
    gridContainer.innerHTML = '';
    gridState.forEach((item, index) => {
        const cell = document.createElement('div');
        cell.classList.add('slot-cell');
        cell.classList.add('landing'); 
        
        if (item) {
            const img = document.createElement('img');
            img.src = item.img;
            img.alt = item.id;
            cell.appendChild(img);

            if (item.isBomb) {
                cell.style.background = "radial-gradient(circle, #00f0ff 0%, #2c0c4c 100%)";
                const badge = document.createElement('span');
                badge.classList.add('bomb-badge');
                badge.innerText = `x${item.multiplierValue}`;
                cell.appendChild(badge);
            }
        } else {
            cell.style.opacity = '0';
        }
        gridContainer.appendChild(cell);
    });
}

function updateUI() {
    creditDisplay.innerText = `$${credit.toFixed(2)}`;
    betDisplay.innerText = `$${actualBet.toFixed(2)}`;
    doubleBetDisplay.innerText = `$${(baseBet * 1.25).toFixed(2)}`;
    buyFsCost.innerText = `$${(baseBet * 100).toFixed(2)}`;
    buySuperCost.innerText = `$${(baseBet * 500).toFixed(2)}`;
    globalMultValue.innerText = `x${globalMultiplier}`;
}

betPlus.addEventListener('click', () => {
    if (isSpinning || isFreeSpinsMode || autoSpinActive) return;
    if (baseBet < 2000) { 
        if (baseBet < 20) baseBet += 2.00;
        else if (baseBet < 100) baseBet += 10.00;
        else if (baseBet < 500) baseBet += 50.00;
        else baseBet += 100.00;
        if (baseBet > 2000) baseBet = 2000;
        calculateActualBet(); 
    }
});

betMinus.addEventListener('click', () => {
    if (isSpinning || isFreeSpinsMode || autoSpinActive) return;
    if (baseBet > 2.00) { 
        if (baseBet <= 20) baseBet -= 2.00;
        else if (baseBet <= 100) baseBet -= 10.00;
        else if (baseBet <= 500) baseBet -= 50.00;
        else baseBet -= 100.00;
        if (baseBet < 2.00) baseBet = 2.00;
        calculateActualBet(); 
    }
});

function calculateActualBet() {
    actualBet = doubleChance ? baseBet * 1.25 : baseBet;
    updateUI();
}

doubleChanceToggle.addEventListener('change', (e) => {
    if (isSpinning || isFreeSpinsMode || autoSpinActive) {
        e.target.checked = !e.target.checked;
        return;
    }
    doubleChance = e.target.checked;
    calculateActualBet();
});

mainSpeedBtn.addEventListener('click', () => {
    currentSpeedMode = (currentSpeedMode + 1) % 3;
    if(currentSpeedMode === 0) { speedMult = 1; mainSpeedBtn.innerText = "▶ NORM"; }
    if(currentSpeedMode === 1) { speedMult = 0.4; mainSpeedBtn.innerText = "⏩ TURBO"; }
    if(currentSpeedMode === 2) { speedMult = 0.1; mainSpeedBtn.innerText = "⚡ SUPER"; }
});

btnBuyFree.addEventListener('click', async () => {
    if (isSpinning || isFreeSpinsMode || autoSpinActive) return;
    const cost = baseBet * 100;
    if (credit >= cost) {
        credit -= cost;
        guardarSaldoEnBD(); 
        updateUI();
        isSuperBonusMode = false; 
        triggerFreeSpins(15);
    } else {
        statusMessage.innerText = "CRÉDITO INSUFICIENTE";
    }
});

btnBuySuper.addEventListener('click', async () => {
    if (isSpinning || isFreeSpinsMode || autoSpinActive) return;
    const cost = baseBet * 500;
    if (credit >= cost) {
        credit -= cost;
        guardarSaldoEnBD(); 
        updateUI();
        isSuperBonusMode = true; 
        triggerFreeSpins(15);
    } else {
        statusMessage.innerText = "CRÉDITO INSUFICIENTE";
    }
});

spinBtn.addEventListener('click', async () => {
    if (isSpinning || isFreeSpinsMode || autoSpinActive) return;
    if (credit >= actualBet) {
        credit -= actualBet;
        guardarSaldoEnBD(); 
        winDisplay.innerText = "$0.00";
        updateUI();
        executeSpin();
    } else {
        statusMessage.innerText = "CRÉDITO INSUFICIENTE";
    }
});

async function executeSpin() {
    isSpinning = true;
    statusMessage.innerText = isFreeSpinsMode ? `GIRO DIVINO: ${freeSpinsLeft}` : (speedMult < 1 ? "GIRO TURBO" : "¡BUSCANDO CONEXIÓN...");
    spinWinAccumulator.style.display = 'none';
    accumValue.innerText = "$0.00";
    accumMult.innerText = "";
    
    if (isFreeSpinsMode) saveGameState();

    const cells = document.querySelectorAll('.slot-cell');
    cells.forEach(cell => cell.classList.add('spinning'));
    await delay(600);

    generateNewSymbols();
    renderGridDOM();

    await handleTumbles();
}

// =====================================
// MAGIA NEGRA DEL CASINO: VOLATILIDAD EXTREMA
// =====================================
function generateNewSymbols() {
    gridState = [];
    for (let i = 0; i < 30; i++) {
        gridState.push(getRandomSymbolWithProbability());
    }
}

function getRandomSymbolWithProbability() {
    // Al distribuir equitativamente los bajos, se forma un arcoíris en la grilla.
    // Esto hace que sea MUCHO más difícil juntar 8 de un mismo color, forzando tiros muertos.
    const weights = {
        'azul': 200, 'verde': 190, 'amarilla': 180, 'morada': 170, 'roja': 150,
        'caliz': 40, 'anillo': 30, 'reloj': 15, 'corona': 5,
        'zeus': doubleChance ? 3 : 1 
    };

    // Probabilidades súper reducidas para los orbes
    if (isFreeSpinsMode) {
        if (isSuperBonusMode) weights['orbe'] = 5; 
        else weights['orbe'] = 1.5; 
    } else {
        weights['orbe'] = 0.1; // Extremedamente raros en juego base
    }

    let totalWeight = 0;
    for (let key in weights) totalWeight += weights[key];

    let randomNum = Math.random() * totalWeight;
    let selectedId = 'azul';

    for (let key in weights) {
        if (randomNum < weights[key]) {
            selectedId = key;
            break;
        }
        randomNum -= weights[key];
    }

    // Si sale orbe, los multiplicadores altísimos son casi un milagro
    if (selectedId === 'orbe') {
        let multWeights;
        if (isSuperBonusMode) {
            multWeights = { 15: 1500, 25: 500, 50: 100, 100: 20, 250: 2, 500: 0.5 };
        } else {
            multWeights = { 2: 20000, 3: 8000, 4: 4000, 5: 1500, 8: 800, 10: 400, 15: 150, 20: 80, 25: 30, 40: 10, 50: 5, 100: 2, 250: 0.5, 500: 0.1, 1000: 0.01 };
        }
        
        let totalMWeight = 0;
        for (let m in multWeights) totalMWeight += multWeights[m];

        let mRand = Math.random() * totalMWeight;
        let finalMult = isSuperBonusMode ? 15 : 2;

        for (let mVal in multWeights) {
            if (mRand < multWeights[mVal]) {
                finalMult = parseInt(mVal);
                break;
            }
            mRand -= multWeights[mVal];
        }
        return { id: 'orbe', isBomb: true, multiplierValue: finalMult, img: 'orbe.png' };
    }

    const baseSym = symbols.find(s => s.id === selectedId);
    return { ...baseSym };
}

async function handleTumbles() {
    let tumbleCount = 0;
    let accumulatedSpinWin = 0; 
    let isWinningTumble = true;
    let extraFreeSpinsAwarded = false;
    let activatedFreeSpins = false;
    let finalSpinWin = 0;

    if (isFreeSpinsMode) spinWinAccumulator.style.display = 'flex';

    while (isWinningTumble) {
        const counts = {};
        gridState.forEach(item => {
            if (item) counts[item.id] = (counts[item.id] || 0) + 1;
        });

        const winningSymbolsList = [];
        let winThisStep = 0;
        const scatterQty = counts['zeus'] || 0;
        
        if (scatterQty >= 4) {
            winningSymbolsList.push('zeus');
            winThisStep += 1.5 * baseBet; // Scatter también paga menos
            if (!isFreeSpinsMode) activatedFreeSpins = true;
            else extraFreeSpinsAwarded = true;
        } else if (scatterQty === 3 && isFreeSpinsMode) {
            winningSymbolsList.push('zeus'); 
            extraFreeSpinsAwarded = true;
        }

        for (const key in counts) {
            if (key === 'zeus' || key === 'orbe') continue;
            const qty = counts[key];
            if (qty >= 8) {
                winningSymbolsList.push(key);
                const config = symbols.find(s => s.id === key);
                
                let factor = 1.0;
                if (qty >= 10 && qty <= 11) factor = 2.5;
                if (qty >= 12) factor = 5.0;

                winThisStep += config.val * baseBet * factor;
            }
        }

        if (winningSymbolsList.length > 0) {
            tumbleCount++;
            accumulatedSpinWin += winThisStep;

            spinWinAccumulator.style.display = 'flex';
            accumValue.innerText = `$${accumulatedSpinWin.toFixed(2)}`;

            const domCells = document.querySelectorAll('.slot-cell');
            gridState.forEach((item, index) => {
                if (item && winningSymbolsList.includes(item.id)) {
                    domCells[index].classList.add('win-highlight');
                }
            });

            await delay(900);

            gridState.forEach((item, index) => {
                if (item && winningSymbolsList.includes(item.id)) {
                    domCells[index].classList.add('win-pop');
                    gridState[index] = null; 
                }
            });

            await delay(300);
            applyGravity();
            renderGridDOM();
            await delay(300);
            fillEmptySpaces();
            renderGridDOM();
            await delay(400);

        } else {
            isWinningTumble = false;
        }
    }

    if (accumulatedSpinWin > 0) {
        let spinOrbsSum = 0;
        finalSpinWin = accumulatedSpinWin;

        const domCells = document.querySelectorAll('.slot-cell');
        
        gridState.forEach((item, index) => {
            if (item && item.isBomb) {
                spinOrbsSum += item.multiplierValue;
                domCells[index].classList.add('bomb-pulse'); 
            }
        });

        if (spinOrbsSum > 0) {
            if (isFreeSpinsMode) {
                globalMultiplier += spinOrbsSum;
                updateUI(); 
                
                accumMult.innerText = ` x ⚡${globalMultiplier}`;
                await delay(1200); 

                finalSpinWin = accumulatedSpinWin * globalMultiplier;
                statusMessage.innerText = `¡PODER DE ZEUS! MULT. GLOBAL x${globalMultiplier}`;
            } else {
                accumMult.innerText = ` x 🔮${spinOrbsSum}`;
                await delay(1200); 
                finalSpinWin = accumulatedSpinWin * spinOrbsSum;
                statusMessage.innerText = `¡RAYO DIVINO! MULTIPLICADO POR x${spinOrbsSum}`;
            }
            accumValue.innerText = `$${finalSpinWin.toFixed(2)}`;
        } 
        
        // =====================================
        // VERIFICACIÓN MAX WIN (5000x BaseBet)
        // =====================================
        let winCapLimit = baseBet * MAX_WIN_MULT;
        let sessionTotal = isFreeSpinsMode ? (totalFsWin + finalSpinWin) : finalSpinWin;
        
        if (sessionTotal >= winCapLimit) {
            finalSpinWin = winCapLimit - (isFreeSpinsMode ? totalFsWin : 0);
            statusMessage.innerText = "⚡ ¡MAX WIN 5000X ALCANZADO! ⚡";
            accumValue.innerText = `MAX WIN $${finalSpinWin.toFixed(2)}`;
            if (isFreeSpinsMode) {
                freeSpinsLeft = 0; 
            }
        }

        credit += finalSpinWin;
        guardarSaldoEnBD();
        winDisplay.innerText = `$${finalSpinWin.toFixed(2)}`;

        if (isFreeSpinsMode) {
            totalFsWin += finalSpinWin;
            animateBonusHeader(totalFsWin);
        }

    } else {
        statusMessage.innerText = isFreeSpinsMode ? "Tirada sin bendición" : "GIRO MUERTO.";
    }

    if (autoSpinActive) {
        if (stopWinLimit > 0 && finalSpinWin >= stopWinLimit) {
            autoSpinActive = false;
            statusMessage.innerText = "AUTO STOP: LÍMITE DE GANANCIA";
        }
    }

    updateUI();
    if (isFreeSpinsMode) saveGameState(); 
    isSpinning = false;

    if (activatedFreeSpins) {
        if (autoSpinActive && stopOnBonus) autoSpinActive = false;
        await delay(1500);
        triggerFreeSpins(15);
        return;
    }

    if (extraFreeSpinsAwarded) {
        freeSpinsLeft += 5;
        statusMessage.innerText = "¡+5 GIROS DIVINOS EXTRA!";
        await delay(1500);
    }

    if (isFreeSpinsMode) {
        if (freeSpinsLeft > 0) {
            await delay(1500);
            executeFreeSpinsLoop();
        } else {
            await delay(1500);
            finishFreeSpinsMode();
        }
    }
}

function applyGravity() {
    for (let col = 0; col < 6; col++) {
        const activeElements = [];
        for (let row = 4; row >= 0; row--) {
            const index = row * 6 + col;
            if (gridState[index] !== null) activeElements.push(gridState[index]);
        }
        for (let row = 4; row >= 0; row--) {
            const index = row * 6 + col;
            if (activeElements.length > 0) gridState[index] = activeElements.shift();
            else gridState[index] = null;
        }
    }
}

function fillEmptySpaces() {
    for (let i = 0; i < 30; i++) {
        if (gridState[i] === null) gridState[i] = getRandomSymbolWithProbability();
    }
}

function triggerFreeSpins(count) {
    isFreeSpinsMode = true;
    freeSpinsLeft = count;
    totalFsWin = 0;
    globalMultiplier = 0; 
    if(globalMultiplier === 0) globalMultiplier = 1;
    
    saveGameState();

    bonusHeaderContainer.style.display = 'flex';
    bonusTotalAmount.innerText = "$0.00";
    updateUI();

    fsOverlayTitle.innerText = isSuperBonusMode ? "¡SUPER OLIMPO ADQUIRIDO!" : "¡GIROS DE ZEUS!";
    fsCountText.innerText = `${count} GIROS CON MULTIPLICADOR GLOBAL`;
    fsOverlay.style.display = 'flex';

    setTimeout(() => {
        fsOverlay.style.display = 'none';
        executeFreeSpinsLoop();
    }, 3000);
}

function executeFreeSpinsLoop() {
    if (freeSpinsLeft > 0) {
        freeSpinsLeft--;
        executeSpin();
    }
}

function animateBonusHeader(targetValue) {
    let current = parseFloat(bonusTotalAmount.innerText.replace('$', ''));
    let increment = (targetValue - current) / 15;
    let step = 0;

    const timer = setInterval(() => {
        current += increment;
        bonusTotalAmount.innerText = `$${current.toFixed(2)}`;
        step++;
        if (step >= 15) {
            clearInterval(timer);
            bonusTotalAmount.innerText = `$${targetValue.toFixed(2)}`;
        }
    }, 40);
}

function finishFreeSpinsMode() {
    isFreeSpinsMode = false;
    isSuperBonusMode = false;
    
    saveGameState();

    fsOverlayTitle.innerText = "¡FIN DEL REINO DIVINO!";
    fsCountText.innerText = `GANANCIA TOTAL: $${totalFsWin.toFixed(2)}`;
    fsOverlay.style.display = 'flex';

    setTimeout(() => {
        fsOverlay.style.display = 'none';
        bonusHeaderContainer.style.display = 'none'; 
        spinWinAccumulator.style.display = 'none';
        statusMessage.innerText = autoSpinActive ? "CONTINUANDO AUTO..." : "PRESIONA PARA GIRAR";
        winDisplay.innerText = `$${totalFsWin.toFixed(2)}`;
        updateUI();
    }, 4000);
}

// ==========================================
// 5. LÓGICA DE GIROS AUTOMÁTICOS (AUTOPLAY)
// ==========================================

autoBtn.addEventListener('click', () => { 
    if (!isSpinning && !isFreeSpinsMode && !autoSpinActive) autoModal.style.display = 'flex'; 
});
closeAutoModalBtn.addEventListener('click', () => { autoModal.style.display = 'none'; });
window.addEventListener('click', (e) => { if (e.target === autoModal) autoModal.style.display = 'none'; });

document.querySelectorAll('.auto-count-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        autoSpinsLeft = parseInt(e.target.getAttribute('data-spins'));
        
        let selectSpd = parseFloat(autoSpeedSelect.value);
        if(selectSpd === 1) { currentSpeedMode = 0; mainSpeedBtn.innerText = "▶ NORM"; }
        if(selectSpd === 0.4) { currentSpeedMode = 1; mainSpeedBtn.innerText = "⏩ TURBO"; }
        if(selectSpd === 0.1) { currentSpeedMode = 2; mainSpeedBtn.innerText = "⚡ SUPER"; }
        speedMult = selectSpd;
        
        stopOnBonus = autoStopBonus.checked;
        stopWinLimit = parseFloat(autoStopWin.value) || 0;
        
        autoModal.style.display = 'none';
        startAutoPlay();
    });
});

stopAutoBtn.addEventListener('click', () => {
    autoSpinActive = false;
    autoSpinsLeft = 0;
    updateAutoUI();
});

function updateAutoUI() {
    if (autoSpinActive) {
        autoBtn.style.display = 'none';
        stopAutoBtn.style.display = 'inline-block';
        stopAutoBtn.innerText = `STOP (${autoSpinsLeft > 9000 ? '∞' : autoSpinsLeft})`;
    } else {
        autoBtn.style.display = 'inline-block';
        stopAutoBtn.style.display = 'none';
    }
}

async function startAutoPlay() {
    autoSpinActive = true;
    updateAutoUI();

    while (autoSpinActive && autoSpinsLeft > 0) {
        while (isSpinning || isFreeSpinsMode) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (!autoSpinActive) break;

        if (credit < actualBet) {
            statusMessage.innerText = "CRÉDITO INSUFICIENTE PARA AUTO";
            autoSpinActive = false;
            break;
        }
        
        autoSpinsLeft--;
        updateAutoUI();
        
        credit -= actualBet;
        guardarSaldoEnBD();
        winDisplay.innerText = "$0.00";
        updateUI();
        
        await executeSpin();
    }
    
    autoSpinActive = false;
    updateAutoUI();
}

infoBtn.addEventListener('click', () => { if (!isSpinning) infoModal.style.display = 'flex'; });
closeModal.addEventListener('click', () => { infoModal.style.display = 'none'; });
window.addEventListener('click', (e) => { if (e.target === infoModal) infoModal.style.display = 'none'; });