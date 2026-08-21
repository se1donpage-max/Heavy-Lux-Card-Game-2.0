const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createGame,
  dealInitial,
  playAttack,
  defend,
  stateForPlayer,
} = require("./engine");
test("36-card game deals six cards and has trump", () => {
  const g = createGame({ id: "x", playerIds: ["a", "b"], stake: 500 });
  dealInitial(g);
  assert.equal(g.players[0].hand.length, 6);
  assert.equal(g.players[1].hand.length, 6);
  assert.ok(g.trumpSuit);
  assert.equal(g.status, "PLAYING");
});
test("private state never exposes another hand", () => {
  const g = createGame({ id: "x", playerIds: ["a", "b"], stake: 500 });
  dealInitial(g);
  const s = stateForPlayer(g, "a");
  assert.ok(Array.isArray(s.myHand));
  assert.ok(!("hand" in s.players[0]));
});
