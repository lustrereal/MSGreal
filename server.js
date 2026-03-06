const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let players = {};
let bullets = [];

io.on('connection', (socket) => {
  console.log('A player connected:', socket.id);

  // New player joins
  socket.on('join', (data) => {
    players[socket.id] = {
      id: socket.id,
      name: data.name,
      color: parseInt(data.color.replace('#', ''), 16) || 0x00ff00,
      x: Math.random() * 780 + 10,
      y: Math.random() * 580 + 10,
      rotation: 0,
      health: 100
    };
    socket.emit('youJoined', players[socket.id]);
    io.emit('updatePlayers', players);
  });

  // Player movement
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = Math.max(10, Math.min(790, data.x));
      players[socket.id].y = Math.max(10, Math.min(590, data.y));
      players[socket.id].rotation = data.rotation;
      io.emit('updatePlayers', players);
    }
  });

  // Shooting
  socket.on('shoot', (bullet) => {
    bullet.owner = socket.id;
    bullets.push(bullet);
    io.emit('newBullet', bullet);
  });

  // Chat message
  socket.on('chat', (msg) => {
    io.emit('chat', { name: players[socket.id]?.name || 'Anonymous', msg });
  });

  // Disconnect
  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('updatePlayers', players);
    console.log('Player disconnected:', socket.id);
  });
});

// Global bullet update and collision (moved outside connection)
setInterval(() => {
  let newBullets = [];
  for (let bullet of bullets) {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    let hit = false;
    for (let playerId in players) {
      let player = players[playerId];
      if (player.id !== bullet.owner && Math.hypot(bullet.x - player.x, bullet.y - player.y) < 20) {
        player.health -= 10;
        if (player.health <= 0) {
          io.emit('playerDied', player.id);
          delete players[playerId];
        }
        hit = true;
        break;
      }
    }
