"use client";
import { useEffect } from "react";

export function LandingMotion() {
  useEffect(() => {
    const sectionNav =
      document.querySelector<HTMLDetailsElement>("[data-section-nav]");
    const closeNav = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("a")) {
        if (sectionNav) sectionNav.open = false;
      }
    };
    sectionNav?.addEventListener("click", closeNav);
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (disposed) return;
        const root = document.getElementById("landing");
        if (!root) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        media.add("(prefers-reduced-motion: no-preference)", () => {
          const ctx = gsap.context(() => {
            gsap.from("[data-reveal]", {
              y: 18,
              opacity: 0,
              duration: 0.7,
              stagger: 0.065,
              ease: "power3.out",
              clearProps: "transform,opacity",
            });
            root
              .querySelectorAll<HTMLElement>("[data-showcase]")
              .forEach((section) => {
                const timeline = gsap.timeline({
                  scrollTrigger: {
                    trigger: section,
                    start: "top 85%",
                    end: "center 55%",
                    scrub: 0.5,
                  },
                });
                timeline.from(section.children, {
                  y: 20,
                  stagger: 0.08,
                  duration: 0.6,
                  ease: "none",
                });
                section
                  .querySelectorAll<SVGPathElement>("[data-showcase-line]")
                  .forEach((path) => {
                    const length = path.getTotalLength();
                    timeline.fromTo(
                      path,
                      { strokeDasharray: length, strokeDashoffset: length },
                      { strokeDashoffset: 0, duration: 0.7, ease: "none" },
                      0.2,
                    );
                  });
                const items = section.querySelectorAll("[data-bundle-item]");
                if (items.length)
                  timeline.from(
                    items,
                    { x: 12, stagger: 0.07, duration: 0.4 },
                    0.25,
                  );
              });
            const chart = root.querySelector<SVGElement>(
              "[data-example-chart]",
            );
            if (chart) {
              const timeline = gsap.timeline({
                scrollTrigger: {
                  trigger: chart,
                  start: "top 95%",
                  end: "bottom 65%",
                  scrub: 0.5,
                },
              });
              timeline.from(chart.querySelectorAll("rect"), {
                scaleY: 0.15,
                transformOrigin: "50% 100%",
                stagger: 0.08,
                duration: 0.5,
                ease: "none",
              });
              timeline.from(
                root.querySelectorAll("[data-example-result]"),
                { y: 8, stagger: 0.08, duration: 0.4 },
                0.35,
              );
            }
          }, root);
          root.dataset.motionReady = "true";
          return () => {
            ctx.revert();
            delete root.dataset.motionReady;
          };
        });
        media.add(
          "(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
          () => {
            const host = root.querySelector<HTMLElement>(".hero-preview");
            const preview = root.querySelector<HTMLElement>(
              "[data-preview-parallax]",
            );
            const float = root.querySelector<HTMLElement>(
              "[data-preview-float]",
            );
            if (!host || !preview || !float) return;
            const ctx = gsap.context(() => {
              const rotateX = gsap.quickTo(preview, "rotationX", {
                duration: 0.5,
                ease: "power3.out",
              });
              const rotateY = gsap.quickTo(preview, "rotationY", {
                duration: 0.5,
                ease: "power3.out",
              });
              const move = (event: PointerEvent) => {
                const box = host.getBoundingClientRect();
                rotateX(-((event.clientY - box.top) / box.height - 0.5) * 5);
                rotateY(((event.clientX - box.left) / box.width - 0.5) * 5);
              };
              const leave = () => {
                rotateX(0);
                rotateY(0);
              };
              const floating = gsap.to(float, {
                y: -7,
                duration: 3,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
                paused: true,
              });
              let visible = false;
              const visibility = () => {
                if (visible && !document.hidden) floating.resume();
                else floating.pause();
              };
              const observer = new IntersectionObserver(([entry]) => {
                visible = entry.isIntersecting;
                visibility();
              });
              observer.observe(host);
              host.addEventListener("pointermove", move);
              host.addEventListener("pointerleave", leave);
              document.addEventListener("visibilitychange", visibility);
              return () => {
                observer.disconnect();
                host.removeEventListener("pointermove", move);
                host.removeEventListener("pointerleave", leave);
                document.removeEventListener("visibilitychange", visibility);
              };
            }, root);
            return () => ctx.revert();
          },
        );
        cleanup = () => media.revert();
      })
      .catch(() => {
        /* Static content remains usable when motion cannot load. */
      });
    return () => {
      sectionNav?.removeEventListener("click", closeNav);
      disposed = true;
      cleanup?.();
    };
  }, []);
  return null;
}
