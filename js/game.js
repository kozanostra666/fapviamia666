
// ============================================================
// DATA
// ============================================================
const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RED_SUITS = new Set(['♥','♦']);

const HAND_DEFS = [
  { id:'royal',    rank:10, name:'Роял-флеш',     emoji:'👑', desc:'A K Q J 10 одной масти' },
  { id:'sflush',   rank:9,  name:'Стрит-флеш',    emoji:'🌊', desc:'5 карт подряд одной масти' },
  { id:'quads',    rank:8,  name:'Каре',           emoji:'🎯', desc:'Четыре карты одного ранга' },
  { id:'fhouse',   rank:7,  name:'Фулл-хаус',      emoji:'🏠', desc:'Тройка + пара' },
  { id:'flush',    rank:6,  name:'Флеш',           emoji:'🌸', desc:'5 карт одной масти' },
  { id:'straight', rank:5,  name:'Стрит',          emoji:'➡️', desc:'5 карт подряд' },
  { id:'three',    rank:4,  name:'Тройка',         emoji:'3️⃣', desc:'Три карты одного ранга' },
  { id:'twopair',  rank:3,  name:'Две пары',       emoji:'2️⃣', desc:'Две разные пары' },
  { id:'pair',     rank:2,  name:'Пара',           emoji:'👫', desc:'Две карты одного ранга' },
  { id:'high',     rank:1,  name:'Старшая карта',  emoji:'🃏', desc:'Лучшая карта в руке' },
];

// ============================================================
// STATE
// ============================================================
let deck = [], playerHand = [], opponentHand = [], community = [];
let pot = 0, playerChips = 1000, stage = 0, bet = 0, roundActive = false;
// stage: 0=pre, 1=flop, 2=turn, 3=river, 4=showdown

// ============================================================
// DECK
// ============================================================
function buildDeck() {
  deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({rank:r, suit:s});
  for (let i = deck.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [deck[i],deck[j]] = [deck[j],deck[i]];
  }
}

function deal(n) {
  return deck.splice(0, n);
}

// ============================================================
// RENDER CARDS
// ============================================================
function cardHTML(card, delay=0) {
  const isRed = RED_SUITS.has(card.suit);
  return `<div class="card face-up ${isRed?'red':''}" style="animation-delay:${delay}s">
    <div class="corner-top">${card.rank}<br>${card.suit}</div>
    <div class="rank">${card.rank}</div>
    <div class="suit">${card.suit}</div>
    <div class="corner-bot">${card.rank}<br>${card.suit}</div>
  </div>`;
}

function renderPlayerCards() {
  document.getElementById('player-cards').innerHTML =
    playerHand.map((c,i) => cardHTML(c, i*0.1)).join('');
}

function renderCommunity() {
  const ids = ['cc0','cc1','cc2','cc3','cc4'];
  ids.forEach((id,i) => {
    const el = document.getElementById(id);
    if (i < community.length) {
      const c = community[i];
      const isRed = RED_SUITS.has(c.suit);
      el.className = `card face-up ${isRed?'red':''}`;
      el.style.opacity = '1';
      el.style.animationDelay = (i * 0.1) + 's';
      el.innerHTML = `
        <div class="corner-top">${c.rank}<br>${c.suit}</div>
        <div class="rank">${c.rank}</div>
        <div class="suit">${c.suit}</div>
        <div class="corner-bot">${c.rank}<br>${c.suit}</div>`;
    } else {
      el.className = 'card-slot';
      el.innerHTML = '';
      el.style.opacity = '1';
    }
  });
}

// ============================================================
// HAND EVALUATION
// ============================================================
function rankVal(r) { return RANKS.indexOf(r); }

function evalHand(cards) {
  // takes 5-7 cards, returns best 5-card hand id + rank
  if (cards.length < 5) return { id:'high', rank:1, best:cards };
  
  const combos = getCombos(cards, 5);
  let best = null;
  for (const combo of combos) {
    const res = eval5(combo);
    if (!best || res.rank > best.rank) best = {...res, best: combo};
  }
  return best;
}

function getCombos(arr, k) {
  if (k === arr.length) return [arr];
  if (k === 1) return arr.map(x => [x]);
  const res = [];
  for (let i = 0; i <= arr.length - k; i++) {
    for (const c of getCombos(arr.slice(i+1), k-1)) res.push([arr[i], ...c]);
  }
  return res;
}

function eval5(cards) {
  const rv = cards.map(c => rankVal(c.rank)).sort((a,b) => b-a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);
  
  // straight check
  let isStraight = rv[0]-rv[4] === 4 && new Set(rv).size === 5;
  // wheel (A-2-3-4-5)
  const isWheel = rv[0]===12 && rv[1]===3 && rv[2]===2 && rv[3]===1 && rv[4]===0;
  if (isWheel) isStraight = true;
  
  const counts = {};
  rv.forEach(v => counts[v] = (counts[v]||0)+1);
  const freq = Object.values(counts).sort((a,b)=>b-a);
  
  if (isFlush && isStraight) {
    if (rv[0]===12 && rv[1]===11) return {id:'royal', rank:10};
    return {id:'sflush', rank:9};
  }
  if (freq[0]===4) return {id:'quads', rank:8};
  if (freq[0]===3 && freq[1]===2) return {id:'fhouse', rank:7};
  if (isFlush) return {id:'flush', rank:6};
  if (isStraight) return {id:'straight', rank:5};
  if (freq[0]===3) return {id:'three', rank:4};
  if (freq[0]===2 && freq[1]===2) return {id:'twopair', rank:3};
  if (freq[0]===2) return {id:'pair', rank:2};
  return {id:'high', rank:1};
}

