import { useEffect, useRef, useState } from "react";

type TProps<T> = {
  defaultValue: T;
  ttl: number;
};

type TUpdater<T> = T | ((current: T) => T);

export default function useTemporaryValue<T>({ defaultValue, ttl }: TProps<T>) {
  const [localValue, setLocalValue] = useState(defaultValue);
  const valueRef = useRef(defaultValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const setValue = (next: TUpdater<T>): T => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const value = typeof next === "function" ? (next as (current: T) => T)(valueRef.current) : next;
    valueRef.current = value;
    setLocalValue(value);

    timeoutRef.current = setTimeout(() => {
      valueRef.current = defaultValue;
      setLocalValue(defaultValue);
      timeoutRef.current = null;
    }, ttl);

    return value;
  };

  return [localValue, setValue] as const;
}
