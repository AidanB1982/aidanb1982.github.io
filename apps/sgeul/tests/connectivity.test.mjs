import { test } from "node:test";
import assert from "node:assert/strict";
import { createConnectivity } from "../src/connectivity-state.js";
test("Android airplane mode overrides a WebView that still reports online", async () => {
  let nativeConnected = false,
    listener;
  const notifications = [];
  const state = createConnectivity({
    native: true,
    browserOnline: () => true,
    network: {
      getStatus: async () => ({ connected: nativeConnected }),
      addListener: async (name, callback) => {
        assert.equal(name, "networkStatusChange");
        listener = callback;
      },
    },
    notify: (online) => notifications.push(online),
  });
  await state.initialise();
  assert.equal(state.isOnline(), false);
  assert.deepEqual(notifications, [false]);
  nativeConnected = true;
  await state.refresh();
  assert.equal(state.isOnline(), true);
  listener({ connected: false });
  assert.equal(state.isOnline(), false);
  assert.deepEqual(notifications, [false, true, false]);
});
test("browser preview retains browser online/offline state without a native bridge", async () => {
  let connected = true;
  const state = createConnectivity({
    native: false,
    browserOnline: () => connected,
    network: {
      getStatus() {
        throw Error("must not call native API");
      },
    },
    notify() {
      throw Error("no synthetic native event expected");
    },
  });
  await state.initialise();
  assert.equal(state.isOnline(), true);
  connected = false;
  assert.equal(state.isOnline(), false);
});
