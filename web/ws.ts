import { forwardRecords, handle, refresh, resyncChat, useStore } from "./store";

/** One WebSocket from server to shell, with reconnect + resync. */
export function connectWs() {
  let retry = 0;
  let everOpen = false;
  const open = () => {
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
    ws.onopen = () => {
      retry = 0;
      useStore.setState({ online: true });
      // Resync on every open, the first included: events between the initial snapshot and the subscription are otherwise lost.
      void refresh();
      void resyncChat();
      if (everOpen) forwardRecords("*", "*"); // records may have changed while we were offline
      everOpen = true;
    };
    ws.onmessage = (e) => {
      try {
        handle(JSON.parse(e.data));
      } catch (err) {
        console.error("bad event", err);
      }
    };
    ws.onclose = () => {
      useStore.setState({ online: false });
      setTimeout(open, Math.min(4000, 300 * 2 ** retry++));
    };
  };
  open();
}
