// multiplayer.js - Fixed multiplayer client

// Only initialize if in multiplayer mode
if (window.location.search.includes('mode=multi')) {
    const socket = io();
    let roomId, playerId;
    let myHand = [], currentTurn = 0, currentTrickSuit = null;

    // Get parameters from URL
    const params = new URLSearchParams(window.location.search);
    roomId = params.get('roomId');
    const playerName = params.get('name');

    console.log('Multiplayer mode initialized', { roomId, playerName });

    // Auto-join room if parameters exist
    if (roomId && playerName) {
        socket.emit('joinGame', { roomId, name: playerName });
    }

    // Socket event handlers
    socket.on('gameCreated', ({ roomId: id, playerId: pid }) => {
        roomId = id;
        playerId = pid;
        console.log('Game created:', { roomId, playerId });
        showMessage(`Room created: ${roomId}`);
    });

    socket.on('joinedRoom', ({ roomId: id, playerId: pid }) => {
        roomId = id;
        playerId = pid;
        console.log('Joined room:', { roomId, playerId });
        showMessage(`Joined room: ${roomId}`);
    });

    socket.on('playerList', players => {
        console.log('Player list updated:', players);
        // Could display player list in UI if needed
        showMessage(`Players in room: ${players.length}/4`);

        // Auto-start when room is full
        if (players.length === 4) {
            showMessage('Room full! Starting game...', 2000);
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
        showMessage(`Current bids: ${bids.join(', ')}`, 2000);
    });

    socket.on('dealCards', (hand) => {
        console.log('Cards dealt:', hand);
        myHand = hand;

        // Sort hand
        myHand.sort((a, b) => {
            if (a.suit === b.suit) {
                return getRankValue(a.rank) - getRankValue(b.rank);
            }
            return a.suit.localeCompare(b.suit);
        });

        renderHand(myHand, 'yourHand');
        showMessage('Cards dealt! Waiting for all players...');
    });

    socket.on('roundStarted', () => {
        console.log('Round started');
        showMessage('Round started!', 2000);
        updatePlayableCards();
    });

    socket.on('cardPlayed', ({ playerIndex, card }) => {
        console.log(`Player ${playerIndex} played:`, card);

        // Display card on table
        const table = document.getElementById('centerTable');
        if (table) {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card played-card';
            cardDiv.textContent = cardToString(card);
            cardDiv.style.margin = '5px';
            table.appendChild(cardDiv);
        }

        // Update current trick suit
        if (table && table.children.length === 1) {
            currentTrickSuit = card.suit;
        }

        updatePlayableCards();
    });

    socket.on('trickWinner', ({ winner }) => {
        console.log('Trick winner:', winner);
        showMessage(`Player ${winner} wins the trick!`, 2000);

        setTimeout(() => {
            const table = document.getElementById('centerTable');
            if (table) table.innerHTML = '';
            currentTrickSuit = null;
            updatePlayableCards();
        }, 2000);
    });

    socket.on('gameOver', ({ scores }) => {
        console.log('Game over:', scores);
        updateScoreboard(scores, [0, 0]); // Assuming no bag info
        showMessage('Game Over!');
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
            const isPlayable = checkCardPlayable(card);

            cardElement.classList.remove('unplayable');
            cardElement.onclick = null;

            if (isPlayable) {
                cardElement.style.cursor = 'pointer';
                cardElement.onclick = () => playCard(card, index);
            } else {
                cardElement.classList.add('unplayable');
                cardElement.style.cursor = 'not-allowed';
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

    function playCard(card, index) {
        if (!roomId) return;

        console.log('Playing card:', card);

        // Remove from hand
        myHand.splice(index, 1);

        // Send to server
        socket.emit('playCard', { roomId, card });

        // Update display
        renderHand(myHand, 'yourHand');
        updatePlayableCards();
    }

    function submitBid() {
        const bidInput = document.getElementById('bidInput');
        const blindNilCheck = document.getElementById('blindNil');

        if (!bidInput || !roomId) return;

        const bid = parseInt(bidInput.value);
        const blindNil = blindNilCheck ? blindNilCheck.checked : false;

        if (isNaN(bid) || bid < 0 || bid > 13) {
            alert('Please enter a valid bid (0-13)');
            return;
        }

        console.log('Submitting bid:', { bid, blindNil });
        socket.emit('bid', { roomId, bid, blindNil });

        // Hide bidding interface
        const biddingPhase = document.getElementById('biddingPhase');
        if (biddingPhase) {
            biddingPhase.classList.add('hidden');
        }

        // Clear input
        bidInput.value = '';
        if (blindNilCheck) blindNilCheck.checked = false;

        updateTurnIndicator('Waiting for other players to bid...');
    }

    // Event listeners
    document.addEventListener('DOMContentLoaded', function() {
        const submitBidBtn = document.getElementById('submitBidBtn');
        if (submitBidBtn) {
            submitBidBtn.addEventListener('click', submitBid);
        }
    });

    // Expose functions globally
    window.submitBid = submitBid;

    console.log('Multiplayer module loaded');
}
