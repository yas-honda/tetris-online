const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.get("/health", (_req, res) => res.json({ ok: true }));

const rooms = new Map();
const MAX_PLAYERS = 2;

function publicRoom(room) {
  return {
    code: room.code,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, ready: p.ready, score: p.score,
      board: p.board, alive: p.alive
    })),
    started: room.started
  };
}
function emitRoom(room) {
  io.to(room.code).emit("room:update", publicRoom(room));
}
function cleanName(value) {
  return String(value || "Player").trim().slice(0, 16) || "Player";
}
function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  socket.data.roomCode = null;
  if (!room) return;
  room.players.delete(socket.id);
  if (room.players.size === 0) rooms.delete(code);
  else {
    room.started = false;
    for (const p of room.players.values()) p.ready = false;
    emitRoom(room);
  }
}
function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do { code = Array.from({length: 5}, () => chars[Math.floor(Math.random()*chars.length)]).join(""); }
  while (rooms.has(code));
  return code;
}

io.on("connection", socket => {
  socket.on("room:create", ({name} = {}, done = () => {}) => {
    leaveRoom(socket);
    const code = makeCode();
    const room = { code, players: new Map(), started: false };
    room.players.set(socket.id, {
      id: socket.id, name: cleanName(name), ready: false, score: 0,
      board: null, alive: true
    });
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    done({ok:true, code});
    emitRoom(room);
  });

  socket.on("room:join", ({code, name} = {}, done = () => {}) => {
    const normalized = String(code || "").trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room) return done({ok:false, error:"そのルームは見つかりません。"});
    if (room.players.size >= MAX_PLAYERS) return done({ok:false, error:"このルームは満員です。"});
    leaveRoom(socket);
    room.players.set(socket.id, {
      id: socket.id, name: cleanName(name), ready: false, score: 0,
      board: null, alive: true
    });
    socket.join(room.code);
    socket.data.roomCode = room.code;
    done({ok:true, code:room.code});
    emitRoom(room);
  });

  socket.on("player:ready", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.started || room.players.size !== 2) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    player.ready = !player.ready;
    if ([...room.players.values()].every(p => p.ready)) {
      room.started = true;
      for (const p of room.players.values()) { p.score = 0; p.board = null; p.alive = true; }
      io.to(room.code).emit("game:start");
    }
    emitRoom(room);
  });

  socket.on("game:state", ({board, score, alive} = {}) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.get(socket.id);
    if (!room || !room.started || !player) return;
    if (Array.isArray(board) && board.length === 20 && board.every(row => Array.isArray(row) && row.length === 10)) {
      player.board = board.map(row => row.map(v => Number(v) || 0));
    }
    player.score = Math.max(0, Math.min(999999, Number(score) || 0));
    player.alive = Boolean(alive);
    socket.to(room.code).emit("opponent:state", {
      id: socket.id, board: player.board, score: player.score, alive: player.alive
    });
    if (!player.alive) {
      room.started = false;
      const winner = [...room.players.values()].find(p => p.id !== socket.id);
      io.to(room.code).emit("game:over", {winner: winner?.name || "相手", loser: player.name});
      for (const p of room.players.values()) p.ready = false;
      emitRoom(room);
    }
  });

  socket.on("game:attack", ({lines} = {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room?.started || !room.players.has(socket.id)) return;
    const target = [...room.players.values()].find(p => p.id !== socket.id);
    if (target) io.to(target.id).emit("game:garbage", {lines: Math.max(0, Math.min(4, Number(lines)||0))});
  });

  socket.on("room:leave", () => leaveRoom(socket));
  socket.on("disconnect", () => leaveRoom(socket));
});

server.listen(PORT, "0.0.0.0", () => console.log(`Tetris Online listening on ${PORT}`));
