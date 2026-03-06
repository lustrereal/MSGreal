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
  socket.on('join', (playerName) => {
    players[socket.id] = {
      id: socket.id,
      name: playerName,
      x: Math.random() * 800,
      y: Math.random() * 600,
      rotation: 0,
      health: 100
    };
    io.emit('updatePlayers', players);
  });

  // Player movement
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].rotation = data.rotation;
      io.emit('updatePlayers', players);
    }
  });

  // Shooting
  socket.on('shoot', (bullet) => {
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

  // Update bullets (simple collision check)
  setInterval(() => {
    bullets = bullets.filter(b => b.x > 0 && b.x < 800 && b.y > 0 && b.y < 600);
    for (let bullet of bullets) {
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
      for (let playerId in players) {
        let player = players[playerId];
        if (player.id !== bullet.owner && Math.hypot(bullet.x - player.x, bullet.y - player.y) < 20) {
          player.health -= 10;
          if (player.health <= 0) {
            io.emit('playerDied', player.id);
            delete players[player.id];
          }
          bullets = bullets.filter(b => b !== bullet);
        }
      }
    }
    io.emit('updateBullets', bullets);
  }, 16);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
