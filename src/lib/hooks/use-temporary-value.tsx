import { useEffect, useRef, useState } from "react";

type TProps<T> = {
  defaultValue: T;
  ttl: number;
};

export default function useTemporaryValue<T>({ defaultValue, ttl }: TProps<T>) {
  const [localValue, setLocalValue] = useState(defaultValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const setValue = (value: T): T => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setLocalValue(value);

    timeoutRef.current = setTimeout(() => {
      setLocalValue(defaultValue);
      timeoutRef.current = null;
    }, ttl);

    return value;
  };

  return [localValue, setValue] as const;
}
