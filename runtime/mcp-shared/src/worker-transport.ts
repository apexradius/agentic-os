import type { MessagePort } from 'node:worker_threads';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export class WorkerServerTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: unknown) => void;

  constructor(private port: MessagePort) {
    this.port.on('message', (msg) => {
      if (this.onmessage) this.onmessage(msg);
    });
    this.port.on('error', (err) => {
      if (this.onerror) this.onerror(err);
    });
    this.port.on('close', () => {
      if (this.onclose) this.onclose();
    });
  }

  async start() {}

  async close() {
    this.port.close();
  }

  async send(message: unknown) {
    this.port.postMessage(message);
  }
}

export class WorkerClientTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: unknown) => void;

  constructor(private worker: any) {
    this.worker.on('message', (msg: any) => {
      if (this.onmessage) this.onmessage(msg);
    });
    this.worker.on('error', (err: any) => {
      if (this.onerror) this.onerror(err);
    });
    this.worker.on('exit', () => {
      if (this.onclose) this.onclose();
    });
  }

  async start() {}

  async close() {
    this.worker.terminate();
  }

  async send(message: unknown) {
    this.worker.postMessage(message);
  }
}
