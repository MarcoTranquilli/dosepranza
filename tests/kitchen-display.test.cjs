const test = require("node:test");
const assert = require("node:assert/strict");
const { getPrepState, setOrderPrepared } = require("../shared/kitchen-display.js");

test("kitchen-display: state persistence isolates order IDs and handles storage gracefully", () => {
  const mockStorage = {};
  global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); }
  };

  setOrderPrepared("ORD-101", true);
  let state = getPrepState();
  assert.equal(state["ORD-101"], true);

  setOrderPrepared("ORD-102", true);
  setOrderPrepared("ORD-101", false);
  state = getPrepState();
  assert.equal(state["ORD-101"], undefined);
  assert.equal(state["ORD-102"], true);
});