// What hands are possible with current visible cards
function getPossibleHands(visible) {
  if (visible.length < 2) return [];
  const possible = new Set();
  // current best
  if (visible.length >= 5) {
    const res = evalHand(visible);
    possible.add(res.id);
  } else if (visible.length >= 2) {
    const res = evalHand(visible);
    possible.add(res.id);
    // could improve
    if (res.rank < 10) possible.add('sflush');
    if (res.rank < 8)  possible.add('quads');
    if (res.rank < 7)  possible.add('fhouse');
    if (visible.length >= 3) {
      const suits = visible.map(c=>c.suit);
      const maxSuit = Math.max(...Object.values(suits.reduce((a,s)=>{a[s]=(a[s]||0)+1;return a},{})));
      if (maxSuit >= 3) { possible.add('flush'); possible.add('sflush'); possible.add('royal'); }
      const rv = visible.map(c=>rankVal(c.rank)).sort((a,b)=>a-b);
      if (rv[rv.length-1]-rv[0] <= 4) possible.add('straight');
    }
  }
  return [...possible];
}

// ============================================================
// HINTS
// ============================================================
function updateHints() {
  const visible = [...playerHand, ...community];
  const current = visible.length >= 5 ? evalHand(visible) : (visible.length >= 2 ? evalHand(visible) : null);
  const currentId = current ? current.id : null;

  const grid = document.getElementById('hint-grid');
  grid.innerHTML = HAND_DEFS.map(h => {
    const isActive = h.id === currentId;
    const isPossible = !isActive && visible.length >= 2 && couldAchieve(h.id, visible);
    let cls = '';
    if (isActive) cls = 'active';
    else if (isPossible) cls = 'possible';
    return `<div class="hint-item ${cls}">
      <div class="badge">${h.emoji}</div>
      <div class="hint-text">
        <div class="hint-name">${h.name}</div>
        <div class="hint-desc">${h.desc}</div>
      </div>
    </div>`;
  }).join('');

  // Best hand banner
  const banner = document.getElementById('best-hand-banner');
  if (current && visible.length >= 2) {
    const hdef = HAND_DEFS.find(h=>h.id===current.id);
    banner.className = 'best-hand-banner has-hand';
    banner.innerHTML = `<span class="hand-emoji">${hdef.emoji}</span> Ваша лучшая рука: <strong>${hdef.name}</strong>`;
  } else if (!roundActive) {
    banner.className = 'best-hand-banner';
    banner.innerHTML = '<span>Раздайте карты чтобы начать</span>';
  }

  // Stage dots
  const stages = ['sd-pre','sd-flop','sd-turn','sd-river'];
  stages.forEach((id,i) => {
    const el = document.getElementById(id);
    el.className = 'stage-dot' + (i < stage ? ' done' : (i === stage ? ' current' : ''));
  });
}

function couldAchieve(hid, visible) {
  const current = evalHand(visible);
  const hrank = HAND_DEFS.find(h=>h.id===hid).rank;
  if (current && hrank <= current.rank) return false; // already have it or better
  
  const missing = 5 - visible.length;
  if (missing <= 0) return false;
  
  // Simple heuristic
  const suits = visible.map(c=>c.suit);
  const suitCounts = suits.reduce((a,s)=>{a[s]=(a[s]||0)+1;return a},{});
  const maxSuit = Math.max(...Object.values(suitCounts));
  const rv = visible.map(c=>rankVal(c.rank));
  const rvSorted = [...rv].sort((a,b)=>a-b);
  const spread = rvSorted[rvSorted.length-1] - rvSorted[0];
  const counts = rv.reduce((a,v)=>{a[v]=(a[v]||0)+1;return a},{});
  const maxCount = Math.max(...Object.values(counts));
  
  if ((hid==='royal'||hid==='sflush') && maxSuit >= 3 && missing >= 2) return true;
  if (hid==='quads' && (maxCount >= 2 || missing >= 3)) return true;
  if (hid==='fhouse' && (maxCount >= 2) && missing >= 1) return true;
  if (hid==='flush' && maxSuit >= 3 && missing >= 2) return true;
  if (hid==='straight' && spread <= 4+missing) return true;
  if (hid==='three' && maxCount >= 2 && missing >= 1) return true;
  if (hid==='twopair' && maxCount >= 2 && missing >= 1) return true;
  if (hid==='pair' && missing >= 1) return true;
  return false;
}

// ============================================================
// GAME FLOW
// ============================================================
const BET_SIZES = {call: 50, raise: 150};

