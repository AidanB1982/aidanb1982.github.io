// Native connection state is authoritative: a WebView can report online because
// its bundled localhost server is reachable even when Android radios are off.
export function createConnectivity({ native, browserOnline, network, notify }) {
  let connected = browserOnline();
  const apply = (status) => {
    const next = status.connected === true;
    if (next !== connected) {
      connected = next;
      notify(next);
    }
  };
  return {
    isOnline: () => (native ? connected : browserOnline()),
    async refresh() {
      if (native) apply(await network.getStatus());
    },
    async initialise() {
      if (!native) return;
      await network.addListener("networkStatusChange", apply);
      await this.refresh();
    },
  };
}
