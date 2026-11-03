import { useEffect, useState } from "react";

/** True once the page is scrolled past `offset` pixels. Only the boolean is state, so re-renders happen at the threshold. */
export function useScrolledPast(offset: number): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [offset]);

  return scrolled;
}