function startRound() {
  buildDeck();
  playerHand = deal(2);
  opponentHand = deal(2);
  community = [];
  stage = 1;
  roundActive = true;
  pot = 30; // blinds
  bet = 50; // call amount

  renderPlayerCards();
  renderCommunity();
  updateChipsDisplay();
  updateHints();

  document.getElementById('btn-deal').style.display = 'none';
  document.getElementById('btn-fold').style.display = '';
  document.getElementById('btn-call').style.display = '';
  document.getElementById('btn-raise').style.display = '';
  document.getElementById('btn-call').textContent = `Колл (50)`;
  document.getElementById('btn-raise').textContent = `Рейз (150)`;
}

function playerFold() {
  const lost = Math.round(pot * 0.3);
  playerChips -= lost;
  // Let opponents react before showing result
  setButtonsLocked(true);
  runOpponentActions(() => {
    showResult(false, 'Вы спасовали', null, -lost,
      'Когда рука слабая — пас правильное решение. Сохраняйте фишки для сильных рук!');
  }, 'fold');
}

function playerCall() {
  playerChips -= BET_SIZES.call;
  pot += BET_SIZES.call * 2;
  setButtonsLocked(true);
  runOpponentActions(() => {
    setButtonsLocked(false);
    advanceStage();
  }, 'call');
}

function playerRaise() {
  playerChips -= BET_SIZES.raise;
  pot += BET_SIZES.raise + Math.round(BET_SIZES.raise * 0.7);
  setButtonsLocked(true);
  runOpponentActions(() => {
    setButtonsLocked(false);
    advanceStage();
  }, 'raise');
}

function setButtonsLocked(locked) {
  const bar = document.querySelector('.action-bar');
  if (locked) bar.classList.add('opponents-acting');
  else bar.classList.remove('opponents-acting');
  const label = document.getElementById('thinking-label');
  label.textContent = locked ? '⏳ Оппоненты думают...' : '';
}

// Bot decision logic
function botDecide(opp, stage, communityCards, playerAction) {
  if (opp.folded) return null;
  const allCards = [...opp.hand, ...communityCards];
  const handStrength = allCards.length >= 5 ? evalHand(allCards).rank : evalHand(allCards).rank;
  const r = Math.random();

  // React somewhat to player's action
  const aggression = playerAction === 'raise' ? 0.15 : 0;

  if (handStrength >= 7) {
    // Very strong hand
    return r < 0.7 ? 'raise' : 'call';
  } else if (handStrength >= 5) {
    // Medium strong
    if (r < 0.1 + aggression) return 'fold';
    return r < 0.5 ? 'raise' : 'call';
  } else if (handStrength >= 3) {
    // Weak-ish
    if (r < 0.25 + aggression) return 'fold';
    return r < 0.45 ? 'raise' : 'call';
  } else {
    // Very weak
    if (r < 0.5 + aggression) return 'fold';
    if (r < 0.75) return 'call';
    return 'check';
  }
}

const BOT_PHRASES = {
  fold:  ['Пас 🏳️', 'Сбрасываю...', 'Не мой день', 'Пас.', 'Слишком рискованно'],
  call:  ['Колл ✓', 'Поддерживаю', 'Колл.', 'Смотрю.', 'Держу ставку'],
  raise: ['Рейз! 🔥', 'Поднимаю!', 'Рейз 💰', 'Ва-банк?', 'Держите!'],
  check: ['Чек ✓', 'Пропускаю.', 'Чек.', 'Смотрим дальше'],
};

