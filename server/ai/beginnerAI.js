module.exports = class BeginnerAI {
    static bid(hand) {
        let bid = 0;
        hand.forEach(card => {
            const rankValue = this.getRankValue(card.rank);
            if (card.suit === '♠') {
                bid += (rankValue >= 12) ? 1 : 0.5;
            } else if (rankValue >= 12) {
                bid += 0.5;
            }
        });
        return Math.max(1, Math.min(6, Math.round(bid)));
    }

    static playCard(hand, leadSuit, spadesBroken) {
        // Filter valid cards
        let validCards = hand;
        
        if (leadSuit) {
            // Must follow suit if possible
            const suitCards = hand.filter(c => c.suit === leadSuit);
            if (suitCards.length > 0) {
                validCards = suitCards;
            }
        } else if (!spadesBroken) {
            // Cannot lead with spades unless broken or only spades left
            const nonSpades = hand.filter(c => c.suit !== '♠');
            if (nonSpades.length > 0) {
                validCards = nonSpades;
            }
        }
        
        // Return random valid card
        return validCards.length > 0 ? 
               validCards[Math.floor(Math.random() * validCards.length)] : 
               hand[0];
    }

    static getRankValue(rank) {
        const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
        return values[rank] || parseInt(rank);
    }
};
