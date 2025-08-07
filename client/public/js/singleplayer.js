// singleplayer.js - Complete single player game implementation

if (window.location.search.includes('mode=single')) {
    console.log('Starting single player mode...');

    // Game state
    let gameState = {
        players: [[], [], [], []], // 0 = human, 1-3 = AI
        playerNames: ['You', 'North', 'East', 'South'],
        bids: [null, null, null, null],
        tricks: [0, 0, 0, 0],
        currentTrick: [],
        currentPlayer: 0,
        trickSuit: null,
        spadesBroken: false,
        scores: [0, 0], // Team scores [team1, team2]
        bags: [0, 0],
        phase: 'bidding' // bidding, playing, roundEnd
    };

    // Initialize game when page loads
    document.addEventListener('DOMContentLoaded', function() {
        initializeGame();
    });

    function initializeGame() {
        console.log('Initializing single player game...');
        dealCards();
        startBiddingPhase();
        updateDisplay();
    }

    function dealCards() {
        const deck = shuffleDeck(createDeck());

        // Clear all hands
        gameState.players = [[], [], [], []];

        // Deal 13 cards to each player
        for (let i = 0; i < 52; i++) {
            gameState.players[i % 4].push(deck[i]);
        }

        // Sort human player's hand
        gameState.players[0].sort((a, b) => {
            if (a.suit === b.suit) {
                return getRankValue(a.rank) - getRankValue(b.rank);
            }
            return a.suit.localeCompare(b.suit);
        });

        console.log('Cards dealt. Human hand:', gameState.players[0]);
        renderHand(gameState.players[0], 'yourHand');
    }

    function startBiddingPhase() {
        console.log('Starting bidding phase...');
        gameState.phase = 'bidding';
        gameState.currentPlayer = 0;

        // Show bidding interface for human player
        const biddingPhase = document.getElementById('biddingPhase');
        if (biddingPhase) {
            biddingPhase.classList.remove('hidden');
        }

        updateTurnIndicator('Your turn to bid');
    }

    function submitBid() {
        const bidInput = document.getElementById('bidInput');
        const blindNilCheck = document.getElementById('blindNil');

        if (!bidInput) return;

        const bid = parseInt(bidInput.value);
        const blindNil = blindNilCheck ? blindNilCheck.checked : false;

        if (isNaN(bid) || bid < 0 || bid > 13) {
            alert('Please enter a valid bid (0-13)');
            return;
        }

        // Set human player's bid
        gameState.bids[0] = blindNil ? 0 : bid;
        console.log(`Human bid: ${gameState.bids[0]}`);

        // Hide bidding interface
        const biddingPhase = document.getElementById('biddingPhase');
        if (biddingPhase) {
            biddingPhase.classList.add('hidden');
        }

        // Clear bid input
        bidInput.value = '';
        if (blindNilCheck) blindNilCheck.checked = false;

        // Process AI bids
        processAIBids();
    }

    function processAIBids() {
        // Simple AI bidding logic
        for (let i = 1; i < 4; i++) {
            const hand = gameState.players[i];
            let bid = 0;

            // Count high cards and spades
            hand.forEach(card => {
                const rankValue = getRankValue(card.rank);
                if (card.suit === '♠') bid += 0.8; // Spades are valuable
                else if (rankValue >= 12) bid += 0.6; // High cards
                else if (rankValue >= 10) bid += 0.3; // Medium cards
            });

            gameState.bids[i] = Math.max(0, Math.min(13, Math.round(bid)));
        }

        console.log('All bids:', gameState.bids);
        showMessage(`Bids: You: ${gameState.bids[0]}, North: ${gameState.bids[1]}, East: ${gameState.bids[2]}, South: ${gameState.bids[3]}`);

        // Start playing phase
        setTimeout(() => {
            startPlayingPhase();
        }, 2000);
    }

    function startPlayingPhase() {
        console.log('Starting playing phase...');
        gameState.phase = 'playing';
        gameState.currentPlayer = 0; // Human starts first trick
        gameState.currentTrick = [];
        gameState.trickSuit = null;

        updateDisplay();
        updatePlayableCards();
    }

    function updateDisplay() {
        updateTurnIndicator();
        updateScoreboard(gameState.scores, gameState.bags);
    }

    function updateTurnIndicator(message) {
        const indicator = document.getElementById('turnIndicator');
        if (!indicator) return;

        if (message) {
            indicator.textContent = message;
        } else if (gameState.phase === 'playing') {
            if (gameState.currentPlayer === 0) {
                indicator.textContent = 'Your turn - Click a card to play';
            } else {
                indicator.textContent = `${gameState.playerNames[gameState.currentPlayer]}'s turn`;
            }
        }
    }

    function updatePlayableCards() {
        if (gameState.phase !== 'playing' || gameState.currentPlayer !== 0) return;

        const handElement = document.getElementById('yourHand');
        if (!handElement) return;

        const cards = handElement.querySelectorAll('.card');
        const humanHand = gameState.players[0];

        cards.forEach((cardElement, index) => {
            if (index >= humanHand.length) return;

            const card = humanHand[index];
            const isPlayable = isCardPlayable(card);

            cardElement.classList.remove('unplayable');
            cardElement.onclick = null;

            if (isPlayable) {
                cardElement.style.cursor = 'pointer';
                cardElement.onclick = () => playCard(0, index);
            } else {
                cardElement.classList.add('unplayable');
                cardElement.style.cursor = 'not-allowed';
            }
        });
    }

    function isCardPlayable(card) {
        if (!gameState.trickSuit) return true; // First card of trick

        const humanHand = gameState.players[0];
        const hasTrickSuit = humanHand.some(c => c.suit === gameState.trickSuit);

        if (hasTrickSuit) {
            return card.suit === gameState.trickSuit;
        }

        return true; // Can play any card if no trick suit in hand
    }

    function playCard(playerIndex, cardIndex) {
        if (gameState.phase !== 'playing') return;
        if (playerIndex !== gameState.currentPlayer) return;

        const player = gameState.players[playerIndex];
        if (!player || cardIndex >= player.length) return;

        const card = player[cardIndex];
        console.log(`Player ${playerIndex} plays:`, card);

        // Validate play
        if (playerIndex === 0 && !isCardPlayable(card)) {
            alert('Invalid card play!');
            return;
        }

        // Remove card from hand
        player.splice(cardIndex, 1);

        // Set trick suit for first card
        if (gameState.currentTrick.length === 0) {
            gameState.trickSuit = card.suit;
        }

        // Break spades if played
        if (card.suit === '♠') {
            gameState.spadesBroken = true;
        }

        // Add to current trick
        gameState.currentTrick.push({
            player: playerIndex,
            card: card
        });

        // Display played card
        displayPlayedCard(card, playerIndex);

        // Update hand display for human player
        if (playerIndex === 0) {
            renderHand(gameState.players[0], 'yourHand');
        }

        // Check if trick is complete
        if (gameState.currentTrick.length === 4) {
            setTimeout(resolveTrick, 1000);
        } else {
            // Next player's turn
            gameState.currentPlayer = (gameState.currentPlayer + 1) % 4;
            updateDisplay();

            // If AI player, play automatically
            if (gameState.currentPlayer !== 0) {
                setTimeout(() => playAICard(), 1000);
            } else {
                updatePlayableCards();
            }
        }
    }

    function playAICard() {
        if (gameState.currentPlayer === 0) return;

        const playerIndex = gameState.currentPlayer;
        const hand = gameState.players[playerIndex];

        // Simple AI logic - play valid card
        let validCards = hand.slice();

        if (gameState.trickSuit) {
            const sameSuit = hand.filter(c => c.suit === gameState.trickSuit);
            if (sameSuit.length > 0) {
                validCards = sameSuit;
            }
        }

        // Choose random valid card (could be improved with better AI logic)
        const cardIndex = hand.findIndex(c => validCards.includes(c));

        if (cardIndex !== -1) {
            playCard(playerIndex, cardIndex);
        }
    }

    function displayPlayedCard(card, playerIndex) {
        const table = document.getElementById('centerTable');
        if (!table) return;

        const cardDiv = document.createElement('div');
        cardDiv.className = 'card played-card';
        cardDiv.textContent = cardToString(card);
        cardDiv.style.margin = '5px';

        table.appendChild(cardDiv);
    }

    function resolveTrick() {
        console.log('Resolving trick:', gameState.currentTrick);

        // Find winner
        let winner = gameState.currentTrick[0];

        gameState.currentTrick.forEach(play => {
            // Spade beats non-spade
            if (play.card.suit === '♠' && winner.card.suit !== '♠') {
                winner = play;
            }
            // Higher spade beats lower spade
            else if (play.card.suit === '♠' && winner.card.suit === '♠') {
                if (getRankValue(play.card.rank) > getRankValue(winner.card.rank)) {
                    winner = play;
                }
            }
            // Higher card of trick suit beats lower
            else if (play.card.suit === gameState.trickSuit && winner.card.suit === gameState.trickSuit) {
                if (getRankValue(play.card.rank) > getRankValue(winner.card.rank)) {
                    winner = play;
                }
            }
        });

        console.log(`${gameState.playerNames[winner.player]} wins the trick`);
        gameState.tricks[winner.player]++;

        showMessage(`${gameState.playerNames[winner.player]} wins the trick!`, 2000);

        // Clear table
        setTimeout(() => {
            const table = document.getElementById('centerTable');
            if (table) table.innerHTML = '';

            // Reset for next trick
            gameState.currentTrick = [];
            gameState.trickSuit = null;
            gameState.currentPlayer = winner.player;

            // Check if round is over
            if (gameState.players[0].length === 0) {
                endRound();
            } else {
                updateDisplay();
                if (gameState.currentPlayer === 0) {
                    updatePlayableCards();
                } else {
                    setTimeout(() => playAICard(), 1000);
                }
            }
        }, 2000);
    }

    function endRound() {
        console.log('Round ended. Calculating scores...');

        // Calculate team tricks
        const team1Tricks = gameState.tricks[0] + gameState.tricks[2]; // Human + South
        const team2Tricks = gameState.tricks[1] + gameState.tricks[3]; // North + East

        const team1Bid = gameState.bids[0] + gameState.bids[2];
        const team2Bid = gameState.bids[1] + gameState.bids[3];

        console.log(`Team 1: ${team1Tricks}/${team1Bid}, Team 2: ${team2Tricks}/${team2Bid}`);

        // Score calculation
        if (team1Tricks >= team1Bid) {
            gameState.scores[0] += team1Bid * 10 + (team1Tricks - team1Bid);
            gameState.bags[0] += team1Tricks - team1Bid;
        } else {
            gameState.scores[0] -= team1Bid * 10;
        }

        if (team2Tricks >= team2Bid) {
            gameState.scores[1] += team2Bid * 10 + (team2Tricks - team2Bid);
            gameState.bags[1] += team2Tricks - team2Bid;
        } else {
            gameState.scores[1] -= team2Bid * 10;
        }

        // Check for bag penalties
        if (gameState.bags[0] >= 10) {
            gameState.scores[0] -= 100;
            gameState.bags[0] -= 10;
        }
        if (gameState.bags[1] >= 10) {
            gameState.scores[1] -= 100;
            gameState.bags[1] -= 10;
        }

        updateDisplay();

        // Check for game end
        if (gameState.scores[0] >= 500 || gameState.scores[1] >= 500) {
            const winner = gameState.scores[0] >= 500 ? 'Your team' : 'Computer team';
            setTimeout(() => {
                alert(`${winner} wins the game! Final scores: Your team: ${gameState.scores[0]}, Computer team: ${gameState.scores[1]}`);
            }, 1000);
        } else {
            setTimeout(() => {
                if (confirm('Round complete! Start next round?')) {
                    startNewRound();
                }
            }, 2000);
        }
    }

    function startNewRound() {
        // Reset round state
        gameState.bids = [null, null, null, null];
        gameState.tricks = [0, 0, 0, 0];
        gameState.currentTrick = [];
        gameState.trickSuit = null;
        gameState.spadesBroken = false;

        // Clear table
        const table = document.getElementById('centerTable');
        if (table) table.innerHTML = '';

        // Start new round
        dealCards();
        startBiddingPhase();
    }

    // Add event listener for bid submission
    document.addEventListener('DOMContentLoaded', function() {
        const submitBidBtn = document.getElementById('submitBidBtn');
        if (submitBidBtn) {
            submitBidBtn.addEventListener('click', submitBid);
        }
    });

    // Expose submitBid function globally for button onclick
    window.submitBid = submitBid;

    console.log('Single player module loaded');
}
