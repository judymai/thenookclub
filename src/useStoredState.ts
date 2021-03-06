import { useState, useEffect } from "react";
import isEqual from "lodash/isEqual";

type Listener = () => any;

class LocalStorageListener {
  listeners: { [key: string]: Set<Listener> } = {};

  triggerChange(key: string): void {
    const listeners = this.listeners[key] ?? new Set();
    listeners.forEach((listener) => listener());
  }

  addListener(key: string, listener: Listener): void {
    if (!this.listeners.hasOwnProperty(key)) {
      this.listeners[key] = new Set();
    }
    this.listeners[key].add(listener);
  }

  removeListener(key: string, listener: Listener): void {
    if (this.listeners.hasOwnProperty(key)) {
      this.listeners[key].delete(listener);
    }
  }
}

const storageListener = new LocalStorageListener();

export function useRawStoredState(
  key: string,
  initialState: string
): [string, (value: string) => void] {
  const [state, setState] = useState<string>(() => {
    if (window.localStorage && window.localStorage.getItem(key)) {
      return window.localStorage.getItem(key);
    }
    return initialState;
  });

  useEffect(() => {
    if (window.localStorage) {
      window.localStorage.setItem(key, state);
      storageListener.triggerChange(key);
    }
  }, [key, state]);

  useEffect(() => {
    function listener() {
      if (window.localStorage) {
        const value = window.localStorage.getItem(key);
        if (value !== state) {
          setState(value);
        }
      }
    }
    storageListener.addListener(key, listener);
    return () => {
      storageListener.removeListener(key, listener);
    };
  }, [key, state]);

  return [state, setState];
}

type Primitive = boolean | number | string;
type SerializableValue = Primitive | Primitive[] | { [key: string]: Primitive };

export default function useStoredState<T extends SerializableValue>(
  name: string,
  initialState: T
): [T, (value: T) => void] {
  const [state, setState] = useRawStoredState(
    name,
    JSON.stringify(initialState)
  );
  function setter(newValue: T) {
    setState(JSON.stringify(newValue));
  }
  let value: T;
  try {
    value = JSON.parse(state);
  } catch (_) {
    value = initialState;
  }
  return [value, setter];
}

export function useStoredValues<T extends SerializableValue>(
  keys: string[]
): T[] {
  function getValues(): T[] {
    if (window.localStorage) {
      return keys.map((key) => JSON.parse(window.localStorage.getItem(key)));
    }
    return [];
  }
  const [values, setValues] = useState<T[]>(getValues);

  useEffect(() => {
    function listener() {
      if (window.localStorage) {
        const newValues = getValues();
        if (!isEqual(values, newValues)) {
          setValues(newValues);
        }
      }
    }
    for (const key of keys) {
      storageListener.addListener(key, listener);
    }
    return () => {
      for (const key of keys) {
        storageListener.removeListener(key, listener);
      }
    };
  }, [keys, values]);

  return values;
}
