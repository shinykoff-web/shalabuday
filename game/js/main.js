import { Game } from './game.js';

const menu = document.getElementById('menu');
const settingsMenu = document.getElementById('settings');
const playBtn = document.getElementById('playBtn');
const settingsBtn = document.getElementById('settingsBtn');
const backBtn = document.getElementById('backBtn');
const playersScreen = document.getElementById('players');
const testModeCheckbox = document.getElementById('testMode');

let testMode = false;

// Показ/скрытие экранов
playBtn.onclick = () => {
  menu.classList.add('hidden');
  playersScreen.classList.remove('hidden');
};

settingsBtn.onclick = () => {
  menu.classList.add('hidden');
  settingsMenu.classList.remove('hidden');
};

backBtn.onclick = () => {
  settingsMenu.classList.add('hidden');
  menu.classList.remove('hidden');
};

testModeCheckbox.onchange = () => {
  testMode = testModeCheckbox.checked;
};

// Выбор количества игроков
playersScreen.querySelectorAll('button').forEach(btn => {
  btn.onclick = () => {
    const playerCount = parseInt(btn.dataset.count);
    playersScreen.classList.add('hidden');

    const canvas = document.getElementById('game');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const game = new Game(canvas, playerCount, testMode);
  };
});