// ============================================================
// CHARACTER AMBIENT PHRASES
// ============================================================
const CHARACTER_PHRASES = {
  'Саманта': [
    '«Я хочу — значит, беру.»',
    '«Дорогой, я не играю в скромность.»',
    '«Жизнь слишком коротка для плохого секса.»',
    '«Мне не нужен принц. Мне нужен драйв.»',
    '«Я не ищу одобрения.»',
    '«Если мужчина боится меня — это его проблема.»',
    '«Я люблю себя. И это взаимно.»',
    '«Правила созданы для скучных людей.»',
    '«Я никогда не извиняюсь за удовольствие.»',
    '«Возраст — это просто цифры в паспорте.»',
    '«Я выбираю страсть.»',
    '«Сначала я, потом всё остальное.»',
    '«Я не собственность. Я событие.»',
    '«Комплименты принимаю. Ограничения — нет.»',
    '«Если это не горячо — мне неинтересно.»',
    '«Я не драматизирую. Я живу.»',
    '«Свобода — мой любимый аксессуар.»',
    '«Я не ищу любовь. Я её создаю.»',
    '«Мужчины приходят и уходят. Я остаюсь.»',
    '«Дорогой, расслабься. Это просто ночь.»',
  ],
  'Кэрри': [
    '«Почему любовь так сложна?»',
    '«Я просто хотела написать об этом…»',
    '«Что если это судьба?»',
    '«Мой каблук ближе к ответу.»',
    '«В Нью-Йорке можно заблудиться даже в толпе.»',
    '«Иногда я думаю о нем, даже когда не хочу.»',
    '«Моя ручка знает больше, чем мои друзья.»',
    '«Почему он не отвечает? Это же SMS, не космос.»',
    '«Я не ищу идеального… я ищу правду.»',
    '«Любовь — это длинная прогулка по Манхэттену.»',
    '«Я пью кофе… и думаю о тебе.»',
    '«Иногда нужно просто надеть хорошие туфли.»',
    '«Это не фантазия… это анализ.»',
    '«Я могла бы об этом написать.»',
    '«Что о нас скажет мир — это уже отдельная история.»',
    '«Если бы отношения были шопингом…»',
    '«Манхэттен — мой лучший друг.»',
    '«Я иду туда, где будет интересно.»',
    '«Любовь — это не GPS.»',
    '«Ты можешь путешествовать по миру… но вернуться домой в мысли.»',
  ],
  'Серёжа': [
    '«Это был не просто рейс — это вдохновение.»',
    '«Я улыбаюсь — даже когда не надо.»',
    '«Вы, кстати, уже слышали мой новый трек?»',
    '«Париж — да, это любовь.»',
    '«Жизнь — это не только лайки.»',
    '«Свободный человек свободен всегда.»',
    '«Музыка — это мой дом.»',
    '«Это просто я, без фильтров.»',
    '«Немного кофе и новый куплет.»',
    '«Я путешествую не ради фото — ради чувства.»',
    '«Вы не представляете, как это — быть собой.»',
    '«Я живу так, как хочу.»',
    '«Это не сцена — это мой реальный день.»',
    '«Вдохновляйся, а не сравнивайся.»',
    '«Это мой мужчина, это моя семья.»',
    '«Каждое слово — моя правда.»',
    '«Я не просто артист — я человек.»',
    '«Мой дом — там, где музыка.»',
    '«Сегодня я творю, завтра — ещё больше.»',
    '«Быть собой — моё главное правило.»',
  ],
  'Игорь': [
    '«Где моя сумочка? Реально, кто-то видел её?»',
    '«Париж, ты меня удивляешь…»',
    '«Никогда так не делай макияж перед ограблением.»',
    '«Я из Краматорска, а теперь я в Париже… и без сумок.»',
    '«А вы точно уверены, что это была любовь?»',
    '«Каждый раз, когда я снимаю видео… что-то происходит.»',
    '«Это не просто стиль — это уже мой стиль жизни.»',
    '«Мне надо срочно новый образ… и новый дом.»',
    '«Не переживайте, это всего лишь Instagram… но больно всё равно.»',
    '«Если бы моя музыка могла говорить…»',
    '«Ну где мой ювелирный набор? Он же здесь был!»',
    '«Я люблю Париж, но не грабителей.»',
    '«Это был не просто ограбление, это был сценарий клипа.»',
    '«Каждое утро я просыпаюсь и думаю: что сегодня?»',
    '«Как всегда, всё сложнее, чем кажется.»',
    '«Вы хотели эпатаж? Я вам его и даю.»',
    '«Я мог бы снять об этом фильм… реально мог.»',
    '«Я улыбаюсь — значит, ещё не всё потеряно.»',
    '«Никогда не говори «это невозможно»… особенно мне.»',
    '«Моя жизнь — это сериал без пауз.»',
  ],
};

let ambientTimers = [];

// Global flag: timestamp when last ambient phrase was shown
let lastAmbientSpoke = 0;
const AMBIENT_GLOBAL_COOLDOWN = 7000; // min ms between ANY two characters speaking

function startAmbientPhrases() {
  stopAmbientPhrases();
  lastAmbientSpoke = 0;

  // Build a single queue of all characters with phrases, interleaved
  const speakers = activeOpponents
    .map((opp, i) => ({ opp, i }))
    .filter(({ opp }) => CHARACTER_PHRASES[opp.name]);

  if (!speakers.length) return;

  // Each speaker gets their own cursor and shuffled list
  speakers.forEach(({ opp, i }, si) => {
    const phrases = [...CHARACTER_PHRASES[opp.name]].sort(() => Math.random() - 0.5);
    let cursor = 0;

    function scheduleNext() {
      // Base interval: 14–24s per character, staggered by position
      const baseDelay = 14000 + Math.random() * 10000;
      const t = setTimeout(() => {
        if (!roundActive || opp.folded) { scheduleNext(); return; }

        // Check global cooldown — if someone just spoke, wait more
        const now = Date.now();
        const sinceLastSpoke = now - lastAmbientSpoke;
        if (sinceLastSpoke < AMBIENT_GLOBAL_COOLDOWN) {
          // Retry after the remaining cooldown + small buffer
          const retry = AMBIENT_GLOBAL_COOLDOWN - sinceLastSpoke + 500 + Math.random() * 2000;
          const tr = setTimeout(() => {
            if (!roundActive || opp.folded) { scheduleNext(); return; }
            const phrase = phrases[cursor % phrases.length];
            cursor++;
            lastAmbientSpoke = Date.now();
            showAmbientBubble(i, phrase);
            scheduleNext();
          }, retry);
          ambientTimers.push(tr);
          return;
        }

        const phrase = phrases[cursor % phrases.length];
        cursor++;
        lastAmbientSpoke = Date.now();
        showAmbientBubble(i, phrase);
        scheduleNext();
      }, baseDelay);
      ambientTimers.push(t);
    }

    // Stagger first phrases: each speaker waits (si * 8s) + random offset
    const firstDelay = 6000 + si * 8000 + Math.random() * 4000;
    const t0 = setTimeout(() => {
      if (!roundActive || opp.folded) { scheduleNext(); return; }
      const phrase = phrases[cursor % phrases.length];
      cursor++;
      lastAmbientSpoke = Date.now();
      showAmbientBubble(i, phrase);
      scheduleNext();
    }, firstDelay);
    ambientTimers.push(t0);
  });
}

