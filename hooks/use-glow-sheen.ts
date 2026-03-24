import { type PointerEvent, useCallback, useState } from "react";

export function useGlowSheen() {
  const [glow, setGlow] = useState({ x: 50, y: 50 });

  const updateGlow = useCallback((e: PointerEvent<Element>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setGlow({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  }, []);

  const handlePointerEnter = useCallback(
    (e: PointerEvent<Element>) => {
      updateGlow(e);
    },
    [updateGlow]
  );

  return {
    glow,
    updateGlow,
    handlePointerEnter,
  };
}
