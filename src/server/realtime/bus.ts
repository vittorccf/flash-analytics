// Barramento de eventos: uma conexão LISTEN por instância do servidor, repassando para quantos
// streams SSE estiverem abertos nela. Várias instâncias funcionam porque cada uma escuta o Postgres.
// Se a conexão cair, reconecta com backoff e avisa os streams ("resync") para recarregarem os dados.
import "server-only";
import { EventEmitter } from "node:events";
import { Client } from "pg";
import { env } from "../env";
import { REALTIME_CHANNEL, type AppEvent } from "./events";

export type BusMessage = AppEvent | { type: "resync" };
type Listener = (message: BusMessage) => void;

class EventBus {
  private emitter = new EventEmitter();
  private client: Client | null = null;
  private connecting: Promise<void> | null = null;
  private retryMs = 1000;

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  async subscribe(listener: Listener) {
    this.emitter.on("message", listener);
    await this.ensureConnected();
    return () => {
      this.emitter.off("message", listener);
    };
  }

  private ensureConnected() {
    if (this.client) return Promise.resolve();
    this.connecting ??= this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async connect() {
    const client = new Client({ connectionString: env.listenDatabaseUrl, keepAlive: true });
    client.on("notification", (msg) => {
      if (msg.channel !== REALTIME_CHANNEL || !msg.payload) return;
      try {
        this.emitter.emit("message", JSON.parse(msg.payload) as AppEvent);
      } catch {
        // payload malformado: ignora
      }
    });
    const onDown = () => this.handleDisconnect(client);
    client.on("error", onDown);
    client.on("end", onDown);
    try {
      await client.connect();
      await client.query(`LISTEN ${REALTIME_CHANNEL}`);
      this.client = client;
      this.retryMs = 1000;
    } catch (error) {
      client.removeAllListeners();
      await client.end().catch(() => {});
      this.scheduleReconnect();
      throw error;
    }
  }

  private handleDisconnect(client: Client) {
    if (this.client !== client) return;
    this.client = null;
    client.removeAllListeners();
    client.end().catch(() => {});
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.emitter.listenerCount("message") === 0) return;
    const wait = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, 30_000);
    setTimeout(() => {
      this.ensureConnected()
        // Eventos podem ter se perdido enquanto estava fora: quem está ouvindo recarrega.
        .then(() => this.emitter.emit("message", { type: "resync" } satisfies BusMessage))
        .catch(() => {});
    }, wait).unref?.();
  }
}

const globalForBus = globalThis as unknown as { flashEventBus?: EventBus };
export const eventBus = (globalForBus.flashEventBus ??= new EventBus());