function stopAmbientPhrases() {
  ambientTimers.forEach(t => clearTimeout(t));
  ambientTimers = [];
}

function showAmbientBubble(i, text) {
  const b = document.getElementById('bubble-' + i);
  if (!b) return;
  // Don't override an active action bubble
  if (b.classList.contains('show')) return;
  b.textContent = text;
  b.className = 'speech-bubble action-ambient show';
  clearTimeout(b._timer);
  b._timer = setTimeout(() => { b.classList.remove('show'); }, 5000);
}

function randomPhrase(action) {
  const list = BOT_PHRASES[action] || ['...'];
  return list[Math.floor(Math.random() * list.length)];
}

function runOpponentActions(onDone, playerAction) {
  const active = activeOpponents.filter(o => !o.folded);
  if (!active.length) { onDone(); return; }

  let i = 0;
  function next() {
    if (i >= active.length) {
      updateSeatChips();
      setTimeout(() => { onDone(); }, 300);
      return;
    }
    const opp = active[i];
    const idx = activeOpponents.indexOf(opp);
    const decision = botDecide(opp, stage, community, playerAction);
    if (!decision) { i++; next(); return; }

    // Brief thinking delay per opponent
    setTimeout(() => {
      const actionClass = 'action-' + decision;
      const phrase = randomPhrase(decision);
      showBubble(idx, phrase, actionClass, 2000);

      if (decision === 'fold') {
        opp.folded = true;
        const seat = document.getElementById('seat-' + idx);
        if (seat) seat.classList.add('folded');
      } else if (decision === 'raise') {
        const raiseAmt = Math.round(BET_SIZES.call * (0.8 + Math.random()));
        opp.chips = Math.max(0, opp.chips - raiseAmt);
        pot += raiseAmt;
      } else if (decision === 'call') {
        const callAmt = Math.round(BET_SIZES.call * (0.6 + Math.random() * 0.4));
        opp.chips = Math.max(0, opp.chips - callAmt);
        pot += callAmt;
      }
      updateChipsDisplay();
      i++;
      setTimeout(next, 700 + Math.random() * 400);
    }, 500 + i * 300 + Math.random() * 300);
  }
  next();
}

function advanceStage() {
  if (stage === 1) {
    // Deal flop
    community = deal(3);
    stage = 2;
    renderCommunity();
    updateChipsDisplay();
    updateHints();
    document.getElementById('btn-call').textContent = `Чек/Колл (${Math.round(pot*0.3)})`;
    document.getElementById('btn-raise').textContent = `Бет/Рейз (${Math.round(pot*0.6)})`;
    BET_SIZES.call = Math.round(pot*0.3);
    BET_SIZES.raise = Math.round(pot*0.6);
  } else if (stage === 2) {
    // Deal turn
    community.push(deal(1)[0]);
    stage = 3;
    renderCommunity();
    updateChipsDisplay();
    updateHints();
    BET_SIZES.call = Math.round(pot*0.4);
    BET_SIZES.raise = Math.round(pot*0.8);
    document.getElementById('btn-call').textContent = `Колл (${BET_SIZES.call})`;
    document.getElementById('btn-raise').textContent = `Рейз (${BET_SIZES.raise})`;
  } else if (stage === 3) {
    // Deal river
    community.push(deal(1)[0]);
    stage = 4;
    renderCommunity();
    updateChipsDisplay();
    updateHints();
    BET_SIZES.call = Math.round(pot*0.5);
    BET_SIZES.raise = Math.round(pot);
    document.getElementById('btn-call').textContent = `Колл (${BET_SIZES.call})`;
    document.getElementById('btn-raise').textContent = `Рейз (${BET_SIZES.raise})`;
  } else if (stage === 4) {
    // Showdown
    showdown();
  }
}

function showdown() {
  // Overridden by window.showdown below — this stub is never called directly
}

function showResult(win, title, hand, chips, desc) {
  roundActive = false;
  stopAmbientPhrases();
  updateChipsDisplay();

  document.getElementById('result-emoji').textContent = win===true?'🎉':win===false?'💸':'🤝';
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-hand').textContent = hand || '';
  const chipEl = document.getElementById('result-chips');
  if (chips > 0) { chipEl.textContent = `+${chips} фишек`; chipEl.className = 'result-chips'; }
  else if (chips < 0) { chipEl.textContent = `${chips} фишек`; chipEl.className = 'result-chips negative'; }
  else { chipEl.textContent = 'Банк пополам'; chipEl.className = 'result-chips'; }
  document.getElementById('result-desc').textContent = desc;
  document.getElementById('result-overlay').classList.add('show');
}

