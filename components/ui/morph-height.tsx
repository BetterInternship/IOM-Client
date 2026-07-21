"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Smoothly animates height changes in its content, including from/to
 * nothing rendered at all. A plain `layout` (Framer Motion) or CSS
 * `transition: height` doesn't work here — the former only visually fakes
 * the size via a transform (so it never propagates to an ancestor sized by
 * content, e.g. a table row), and the latter can't animate to/from
 * `height: auto`. This instead measures the real height via
 * ResizeObserver and drives an explicit pixel-to-pixel transition, so
 * anything that sizes to this element (a `<td>`/`<tr>`, a flex column, …)
 * reflows smoothly frame-by-frame right along with it.
 */
export function MorphHeight({
  children,
  duration = 200,
}: {
  children: ReactNode;
  duration?: number;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const prevHeightRef = useRef(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    prevHeightRef.current = inner.offsetHeight;

    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "height") return;
      outer.style.height = "";
      outer.style.overflow = "";
      outer.style.transition = "";
    };
    outer.addEventListener("transitionend", onTransitionEnd);

    const ro = new ResizeObserver(() => {
      const newHeight = inner.offsetHeight;
      const prevHeight = prevHeightRef.current;
      if (newHeight === prevHeight) return;
      prevHeightRef.current = newHeight;
      outer.style.overflow = "hidden";
      outer.style.transition = "none";
      outer.style.height = `${prevHeight}px`;
      outer.offsetHeight;
      outer.style.transition = `height ${duration}ms ease`;
      outer.style.height = `${newHeight}px`;
    });
    ro.observe(inner);

    return () => {
      ro.disconnect();
      outer.removeEventListener("transitionend", onTransitionEnd);
    };
  }, [duration]);

  return (
    <div ref={outerRef}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
