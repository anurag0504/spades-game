const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const SpadesGame = require('./gameEngine');
const BeginnerAI = require('./ai/beginnerAI');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/../client/public'));

let games = {};

io.on('connection', socket => {
  socket.on('createGame', ({ name }) => {
    const roomId = Math.random().toString(36).substr(2, 6);
    games[roomId] = new SpadesGame();
    games[roomId].addPlayer({ id: socket.id, name });
    socket.join(roomId);
    io.to(socket.id).emit('gameCreated', { roomId });
  });

  socket.on('joinGame', ({ roomId, name }) => {
    const game = games[roomId];
    if (game && game.players.length < 4) {
      game.addPlayer({ id: socket.id, name });
      socket.join(roomId);
      io.to(roomId).emit('playerList', game.players);

      // Fill remaining slots with bots automatically
      if (game.players.length === 4) {
        startBidding(roomId);
      }
    }
  });

  socket.on('bid', ({ roomId, bid, blindNil }) => {
    const game = games[roomId];
    const idx = game.players.findIndex(p => p.id === socket.id);
    game.setBid(idx, bid, blindNil);
    io.to(roomId).emit('bidsUpdate', game.players.map(p => p.bid));
    if (game.players.every(p => p.bid !== null)) {
      dealAndStart(roomId);
    }
  });

  socket.on('playCard', ({ roomId, card }) => {
    const game = games[roomId];
    const idx = game.players.findIndex(p => p.id === socket.id);

    try {
      const winner = game.playCard(idx, card);
      io.to(roomId).emit('cardPlayed', { playerIndex: idx, card });

      if (winner !== null) {
        io.to(roomId).emit('trickWinner', { winner });

        if (game.players[0].hand.length === 0) {
          game.calculateScores();
          if (game.isGameOver()) {
            io.to(roomId).emit('gameOver', { scores: game.scores });
          } else {
            game.resetRound();
            startBidding(roomId);
          }
        }
      }
    } catch (err) {
      io.to(socket.id).emit('errorMessage', err.message);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in games) {
      const game = games[roomId];
      game.players = game.players.filter(p => p.id !== socket.id);
      io.to(roomId).emit('playerList', game.players);
    }
  });
});

function startBidding(roomId) {
  io.to(roomId).emit('biddingStart');
}

function dealAndStart(roomId) {
  const game = games[roomId];
  game.createDeck();
  game.shuffleDeck();
  game.dealCards();
  game.players.forEach((p, i) => io.to(p.id).emit('dealCards', game.players[i].hand));
  io.to(roomId).emit('roundStarted');
}

server.listen(3000, () => console.log('Server running on port 3000'));
