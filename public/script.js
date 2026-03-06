const socket = io();

let config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  parent: 'game-container'
};

let game;
let player;
let otherPlayers = {};
let bullets = {};
let keys;
let ownData;
let name = '';
let lastShot = 0;

// Home screen
document.getElementById('join-button').addEventListener('click', () => {
  name = document.getElementById('player-name').value || 'Player';
  let color = document.getElementById('player-color').value;
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'block';
  game = new Phaser.Game(config);
  socket.emit('join', { name, color });
});

// Chat
document.getElementById('send-chat').addEventListener('click', () => {
  let msg = document.getElementById('chat-input').value;
  if (msg) {
    socket.emit('chat', msg);
    document.getElementById('chat-input').value = '';
  }
});

document.getElementById('chat-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('send-chat').click();
  }
});

socket.on('chat', (data) => {
  let chat = document.getElementById('chat-messages');
  chat.innerHTML += `<p><strong>${data.name}:</strong> ${data.msg}</p>`;
  chat.scrollTop = chat.scrollHeight;
});

function preload() {
  // No assets
}

function create() {
  keys = this.input.keyboard.addKeys({
    up: 'W', down: 'S', left: 'A', right: 'D'
  });
  player = this.add.rectangle(400, 300, 20, 20, 0x888888).setOrigin(0.5);
}

function update(time) {
  let pointer = this.input.activePointer;
  let velocityX = 0, velocityY = 0;
  if (keys.up.isDown) velocityY -= 4;
  if (keys.down.isDown) velocityY += 4;
  if (keys.left.isDown) velocityX -= 4;
  if (keys.right.isDown) velocityX += 4;

  player.x = Math.max(10, Math.min(790, player.x + velocityX));
  player.y = Math.max(10, Math.min(590, player.y + velocityY));

  // Rotate to mouse
  player.rotation = Phaser.Math.Angle.Between(player.x, player.y, pointer.worldX, pointer.worldY);
  socket.emit('move', { x: player.x, y: player.y, rotation: player.rotation });

  // Shoot on left click
  if (pointer.leftButtonDown() && time > lastShot + 200) {
    let angle = player.rotation;
    let bulletId = Math.random().toString(36).substr(2, 9);
    let bullet = {
      id: bulletId,
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * 10,
      vy: Math.sin(angle) * 10
    };
    socket.emit('shoot', bullet);
    lastShot = time;
  }
}

// You joined
socket.on('youJoined', (data) => {
  ownData = data;
  player.setFillStyle(data.color);
  player.x = data.x;
  player.y = data.y;
});

// Update other players (skip self)
socket.on('updatePlayers', (playersData) => {
  for (let id in otherPlayers) {
    if (!playersData[id]) {
      otherPlayers[id].destroy();
      delete otherPlayers[id];
    }
  }
  for (let id in playersData) {
    if (id === socket.id) continue;
    let p = playersData[id];
    if (!otherPlayers[id]) {
      otherPlayers[id] = game.scene.scenes[0].add.rectangle(p.x, p.y, 20, 20, p.color).setOrigin(0.5);
    } else {
      otherPlayers[id].x = p.x;
      otherPlayers[id].y = p.y;
      otherPlayers[id].rotation = p.rotation;
    }
  }
});

// Bullets
socket.on('newBullet', (bullet) => {
  let scene = game.scene.scenes[0];
  bullets[bullet.id] = scene.add.line(bullet.x, bullet.y, bullet.x + bullet.vx * 1.5, bullet.y + bullet.vy * 1.5, 0xffffff).setOrigin(0);
  bullets[bullet.id].setLineWidth(3);
});

socket.on('updateBullets', (newBullets) => {
  // Remove missing
  for (let id in bullets) {
    if (!newBullets.find(b => b.id === id)) {
      bullets[id].destroy();
      delete bullets[id];
    }
  }
  // Update/add
  for (let b of newBullets) {
    let scene = game.scene.scenes[0];
    if (!bullets[b.id]) {
      bullets[b.id] = scene.add.line(b.x, b.y, b.x + b.vx * 1.5, b.y + b.vy * 1.5, 0xffffff).setOrigin(0);
      bullets[b.id].setLineWidth(3);
    } else {
      bullets[b.id].setTo(b.x, b.y, b.x + b.vx * 1.5, b.y + b.vy * 1.5);
    }
  }
});

// Player died
socket.on('playerDied', (id) => {
  if (otherPlayers[id]) {
    otherPlayers[id].destroy();
    delete otherPlayers[id];
  }
  if (id === socket.id) {
    // Reset to home screen
    if (game) {
      game.destroy(true);
      game = null;
    }
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('home-screen').style.display = 'block';
    document.getElementById('player-name').value = '';
    document.getElementById('player-color').value = '#00ff00';
    document.getElementById('chat-messages').innerHTML = '';
    player = null;
    otherPlayers = {};
    bullets = {};
    lastShot = 0;
    ownData = null;
  }
});
