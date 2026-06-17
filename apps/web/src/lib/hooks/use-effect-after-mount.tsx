import { DependencyList, EffectCallback, useEffect, useRef } from "react";

export default function useEffectAfterMount(effect: EffectCallback, deps: DependencyList) {
  const isMounted = useRef(false);

  useEffect(() => {
    let cleanup: void | (() => void) = undefined;
    if (isMounted.current) {
      cleanup = effect();
    }
    isMounted.current = true;
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
