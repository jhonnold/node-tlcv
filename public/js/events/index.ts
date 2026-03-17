import type { SerializedGame, SerializedBroadcast, StoredGameMeta } from '../../../shared/types';

export type GameEventData = Omit<SerializedBroadcast, 'chat'> & { game: SerializedGame };

export type NavPosition = {
  fen: string;
  isLive: boolean;
  index: number;
  lastMove: { from: string; to: string } | null;
};

type EventMap = {
  'game:state': GameEventData;
  'game:update': GameEventData;
  'chat:history': string[];
  'chat:message': string[];
  'nav:position': NavPosition;
  'tab:change': { tab: string };
  'theme:change': { theme: string };
  'board:resize': undefined;
  'board:flip': { flipped: boolean };
  'game:replay': StoredGameMeta;
  'replay:exit': undefined;
};

type EventKey = keyof EventMap;

const listeners = new Map<string, Array<(data: any) => void>>();

export function off<K extends EventKey>(event: K, callback: (data: EventMap[K]) => void) {
  const callbacks = listeners.get(event);
  if (callbacks) {
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }
}

export function on<K extends EventKey>(event: K, callback: (data: EventMap[K]) => void): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, []);
  }
  listeners.get(event)!.push(callback);

  return () => off(event, callback);
}

export function emit<K extends EventKey>(event: K, data: EventMap[K]) {
  const callbacks = listeners.get(event) || [];
  callbacks.forEach((callback) => {
    try {
      callback(data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error in event handler for "${event}":`, error);
    }
  });
}

export function once<K extends EventKey>(event: K, callback: (data: EventMap[K]) => void): () => void {
  const wrapper = (data: EventMap[K]) => {
    off(event, wrapper);
    callback(data);
  };
  return on(event, wrapper);
}

export function removeAllListeners(event?: string) {
  if (event) {
    listeners.delete(event);
  } else {
    listeners.clear();
  }
}
