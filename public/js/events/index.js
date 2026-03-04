// public/js/events/index.js
const listeners = new Map();

export function off(event, callback) {
  const callbacks = listeners.get(event);
  if (callbacks) {
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }
}

export function on(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, []);
  }
  listeners.get(event).push(callback);

  // Return unsubscribe function
  return () => off(event, callback);
}

export function emit(event, data) {
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

export function once(event, callback) {
  const wrapper = (data) => {
    off(event, wrapper);
    callback(data);
  };
  return on(event, wrapper);
}

export function removeAllListeners(event) {
  if (event) {
    listeners.delete(event);
  } else {
    listeners.clear();
  }
}
