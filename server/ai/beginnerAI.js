module.exports = class BeginnerAI {
    static bid(hand) {
      return Math.floor(hand.length / 4);
    }
  
    static playCard(hand, leadSuit, spadesBroken) {
      const valid = leadSuit
        ? hand.filter(c => c.suit === leadSuit)
        : spadesBroken
          ? hand
          : hand.filter(c => c.suit !== '♠');
  
      return valid.length
        ? valid[Math.floor(Math.random() * valid.length)]
        : hand[0];
    }
  };
  