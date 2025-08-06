const socket = io();

const joinBtn = document.getElementById('joinBtn');
const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomId');
const bidInput = document.getElementById('bidInput');
const submitBidBtn = document.getElementById('submitBid');

const lobby = document.getElementById('lobby');
const biddingSection = document.getElementById('bidding');
const game = document.getElementById('game');
const playersListDiv = document.getElementById('playersList');
const handDiv = document.getElementById('player-hand');
const tableDiv = document.getElementById('table');
const scoreboardDiv = document.getElementById('scoreboard');
const turnIndicator = document.getElementById('turn-indicator');

joinBtn.addEventListener('click', () => {
  socket.emit('joinRoom', { roomId: roomIdInput.value, playerName: playerNameInput.value });
});

submitBidBtn.addEventListener('click', () => {
  socket.emit('submitBid', { roomId: roomIdInput.value, bid: bidInput.value });
  biddingSection.style.display = 'none';
});

socket.on('playerList', (players) => {
  playersListDiv.innerHTML = '<h3>Players:</h3>';
  players.forEach(p => playersListDiv.innerHTML += `<p>${p.name}</p>`);
});

socket.on('startBidding', () => {
  lobby.style.display = 'none';
  biddingSection.style.display = 'block';
});

socket.on('gameStarted', () => {
  biddingSection.style.display = 'none';
  game.style.display = 'block';
});

socket.on('dealCards', (hand) => {
  handDiv.innerHTML = '';
  hand.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.textContent = `${card.rank}${card.suit}`;
    cardDiv.addEventListener('click', () => {
      socket.emit('playCard', { roomId: roomIdInput.value, card });
      cardDiv.remove();
    });
    handDiv.appendChild(cardDiv);
  });
});

socket.on('cardPlayed', ({ playerIndex, card }) => {
  const playedCardDiv = document.createElement('div');
  playedCardDiv.className = 'played-card';
  playedCardDiv.textContent = `${card.rank}${card.suit}`;
  tableDiv.appendChild(playedCardDiv);
});

socket.on('turnUpdate', (turnIndex) => {
  turnIndicator.textContent = `Current Turn: Player ${turnIndex + 1}`;
});

socket.on('trickWinner', ({ winner, scores }) => {
  alert(`Trick won by ${winner}`);
  scoreboardDiv.innerHTML = `Scores: ${scores.join(' | ')}`;
  tableDiv.innerHTML = '';
});

socket.on('gameOver', ({ winner, scores }) => {
  alert(`Game Over! Winner: ${winner}`);
  scoreboardDiv.innerHTML = `Final Scores: ${scores.join(' | ')}`;
});

socket.on('errorMessage', (msg) => alert(msg));
