// multiplayer.js - Clean multiplayer client

// Only initialize if in multiplayer mode
if (window.location.search.includes('mode=multi')) {
    console.log('Initializing multiplayer...');
    
    const socket = io();
    let roomId, playerId;
    let myHand = [], currentTurn = 0, currentTrickSuit = null;

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
        roomId = id;
        playerId = pid;
        console.log('Room created successfully:', { roomId, playerId });
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

    socket.on('dealCards', (hand) => {
        console.log('Cards dealt:', hand);
        myHand = hand;
        
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
            currentTrickSuit = card.suit;
        }
        
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
            currentTrickSuit = null;
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
        if (!currentTrickSuit) return true;
        const hasSuit = myHand.some(c => c.suit === currentTrickSuit);
        return hasSuit ? card.suit === currentTrickSuit : true;
    }

    function playCard(card, index) {
        if (!roomId) return;
        
        console.log('Playing card:', card);
        myHand.splice(index, 1);
        socket.emit('playCard', { roomId, card });
        
        if (typeof renderHand === 'function') {
            renderHand(myHand, 'yourHand');
        }
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
        const submitBidBtn = document.getElementById('submitBidBtn');
        if (submitBidBtn) {
            submitBidBtn.addEventListener('click', submitBid);
        }
    });

    // Expose functions globally
    window.submitBid = submitBid;
    
    console.log('Multiplayer module loaded');
}
