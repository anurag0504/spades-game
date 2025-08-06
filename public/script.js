const socket = io();

const createRoomBtn = document.getElementById('createRoomBtn');
const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomId');
const totalPlayersInput = document.getElementById('totalPlayers');
const botPlayersInput = document.getElementById('botPlayers');

const submitBidBtn = document.getElementById('submitBid');
const bidInput = document.getElementById('bidInput');

const setupDiv = document.getElementById('setup');
const lobbyDiv = document.getElementById('lobby');
const biddingDiv = document.getElementById('bidding');
const gameDiv = document.getElementById('game');
const playersListDiv = document.getElementById('playersList');
const handDiv = document.getElementById('player-hand');
const tableDiv = document.getElementById('table');
const scoreboardDiv = document.getElementById('scoreboard');
const turnIndicator = document.getElementById('turn-indicator');

let currentHand = [];
let currentTurnIndex = 0;

createRoomBtn.addEventListener('click', () => {
  socket.emit('joinRoom', { 
    roomId: roomIdInput.value, 
    playerName: playerNameInput.value,
    totalPlayers: parseInt(totalPlayersInput.value),
    botPlayers: parseInt(botPlayersInput.value)
  });
  setupDiv.style.display = 'none';
  lobbyDiv.style.display = 'block';
});

submitBidBtn.addEventListener('click', () => {
  socket.emit('submitBid', { roomId: roomIdInput.value, bid: bidInput.value });
  biddingDiv.style.display = 'none';
});

socket.on('playerList', (players) => {
  playersListDiv.innerHTML = '<h3>Players:</h3>';
  players.forEach(p => playersListDiv.innerHTML += `<p>${p.name}</p>`);
});

socket.on('startBidding', () => {
  lobbyDiv.style.display = 'none';
  biddingDiv.style.display = 'block';
});

socket.on('gameStarted', () => {
  biddingDiv.style.display = 'none';
  gameDiv.style.display = 'block';
});

socket.on('dealCards', (hand) => {
  currentHand = hand;
  renderHand();
});

function renderHand() {
  handDiv.innerHTML = '';
  currentHand.forEach((card, index) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.textContent = `${card.rank}${card.suit}`;
    cardDiv.dataset.index = index;

    if (!isCardPlayable(card)) {
      cardDiv.classList.add('disabled-card');
    } else {
      cardDiv.addEventListener('click', () => {
        socket.emit('playCard', { roomId: roomIdInput.value, card, cardIndex: index });
      });
    }
    handDiv.appendChild(cardDiv);
  });
}

function isCardPlayable(card) {
  const leadCard = tableDiv.querySelector('.played-card');
  if (!leadCard) return true;
  const leadSuit = leadCard.textContent.slice(-1);
  const hasLeadSuit = currentHand.some(c => c.suit === leadSuit);
  return !hasLeadSuit || card.suit === leadSuit;
}

socket.on('validCardPlayed', (cardIndex) => {
  currentHand.splice(cardIndex, 1);
  renderHand();
});

socket.on('updateBids', (bids) => {
  scoreboardDiv.innerHTML = `Bids: ${bids.join(' | ')} <br>`;
});

socket.on('cardPlayed', ({ playerIndex, card }) => {
  const playedCardDiv = document.createElement('div');
  playedCardDiv.className = 'played-card';
  playedCardDiv.textContent = `${card.rank}${card.suit}`;
  tableDiv.appendChild(playedCardDiv);
});

socket.on('turnUpdate', (turnIndex) => {
  currentTurnIndex = turnIndex;
  turnIndicator.textContent = `Current Turn: Player ${turnIndex + 1}`;
  renderHand();
});

socket.on('trickWinner', ({ winner, scores, bids }) => {
  alert(`Trick won by ${winner}`);
  scoreboardDiv.innerHTML = `Bids: ${bids.join(' | ')} <br> Scores: ${scores.join(' | ')}`;
  tableDiv.innerHTML = '';
});

socket.on('gameOver', ({ winner, scores, bids }) => {
  alert(`Game Over! Winner: ${winner}`);
  scoreboardDiv.innerHTML = `Final Bids: ${bids.join(' | ')} <br> Final Scores: ${scores.join(' | ')}`;
});

socket.on('errorMessage', (msg) => alert(msg));
