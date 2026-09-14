type Listener = (event: { data?: string }) => void;

export class FakeSocket {
  sent: string[] = [];
  closed = false;
  private listeners: Record<string, Listener[]> = {};

  addEventListener(type: string, listener: Listener) {
    (this.listeners[type] ??= []).push(listener);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
  }

  emitOpen() {
    for (const listener of this.listeners.open ?? []) listener({});
  }

  emitMessage(data: unknown) {
    for (const listener of this.listeners.message ?? [])
      listener({ data: JSON.stringify(data) });
  }

  emitClose() {
    for (const listener of this.listeners.close ?? []) listener({});
  }
}
