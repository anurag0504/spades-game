// multiplayer.js
const socket = io();
let roomId, playerId, isLeader = false;
let myHand = [], currentTurn, playableCards = [];

document.getElementById('createRoomBtn')?.addEventListener('click', () => {
  const name = document.getElementById('playerName').value;
  const totalPlayers = parseInt(document.getElementById('totalPlayers').value);
  const botCount = parseInt(document.getElementById('botPlayers').value);

  if (name && totalPlayers && totalPlayers - botCount >= 1) {
    socket.emit('createGame', { name, totalPlayers, botCount });
  } else {
    alert("Invalid input for players/bots.");
  }
});

document.getElementById('joinRoomBtn')?.addEventListener('click', () => {
  const name = document.getElementById('playerName').value;
  const room = document.getElementById('roomId').value;
  if (name && room) socket.emit('joinGame', { roomId: room, name });
});

socket.on('gameCreated', ({ roomId: id, playerId: pid }) => {
  roomId = id;
  playerId = pid;
  isLeader = true;
  document.getElementById('roomStatus').textContent = `Room ID: ${roomId}`;
});

socket.on('joinedRoom', ({ roomId: id, playerId: pid }) => {
  roomId = id;
  playerId = pid;
  document.getElementById('roomStatus').textContent = `Room ID: ${roomId}`;
});

socket.on('playerList', players => {
  const list = document.getElementById('playerList');
  list.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} ${p.isBot ? '(BOT)' : ''}`;
    list.appendChild(li);
  });
});

socket.on('biddingStart', ({ currentBidder }) => {
  if (playerId === currentBidder) {
    document.getElementById('biddingPhase').classList.remove('hidden');
  }
});

document.getElementById('submitBidBtn')?.addEventListener('click', () => {
  const bid = parseInt(document.getElementById('bidInput').value);
  const blindNil = document.getElementById('blindNil').checked;
  socket.emit('bid', { roomId, bid, blindNil });
  document.getElementById('biddingPhase').classList.add('hidden');
});

socket.on('dealCards', ({ hand }) => {
  myHand = hand;
  renderHand(hand, 'yourHand');
  updatePlayableCards();
});

socket.on('updateTurn', ({ playerTurn }) => {
  currentTurn = playerTurn;
  updateTurnUI();
  updatePlayableCards();
});

socket.on('cardPlayed', ({ playerId: playedBy, card }) => {
  const table = document.getElementById('centerTable');
  const div = document.createElement('div');
  div.className = 'card played-card';
  div.textContent = cardToString(card);
  table.appendChild(div);
});

socket.on('updateScores', ({ scores }) => {
  const scoreBoard = document.getElementById('scoreBoard');
  scoreBoard.innerHTML = '';
  scores.forEach(s => {
    const p = document.createElement('p');
    p.textContent = `${s.name}: ${s.score}`;
    scoreBoard.appendChild(p);
  });
});

socket.on('trickWon', ({ winner }) => {
  const trickInfo = document.getElementById('trickInfo');
  trickInfo.textContent = `${winner} won the trick!`;
  setTimeout(() => trickInfo.textContent = '', 2000);
});

socket.on('gameOver', ({ winner }) => {
  alert(`${winner} wins the game!`);
});

// Utility functions
function renderHand(hand, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  hand.forEach(card => {
    const div = document.createElement('div');
    div.className = 'card';
    div.dataset.suit = card.suit;
    div.dataset.rank = card.rank;
    div.textContent = cardToString(card);
    container.appendChild(div);
  });
}

function updatePlayableCards() {
  const handArea = document.getElementById('yourHand');
  const cards = handArea.querySelectorAll('.card');

  cards.forEach(card => {
    const cardObj = { suit: card.dataset.suit, rank: card.dataset.rank };
    const isPlayable = checkCardPlayable(cardObj);

    if (currentTurn !== playerId) {
      card.classList.add('greyed-out');
      card.onclick = null;
    } else if (isPlayable) {
      card.classList.remove('greyed-out');
      card.onclick = () => {
        socket.emit('playCard', { roomId, card: cardObj });
        card.remove();
      };
    } else {
      card.classList.add('greyed-out');
      card.onclick = null;
    }
  });
}

function checkCardPlayable(card) {
    // If no suit led yet (first card of trick), any card is playable
    if (!currentTrickSuit) return true;
  
    // Check if player has at least one card of the current trick suit
    const hasSuit = myHand.some(c => c.suit === currentTrickSuit);
  
    if (hasSuit) {
      // Can only play matching suit if you have it
      return card.suit === currentTrickSuit;
    } else {
      // If you don't have that suit, any card is playable
      return true;
    }
  }
  

function cardToString(card) {
  const ranks = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  return `${ranks[card.rank] || card.rank} ${card.suit[0].toUpperCase()}`;
}

function updateTurnUI() {
  const turnDisplay = document.getElementById('turnDisplay');
  turnDisplay.textContent = playerId === currentTurn ? "Your Turn" : "Waiting...";
}
