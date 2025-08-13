const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const SpadesGame = require('./gameEngine');
const BeginnerAI = require('./ai/beginnerAI');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET','POST']
    }
});

// Serve static files from client/public directory
app.use(express.static(path.join(__dirname, '../client/public')));

let games = {};

io.on('connection', socket => {
    console.log('Player connected:', socket.id);

    socket.on('createGame', ({ name }) => {
        try {
            const roomId = Math.random().toString(36).substr(2, 6);
            games[roomId] = new SpadesGame();
            games[roomId].started = false;
            games[roomId].addPlayer({ id: socket.id, name, isBot: false });
            socket.join(roomId);

            io.to(socket.id).emit('gameCreated', { roomId, playerId: socket.id });
            io.to(roomId).emit('playerList', games[roomId].players);
            console.log(`Game ${roomId} created, waiting for more players`);
        } catch (err) {
            console.error('Error creating game:', err);
            socket.emit('errorMessage','Failed to create game');
        }
    });

    socket.on('joinGame', ({ roomId, name }) => {
        try {
            const game = games[roomId];
            if (!game) {
                socket.emit('errorMessage','Room not found');
                return;
            }
            if (game.started) {
                socket.emit('errorMessage','Game already started');
                return;
            }

            const humanPlayers = game.players.filter(p => !p.isBot);
            if (humanPlayers.length >= 4) {
                socket.emit('errorMessage','Room is full');
                return;
            }

            console.log(`${name} joining game ${roomId}`);
            game.addPlayer({ id: socket.id, name, isBot: false });
            socket.join(roomId);
            io.to(socket.id).emit('joinedRoom', { roomId, playerId: socket.id });
            io.to(roomId).emit('playerList', game.players);

            const currentHumans = game.players.filter(p => !p.isBot);
            if (currentHumans.length === 4) {
                console.log(`Game ${roomId} has 4 human players, starting game`);
                game.started = true;
                setTimeout(() => startBidding(roomId), 1000);
            } else {
                console.log(`Game ${roomId} has ${currentHumans.length}/4 players, waiting for more`);
            }
        } catch (err) {
            console.error('Error joining game:', err);
            socket.emit('errorMessage','Failed to join game');
        }
    });

    socket.on('bid', ({ roomId, bid, blindNil }) => {
        try {
            const game = games[roomId];
            if (!game) return;

            const playerIndex = game.players.findIndex(p => p.id === socket.id);
            if (playerIndex === -1) return;

            console.log(`Player ${playerIndex} bids ${bid} (blindNil: ${blindNil})`);
            game.setBid(playerIndex, blindNil ? 0 : bid, blindNil);

            // Process bot bids now
            processBotBids(game);

            io.to(roomId).emit('bidsUpdate', game.players.map(p => p.bid));

            // After all players have bid, begin the trick‑playing phase (no new dealing)
            if (game.players.every(p => p.bid !== null)) {
                console.log(`All bids received for game ${roomId}, starting play`);
                setTimeout(() => startPlayAfterBidding(roomId), 1000);
            }
        } catch (err) {
            console.error('Error processing bid:', err);
            socket.emit('errorMessage','Failed to process bid');
        }
    });

    socket.on('playCard', ({ roomId, card }) => {
        try {
            const game = games[roomId];
            if (!game) return;

            const playerIndex = game.players.findIndex(p => p.id === socket.id);
            if (playerIndex === -1) return;

            console.log(`Player ${playerIndex} plays:`, card);

            const winner = game.playCard(playerIndex, card);
            io.to(roomId).emit('cardPlayed', { playerIndex, card });

            if (winner !== null) {
                console.log(`Player ${winner} wins trick`);
                io.to(roomId).emit('trickWinner', { winner });

                if (game.players[0].hand.length === 0) {
                    game.calculateScores();
                    if (game.isGameOver()) {
                        const winningTeam = game.scores[0] >= 500 ? 0 : 1;
                        io.to(roomId).emit('gameOver', { scores: game.scores, winner: winningTeam });
                    } else {
                        setTimeout(() => {
                            game.resetRound();
                            startBidding(roomId);
                        }, 3000);
                    }
                } else {
                    setTimeout(() => processBotTurns(roomId), 1000);
                }
            } else {
                setTimeout(() => processBotTurns(roomId), 1000);
            }
        } catch (err) {
            console.error('Error playing card:', err);
            io.to(socket.id).emit('errorMessage', err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        for (const roomId in games) {
            const game = games[roomId];
            const idx  = game.players.findIndex(p => p.id === socket.id);
            if (idx !== -1) {
                console.log(`Removing player from game ${roomId}`);
                game.players.splice(idx, 1);
                io.to(roomId).emit('playerList', game.players);
                const humanPlayers = game.players.filter(p => !p.isBot);
                if (humanPlayers.length === 0) {
                    delete games[roomId];
                    console.log(`Game ${roomId} deleted - no human players`);
                }
            }
        }
    });

    socket.on('startGame', ({ roomId }) => {
        try {
            const game = games[roomId];
            if (!game) {
                socket.emit('errorMessage','Room not found');
                return;
            }
            if (game.started) {
                socket.emit('errorMessage','Game already started');
                return;
            }
            while (game.players.length < 4) {
                const botIndex = game.players.length;
                game.addPlayer({
                    id: `bot_${botIndex}`,
                    name: `Bot ${botIndex}`,
                    isBot: true
                });
            }
            game.started = true;
            io.to(roomId).emit('playerList', game.players);
            console.log(`Manual start triggered for game ${roomId}. Starting bidding.`);
            startBidding(roomId);
        } catch (err) {
            console.error('Error starting game:', err);
            socket.emit('errorMessage','Failed to start game');
        }
    });
});

// -----------------------------------------------------------------------------
// Helper and game management functions
// -----------------------------------------------------------------------------

function processBotBids(game) {
    game.players.forEach((player, idx) => {
        if (player.isBot && player.bid === null) {
            const hand = player.hand;
            let bid    = 0;
            hand.forEach(card => {
                const rankValue = getRankValue(card.rank);
                if (card.suit === '♠') {
                    bid += (rankValue >= 12) ? 1 : 0.5;
                } else if (rankValue >= 12) {
                    bid += 0.5;
                }
            });
            bid = Math.max(1, Math.min(6, Math.round(bid)));
            game.setBid(idx, bid, false);
            console.log(`Bot ${idx} bids ${bid}`);
        }
    });
}

function getRankValue(rank) {
    const values = {
        '2': 2,'3': 3,'4': 4,'5': 5,'6': 6,'7': 7,'8': 8,'9': 9,'10': 10,
        'J': 11,'Q': 12,'K': 13,'A': 14
    };
    return values[rank] || parseInt(rank);
}

function processBotTurns(roomId) {
    const game = games[roomId];
    if (!game) return;

    const currentPlayer = game.players[game.currentTurn];
    if (currentPlayer && currentPlayer.isBot) {
        console.log(`Processing bot turn for player ${game.currentTurn}`);

        const hand = currentPlayer.hand;
        if (hand.length === 0) return;

        const leadSuit = game.currentTrick.length > 0
            ? game.currentTrick[0].card.suit
            : null;
        const card = BeginnerAI.playCard(hand, leadSuit, game.spadesBroken);

        if (card) {
            try {
                // Save the bot’s index before playCard updates currentTurn.
                const botIndex = game.currentTurn;

                // Play the card; this will internally update game.currentTurn.
                const winner = game.playCard(botIndex, card);

                // Tell clients which player actually played.
                io.to(roomId).emit('cardPlayed', { playerIndex: botIndex, card });

                if (winner !== null) {
                    io.to(roomId).emit('trickWinner', { winner });

                    if (game.players[0].hand.length === 0) {
                        game.calculateScores();
                        if (game.isGameOver()) {
                            const winningTeam = game.scores[0] >= 500 ? 0 : 1;
                            io.to(roomId).emit('gameOver', { scores: game.scores, winner: winningTeam });
                        } else {
                            setTimeout(() => {
                                game.resetRound();
                                startBidding(roomId);
                            }, 3000);
                        }
                    } else {
                        // Continue with next trick
                        setTimeout(() => processBotTurns(roomId), 1000);
                    }
                } else {
                    // Trick not over yet; next player (human or bot) goes
                    setTimeout(() => processBotTurns(roomId), 1000);
                }
            } catch (err) {
                console.error('Bot play error:', err);
            }
        }
    }
}


/**
 * Begin the bidding phase.  This now deals the cards **before** asking for bids,
 * so that players can inspect their hands and bid appropriately.
 */
function startBidding(roomId) {
    const game = games[roomId];
    if (!game) return;

    console.log(`Starting bidding for game ${roomId}`);

    // Deal cards up front
    game.createDeck();
    game.shuffleDeck();
    game.dealCards();

    // Send cards to each human player (include seat index)
    game.players.forEach((player, idx) => {
        if (!player.isBot) {
            io.to(player.id).emit('dealCards', { hand: player.hand, seat: idx });
        }
    });

    // Ask everyone to bid
    io.to(roomId).emit('biddingStart');

    // Let bots bid immediately, then check if all bids are complete
    setTimeout(() => {
        processBotBids(game);
        const humanPlayers      = game.players.filter(p => !p.isBot);
        const humanBidsComplete = humanPlayers.every(p => p.bid !== null);
        if (humanBidsComplete && game.players.every(p => p.bid !== null)) {
            startPlayAfterBidding(roomId);
        }
    }, 500);
}

/**
 * After all bids are in, transition into the playing phase **without re-dealing**.
 */
function startPlayAfterBidding(roomId) {
    const game = games[roomId];
    if (!game) return;
    console.log(`Starting play for game ${roomId}`);
    io.to(roomId).emit('roundStarted');

    setTimeout(() => {
        const g = games[roomId];
        if (!g) return;
        const player = g.players[g.currentTurn];
        if (player && player.isBot) {
            processBotTurns(roomId);
        }
    }, 2000);
}


/**
 * Legacy function: previously dealt cards and started play simultaneously.  It is
 * retained for reference but is no longer used for normal rounds since dealing
 * now occurs in startBidding.
 */
function dealAndStart(roomId) {
    const game = games[roomId];
    if (!game) return;

    console.log(`Dealing cards for game ${roomId}`);
    game.createDeck();
    game.shuffleDeck();
    game.dealCards();

    game.players.forEach((player, idx) => {
        if (!player.isBot) {
            io.to(player.id).emit('dealCards', { hand: player.hand, seat: idx });
        }
    });

    io.to(roomId).emit('roundStarted');
    setTimeout(() => processBotTurns(roomId), 2000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Spades game server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to play!`);
});
