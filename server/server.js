const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 10002;

// Serve static client if requested (optional)
app.use(express.static(__dirname + '/../'));

// Game authoritative state
let state = {
  left: { y: 225 - 40, score: 0 },
  right: { y: 225 - 40, score: 0 },
  ball: { x: 400, y: 225, vx: 5, vy: 2.5 },
  running: false
};

let players = {}; // socketId -> side ('left' or 'right')

function assignSide(){
  const taken = Object.values(players);
  if(!taken.includes('left')) return 'left';
  if(!taken.includes('right')) return 'right';
  return null;
}

io.on('connection', socket => {
  console.log('conn', socket.id);
  const side = assignSide();
  if(!side){
    socket.emit('full');
    socket.disconnect(true);
    return;
  }
  players[socket.id] = side;
  socket.emit('init', { side, state });
  io.emit('players', Object.values(players));

  socket.on('input', data => {
    // data: { up: bool, down: bool }
    const s = players[socket.id];
    if(!s) return;
    // debug log: show inputs when received
    console.log(`input from ${socket.id} (${s}):`, data);
  const speed = 12;
    // data may include raw keys: w/s and up/down
    if(s === 'left'){
      if(data.w) state.left.y -= speed;
      if(data.s) state.left.y += speed;
    } else if(s === 'right'){
      if(data.up) state.right.y -= speed;
      if(data.down) state.right.y += speed;
    }
    state[s].y = Math.max(0, Math.min(450 - 80, state[s].y));
  });

  socket.on('toggle', ()=>{ 
    state.running = !state.running; 
    console.log('toggle received from', socket.id, 'new running=', state.running);
  });

  socket.on('reset', ()=>{ 
    state.left.score = 0; state.right.score = 0; state.ball.x=400; state.ball.y=225; state.ball.vx = 5; state.ball.vy = 2.5; state.running = false; 
    console.log('reset received from', socket.id);
  });

  socket.on('debug-input', (d) => {
    console.log('debug-input from', socket.id, d);
  });

  socket.on('disconnect', ()=>{
    delete players[socket.id];
    io.emit('players', Object.values(players));
  });
});

// Game loop authoritative
setInterval(()=>{
  if(!state.running) { io.emit('state', state); return; }
  // ball physics
  state.ball.x += state.ball.vx;
  state.ball.y += state.ball.vy;
  if(state.ball.y - 9 <= 0){ state.ball.y = 9; state.ball.vy *= -1; }
  if(state.ball.y + 9 >= 450){ state.ball.y = 450 - 9; state.ball.vy *= -1; }

  // left paddle collision
  if(state.ball.x - 9 <= 20 + 12){
    if(state.ball.y >= state.left.y && state.ball.y <= state.left.y + 80){
      const relative = (state.ball.y - (state.left.y + 40)) / 40; // -1..1
      const angle = relative * (Math.PI/3);
      const speed = Math.hypot(state.ball.vx, state.ball.vy) * 1.05;
      state.ball.vx = Math.abs(Math.cos(angle) * speed);
      state.ball.vy = Math.sin(angle) * speed;
      state.ball.x = 20 + 12 + 9 + 0.1;
    }
  }
  // right paddle collision
  if(state.ball.x + 9 >= 800 - 20 - 12){
    if(state.ball.y >= state.right.y && state.ball.y <= state.right.y + 80){
      const relative = (state.ball.y - (state.right.y + 40)) / 40;
      const angle = relative * (Math.PI/3);
      const speed = Math.hypot(state.ball.vx, state.ball.vy) * 1.05;
      state.ball.vx = -Math.abs(Math.cos(angle) * speed);
      state.ball.vy = Math.sin(angle) * speed;
      state.ball.x = 800 - 20 - 12 - 9 - 0.1;
    }
  }

  // scoring
  if(state.ball.x + 9 < 0){ state.right.score++; serve(true); }
  if(state.ball.x - 9 > 800){ state.left.score++; serve(false); }

  io.emit('state', state);
}, 1000/60);

// diagnostic: print ball position once per second when running
setInterval(()=>{
  if(state.running){
    console.log('ball pos', Math.round(state.ball.x), Math.round(state.ball.y), 'vx', state.ball.vx.toFixed(2), 'vy', state.ball.vy.toFixed(2));
  }
}, 1000);

// diagnostic: print paddle positions once per second
setInterval(()=>{
  console.log('paddles', 'left.y=', Math.round(state.left.y), 'right.y=', Math.round(state.right.y));
}, 1000);

function serve(toRight){ state.ball.x = 400; state.ball.y = 225; const dir = toRight ? 1 : -1; state.ball.vx = 5 * dir; state.ball.vy = (Math.random()*6 - 3); }

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use. If another instance is running, stop it or choose a different PORT.`);
  } else {
    console.error('Server error:', err);
  }
  process.exitCode = 1;
});

// Prefer binding to IPv4 explicitly to avoid IPv6 EADDRINUSE in some environments
server.listen(PORT, '0.0.0.0', () => console.log('server listening', PORT));