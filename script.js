// ==========================================
// 1. CONFIGURACIÓN DE SUPABASE
// ==========================================
const supabaseUrl = 'https://wgqqbahoalozgfukioza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndncXFiYWhvYWxvemdmdWtpb3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNTA3OTYsImV4cCI6MjA5OTgyNjc5Nn0.v_kpYceS8ceIUBNaLLHjfyBeFA2Y3lDRy7Yn6cb5Uz8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;

// Símbolos oficiales
const symbols = [
    { id: 'corona', img: 'corona.png', val: 10 },    
    { id: 'reloj', img: 'reloj.png', val: 5 },       
    { id: 'anillo', img: 'anillo.png', val: 4 },     
    { id: 'caliz', img: 'caliz.png', val: 3 },       
    { id: 'roja', img: 'roja.png', val: 2 },         
    { id: 'morada', img: 'morada.png', val: 1.5 },   
    { id: 'amarilla', img: 'amarilla.png', val: 1 }, 
    { id: 'verde', img: 'verde.png', val: 0.8 },     
    { id: 'azul', img: 'azul.png', val: 0.5 },       
    { id: 'zeus', img: 'zeus.png', val: 15 }         
];

// Estado General
let credit = 0; 
let baseBet = 2.00;
let actualBet = 2.00;
let doubleChance = false;
let isSpinning = false;

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

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 2. LÓGICA DE AUTENTICACIÓN Y SALDOS DE SUPABASE
// ==========================================

async function verificarSesionYJugar() {
    statusMessage.innerText = "CARGANDO SALDO...";
    
    // 1. Verificamos si hay alguien logueado
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        // Redirigir al lobby si no está logueado
        window.location.href = 'index.html'; 
        return;
    }
    
    currentUser = session.user;

    // 2. Buscamos su saldo en la tabla "perfiles"
    const { data: perfilData } = await supabaseClient
        .from('perfiles')
        .select('saldo')
        .eq('id', currentUser.id)
        .single();

    if (perfilData) {
        credit = parseFloat(perfilData.saldo);
    } else {
        // Si no tiene perfil, le damos el bono inicial y lo creamos
        credit = 10000; 
        await guardarSaldoEnBD(); 
    }

    statusMessage.innerText = "¡QUE LOS DIOSES TE BENDIGAN!";
    initGrid();
}

// Función con UPSERT para crear el registro si no existe, o actualizarlo si ya existe
async function guardarSaldoEnBD() {
    if(!currentUser) return;
    
    await supabaseClient
        .from('perfiles')
        .upsert({ 
            id: currentUser.id, 
            saldo: credit 
        });
}

// ==========================================
// 3. FUNCIONES DEL JUEGO
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

// Apuestas
betPlus.addEventListener('click', () => {
    if (isSpinning || isFreeSpinsMode) return;
    if (baseBet < 100) { baseBet += 2.00; calculateActualBet(); }
});

betMinus.addEventListener('click', () => {
    if (isSpinning || isFreeSpinsMode) return;
    if (baseBet > 2.00) { baseBet -= 2.00; calculateActualBet(); }
});

function calculateActualBet() {
    actualBet = doubleChance ? baseBet * 1.25 : baseBet;
    updateUI();
}

doubleChanceToggle.addEventListener('change', (e) => {
    if (isSpinning || isFreeSpinsMode) {
        e.target.checked = !e.target.checked;
        return;
    }
    doubleChance = e.target.checked;
    calculateActualBet();
});

// Comprar Giros Normales
btnBuyFree.addEventListener('click', async () => {
    if (isSpinning || isFreeSpinsMode) return;
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

// Comprar Super Giros
btnBuySuper.addEventListener('click', async () => {
    if (isSpinning || isFreeSpinsMode) return;
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

// Lanzar Tiro
spinBtn.addEventListener('click', async () => {
    if (isSpinning || isFreeSpinsMode) return;
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
    statusMessage.innerText = isFreeSpinsMode ? `GIRO DIVINO: ${freeSpinsLeft}` : "¡INVOCANDO LOS RAYOS!";
    spinWinAccumulator.style.display = 'none';
    accumValue.innerText = "$0.00";
    accumMult.innerText = "";
    
    const cells = document.querySelectorAll('.slot-cell');
    cells.forEach(cell => cell.classList.add('spinning'));
    await delay(600);

    generateNewSymbols();
    renderGridDOM();

    await handleTumbles();
}

function generateNewSymbols() {
    gridState = [];
    for (let i = 0; i < 30; i++) {
        gridState.push(getRandomSymbolWithProbability());
    }
}

function getRandomSymbolWithProbability() {
    const weights = {
        'azul': 110, 'verde': 95, 'amarilla': 85, 'morada': 70, 'roja': 60,
        'caliz': 40, 'anillo': 28, 'reloj': 18, 'corona': 8,
        'zeus': doubleChance ? 16 : 7 
    };

    if (isFreeSpinsMode) {
        if (isSuperBonusMode) weights['orbe'] = 25; 
        else weights['orbe'] = 12; 
    } else {
        weights['orbe'] = 3; 
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

    if (selectedId === 'orbe') {
        let multWeights;
        if (isSuperBonusMode) {
            multWeights = { 15: 600, 25: 250, 50: 100, 100: 35, 250: 10, 500: 2 };
        } else {
            multWeights = { 2: 2500, 3: 1500, 5: 800, 8: 400, 10: 200, 15: 100, 25: 40, 50: 15, 100: 5, 250: 1, 500: 0.2 };
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
            winThisStep += 15 * baseBet;
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
                if (qty >= 10 && qty <= 11) factor = 1.5;
                if (qty >= 12) factor = 3.0;

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
        let finalSpinWin = accumulatedSpinWin;

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

        credit += finalSpinWin;
        
        // Guardamos la ganancia en la BD
        guardarSaldoEnBD();

        winDisplay.innerText = `$${finalSpinWin.toFixed(2)}`;

        if (isFreeSpinsMode) {
            totalFsWin += finalSpinWin;
            animateBonusHeader(totalFsWin);
        }

    } else {
        statusMessage.innerText = isFreeSpinsMode ? "Tirada sin bendición" : "Suerte en la próxima";
    }

    updateUI();
    isSpinning = false;

    if (activatedFreeSpins) {
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
    fsOverlayTitle.innerText = "¡FIN DEL REINO DIVINO!";
    fsCountText.innerText = `GANANCIA TOTAL: $${totalFsWin.toFixed(2)}`;
    fsOverlay.style.display = 'flex';

    setTimeout(() => {
        fsOverlay.style.display = 'none';
        bonusHeaderContainer.style.display = 'none'; 
        spinWinAccumulator.style.display = 'none';
        statusMessage.innerText = "PRESIONA PARA GIRAR";
        winDisplay.innerText = `$${totalFsWin.toFixed(2)}`;
        updateUI();
    }, 4000);
}

infoBtn.addEventListener('click', () => { if (!isSpinning) infoModal.style.display = 'flex'; });
closeModal.addEventListener('click', () => { infoModal.style.display = 'none'; });
window.addEventListener('click', (e) => { if (e.target === infoModal) infoModal.style.display = 'none'; });

// ==========================================
// 4. INICIALIZADOR
// ==========================================
window.onload = verificarSesionYJugar;