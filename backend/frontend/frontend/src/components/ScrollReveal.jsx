import { useEffect, useRef } from "react";

/**
 * ScrollReveal — wrap any block to fade/translate it in when it enters the viewport.
 * Pure IntersectionObserver, no framer-motion. Cheap and respects reduced motion.
 */
export default function ScrollReveal({ as: Tag = "div", className = "", delay = 0, children, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("in-view");
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          el.classList.add("in-view");
          obs.unobserve(el);
        }
      }),
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
