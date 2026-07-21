// Game Elements
const gameArea = document.getElementById('game-area');
const basket = document.getElementById('basket');
const scoreDisplay = document.getElementById('score');
const timeDisplay = document.getElementById('time');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreDisplay = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Emojis Setup
const goodEmojis = ['🍎', '🍕', '⭐', '🎈', '🍩', '💎', '🍔'];
const bombEmoji = '💣';

// Game Configuration
const GAME_DURATION = 30; // seconds
let score = 0;
let timeRemaining = GAME_DURATION;
let gameInterval = null;
let timerInterval = null;
let basketX = 50; // percentage position
let activeEmojis = [];

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
document.addEventListener('keydown', handleKeyDown);

// Touch & Mouse Control for Basket
let isDragging = false;
gameArea.addEventListener('pointerdown', (e) => {
  isDragging = true;
  moveBasketToPointer(e);
});
gameArea.addEventListener('pointermove', (e) => {
  if (isDragging) moveBasketToPointer(e);
});
gameArea.addEventListener('pointerup', () => (isDragging = false));

function moveBasketToPointer(e) {
  const rect = gameArea.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let percentage = (x / rect.width) * 100;
  basketX = Math.max(5, Math.min(95, percentage));
  basket.style.left = `${basketX}%`;
}

function handleKeyDown(e) {
  const step = 5;
  if (e.key === 'ArrowLeft') {
    basketX = Math.max(5, basketX - step);
  } else if (e.key === 'ArrowRight') {
    basketX = Math.min(95, basketX + step);
  }
  basket.style.left = `${basketX}%`;
}

function startGame() {
  // Reset Variables
  score = 0;
  timeRemaining = GAME_DURATION;
  scoreDisplay.textContent = score;
  timeDisplay.textContent = timeRemaining;

  // Clear Existing Emojis
  activeEmojis.forEach((item) => item.element.remove());
  activeEmojis = [];

  // Hide Overlays
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');

  // Start Loops
  gameInterval = setInterval(spawnEmoji, 700);
  timerInterval = setInterval(updateTimer, 1000);

  requestAnimationFrame(gameLoop);
}

function spawnEmoji() {
  const isBomb = Math.random() < 0.25; // 25% chance of spawning a bomb
  const symbol = isBomb
    ? bombEmoji
    : goodEmojis[Math.floor(Math.random() * goodEmojis.length)];

  const emojiElem = document.createElement('div');
  emojiElem.classList.add('emoji-item');
  emojiElem.textContent = symbol;

  const startX = Math.random() * 85 + 5; // percentage
  emojiElem.style.left = `${startX}%`;
  emojiElem.style.top = '0px';

  gameArea.appendChild(emojiElem);

  activeEmojis.push({
    element: emojiElem,
    x: startX,
    y: 0,
    speed: Math.random() * 2 + 3, // Fall speed
    isBomb: isBomb,
  });
}

function gameLoop() {
  if (timeRemaining <= 0) return;

  const areaRect = gameArea.getBoundingClientRect();
  const basketRect = basket.getBoundingClientRect();

  for (let i = activeEmojis.length - 1; i >= 0; i--) {
    const item = activeEmojis[i];
    item.y += item.speed;
    item.element.style.top = `${item.y}px`;

    const itemRect = item.element.getBoundingClientRect();

    // Check collision with basket
    if (
      itemRect.bottom >= basketRect.top &&
      itemRect.top <= basketRect.bottom &&
      itemRect.right >= basketRect.left &&
      itemRect.left <= basketRect.right
    ) {
      if (item.isBomb) {
        score = Math.max(0, score - 5);
      } else {
        score += 10;
      }
      scoreDisplay.textContent = score;

      item.element.remove();
      activeEmojis.splice(i, 1);
      continue;
    }

    // Remove if hit bottom
    if (item.y > areaRect.height) {
      item.element.remove();
      activeEmojis.splice(i, 1);
    }
  }

  requestAnimationFrame(gameLoop);
}

function updateTimer() {
  timeRemaining--;
  timeDisplay.textContent = timeRemaining;

  if (timeRemaining <= 0) {
    endGame();
  }
}

function endGame() {
  clearInterval(gameInterval);
  clearInterval(timerInterval);

  finalScoreDisplay.textContent = score;
  gameOverScreen.classList.remove('hidden');
}