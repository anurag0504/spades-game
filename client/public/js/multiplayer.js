// multiplayer.js - Clean multiplayer client

// Only initialize if in multiplayer mode
if (window.location.search.includes('mode=multi')) {
    console.log('Initializing multiplayer...');
    
    const socket = io();
    let roomId, playerId;
    // mySeat is the player's seat index (0–3).  Set after dealing cards.
    let mySeat = null;
    let myHand = [], currentTurn = 0, currentTrickSuit = null;
    // Track whether spades have been broken.  Spades cannot be led until broken.
    let spadesBroken = false;

    // Get parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('roomId');
    const playerName = urlParams.get('name');
    const isCreator = urlParams.get('creator') === 'true';

    console.log('Multiplayer mode initialized', { roomId, playerName, isCreator });

    // Handle room creation vs joining
    if (isCreator && playerName) {
        console.log('Creating room as:', playerName);
        socket.emit('createGame', { name: playerName });
    } else if (roomId && playerName) {
        console.log('Joining room:', roomId, 'as:', playerName);
        socket.emit('joinGame', { roomId, name: playerName });
    } else {
        console.log('Missing required parameters');
        if (typeof showMessage === 'function') {
            showMessage('Missing room information');
        } else {
            alert('Missing room information');
        }
    }

    // Socket event handlers
    socket.on('gameCreated', ({ roomId: id, playerId: pid }) => {
        roomId   = id;
        playerId = pid;
        console.log('Room created successfully:', { roomId, playerId });

        // Update the URL with the actual room ID so it can be shared
        try {
            const params = new URLSearchParams({
                mode: 'multi',
                roomId: roomId,
                name: playerName,
                creator: 'false'
            });
            window.history.replaceState(null, '', 'game.html?' + params.toString());
        } catch (err) {
            console.warn('Failed to update URL with room ID:', err);
        }

        if (typeof showMessage === 'function') {
            showMessage(`Room created: ${roomId}. Share this ID with others!`);
        } else {
            alert(`Room created: ${roomId}. Share this ID with others!`);
        }
    });

    socket.on('joinedRoom', ({ roomId: id, playerId: pid }) => {
        roomId = id;
        playerId = pid;
        console.log('Successfully joined room:', { roomId, playerId });
        if (typeof showMessage === 'function') {
            showMessage(`Joined room: ${roomId}`);
        } else {
            alert(`Joined room: ${roomId}`);
        }
    });

    socket.on('playerList', players => {
        console.log('Player list updated:', players);
        const humanPlayers = players.filter(p => !p.isBot);
        if (typeof showMessage === 'function') {
            showMessage(`Players in room: ${humanPlayers.length}/4`);
        } else {
            console.log(`Players in room: ${humanPlayers.length}/4`);
        }
        
        if (humanPlayers.length === 4) {
            if (typeof showMessage === 'function') {
                showMessage('Room full! Starting game...', 2000);
            }
        }
        // Enable or disable the start button for the creator
        if (isCreator) {
            const startBtn = document.getElementById('startGameBtn');
            if (startBtn) {
                // Disable if room is full
                startBtn.disabled = humanPlayers.length >= 4;
            }
        }
    });

    socket.on('biddingStart', () => {
        console.log('Bidding started');
        const biddingPhase = document.getElementById('biddingPhase');
        if (biddingPhase) {
            biddingPhase.classList.remove('hidden');
        }
        updateTurnIndicator('Your turn to bid');
    });

    socket.on('bidsUpdate', (bids) => {
        console.log('Bids updated:', bids);
        if (typeof showMessage === 'function') {
            showMessage(`Current bids: ${bids.join(', ')}`, 2000);
        }
    });

    socket.on('dealCards', (payload) => {
        // Payload may be either an array (legacy) or an object with hand and seat
        let hand, seat;
        if (Array.isArray(payload)) {
            hand = payload;
            seat = null;
        } else {
            hand = payload.hand;
            seat = payload.seat;
        }
        console.log('Cards dealt:', hand, 'seat:', seat);
        myHand = hand;
        if (seat !== undefined && seat !== null) {
            mySeat = seat;
        }

        // Sort hand
        if (typeof getRankValue === 'function') {
            myHand.sort((a, b) => {
                if (a.suit === b.suit) {
                    return getRankValue(a.rank) - getRankValue(b.rank);
                }
                return a.suit.localeCompare(b.suit);
            });
        }

        if (typeof renderHand === 'function') {
            renderHand(myHand, 'yourHand');
        }
        if (typeof showMessage === 'function') {
            showMessage('Cards dealt! Game starting...');
        }
    });

    socket.on('roundStarted', () => {
        console.log('Round started');
        // Reset spadesBroken at the start of each round
        spadesBroken = false;
        if (typeof showMessage === 'function') {
            showMessage('Round started!', 2000);
        }
        updatePlayableCards();
    });

    socket.on('cardPlayed', ({ playerIndex, card }) => {
        console.log(`Player ${playerIndex} played:`, card);
        
        const table = document.getElementById('centerTable');
        if (table) {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card played-card';
            cardDiv.textContent = typeof cardToString === 'function' ? cardToString(card) : `${card.rank}${card.suit}`;
            cardDiv.style.margin = '5px';
            table.appendChild(cardDiv);
        }
        
        if (table && table.children.length === 1) {
            // First card of the trick sets the suit
            currentTrickSuit = card.suit;
        }

        // If a spade is played by any player, spades are now broken
        if (card.suit === '♠') {
            spadesBroken = true;
        }

        // Move to the next player's turn
        currentTurn = (playerIndex + 1) % 4;

        updatePlayableCards();
    });

    socket.on('trickWinner', ({ winner }) => {
        console.log('Trick winner:', winner);
        if (typeof showMessage === 'function') {
            showMessage(`Player ${winner} wins the trick!`, 2000);
        }
        
        setTimeout(() => {
            const table = document.getElementById('centerTable');
            if (table) table.innerHTML = '';
            // Reset trick suit and assign the next turn to the winner
            currentTrickSuit = null;
            currentTurn = winner;
            updatePlayableCards();
        }, 2000);
    });

    socket.on('gameOver', ({ scores }) => {
        console.log('Game over:', scores);
        if (typeof updateScoreboard === 'function') {
            updateScoreboard(scores, [0, 0]);
        }
        if (typeof showMessage === 'function') {
            showMessage('Game Over!');
        }
    });

    socket.on('errorMessage', (message) => {
        console.error('Server error:', message);
        alert(`Error: ${message}`);
    });

    // UI Functions
    function updateTurnIndicator(message) {
        const indicator = document.getElementById('turnIndicator');
        if (indicator) {
            indicator.textContent = message || 'Waiting...';
        }
    }

    function updatePlayableCards() {
        const handArea = document.getElementById('yourHand');
        if (!handArea) return;

        const cards = handArea.querySelectorAll('.card');

        cards.forEach((cardElement, index) => {
            if (index >= myHand.length) return;

            const card = myHand[index];
            // Only the player whose turn it is may interact
            const turnMatchesSeat = mySeat !== null && currentTurn === mySeat;
            const isPlayable       = checkCardPlayable(card);

            cardElement.classList.remove('unplayable');
            cardElement.onclick = null;

            if (turnMatchesSeat && isPlayable) {
                cardElement.style.cursor = 'pointer';
                cardElement.onclick = () => playCard(card, index);
            } else {
                cardElement.classList.add('unplayable');
                cardElement.style.cursor = 'not-allowed';
            }
        });
    }

    function checkCardPlayable(card) {
        /**
         * Determine if a card is playable in the current trick.
         *
         * - If no suit has been led, the player is leading.  In this case,
         *   they may not lead spades until spades have been broken unless
         *   they have only spades left in their hand.
         * - If a suit has been led, the player must follow that suit if
         *   they have any cards of that suit.
         */
        // No suit led yet: you are leading the trick
        if (!currentTrickSuit) {
            // If spades not broken and the card is a spade, check if you have any non‑spade cards
            if (!spadesBroken && card.suit === '♠') {
                const hasNonSpade = myHand.some(c => c.suit !== '♠');
                if (hasNonSpade) {
                    return false;
                }
            }
            return true;
        }
        // A suit has been led: follow suit if possible
        const hasSuit = myHand.some(c => c.suit === currentTrickSuit);
        if (hasSuit) {
            return card.suit === currentTrickSuit;
        }
        // If you don't have the lead suit, any card is allowed
        return true;
    }

    function playCard(card, index) {
        if (!roomId) return;

        console.log('Playing card:', card);
        // Remove card from local hand
        myHand.splice(index, 1);

        // If we play a spade, mark spades as broken
        if (card.suit === '♠') {
            spadesBroken = true;
        }

        // Emit play to server
        socket.emit('playCard', { roomId, card });

        // After playing, optimistically move to the next turn locally
        currentTurn = (currentTurn + 1) % 4;

        // Re-render the hand and update playable indicators
        if (typeof renderHand === 'function') {
            renderHand(myHand, 'yourHand');
        }
        updatePlayableCards();
    }

    function submitBid() {
        const bidInput      = document.getElementById('bidInput');
        const blindNilCheck = document.getElementById('blindNil');

        if (!bidInput || !roomId) return;

        const rawValue = bidInput.value.trim();
        const bid      = Number(rawValue);
        const blindNil = blindNilCheck ? blindNilCheck.checked : false;

        if (!Number.isInteger(bid) || bid < 0 || bid > 13) {
            alert('Please enter a valid bid (0–13)');
            return;
        }

        console.log('Submitting bid:', { bid, blindNil });
        socket.emit('bid', { roomId, bid, blindNil });

        const biddingPhase = document.getElementById('biddingPhase');
        if (biddingPhase) {
            biddingPhase.classList.add('hidden');
        }

        bidInput.value = '';
        if (blindNilCheck) blindNilCheck.checked = false;

        updateTurnIndicator('Waiting for other players to bid...');
    }

    // Event listeners
    document.addEventListener('DOMContentLoaded', function() {
        // Attach bid submission handler
        const submitBidBtn = document.getElementById('submitBidBtn');
        if (submitBidBtn) {
            submitBidBtn.addEventListener('click', submitBid);
        }

        // If this client is the room creator, show the start button
        const startBtn = document.getElementById('startGameBtn');
        if (startBtn && isCreator) {
            startBtn.classList.remove('hidden');
            startBtn.disabled = false;
            startBtn.addEventListener('click', function() {
                if (roomId) {
                    // Send start signal to server; disable the button to prevent repeats
                    socket.emit('startGame', { roomId });
                    startBtn.disabled = true;
                }
            });
        }
    });

    // Expose functions globally
    window.submitBid = submitBid;
    
    console.log('Multiplayer module loaded');
}
