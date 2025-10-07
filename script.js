// Simple Tennis-for-Two / Pong-like game with optional LAN multiplayer via socket.io
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = canvas.width, H = canvas.height;

// Game state (rendered)
let left = { x: 20, y: H/2 - 40, w: 12, h: 80, vy:0, score:0 };
let right = { x: W - 20 - 12, y: H/2 - 40, w:12, h:80, vy:0, score:0 };
let ball = { x: W/2, y: H/2, vx: 5, vy: 2.5, r:9 };
let running = false;
let lastTime = 0;

// Network
let socket = null;
let side = null; // 'left' or 'right' when connected
let isNetwork = false;

// Config
// increased paddle speed for snappier movement
const PADDLE_SPEED = 12;
const MAX_BOUNCE_ANGLE = Math.PI/3; // 60 degrees

// Input
const keys = {};
let lastKey = null;
window.addEventListener('keydown', e => { keys[e.key] = true; lastKey = e.key; console.log('keydown', e.key); if(e.key === ' '){ if(isNetwork){ socket && socket.emit('toggle'); } else { toggleRun(); } e.preventDefault(); } if(e.key === 'r' || e.key === 'R'){ if(isNetwork){ socket && socket.emit('reset'); } else { reset(); } } });
window.addEventListener('keyup', e => { keys[e.key] = false; lastKey = null; });

// Buttons
document.getElementById('start').addEventListener('click', ()=>{ if(isNetwork){ socket && socket.emit('toggle'); } else { toggleRun(); } });
document.getElementById('reset').addEventListener('click', ()=>{ if(isNetwork){ socket && socket.emit('reset'); } else { reset(); } });
document.getElementById('connect').addEventListener('click', connectToServer);

function toggleRun(){ running = !running; if(running){ requestAnimationFrame(loop); document.getElementById('start').textContent = 'Pause'; } else { document.getElementById('start').textContent = 'Start'; } }

function reset(){ running = false; left.score = 0; right.score = 0; ball.x = W/2; ball.y = H/2; ball.vx = 5 * (Math.random()<0.5?1:-1); ball.vy = (Math.random()*6-3); left.y = H/2 - left.h/2; right.y = H/2 - right.h/2; document.getElementById('score-left').textContent = left.score; document.getElementById('score-right').textContent = right.score; document.getElementById('start').textContent = 'Start'; draw(); }

function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

function update(dt){
  if(isNetwork) {
    // send current inputs to server for authoritative update
    if(!socket) return;
    // send all possible key states so server can map based on assigned side
    const input = {
      w: !!(keys['w'] || keys['W']),
      s: !!(keys['s'] || keys['S']),
      up: !!keys['ArrowUp'],
      down: !!keys['ArrowDown']
    };
    const any = input.w || input.s || input.up || input.down;
    if(any) console.log('sending raw input', input, 'side=', side);
    socket.emit('input', input);
    socket.emit('debug-input', { input, sideGuess: side });
    // update debug display with last sent input
    if(window.document){
      const dbg = document.getElementById('net-debug');
      if(dbg) dbg.textContent = `ball ${Math.round(ball.x)} ${Math.round(ball.y)} running=${isNetwork ? 'net' : running} key=${lastKey||'-'} sent=${input.up? 'up':'' }${input.down? 'down':''}`;
    }
    return; // server will emit state which we render
  }

  // paddles by input (local)
  left.vy = 0; right.vy = 0;
  if(keys['w'] || keys['W']) left.vy = -PADDLE_SPEED;
  if(keys['s'] || keys['S']) left.vy = PADDLE_SPEED;
  if(keys['ArrowUp']) right.vy = -PADDLE_SPEED;
  if(keys['ArrowDown']) right.vy = PADDLE_SPEED;

  left.y = clamp(left.y + left.vy, 0, H - left.h);
  right.y = clamp(right.y + right.vy, 0, H - right.h);

  // ball
  ball.x += ball.vx;
  ball.y += ball.vy;

  // collide top/bottom
  if(ball.y - ball.r <= 0){ ball.y = ball.r; ball.vy *= -1; }
  if(ball.y + ball.r >= H){ ball.y = H - ball.r; ball.vy *= -1; }

  // collide paddles
  // left paddle
  if(ball.x - ball.r <= left.x + left.w && ball.x - ball.r >= left.x){
    if(ball.y >= left.y && ball.y <= left.y + left.h){
      const relative = (ball.y - (left.y + left.h/2)) / (left.h/2);
      const angle = relative * MAX_BOUNCE_ANGLE;
      const speed = Math.hypot(ball.vx, ball.vy) * 1.05;
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
      if(ball.vx < 0) ball.vx *= -1;
      ball.x = left.x + left.w + ball.r + 0.1;
    }
  }
  // right paddle
  if(ball.x + ball.r >= right.x && ball.x + ball.r <= right.x + right.w){
    if(ball.y >= right.y && ball.y <= right.y + right.h){
      const relative = (ball.y - (right.y + right.h/2)) / (right.h/2);
      const angle = relative * MAX_BOUNCE_ANGLE;
      const speed = Math.hypot(ball.vx, ball.vy) * 1.05;
      ball.vx = -Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
      if(ball.vx > 0) ball.vx *= -1;
      ball.x = right.x - ball.r - 0.1;
    }
  }

  // scoring
  if(ball.x + ball.r < 0){ // right scores
    right.score += 1; document.getElementById('score-right').textContent = right.score; serve(true);
  }
  if(ball.x - ball.r > W){ // left scores
    left.score += 1; document.getElementById('score-left').textContent = left.score; serve(false);
  }
}

