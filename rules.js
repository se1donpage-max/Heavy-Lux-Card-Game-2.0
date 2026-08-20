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

game.table имеет структуру:

[
    {
        attack: Card,
        defense: Card | null
    }
]

Для подкидывания учитываются
И атакующие, И защищающие карты.

Пример:

6♠ / 10♠
K♥ / A♥

Доступные достоинства:

6
10
K
A
=========================================================
*/

function getTableRanks(table) {

    if (!Array.isArray(table)) {
        return [];
    }

    const ranks = new Set();

    for (const pair of table) {

        if (!pair) {
            continue;
        }

        /*
        Поддерживаем также обычный массив
        карт для безопасности.
        */

        if (isCard(pair)) {

            ranks.add(
                pair.rank
            );

            continue;

        }

        if (
            isCard(pair.attack)
        ) {

            ranks.add(
                pair.attack.rank
            );

        }

        if (
            isCard(pair.defense)
        ) {

            ranks.add(
                pair.defense.rank
            );

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

1. только корректную карту;

2. только карту достоинства,
   которое уже присутствует на столе;

3. пока не достигнут лимит захода;

4. лимит фиксируется engine
   в начале текущего захода;

5. максимум 6 атакующих карт.

Важно:

table.length =
количество атакующих пар,

а не количество физических карт.
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
        !Number.isInteger(
            attackLimit
        ) ||
        attackLimit <= 0
    ) {
        return false;
    }

    /*
    Первый атакующий.
    */

    if (table.length === 0) {

        return canAttack(card);

    }

    /*
    Нельзя превышать лимит
    текущего захода.
    */

    if (
        table.length >=
        attackLimit
    ) {

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
если:

1. он действительно защитник;
2. стол не пуст;
3. существует хотя бы одна
   НЕПОБИТАЯ атакующая карта.

Полностью отбившийся стол
взять нельзя.
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

    if (table.length === 0) {
        return false;
    }

    /*
    Если есть хотя бы одна
    атакующая карта без защиты —
    защитник может взять.
    */

    return table.some(
        pair =>
            pair &&
            isCard(pair.attack) &&
            !isCard(pair.defense)
    );

}


/*
=========================================================
CAN END ATTACK
=========================================================

Атаку можно закончить только если:

- стол не пуст;
- каждая атакующая карта существует;
- каждая атакующая карта побита.
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
            isCard(pair.attack) &&
            isCard(pair.defense)
    );

}


/*
=========================================================
GET MAX ATTACK CARDS
=========================================================

Количество атакующих карт
не может превышать:

- количество карт защитника
  на момент начала захода;

- 6 карт.

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
        Number.isInteger(
            playerCount
        ) &&
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

    return (
        hand.length >=
        HAND_SIZE
    );

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
