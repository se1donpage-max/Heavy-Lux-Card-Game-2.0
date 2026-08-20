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

Этот файл содержит только правила.

Он НЕ изменяет состояние игры.

Он отвечает на вопросы:

- может ли игрок атаковать;
- может ли игрок защищаться;
- можно ли подкинуть карту;
- можно ли закончить атаку;
- можно ли взять карты;
- сколько карт разрешено положить на стол.
=========================================================
*/

const {
    isCard,
    isSameRank,
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

Возвращает достоинства всех карт,
которые уже присутствуют на столе.

Например:

9♥
K♠
Q♦

Результат:

["9", "K", "Q"]
=========================================================
*/

function getTableRanks(table) {

    if (!Array.isArray(table)) {
        return [];
    }

    const ranks =
        new Set();

    for (const card of table) {

        if (isCard(card)) {
            ranks.add(card.rank);
        }

    }

    return [
        ...ranks
    ];
}


/*
=========================================================
CAN ATTACK
=========================================================

Проверяет, может ли карта быть
первой атакующей картой.

Для первого хода достаточно,
чтобы карта существовала.

Дополнительные ограничения
накладываются Game Engine.
=========================================================
*/

function canAttack(card) {

    return isCard(card);
}


/*
=========================================================
CAN ADD ATTACK CARD
=========================================================

После появления первой карты
на столе подкидывать можно только
карты достоинства, которое уже
присутствует на столе.

Пример:

На столе:

9♥
K♠

Можно подкинуть:

9♣
K♦

Нельзя:

Q♣
A♥
=========================================================
*/

function canAddAttackCard(
    card,
    table,
    defenderHandSize
) {

    if (!isCard(card)) {
        return false;
    }

    if (!Array.isArray(table)) {
        return false;
    }

    /*
    Первая карта проверяется
    через canAttack().
    */

    if (table.length === 0) {
        return canAttack(card);
    }

    /*
    Нельзя атаковать,
    если у защищающегося уже
    нет карт.
    */

    if (
        !Number.isInteger(
            defenderHandSize
        ) ||
        defenderHandSize <= 0
    ) {
        return false;
    }

    /*
    Количество атакующих карт
    не может превышать количество
    карт защищающегося.
    */

    if (
        table.length >=
        defenderHandSize
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

Проверяет, может ли defendingCard
побить attackingCard.

Основная проверка находится
в cards.canBeat().
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

Возвращает карты руки,
которые игрок может использовать
для защиты конкретной карты.
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

Возвращает карты руки,
которые разрешено подкинуть.
=========================================================
*/

function getAttackableCards(
    hand,
    table,
    defenderHandSize
) {

    if (!Array.isArray(hand)) {
        return [];
    }

    return hand.filter(
        card =>
            canAddAttackCard(
                card,
                table,
                defenderHandSize
            )
    );
}


/*
=========================================================
CAN TAKE
=========================================================

Защищающийся может взять карты,
если он находится в фазе защиты.

Саму фазу проверит Game Engine.

Здесь проверяем только,
что действие в принципе существует.
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

Атакующий может закончить атаку,
если:

- на столе есть карты;
- сейчас действительно идёт атака.
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

    return table.length > 0;
}


/*
=========================================================
GET MAX ATTACK CARDS
=========================================================

Классическое ограничение:

Количество атакующих карт
не может превышать количество
карт у защищающегося.

Также физический максимум
одного захода — 6 карт.
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

Игрок должен иметь меньше 6 карт.

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

    if (handSize >= HAND_SIZE) {
        return false;
    }

    return deckSize > 0;
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
        hand.length >= HAND_SIZE
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
