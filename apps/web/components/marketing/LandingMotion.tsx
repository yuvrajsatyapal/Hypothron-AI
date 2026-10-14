"use client";
import { useEffect } from "react";
export function LandingMotion() {
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        media.add("(prefers-reduced-motion: no-preference)", () => {
          const root = document.getElementById("landing");
          if (!root) return;
          const ctx = gsap.context(() => {
            gsap.from("[data-reveal]", {
              y: 20,
              opacity: 0,
              duration: 0.7,
              stagger: 0.12,
              ease: "power2.out",
            });
            const path = root.querySelector<SVGPathElement>(
              "[data-pipeline-connection]",
            );
            if (path) {
              const length = path.getTotalLength();
              gsap.set(path, {
                strokeDasharray: length,
                strokeDashoffset: length,
              });
              gsap.to(path, {
                strokeDashoffset: 0,
                ease: "none",
                scrollTrigger: {
                  trigger: "#pipeline",
                  start: "top 75%",
                  end: "bottom 35%",
                  scrub: 1,
                },
              });
            }
            gsap.utils
              .toArray<HTMLElement>("[data-pipeline-stage]")
              .forEach((stage, i) => {
                gsap.fromTo(
                  stage,
                  { opacity: 0.65 },
                  {
                    opacity: 1,
                    ease: "none",
                    scrollTrigger: {
                      trigger: "#pipeline",
                      start: `top ${80 - i * 8}%`,
                      end: `bottom ${80 - i * 8}%`,
                      scrub: 1,
                    },
                  },
                );
              });
          }, root);
          return () => ctx.revert();
        });
        cleanup = () => media.revert();
      })
      .catch(() => {
        /* Full static content remains usable if motion cannot load. */
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  return null;
}
