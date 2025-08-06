class SpadesGame {
    constructor() {
      this.players = [];
      this.teams = [[0, 2], [1, 3]];
      this.scores = [0, 0];
      this.bags = [0, 0];
      this.spadesBroken = false;
      this.currentTrick = [];
      this.currentTurn = 0;
      this.deck = [];
      this.ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    }
  
    addPlayer(player) {
      if (this.players.length < 4) {
        this.players.push({ ...player, hand: [], bid: null, tricks: 0, blindNil: false });
      }
    }
  
    createDeck() {
      const suits = ['♠', '♥', '♦', '♣'];
      this.deck = [];
      suits.forEach(suit => this.ranks.forEach(rank => {
        this.deck.push({ suit, rank });
      }));
    }
  
    shuffleDeck() {
      for (let i = this.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
      }
    }
  
    dealCards() {
      this.players.forEach((p, i) => {
        p.hand = this.deck.slice(i * 13, (i + 1) * 13);
        p.tricks = 0;
      });
    }
  
    setBid(playerIndex, bid, blindNil = false) {
      this.players[playerIndex].bid = bid;
      this.players[playerIndex].blindNil = blindNil;
    }
  
    playCard(playerIndex, card) {
      const player = this.players[playerIndex];
  
      // Must follow suit if possible
      const leadSuit = this.currentTrick.length > 0 ? this.currentTrick[0].card.suit : null;
      if (leadSuit) {
        const hasSuit = player.hand.some(c => c.suit === leadSuit);
        if (hasSuit && card.suit !== leadSuit) {
          throw new Error("You must follow suit");
        }
      }
  
      // Cannot lead Spades unless broken or no other cards
      if (!this.spadesBroken && !leadSuit && card.suit === '♠') {
        const nonSpades = player.hand.filter(c => c.suit !== '♠');
        if (nonSpades.length > 0) {
          throw new Error("Cannot lead Spades until broken");
        }
      }
  
      // Play the card
      player.hand = player.hand.filter(c => !(c.suit === card.suit && c.rank === card.rank));
      if (card.suit === '♠') this.spadesBroken = true;
  
      this.currentTrick.push({ playerIndex, card });
  
      if (this.currentTrick.length === 4) {
        return this.resolveTrick();
      }
  
      this.currentTurn = (this.currentTurn + 1) % 4;
      return null;
    }
  
    resolveTrick() {
      const leadSuit = this.currentTrick[0].card.suit;
      let winningPlay = this.currentTrick[0];
  
      this.currentTrick.forEach(play => {
        if (play.card.suit === '♠' && winningPlay.card.suit !== '♠') {
          winningPlay = play;
        } else if (
          play.card.suit === winningPlay.card.suit &&
          this.ranks.indexOf(play.card.rank) > this.ranks.indexOf(winningPlay.card.rank)
        ) {
          winningPlay = play;
        }
      });
  
      this.players[winningPlay.playerIndex].tricks++;
      this.currentTurn = winningPlay.playerIndex;
      this.currentTrick = [];
      return winningPlay.playerIndex;
    }
  
    calculateScores() {
      const teamTricks = [
        this.players[0].tricks + this.players[2].tricks,
        this.players[1].tricks + this.players[3].tricks
      ];
      const teamBids = [
        this.players[0].bid + this.players[2].bid,
        this.players[1].bid + this.players[3].bid
      ];
  
      teamTricks.forEach((tricks, i) => {
        if (tricks >= teamBids[i]) {
          this.scores[i] += teamBids[i] * 10;
          const bags = tricks - teamBids[i];
          this.bags[i] += bags;
          this.scores[i] += bags;
          if (this.bags[i] >= 10) {
            this.scores[i] -= 100;
            this.bags[i] = 0;
          }
        } else {
          this.scores[i] -= teamBids[i] * 10;
        }
      });
  
      this.players.forEach((p, i) => {
        const team = i % 2;
        if (p.blindNil) {
          this.scores[team] += p.tricks === 0 ? 200 : -200;
        } else if (p.bid === 0) {
          this.scores[team] += p.tricks === 0 ? 100 : -100;
        }
      });
    }
  
    isGameOver() {
      return this.scores.some(score => score >= 500);
    }
  
    resetRound() {
      this.spadesBroken = false;
      this.players.forEach(p => {
        p.tricks = 0;
        p.bid = null;
        p.hand = [];
        p.blindNil = false;
      });
      this.currentTrick = [];
    }
  }
  
  module.exports = SpadesGame;
  