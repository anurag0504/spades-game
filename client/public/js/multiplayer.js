// multiplayer.js
const socket = io();
let roomId;
let myHand = [];

document.getElementById('createRoomBtn')?.addEventListener('click', () => {
  const name = document.getElementById('playerName').value;
  socket.emit('createGame', { name });
});

document.getElementById('joinRoomBtn')?.addEventListener('click', () => {
  const name = document.getElementById('playerName').value;
  const room = document.getElementById('roomId').value;
  socket.emit('joinGame', { roomId: room, name });
});

socket.on('gameCreated', data => {
  roomId = data.roomId;
  alert(`Room created: ${roomId}`);
});

socket.on('playerList', players => {
  console.log("Players in room:", players);
});

socket.on('biddingStart', () => {
  document.getElementById('biddingPhase').classList.remove('hidden');
});

document.getElementById('submitBidBtn')?.addEventListener('click', () => {
  const bid = parseInt(document.getElementById('bidInput').value);
  const blindNil = document.getElementById('blindNil').checked;
  socket.emit('bid', { roomId, bid, blindNil });
  document.getElementById('biddingPhase').classList.add('hidden');
});

socket.on('dealCards', hand => {
  myHand = hand;
  renderHand(hand, 'yourHand');
  enableCardSelection();
});

socket.on('cardPlayed', data => {
  const table = document.getElementById('centerTable');
  const div = document.createElement('div');
  div.className = 'card played-card';
  div.textContent = cardToString(data.card);
  table.appendChild(div);
});

function enableCardSelection() {
  document.querySelectorAll('#yourHand .card').forEach(card => {
    card.addEventListener('click', () => {
      const cardObj = { suit: card.dataset.suit, rank: card.dataset.rank };
      socket.emit('playCard', { roomId, card: cardObj });
      card.remove();
    });
  });
}
