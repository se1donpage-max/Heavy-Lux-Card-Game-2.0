"use strict";

/*
=========================================================
HEAVY LUX CARD
DECK ENGINE
=========================================================

36 КАРТ
ПОДКИДНОЙ ДУРАК
БЕЗ ПЕРЕВОДА

Этот модуль отвечает только за колоду.

Он НЕ отвечает за:

- игроков
- ходы
- атаку
- защиту
- комнаты
- Socket.IO
- экономику
=========================================================
*/

const {
    SUITS,
    createDeck,
    isCard
} = require("./cards");


/*
=========================================================
DECK SIZE
=========================================================
*/

const DECK_SIZE = 36;


/*
=========================================================
SHUFFLE

Fisher-Yates.

Используем отдельную функцию,
чтобы вся логика перемешивания
находилась в одном месте.
=========================================================
*/

function shuffleDeck(deck) {

    if (!Array.isArray(deck)) {
        throw new Error(
            "Deck must be an array"
        );
    }

    const result = [...deck];

    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            result[i],
            result[j]
        ] = [
            result[j],
            result[i]
        ];

    }

    return result;
}


/*
=========================================================
CREATE SHUFFLED DECK
=========================================================
*/

function createShuffledDeck() {

    const deck =
        createDeck();

    if (
        deck.length !==
        DECK_SIZE
    ) {
        throw new Error(
            `Invalid deck size: ${deck.length}`
        );
    }

    return shuffleDeck(deck);
}


/*
=========================================================
GET TRUMP SUIT
=========================================================

В Дураке одна карта открывается
после раздачи.

Её масть становится козырной.

В нашем движке мы пока не привязываем
эту функцию к конкретному положению
карты в физической колоде.

Это будет делать Game Engine.
=========================================================
*/

function getTrumpSuit(card) {

    if (!isCard(card)) {
        throw new Error(
            "Invalid trump card"
        );
    }

    return card.suit;
}


/*
=========================================================
DRAW ONE CARD
=========================================================
*/

function drawCard(deck) {

    if (!Array.isArray(deck)) {
        throw new Error(
            "Deck must be an array"
        );
    }

    if (deck.length === 0) {
        return null;
    }

    return deck.pop();
}


/*
=========================================================
DRAW MULTIPLE CARDS
=========================================================
*/

function drawCards(
    deck,
    amount
) {

    if (!Array.isArray(deck)) {
        throw new Error(
            "Deck must be an array"
        );
    }

    if (
        !Number.isInteger(amount) ||
        amount < 0
    ) {
        throw new Error(
            "Amount must be a non-negative integer"
        );
    }

    const cards = [];

    for (
        let i = 0;
        i < amount;
        i++
    ) {

        const card =
            drawCard(deck);

        if (card === null) {
            break;
        }

        cards.push(card);
    }

    return cards;
}


/*
=========================================================
GET DECK SIZE
=========================================================
*/

function getDeckSize(deck) {

    if (!Array.isArray(deck)) {
        throw new Error(
            "Deck must be an array"
        );
    }

    return deck.length;
}


/*
=========================================================
IS EMPTY
=========================================================
*/

function isDeckEmpty(deck) {

    return (
        getDeckSize(deck) === 0
    );
}


/*
=========================================================
VALIDATE DECK
=========================================================

Проверяем:

- массив
- каждая карта корректна
- нет дубликатов
- размер не больше 36

Для полной новой колоды должно быть
ровно 36 карт.
=========================================================
*/

function validateDeck(
    deck,
    requireFullDeck = false
) {

    if (!Array.isArray(deck)) {
        return false;
    }

    if (
        deck.length >
        DECK_SIZE
    ) {
        return false;
    }

    if (
        requireFullDeck &&
        deck.length !== DECK_SIZE
    ) {
        return false;
    }

    const ids =
        new Set();

    for (const card of deck) {

        if (!isCard(card)) {
            return false;
        }

        if (ids.has(card.id)) {
            return false;
        }

        ids.add(card.id);
    }

    return true;
}


/*
=========================================================
CREATE NEW DECK STATE
=========================================================

Пока это просто состояние колоды.

Игровое состояние появится
в game.js.
=========================================================
*/

function createDeckState() {

    const cards =
        createShuffledDeck();

    return {

        cards,

        trumpCard: null,

        trumpSuit: null

    };
}


/*
=========================================================
SET TRUMP CARD
=========================================================

Передаём карту, которая определяет
козырь.

Карта НЕ удаляется здесь из колоды.

Game Engine сам определит,
как физически хранится козырная карта
и когда она становится недоступной
для добора.
=========================================================
*/

function setTrumpCard(
    deckState,
    trumpCard
) {

    if (
        !deckState ||
        !Array.isArray(
            deckState.cards
        )
    ) {
        throw new Error(
            "Invalid deck state"
        );
    }

    if (!isCard(trumpCard)) {
        throw new Error(
            "Invalid trump card"
        );
    }

    deckState.trumpCard =
        trumpCard;

    deckState.trumpSuit =
        getTrumpSuit(
            trumpCard
        );

    return deckState;
}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    DECK_SIZE,

    shuffleDeck,

    createShuffledDeck,

    getTrumpSuit,

    drawCard,

    drawCards,

    getDeckSize,

    isDeckEmpty,

    validateDeck,

    createDeckState,

    setTrumpCard

};