function serve(toRight){ ball.x = W/2; ball.y = H/2; const dir = toRight ? 1 : -1; ball.vx = 5 * dir; ball.vy = (Math.random()*6 - 3); }

function draw(){
  ctx.clearRect(0,0,W,H);

  // middle dashed line
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10,14]);
  ctx.beginPath();
  ctx.moveTo(W/2, 0);
  ctx.lineTo(W/2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // paddles
  ctx.fillStyle = '#e6f0ff';
  roundRect(ctx, left.x, left.y, left.w, left.h, 4, true, false);
  roundRect(ctx, right.x, right.y, right.w, right.h, 4, true, false);

  // ball
  ctx.beginPath();
  ctx.fillStyle = '#ffd86b';
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
  ctx.fill();

  // small glow
  ctx.beginPath(); ctx.fillStyle='rgba(255,200,120,0.08)'; ctx.arc(ball.x, ball.y, ball.r*2.2,0,Math.PI*2); ctx.fill();

  // show connection/side
  if(isNetwork){
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(8, H-26, 180, 18);
    ctx.fillStyle = '#cfe8ff';
    ctx.font = '12px sans-serif';
    ctx.fillText('Network play — side: ' + (side||'...'), 12, H-12);
  }
}

function roundRect(ctx,x,y,w,h,r,fill,stroke){ if(r===undefined) r=5; ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if(fill) ctx.fill(); if(stroke) ctx.stroke(); }

function loop(ts){ if(!lastTime) lastTime = ts; const dt = (ts - lastTime)/1000; lastTime = ts; update(dt); draw(); if(!isNetwork ? running : true) requestAnimationFrame(loop); }

// initial draw
reset();

// make canvas high DPI aware
function resizeForDPR(){ const dpr = window.devicePixelRatio || 1; canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; ctx.setTransform(dpr,0,0,dpr,0,0); draw(); }
resizeForDPR();
window.addEventListener('resize', resizeForDPR);

// give focus for keyboard
canvas.tabIndex = 1000;
canvas.style.outline = 'none';
canvas.addEventListener('click', ()=> canvas.focus());

// Touch / on-screen controls
function bindButton(id, downKeys){
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    downKeys.forEach(k=> keys[k]=true);
    // send immediate input if network
    if(isNetwork && socket) socket.emit('input', { w: keys['w'], s: keys['s'], up: keys['ArrowUp'], down: keys['ArrowDown'] });
  });
  el.addEventListener('pointerup', (e)=>{
    e.preventDefault();
    downKeys.forEach(k=> keys[k]=false);
    if(isNetwork && socket) socket.emit('input', { w: keys['w'], s: keys['s'], up: keys['ArrowUp'], down: keys['ArrowDown'] });
  });
  el.addEventListener('pointerleave', (e)=>{ downKeys.forEach(k=> keys[k]=false); if(isNetwork && socket) socket.emit('input', { w: keys['w'], s: keys['s'], up: keys['ArrowUp'], down: keys['ArrowDown'] }); });
}

bindButton('left-up', ['w']);
bindButton('left-down', ['s']);
bindButton('right-up', ['ArrowUp']);
bindButton('right-down', ['ArrowDown']);

// network connect
function connectToServer(){
  if(socket){ socket.disconnect(); socket = null; isNetwork = false; side = null; document.getElementById('connect').textContent = 'Play on LAN'; reset(); return; }
  // try connect to same host on port 10002 (server)
  if(typeof io === 'undefined'){
    alert('Socket.IO client not loaded. Check network or use the bundled socket.io client.');
    return;
  }
  // prefer explicit protocol
  const host = window.location.hostname || 'localhost';
  const url = (window.location.protocol === 'https:' ? 'https://' : 'http://') + host + ':10002';
  socket = io(url, { reconnectionAttempts: 3, timeout: 3000 });
  socket.on('connect_error', (err)=>{ console.error('connect_error', err); alert('Unable to connect to game server on port 10002'); socket.disconnect(); socket = null; });

  socket.on('full', ()=>{ alert('Server is full (2 players).'); socket.disconnect(); socket = null; });

  socket.on('init', (d)=>{
    side = d.side;
    isNetwork = true;
    // set initial rendered state
    if(d.state){ applyState(d.state); }
    document.getElementById('connect').textContent = 'Disconnect';
  });

  socket.on('state', s => {
  // debug: log small snapshot
  console.log('state recv', Math.round(s.ball.x), Math.round(s.ball.y), s.left.y, s.right.y, 'running=', s.running);
    applyState(s);
  });

  socket.on('players', p => { console.log('players', p); });

  requestAnimationFrame(loop);
}

function applyState(s){
  left.y = s.left.y; left.score = s.left.score;
  right.y = s.right.y; right.score = s.right.score;
  ball.x = s.ball.x; ball.y = s.ball.y; ball.vx = s.ball.vx; ball.vy = s.ball.vy;
  document.getElementById('score-left').textContent = left.score;
  document.getElementById('score-right').textContent = right.score;
  // show quick debug info
  const dbg = document.getElementById('net-debug');
  if(dbg) dbg.textContent = `ball ${Math.round(ball.x)} ${Math.round(ball.y)} running=${s.running}`;
  // force draw immediately to reflect authoritative state
  draw();
}

// show tiny hint
console.log('Tennis for Two ready — click the canvas and press Space to start. Use Play on LAN to connect to a server.');