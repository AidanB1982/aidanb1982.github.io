import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { App } from "@capacitor/app";
import { createConnectivity } from "./connectivity-state.js";
const state = createConnectivity({
  native: Capacitor.isNativePlatform(),
  browserOnline: () => navigator.onLine,
  network: Network,
  notify: (online) =>
    window.dispatchEvent(new Event(online ? "online" : "offline")),
});
let initialising;
export const isOnline = () => state.isOnline();
export function initialiseConnectivity() {
  if (!initialising)
    initialising = (async () => {
      await state.initialise();
      if (Capacitor.isNativePlatform())
        await App.addListener("appStateChange", async ({ isActive }) => {
          if (isActive) await state.refresh().catch(() => {});
        });
    })();
  return initialising;
}
