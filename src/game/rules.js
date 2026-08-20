"use strict";

/*
=========================================================
HEAVY LUX CARD
GAME RULES
=========================================================

КЛАССИЧЕСКИЙ ПОДКИДНОЙ ДУРАК

36 КАРТ
2–3 ИГРОКА
БЕЗ ПЕРЕВОДА

Этот модуль НЕ изменяет состояние игры.

Он только проверяет правила.
=========================================================
*/

const {
    isCard,
    canBeat,
    isTrump
} = require("./cards");


/*
=========================================================
CONSTANTS
=========================================================
*/

const MIN_PLAYERS = 2;

const MAX_PLAYERS = 3;

const HAND_SIZE = 6;


/*
=========================================================
GET TABLE RANKS
=========================================================
*/

function getTableRanks(table) {

    if (!Array.isArray(table)) {
        return [];
    }

    const ranks = new Set();

    for (const card of table) {

        if (isCard(card)) {
            ranks.add(card.rank);
        }

    }

    return [...ranks];
}


/*
=========================================================
CAN ATTACK
=========================================================

Любая корректная карта может быть
первой атакующей картой.
=========================================================
*/

function canAttack(card) {

    return isCard(card);
}


/*
=========================================================
CAN ADD ATTACK CARD
=========================================================

Подкинуть можно:

1. только карту достоинства,
   которое уже есть на столе;

2. пока не достигнут лимит захода;

3. лимит определяется количеством
   карт защитника НА МОМЕНТ НАЧАЛА ЗАХОДА;

4. максимум 6 атакующих карт.
=========================================================
*/

function canAddAttackCard(
    card,
    table,
    attackLimit
) {

    if (!isCard(card)) {
        return false;
    }

    if (!Array.isArray(table)) {
        return false;
    }

    if (
        !Number.isInteger(attackLimit) ||
        attackLimit <= 0
    ) {
        return false;
    }

    /*
    Первая карта.
    */

    if (table.length === 0) {
        return canAttack(card);
    }

    /*
    Нельзя превышать зафиксированный
    лимит текущего захода.
    */

    if (table.length >= attackLimit) {
        return false;
    }

    const tableRanks =
        getTableRanks(table);

    return tableRanks.includes(
        card.rank
    );
}


/*
=========================================================
CAN DEFEND
=========================================================
*/

function canDefend(
    attackingCard,
    defendingCard,
    trumpSuit
) {

    if (
        !isCard(attackingCard) ||
        !isCard(defendingCard)
    ) {
        return false;
    }

    return canBeat(
        attackingCard,
        defendingCard,
        trumpSuit
    );
}


/*
=========================================================
GET DEFENDABLE CARDS
=========================================================
*/

function getDefendableCards(
    hand,
    attackingCard,
    trumpSuit
) {

    if (!Array.isArray(hand)) {
        return [];
    }

    if (!isCard(attackingCard)) {
        return [];
    }

    return hand.filter(
        card =>
            canDefend(
                attackingCard,
                card,
                trumpSuit
            )
    );
}


/*
=========================================================
GET ATTACKABLE CARDS
=========================================================
*/

function getAttackableCards(
    hand,
    table,
    attackLimit
) {

    if (!Array.isArray(hand)) {
        return [];
    }

    return hand.filter(
        card =>
            canAddAttackCard(
                card,
                table,
                attackLimit
            )
    );
}


/*
=========================================================
CAN TAKE
=========================================================

Защитник может взять карты,
если на столе существует хотя бы
одна атакующая карта.

Важно:

Game Engine дополнительно проверяет,
что действие выполняет именно защитник
и что сейчас фаза защиты.
=========================================================
*/

function canTake(
    table,
    isDefender
) {

    if (!isDefender) {
        return false;
    }

    if (!Array.isArray(table)) {
        return false;
    }

    return table.length > 0;
}


/*
=========================================================
CAN END ATTACK
=========================================================

Атаку можно закончить только если:

- стол не пуст;
- все атакующие карты побиты.
=========================================================
*/

function canEndAttack(
    table,
    isAttacker
) {

    if (!isAttacker) {
        return false;
    }

    if (!Array.isArray(table)) {
        return false;
    }

    if (table.length === 0) {
        return false;
    }

    return table.every(
        pair =>
            pair &&
            pair.attack &&
            pair.defense
    );
}


/*
=========================================================
GET MAX ATTACK CARDS
=========================================================
*/

function getMaxAttackCards(
    defenderHandSize
) {

    if (
        !Number.isInteger(
            defenderHandSize
        ) ||
        defenderHandSize <= 0
    ) {
        return 0;
    }

    return Math.min(
        defenderHandSize,
        HAND_SIZE
    );
}


/*
=========================================================
CAN START GAME
=========================================================
*/

function canStartGame(
    playerCount
) {

    return (
        Number.isInteger(playerCount) &&
        playerCount >= MIN_PLAYERS &&
        playerCount <= MAX_PLAYERS
    );
}


/*
=========================================================
CAN DRAW
=========================================================
*/

function canDraw(
    handSize,
    deckSize
) {

    if (
        !Number.isInteger(handSize) ||
        !Number.isInteger(deckSize)
    ) {
        return false;
    }

    return (
        handSize < HAND_SIZE &&
        deckSize > 0
    );
}


/*
=========================================================
IS HAND FULL
=========================================================
*/

function isHandFull(hand) {

    if (!Array.isArray(hand)) {
        return false;
    }

    return hand.length >= HAND_SIZE;
}


/*
=========================================================
IS TRUMP CARD
=========================================================
*/

function isTrumpCard(
    card,
    trumpSuit
) {

    return isTrump(
        card,
        trumpSuit
    );
}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    MIN_PLAYERS,

    MAX_PLAYERS,

    HAND_SIZE,

    getTableRanks,

    canAttack,

    canAddAttackCard,

    canDefend,

    getDefendableCards,

    getAttackableCards,

    canTake,

    canEndAttack,

    getMaxAttackCards,

    canStartGame,

    canDraw,

    isHandFull,

    isTrumpCard

};