function closeResult() {
  document.getElementById('result-overlay').classList.remove('show');
  document.getElementById('btn-deal').style.display = '';
  document.getElementById('btn-fold').style.display = 'none';
  document.getElementById('btn-call').style.display = 'none';
  document.getElementById('btn-raise').style.display = 'none';

  // Reset community slots
  const ids = ['cc0','cc1','cc2','cc3','cc4'];
  ids.forEach((id,i) => {
    const el = document.getElementById(id);
    el.className = 'card face-down';
    el.innerHTML = '';
    el.style.opacity = i < 3 ? '0.3' : '0.15';
  });
  document.getElementById('player-cards').innerHTML = '';
  // Reset community slots
  ['cc0','cc1','cc2','cc3','cc4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.className = 'card-slot'; el.innerHTML = ''; el.style.opacity = '1'; }
  });
  if (activeOpponents.length) renderOpponentCards();

  const banner = document.getElementById('best-hand-banner');
  banner.className = 'best-hand-banner';
  banner.innerHTML = '<span>Раздайте карты чтобы начать</span>';
  document.getElementById('hint-grid').innerHTML = HAND_DEFS.map(h =>
    `<div class="hint-item"><div class="badge">${h.emoji}</div><div class="hint-text"><div class="hint-name">${h.name}</div><div class="hint-desc">${h.desc}</div></div></div>`
  ).join('');

  const stages = ['sd-pre','sd-flop','sd-turn','sd-river'];
  stages.forEach(id => document.getElementById(id).className = 'stage-dot');
  stage = 0;
  updateChipsDisplay();
}

function updateChipsDisplay() {
  document.getElementById('player-chips').textContent = playerChips;
  document.getElementById('chips-display').textContent = playerChips;
  document.getElementById('pot-value').textContent = pot;
}

// ============================================================
// INIT REFERENCE TABLE
// ============================================================
function initReference() {
  document.getElementById('hands-table').innerHTML = HAND_DEFS.map(h =>
    `<div class="hand-row">
      <span class="rank-num">#${h.rank}</span>
      <span style="font-size:1.1rem">${h.emoji}</span>
      <div><div class="hand-nm">${h.name}</div><div class="hand-ex">${h.desc}</div></div>
    </div>`
  ).join('');

  document.getElementById('hint-grid').innerHTML = HAND_DEFS.map(h =>
    `<div class="hint-item"><div class="badge">${h.emoji}</div><div class="hint-text"><div class="hint-name">${h.name}</div><div class="hint-desc">${h.desc}</div></div></div>`
  ).join('');
}

initReference();
updateChipsDisplay();

// ============================================================
// DEALER ANIMATION
// ============================================================
function showDealer(onDone) {
  const wrap = document.getElementById('dealer-wrap');
  wrap.classList.remove('slide-out');
  wrap.classList.add('slide-in');
  // Slide in completes ~after 1.1s, then start dealing
  setTimeout(() => {
    if (onDone) onDone();
  }, 1000);
}

function hideDealer() {
  const wrap = document.getElementById('dealer-wrap');
  wrap.classList.remove('slide-in');
  wrap.classList.add('slide-out');
}

function flyCard(fromEl, toEl, delay, cb, landClass) {
  if (!fromEl || !toEl) { if (cb) cb(); return; }
  const from = fromEl.getBoundingClientRect();
  const to   = toEl.getBoundingClientRect();
  const card = document.createElement('div');
  card.className = 'deal-fly-card';
  card.style.left = (from.left + from.width/2 - 22) + 'px';
  card.style.top  = (from.top  + from.height/2 - 32) + 'px';
  document.body.appendChild(card);

  setTimeout(() => {
    card.style.transition = 'none';
    card.style.opacity = '1';
    card.style.transform = 'rotate(-25deg) scale(1.05)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.transition = 'left 0.42s cubic-bezier(0.25,0.46,0.45,0.94), top 0.38s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.42s ease, opacity 0.1s';
        card.style.left = (to.left + to.width/2 - 22) + 'px';
        card.style.top  = (to.top  + to.height/2 - 32) + 'px';
        card.style.transform = 'rotate(0deg) scale(1)';
      });
    });
    setTimeout(() => {
      card.remove();
      // Pop a real face-down card into the slot (keep same element to preserve ID)
      if (toEl.classList.contains('card-slot')) {
        toEl.className = 'card face-down';
        toEl.style.animation = 'cardPop 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards';
      }
      if (cb) cb();
    }, 440);
  }, delay);
}

// Override startRound to include dealer animation
// startRound: see window.startRound override in opponents section

