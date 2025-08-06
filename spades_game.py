import random

# ------------------ CARD AND DECK ------------------
SUITS = ['♠', '♥', '♦', '♣']
RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

class Card:
    def __init__(self, suit, rank):
        self.suit = suit
        self.rank = rank
        self.value = RANKS.index(rank)

    def __str__(self):
        return f"{self.rank}{self.suit}"

class Deck:
    def __init__(self):
        self.cards = [Card(suit, rank) for suit in SUITS for rank in RANKS]

    def shuffle(self):
        random.shuffle(self.cards)

    def deal(self, num_players):
        return [self.cards[i::num_players] for i in range(num_players)]

# ------------------ PLAYER ------------------
class Player:
    def __init__(self, name, is_human=False):
        self.name = name
        self.hand = []
        self.bid = 0
        self.tricks_won = 0
        self.score = 0
        self.is_human = is_human

    def make_bid(self):
        if self.is_human:
            while True:
                try:
                    bid = int(input(f"{self.name}, enter your bid (0-13): "))
                    if 0 <= bid <= 13:
                        self.bid = bid
                        break
                except ValueError:
                    pass
                print("Invalid input. Try again.")
        else:
            self.bid = random.randint(1, 5)
        print(f"{self.name} bids {self.bid}")

    def play_card(self, lead_suit=None, spades_broken=False):
        if self.is_human:
            while True:
                print("Your hand:", ', '.join(str(c) for c in self.hand))
                choice = input(f"{self.name}, choose a card to play: ")
                chosen_card = next((c for c in self.hand if str(c) == choice), None)
                if chosen_card:
                    if lead_suit and chosen_card.suit != lead_suit and any(c.suit == lead_suit for c in self.hand):
                        print("You must follow the lead suit.")
                        continue
                    if lead_suit is None and chosen_card.suit == '♠' and not spades_broken and any(c.suit != '♠' for c in self.hand):
                        print("Cannot lead with spades until broken.")
                        continue
                    self.hand.remove(chosen_card)
                    return chosen_card
                print("Invalid card selection. Try again.")
        else:
            playable = self.hand
            if lead_suit:
                suit_cards = [c for c in self.hand if c.suit == lead_suit]
                if suit_cards:
                    playable = suit_cards
            if lead_suit is None and not spades_broken:
                non_spades = [c for c in self.hand if c.suit != '♠']
                if non_spades:
                    playable = non_spades
            card = random.choice(playable)
            self.hand.remove(card)
            print(f"{self.name} plays {card}")
            return card

# ------------------ GAME ------------------
class SpadesGame:
    def __init__(self):
        self.players = [
            Player("Player 1", is_human=True),
            Player("Player 2"),
            Player("Player 3"),
            Player("Player 4")
        ]
        self.spades_broken = False

    def play_round(self):
        deck = Deck()
        deck.shuffle()
        hands = deck.deal(4)
        for i, player in enumerate(self.players):
            player.hand = hands[i]
            player.tricks_won = 0

        for player in self.players:
            player.make_bid()

        lead_index = 0
        for _ in range(13):
            lead_index = self.play_trick(lead_index)

        self.update_scores()
        self.display_scores()

    def play_trick(self, lead_index):
        table = []
        lead_suit = None
        winner_index = lead_index
        winning_card = None

        for i in range(4):
            player_index = (lead_index + i) % 4
            player = self.players[player_index]
            card = player.play_card(lead_suit, self.spades_broken)
            if card.suit == '♠':
                self.spades_broken = True
            if i == 0:
                lead_suit = card.suit
                winning_card = card
            else:
                if self.compare_cards(card, winning_card, lead_suit):
                    winning_card = card
                    winner_index = player_index
            table.append((player_index, card))

        self.players[winner_index].tricks_won += 1
        print(f"{self.players[winner_index].name} wins the trick\n")
        return winner_index

    def compare_cards(self, card, winning_card, lead_suit):
        if card.suit == winning_card.suit and card.value > winning_card.value:
            return True
        if card.suit == '♠' and winning_card.suit != '♠':
            return True
        return False

    def update_scores(self):
        for player in self.players:
            if player.tricks_won >= player.bid:
                player.score += 10 * player.bid + (player.tricks_won - player.bid)
            else:
                player.score -= 10 * player.bid

    def display_scores(self):
        print("Final Scores after Round:")
        for player in self.players:
            print(f"{player.name}: {player.score} points")
        print("-"*40)

# ------------------ RUN GAME ------------------
if __name__ == "__main__":
    game = SpadesGame()
    for round_num in range(1, 4):  # play 3 rounds
        print(f"===== ROUND {round_num} =====")
        game.play_round()
