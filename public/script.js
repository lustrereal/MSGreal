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
let name = '';
let lastShot = 0;

// Home screen
document.getElementById('join-button').addEventListener('click', () => {
  name = document.getElementById('player-name').value || 'Player';
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'block';
  game = new Phaser.Game(config);
  socket.emit('join', name);
});

// Chat
document.getElementById('send-chat').addEventListener('click', () => {
  let msg = document.getElementById('chat-input').value;
  if (msg) {
    socket.emit('chat', msg);
    document.getElementById('chat-input').value = '';
  }
});

socket.on('chat', (data) => {
  let chat = document.getElementById('chat-messages');
  chat.innerHTML += `<p><strong>${data.name}:</strong> ${data.msg}</p>`;
  chat.scrollTop = chat.scrollHeight;
});

function preload() {
  // No assets needed for simple shapes
}

function create() {
  keys = this.input.keyboard.addKeys({
    up: 'W', down: 'S', left: 'A', right: 'D', space: 'SPACE'
  });
}

function update(time) {
  if (!player) {
    player = this.add.rectangle(0, 0, 20, 20, 0x00ff00);
    player.setOrigin(0.5);
  }

  // Movement
  let velocityX = 0, velocityY = 0;
  if (keys.up.isDown) velocityY = -3;
  if (keys.down.isDown) velocityY = 3;
  if (keys.left.isDown) velocityX = -3;
  if (keys.right.isDown) velocityX = 3;

  player.x += velocityX;
  player.y += velocityY;

  // Rotation towards mouse (simple top-view aim)
  let pointer = this.input.activePointer;
  player.rotation = Phaser.Math.Angle.Between(player.x, player.y, pointer.x, pointer.y);

  socket.emit('move', { x: player.x, y: player.y, rotation: player.rotation });

  // Shooting
  if (keys.space.isDown && time > lastShot + 200) {
    let bullet = {
      id: Math.random().toString(36).substr(2, 9),
      owner: socket.id,
      x: player.x,
      y: player.y,
      vx: Math.cos(player.rotation) * 10,
      vy: Math.sin(player.rotation) * 10
    };
    socket.emit('shoot', bullet);
    lastShot = time;
  }
}

// Update other players
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
      otherPlayers[id] = game.scene.scenes[0].add.rectangle(p.x, p.y, 20, 20, 0xff0000);
      otherPlayers[id].setOrigin(0.5);
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
  bullets[bullet.id] = scene.add.line(0, 0, bullet.x, bullet.y, bullet.x + bullet.vx, bullet.y + bullet.vy, 0xffffff).setOrigin(0);
});

socket.on('updateBullets', (newBullets) => {
  for (let b of newBullets) {
    if (bullets[b.id]) {
      bullets[b.id].setTo(b.x, b.y, b.x + b.vx, b.y + b.vy);
    }
  }
});

socket.on('playerDied', (id) => {
  if (otherPlayers[id]) {
    otherPlayers[id].destroy();
    delete otherPlayers[id];
  }
});