// Override advanceStage to animate community cards
const _origAdvance = advanceStage;
window.advanceStage = function() {
  const prevStage = stage;
  // Run original logic to update state
  _origAdvance();
  // If community grew, animate the new cards
  const newCount = community.length;
  if (newCount > 0) {
    const dealerImg = document.getElementById('dealer-img');
    showDealer(() => {
      const startIdx = prevStage === 1 ? 0 : prevStage === 2 ? 3 : 4;
      let i = startIdx;
      function flyNext() {
        if (i >= community.length) {
          // All community cards dealt — hide dealer
          hideDealer();
          return;
        }
        const target = document.getElementById('cc' + i);
        flyCard(dealerImg, target, 0, () => {
          i++;
          setTimeout(flyNext, 80);
        });
      }
      flyNext();
    });
  }
};

function restartGame() {
  playerChips = 1000;
  pot = 0;
  stage = 0;
  roundActive = false;
  closeResult();
  document.getElementById('btn-restart').style.display = 'none';
  document.getElementById('result-overlay').classList.remove('show');
  updateChipsDisplay();
}


// ============================================================
// OPPONENTS DATA
// ============================================================
const OPPONENTS = [
  { name: "Кэрри", avatar: "images/avatar1.png" },
  { name: "Саманта", avatar: "images/avatar2.png" },
  { name: "Шарлотта", avatar: "images/avatar3.png" },
  { name: "Стэнфорд", avatar: "images/avatar4.png" },
  { name: "Миранда", avatar: "images/avatar5.png" },
  { name: "Серёжа", avatar: "images/avatar6.png" },
  { name: "Игорь", avatar: "images/avatar7.png" }
];

let selectedCount = 0;
let selectedOpponents = []; // indices into OPPONENTS[]
let activeOpponents = [];   // {name, avatar, chips, hand, folded}

function selectCount(n) {
  selectedCount = n;
  document.querySelectorAll('.count-btn').forEach((b,i) => b.classList.toggle('selected', i+1===n));
  const btn = document.getElementById('lobby-start-btn');
  btn.style.opacity = n > 0 ? '1' : '0.4';
  btn.style.pointerEvents = n > 0 ? 'auto' : 'none';
}

