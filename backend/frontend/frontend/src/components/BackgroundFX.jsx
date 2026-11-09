import { useEffect, useRef, memo } from "react";

/**
 * BackgroundFX — layered fixed background fx.
 * 1. Three drifting blurred orbs (.orb-1/2/3) using CSS animation
 * 2. A cursor-following violet glow (only on devices that hover, respects prefers-reduced-motion)
 *
 * Mesh gradient + grain noise are painted by body::before and body::after in App.css.
 */
const BackgroundFX = memo(function BackgroundFX() {
  const glowRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const noHover = window.matchMedia("(hover: none)").matches;
    if (reduce || noHover) return;

    const el = glowRef.current;
    if (!el) return;

    let raf = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    const onMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      el.style.left = `${currentX}px`;
      el.style.top = `${currentY}px`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="orbs-wrap" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <div ref={glowRef} className="mouse-glow" aria-hidden="true" />
    </>
  );
});

export default BackgroundFX;
