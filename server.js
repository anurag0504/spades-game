const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/public'));

let rooms = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = createNewRoom(socket.id, playerName);
    } else {
      const room = rooms[roomId];
      if (room.players.length >= 4) {
        socket.emit('errorMessage', 'Room is full');
        return;
      }
      room.players.push({ id: socket.id, name: playerName, isBot: false, bid: null, tricks: 0 });
      socket.join(roomId);
    }
    io.to(roomId).emit('playerList', rooms[roomId].players);

    if (rooms[roomId].players.length === 4) {
      startBidding(roomId);
    }
  });

  socket.on('submitBid', ({ roomId, bid, blindNil }) => {
    const room = rooms[roomId];
    const player = room.players.find(p => p.id === socket.id);
    player.bid = parseInt(bid);
    player.blindNil = blindNil;

    io.to(roomId).emit('bidsUpdate', room.players.map(p => p.bid));
    if (room.players.every(p => p.bid !== null)) {
      startRound(roomId);
    }
  });

  socket.on('playCard', ({ roomId, card }) => {
    playCard(roomId, socket.id, card);
  });

  socket.on('disconnect', () => {
    for (let roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
      io.to(roomId).emit('playerList', rooms[roomId].players);
    }
  });
});

// ---- Game Functions ---- //

function createNewRoom(leaderId, playerName) {
  return {
    leaderId,
    players: [{ id: leaderId, name: playerName, isBot: false, bid: null, tricks: 0 }],
    scores: [0, 0],   // Team scores
    bags: [0, 0],
    currentTrick: [],
    currentTurn: 0,
    spadesBroken: false,
    deck: [],
    round: 1
  };
}

function startBidding(roomId) {
  const room = rooms[roomId];
  room.players.forEach(p => { p.bid = null; p.tricks = 0; });
  io.to(roomId).emit('startBidding');
}

function startRound(roomId) {
  const room = rooms[roomId];
  room.deck = createShuffledDeck();
  dealCards(room);
  determineFirstLead(room);
  io.to(roomId).emit('roundStarted');
  updateTurn(roomId);
}

function createShuffledDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  let deck = [];
  suits.forEach(s => ranks.forEach(r => deck.push({ suit: s, rank: r })));
  return deck.sort(() => Math.random() - 0.5);
}

function dealCards(room) {
  const hands = [[], [], [], []];
  for (let i = 0; i < 52; i++) hands[i % 4].push(room.deck[i]);
  room.players.forEach((p, i) => {
    io.to(p.id).emit('dealCards', hands[i]);
    p.hand = hands[i];
  });
}

function determineFirstLead(room) {
  let starter = 0;
  room.players.forEach((p, i) => {
    if (p.hand.some(c => c.suit === '♣' && c.rank === '2')) starter = i;
  });
  room.currentTurn = starter;
}

function playCard(roomId, playerId, card) {
  const room = rooms[roomId];
  const playerIndex = room.players.findIndex(p => p.id === playerId);

  // Suit following rule
  const leadSuit = room.currentTrick.length ? room.currentTrick[0].card.suit : null;
  const hasLead = leadSuit && room.players[playerIndex].hand.some(c => c.suit === leadSuit);
  if (leadSuit && card.suit !== leadSuit && hasLead) {
    io.to(playerId).emit('errorMessage', `Must follow ${leadSuit}`);
    return;
  }

  // Spades leading restriction
  if (!room.spadesBroken && card.suit === '♠' && leadSuit === null) {
    const hasOtherSuit = room.players[playerIndex].hand.some(c => c.suit !== '♠');
    if (hasOtherSuit) {
      io.to(playerId).emit('errorMessage', 'Cannot lead spades until broken');
      return;
    }
  }

  // Remove card
  room.players[playerIndex].hand = room.players[playerIndex].hand.filter(c => !(c.suit === card.suit && c.rank === card.rank));
  if (card.suit === '♠') room.spadesBroken = true;

  room.currentTrick.push({ playerIndex, card });
  io.to(roomId).emit('cardPlayed', { playerIndex, card });

  if (room.currentTrick.length === 4) {
    setTimeout(() => {
      resolveTrick(roomId);
    }, 1000);
  } else {
    room.currentTurn = (room.currentTurn + 1) % 4;
    updateTurn(roomId);
  }
}

function resolveTrick(roomId) {
  const room = rooms[roomId];
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const leadSuit = room.currentTrick[0].card.suit;
  let winner = room.currentTrick[0];

  room.currentTrick.forEach(play => {
    if (play.card.suit === '♠' && winner.card.suit !== '♠') winner = play;
    else if (play.card.suit === winner.card.suit && ranks.indexOf(play.card.rank) > ranks.indexOf(winner.card.rank)) winner = play;
  });

  room.players[winner.playerIndex].tricks++;
  io.to(roomId).emit('trickWinner', { winner: room.players[winner.playerIndex].name });
  room.currentTrick = [];
  room.currentTurn = winner.playerIndex;
  updateTurn(roomId);

  if (room.players.every(p => p.hand.length === 0)) {
    calculateScores(roomId);
  }
}

function calculateScores(roomId) {
  const room = rooms[roomId];
  const teamTricks = [room.players[0].tricks + room.players[2].tricks, room.players[1].tricks + room.players[3].tricks];
  const teamBids = [room.players[0].bid + room.players[2].bid, room.players[1].bid + room.players[3].bid];

  teamTricks.forEach((tricks, i) => {
    if (tricks >= teamBids[i]) {
      room.scores[i] += teamBids[i] * 10;
      room.bags[i] += (tricks - teamBids[i]);
      room.scores[i] += (tricks - teamBids[i]); // 1 point per bag
      if (room.bags[i] >= 10) {
        room.scores[i] -= 100;
        room.bags[i] = 0;
      }
    } else {
      room.scores[i] -= teamBids[i] * 10;
    }
  });

  io.to(roomId).emit('roundOver', { scores: room.scores, bags: room.bags, round: room.round });
  room.round++;

  if (room.scores.some(s => s >= 500)) {
    const winner = room.scores[0] >= 500 ? 'Team 1' : 'Team 2';
    io.to(roomId).emit('gameOver', { winner, scores: room.scores });
  } else {
    startBidding(roomId);
  }
}

function updateTurn(roomId) {
  const room = rooms[roomId];
  io.to(roomId).emit('turnUpdate', room.currentTurn);
}

server.listen(3000, () => console.log('Server running on port 3000'));
