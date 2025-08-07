const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const SpadesGame = require('./gameEngine');
const BeginnerAI = require('./ai/beginnerAI');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
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
            console.log(`Creating game ${roomId} for ${name}`);
            games[roomId] = new SpadesGame();
            games[roomId].addPlayer({ id: socket.id, name, isBot: false });
            socket.join(roomId);
            
            // DON'T fill with bots automatically - wait for real players
            io.to(socket.id).emit('gameCreated', { roomId, playerId: socket.id });
            io.to(roomId).emit('playerList', games[roomId].players);
            console.log(`Game ${roomId} created, waiting for more players`);
            
        } catch (error) {
            console.error('Error creating game:', error);
            socket.emit('errorMessage', 'Failed to create game');
        }
    });

    socket.on('joinGame', ({ roomId, name }) => {
        try {
            const game = games[roomId];
            if (!game) {
                socket.emit('errorMessage', 'Room not found');
                return;
            }

            // Count human players only
            const humanPlayers = game.players.filter(p => !p.isBot);
            if (humanPlayers.length >= 4) {
                socket.emit('errorMessage', 'Room is full');
                return;
            }

            console.log(`${name} joining game ${roomId}`);
            game.addPlayer({ id: socket.id, name, isBot: false });
            socket.join(roomId);
            io.to(socket.id).emit('joinedRoom', { roomId, playerId: socket.id });
            io.to(roomId).emit('playerList', game.players);

            // Only start game when we have 4 human players, or fill remaining with bots
            const currentHumans = game.players.filter(p => !p.isBot);
            if (currentHumans.length === 4) {
                console.log(`Game ${roomId} has 4 human players, starting game`);
                setTimeout(() => {
                    startBidding(roomId);
                }, 1000);
            } else {
                console.log(`Game ${roomId} has ${currentHumans.length}/4 players, waiting for more`);
                // For now, fill remaining slots with bots for testing
                while (game.players.length < 4) {
                    const botIndex = game.players.length;
                    game.addPlayer({
                        id: `bot_${botIndex}`,
                        name: `Bot ${botIndex}`,
                        isBot: true
                    });
                }
                
                if (currentHumans.length >= 1 && game.players.length === 4) {
                    console.log(`Game ${roomId} filled with bots, starting game`);
                    io.to(roomId).emit('playerList', game.players);
                    setTimeout(() => {
                        startBidding(roomId);
                    }, 1000);
                }
            }

        } catch (error) {
            console.error('Error joining game:', error);
            socket.emit('errorMessage', 'Failed to join game');
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
            
            // Process bot bids
            processBotBids(game);
            
            io.to(roomId).emit('bidsUpdate', game.players.map(p => p.bid));
            
            if (game.players.every(p => p.bid !== null)) {
                console.log(`All bids received for game ${roomId}, dealing cards`);
                setTimeout(() => {
                    dealAndStart(roomId);
                }, 1000);
            }

        } catch (error) {
            console.error('Error processing bid:', error);
            socket.emit('errorMessage', 'Failed to process bid');
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
                
                // Check if round is over
                if (game.players[0].hand.length === 0) {
                    game.calculateScores();
                    if (game.isGameOver()) {
                        const winningTeam = game.scores[0] >= 500 ? 0 : 1;
                        io.to(roomId).emit('gameOver', { scores: game.scores, winner: winningTeam });
                    } else {
                        // Start new round
                        setTimeout(() => {
                            game.resetRound();
                            startBidding(roomId);
                        }, 3000);
                    }
                } else {
                    // Continue with next player or bot
                    setTimeout(() => {
                        processBotTurns(roomId);
                    }, 1000);
                }
            } else {
                // Continue with next player or bot
                setTimeout(() => {
                    processBotTurns(roomId);
                }, 1000);
            }

        } catch (err) {
            console.error('Error playing card:', err);
            io.to(socket.id).emit('errorMessage', err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        // Clean up games with disconnected players
        for (const roomId in games) {
            const game = games[roomId];
            const playerIndex = game.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                console.log(`Removing player from game ${roomId}`);
                game.players.splice(playerIndex, 1);
                io.to(roomId).emit('playerList', game.players);
                
                // If no human players left, delete the game
                const humanPlayers = game.players.filter(p => !p.isBot);
                if (humanPlayers.length === 0) {
                    delete games[roomId];
                    console.log(`Game ${roomId} deleted - no human players`);
                }
            }
        }
    });
});

function processBotBids(game) {
    game.players.forEach((player, index) => {
        if (player.isBot && player.bid === null) {
            // Improved bot bidding - actually count tricks they can likely take
            const hand = player.hand;
            let bid = 0;
            
            // Count high cards and spades
            hand.forEach(card => {
                const rankValue = getRankValue(card.rank);
                if (card.suit === '♠') {
                    bid += (rankValue >= 12) ? 1 : 0.5; // High spades are worth more
                } else if (rankValue >= 12) {
                    bid += 0.5; // High cards in other suits
                }
            });
            
            bid = Math.max(1, Math.min(6, Math.round(bid))); // Bid between 1-6
            game.setBid(index, bid, false);
            console.log(`Bot ${index} bids ${bid}`);
        }
    });
}

function getRankValue(rank) {
    const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
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
        
        const leadSuit = game.currentTrick.length > 0 ? game.currentTrick[0].card.suit : null;
        const card = BeginnerAI.playCard(hand, leadSuit, game.spadesBroken);
        
        if (card) {
            try {
                const winner = game.playCard(game.currentTurn, card);
                io.to(roomId).emit('cardPlayed', { playerIndex: game.currentTurn, card });
                
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
                        setTimeout(() => {
                            processBotTurns(roomId);
                        }, 1000);
                    }
                } else {
                    setTimeout(() => {
                        processBotTurns(roomId);
                    }, 1000);
                }
            } catch (error) {
                console.error('Bot play error:', error);
            }
        }
    }
}

function startBidding(roomId) {
    const game = games[roomId];
    if (!game) return;
    
    console.log(`Starting bidding for game ${roomId}`);
    io.to(roomId).emit('biddingStart');
    
    // Process bot bids immediately
    setTimeout(() => {
        processBotBids(game);
        
        // Check if all bids are complete (human player still needs to bid)
        const humanPlayers = game.players.filter(p => !p.isBot);
        const humanBidsComplete = humanPlayers.every(p => p.bid !== null);
        
        if (humanBidsComplete && game.players.every(p => p.bid !== null)) {
            dealAndStart(roomId);
        }
    }, 500);
}

function dealAndStart(roomId) {
    const game = games[roomId];
    if (!game) return;
    
    console.log(`Dealing cards for game ${roomId}`);
    game.createDeck();
    game.shuffleDeck();
    game.dealCards();
    
    // Send cards to human players only
    game.players.forEach((player, index) => {
        if (!player.isBot) {
            io.to(player.id).emit('dealCards', player.hand);
        }
    });
    
    io.to(roomId).emit('roundStarted');
    
    // Start first turn
    setTimeout(() => {
        processBotTurns(roomId);
    }, 2000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Spades game server running on port ${PORT}`);
    console.log('Visit http://localhost:' + PORT + ' to play!');
});
