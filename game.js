const socket = io();
const $ = id => document.getElementById(id);
const lobby = $("lobby"), roomPanel = $("roomPanel"), gamePanel = $("gamePanel");
let roomCode = null, started = false, game = null, opponent = null, lastSent = 0;

socket.on("connect", () => $("connection").textContent = "● ONLINE");
socket.on("disconnect", () => $("connection").textContent = "○ RECONNECTING");

function toast(message) {
  const el=$("toast"); el.textContent=message; el.classList.remove("hidden");
  setTimeout(()=>el.classList.add("hidden"),2400);
}
function playerName(){return $("playerName").value.trim() || "Player";}
function enterRoom(code){
  roomCode=code; $("roomCodeDisplay").textContent=code;
  lobby.classList.add("hidden"); roomPanel.classList.remove("hidden");
  $("lobbyMessage").textContent="";
}
$("createRoom").onclick=()=>socket.emit("room:create",{name:playerName()},r=>{
  if(!r.ok)return toast("ルームを作成できませんでした");
  enterRoom(r.code); $("roomMessage").textContent="友達にルームコードを共有してください。";
});
$("joinRoom").onclick=()=>socket.emit("room:join",{name:playerName(),code:$("roomCode").value},r=>{
  if(!r.ok){$("lobbyMessage").textContent=r.error;return;}
  enterRoom(r.code);
});
$("roomCode").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""));
$("copyCode").onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);toast("ルームコードをコピーしました");}catch{toast("コード："+roomCode);}};
$("readyButton").onclick=()=>socket.emit("player:ready");
$("leaveButton").onclick=()=>{socket.emit("room:leave");resetToLobby();};
function resetToLobby(){roomCode=null;started=false;game=null;opponent=null;roomPanel.classList.add("hidden");gamePanel.classList.add("hidden");lobby.classList.remove("hidden");}
socket.on("room:update",room=>{
  $("players").innerHTML="";
  room.players.forEach((p,i)=>{
    const div=document.createElement("div");div.className="player";
    const strong=document.createElement("strong");strong.textContent=(i===0?"PLAYER 1 · ":"PLAYER 2 · ")+p.name;
    const small=document.createElement("small");small.textContent=p.ready?"準備OK":"待機中";
    div.append(strong,small);$("players").append(div);
  });
  $("readyButton").disabled=room.players.length!==2 || room.started;
  $("readyButton").textContent=room.players.find(p=>p.id===socket.id)?.ready?"準備を取り消す":"準備OK";
  if(room.players.length<2)$("roomMessage").textContent="もう1人の参加を待っています…";
  else $("roomMessage").textContent="2人そろいました。両方が準備OKを押すと開始！";
});
socket.on("game:start",()=>{
  started=true;roomPanel.classList.add("hidden");gamePanel.classList.remove("hidden");
  game=new Tetris();opponent=null;toast("対戦スタート！");
});
socket.on("opponent:state",state=>{opponent=state;drawOpponent();});
socket.on("game:garbage",({lines})=>{if(game&&started){game.addGarbage(lines);toast("お邪魔ブロックが来た！");}});
socket.on("game:over",result=>{
  started=false;toast(result.winner+" の勝ち！");
  $("roomMessage").textContent=result.winner+" の勝ち！もう一度準備OKで再戦できます。";
  gamePanel.classList.add("hidden");roomPanel.classList.remove("hidden");
});
function drawOpponent(){
  const c=$("opponentBoard"),ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);
  const board=opponent?.board;
  if(board)drawGrid(ctx,board,c.width/10,c.height/20);
  $("opponentScore").textContent=opponent?opponent.score:"—";
  $("opponentStatus").textContent=opponent?(opponent.alive?"対戦中":"ゲームオーバー"):"相手の盤面を待っています";
}
const COLORS=["#0000","#55e6d0","#5c8dff","#ffb84d","#bd7cff","#ff6fae","#a7e45b","#ff6477"];
function drawGrid(ctx,board,cw,ch){
  ctx.clearRect(0,0,cw*10,ch*20);
  board.forEach((row,y)=>row.forEach((v,x)=>{
    if(!v)return;ctx.fillStyle=COLORS[v]||"#fff";ctx.fillRect(x*cw+1,y*ch+1,cw-2,ch-2);
    ctx.fillStyle="#ffffff22";ctx.fillRect(x*cw+2,y*ch+2,cw-4,3);
  }));
  ctx.strokeStyle="#ffffff0c";for(let x=0;x<=10;x++){ctx.beginPath();ctx.moveTo(x*cw,0);ctx.lineTo(x*cw,ch*20);ctx.stroke();}
  for(let y=0;y<=20;y++){ctx.beginPath();ctx.moveTo(0,y*ch);ctx.lineTo(cw*10,y*ch);ctx.stroke();}
}
const SHAPES=[
  null,
  [[1,1,1,1]],
  [[2,0,0],[2,2,2]],
  [[0,0,3],[3,3,3]],
  [[4,4],[4,4]],
  [[0,5,5],[5,5,0]],
  [[0,6,0],[6,6,6]],
  [[7,7,0],[0,7,7]]
];
class Tetris{
  constructor(){this.board=Array.from({length:20},()=>Array(10).fill(0));this.score=0;this.lines=0;this.alive=true;this.bag=[];this.dropCounter=0;this.last=0;this.next();this.loop= t=>this.update(t);requestAnimationFrame(this.loop);}
  next(){if(!this.bag.length)this.bag=[1,2,3,4,5,6,7].sort(()=>Math.random()-.5);const id=this.bag.pop();this.piece={shape:SHAPES[id].map(r=>r.slice()),x:3,y:0};if(this.collide())this.end();}
  collide(shape=this.piece.shape,x=this.piece.x,y=this.piece.y){return shape.some((row,dy)=>row.some((v,dx)=>v&&(x+dx<0||x+dx>=10||y+dy>=20||(y+dy>=0&&this.board[y+dy][x+dx]))));}
  move(dx,dy){if(!this.collide(this.piece.shape,this.piece.x+dx,this.piece.y+dy)){this.piece.x+=dx;this.piece.y+=dy;return true;}return false;}
  rotate(){const s=this.piece.shape;const r=s[0].map((_,i)=>s.map(row=>row[i]).reverse());for(const k of [0,-1,1,-2,2])if(!this.collide(r,this.piece.x+k,this.piece.y)){this.piece.shape=r;this.piece.x+=k;return;}}
  lock(){this.piece.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v&&this.piece.y+y>=0)this.board[this.piece.y+y][this.piece.x+x]=v;}));
    let count=0;for(let y=19;y>=0;y--)if(this.board[y].every(Boolean)){this.board.splice(y,1);this.board.unshift(Array(10).fill(0));count++;y++;}
    if(count){this.lines+=count;this.score+=[0,100,300,500,800][count];if(count>=2)socket.emit("game:attack",{lines:count-1});}
    this.next();this.send(true);
  }
  addGarbage(n){for(let i=0;i<n;i++){this.board.shift();const hole=Math.floor(Math.random()*10);this.board.push(Array.from({length:10},(_,x)=>x===hole?0:7));}if(this.collide())this.end();}
  hardDrop(){while(this.move(0,1)){}this.lock();}
  end(){if(!this.alive)return;this.alive=false;this.send(true);socket.emit("game:state",{board:this.board,score:this.score,alive:false});}
  send(force=false){const now=Date.now();if(!force&&now-lastSent<100)return;lastSent=now;socket.emit("game:state",{board:this.board,score:this.score,alive:this.alive});}
  update(t){if(!started||!this.alive)return;const dt=t-this.last;this.last=t;this.dropCounter+=dt;if(this.dropCounter>Math.max(100,800-this.lines*35)){if(!this.move(0,1))this.lock();this.dropCounter=0;}this.draw();this.send();requestAnimationFrame(this.loop);}
  draw(){const c=$("board"),ctx=c.getContext("2d");drawGrid(ctx,this.board,30,30);
    this.piece.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v){ctx.fillStyle=COLORS[v];ctx.fillRect((this.piece.x+x)*30+1,(this.piece.y+y)*30+1,28,28);}}));
    $("myScore").textContent=this.score;
  }
}
function key(e){if(!game||!started||!game.alive)return;const allowed=["ArrowLeft","ArrowRight","ArrowDown","ArrowUp"," ","x","X"];if(!allowed.includes(e.key))return;e.preventDefault();
  if(e.key==="ArrowLeft")game.move(-1,0);if(e.key==="ArrowRight")game.move(1,0);if(e.key==="ArrowDown"){if(!game.move(0,1))game.lock();else game.score+=1;}if(e.key==="ArrowUp"||e.key.toLowerCase()==="x")game.rotate();if(e.key===" ")game.hardDrop();game.draw();game.send(true);
}
document.addEventListener("keydown",key);
document.querySelectorAll("[data-key]").forEach(b=>b.onclick=()=>{const k=b.dataset.key;key({key:k,preventDefault(){}});});