function launchGame() {
  if (!selectedCount || activeOpponents.length > 0) return; // prevent double-trigger
  // Randomly shuffle indices and pick selectedCount
  const indices = [...Array(OPPONENTS.length).keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  selectedOpponents = indices.slice(0, selectedCount);
  activeOpponents = selectedOpponents.map(i => ({
    ...OPPONENTS[i],
    chips: 1000,
    hand: [],
    folded: false
  }));
  document.getElementById('lobby-overlay').classList.add('hidden');
  renderSeats();
}

function renderSeats() {
  const row = document.getElementById('seats-row');
  row.innerHTML = activeOpponents.map((o, i) => `
    <div class="seat" id="seat-${i}" style="position:relative">
      <div class="speech-bubble" id="bubble-${i}"></div>
      <img class="seat-avatar" src="${o.avatar}" alt="${o.name}">
      <div class="seat-name">${o.name}</div>
      <div class="seat-chips-badge" id="seat-chips-${i}">● ${o.chips}</div>
    </div>`).join('');
  renderOpponentCards();
}

function showBubble(i, text, actionClass, duration = 2200) {
  const b = document.getElementById('bubble-' + i);
  if (!b) return;
  b.textContent = text;
  b.className = 'speech-bubble ' + actionClass + ' show';
  clearTimeout(b._timer);
  b._timer = setTimeout(() => { b.classList.remove('show'); }, duration);
}

function renderOpponentCards() {
  const wrap = document.getElementById('opponents-cards-wrap');
  wrap.innerHTML = activeOpponents.map((o, i) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="font-size:0.65rem;color:rgba(245,240,232,0.35);letter-spacing:1px">${o.name.toUpperCase()}</div>
      <div class="cards-row" id="opp-cards-${i}">
        <div class="card-slot" id="opp-slot-${i}-0"></div>
        <div class="card-slot" id="opp-slot-${i}-1"></div>
      </div>
    </div>`).join('');
}

function updateSeatChips() {
  activeOpponents.forEach((o, i) => {
    const el = document.getElementById(`seat-chips-${i}`);
    if (el) el.textContent = `● ${o.chips}`;
    const seat = document.getElementById(`seat-${i}`);
    if (seat) seat.className = 'seat' + (o.folded ? ' folded' : '');
  });
}

// Patch restartGame to show lobby
const _origRestart = restartGame;
window.restartGame = function() {
  playerChips = 1000;
  pot = 0; stage = 0; roundActive = false;
  selectedOpponents = []; selectedCount = 0;
  activeOpponents = [];
  selectedCount = 0;
  document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('selected'));
  const btn = document.getElementById('lobby-start-btn');
  btn.style.opacity = '0.4';
  btn.style.pointerEvents = 'none';
  document.getElementById('lobby-overlay').classList.remove('hidden');
  closeResult();
  document.getElementById('btn-restart').style.display = 'none';
  updateChipsDisplay();
};

// Patch showDealer / startRound to use activeOpponents
const _origDealerStart = window.startRound;
window.startRound = function() {
  if (!activeOpponents.length) return;

  buildDeck();
  playerHand = deal(2);
  // Deal to each opponent
  activeOpponents.forEach((o, i) => {
    o.hand = deal(2);
    o.folded = false;
  });
  community = [];
  stage = 1; roundActive = true;
  pot = 30 + activeOpponents.length * 15;
  bet = 50;

  updateChipsDisplay();
  renderSeats();
  updateSeatChips();

  document.getElementById('btn-deal').style.display = 'none';
  document.getElementById('btn-restart').style.display = '';
  document.getElementById('btn-fold').style.display = 'none';
  document.getElementById('btn-call').style.display = 'none';
  document.getElementById('btn-raise').style.display = 'none';

  showDealer(() => {
    const pZone = document.getElementById('player-cards');
    // Fly cards to player then to each opponent
    // Build per-slot targets: p0, o0-0, p1, o1-0, p0-... round-robin style
    let seq = [];
    const pSlots = [
      { container: pZone, slotId: 'player-slot-0' },
      { container: pZone, slotId: 'player-slot-1' },
    ];
    // Create player slots
    pZone.innerHTML = '<div class="card-slot" id="player-slot-0"></div><div class="card-slot" id="player-slot-1"></div>';
    // Build deal order: p, opp0, opp1, ... p, opp0, opp1 (2 rounds)
    const oppSlots = activeOpponents.map((o, i) => [
      document.getElementById(`opp-slot-${i}-0`),
      document.getElementById(`opp-slot-${i}-1`),
    ]);
    // Round 1
    seq.push(document.getElementById('player-slot-0'));
    activeOpponents.forEach((o, i) => seq.push(oppSlots[i][0]));
    // Round 2
    seq.push(document.getElementById('player-slot-1'));
    activeOpponents.forEach((o, i) => seq.push(oppSlots[i][1]));
    const dealerImg = document.getElementById('dealer-img');
    let idx = 0;
    function next() {
      if (idx >= seq.length) {
        renderPlayerCards();
        renderCommunity();
        updateHints();
        // All cards dealt, player now sees their hand — hide dealer
        hideDealer();
        // Start ambient character chatter
        startAmbientPhrases();
        document.getElementById('btn-fold').style.display = '';
        document.getElementById('btn-call').style.display = '';
        document.getElementById('btn-raise').style.display = '';
        document.getElementById('btn-call').textContent = 'Колл (50)';
        document.getElementById('btn-raise').textContent = 'Рейз (150)';
        return;
      }
      flyCard(dealerImg, seq[idx], 0, () => { idx++; setTimeout(next, 60); });
    }
    next();
  });
};

// Patch showdown to handle multiple opponents
const _origShowdown = showdown;
window.showdown = function() {
  // Reveal opponent cards
  activeOpponents.forEach((o, i) => {
    const wrap = document.getElementById(`opp-cards-${i}`);
    if (wrap) wrap.innerHTML = o.hand.map((c, ci) => cardHTML(c, ci*0.12)).join('');
    const seat = document.getElementById(`seat-${i}`);
    if (seat) seat.className = 'seat';
  });

  const playerBest = evalHand([...playerHand, ...community]);
  const oppResults = activeOpponents.map(o => ({
    ...o,
    best: evalHand([...o.hand, ...community])
  }));

  const pDef = HAND_DEFS.find(h => h.id === playerBest.id);
  const bestOppRank = Math.max(...oppResults.map(o => o.best.rank));
  const winnerOpp = oppResults.find(o => o.best.rank === bestOppRank);
  const wDef = HAND_DEFS.find(h => h.id === winnerOpp.best.id);

  setTimeout(() => {
    if (playerBest.rank > bestOppRank) {
      const win = Math.round(pot * 0.7);
      playerChips += win;
      // mark all opponents as losers
      showResult(true, '🏆 Вы победили!',
        `Ваша рука: ${pDef.emoji} ${pDef.name}`,
        win, `Вы побили всех за столом! ${pDef.name} — лучшая комбинация!`);
    } else if (playerBest.rank < bestOppRank) {
      const lost = Math.round(pot * 0.4);
      playerChips -= lost;
      // mark winning seat
      const wi = activeOpponents.indexOf(winnerOpp);
      const seat = document.getElementById(`seat-${wi}`);
      if (seat) seat.className = 'seat winner';
      showResult(false, `😔 Победил ${winnerOpp.name}`,
        `${winnerOpp.name}: ${wDef.emoji} ${wDef.name} vs Ваша: ${pDef.emoji} ${pDef.name}`,
        -lost, `${wDef.name} сильнее ${pDef.name}. Попробуйте снова!`);
    } else {
      showResult(null, '🤝 Ничья!',
        `Обе руки: ${pDef.emoji} ${pDef.name}`,
        0, 'Одинаковые комбинации — банк делится.');
    }
  }, 800);
};

// closeResult: re-render seats
const _origCloseResult = closeResult;
window.closeResult = function() {
  _origCloseResult();
  if (activeOpponents.length) renderSeats();
};

