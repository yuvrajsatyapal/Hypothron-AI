"use client";
import { useEffect, useRef } from "react";
export function AmbientGraph() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const media = matchMedia(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
    );
    let generation = 0;
    let disposed = false,
      release: (() => void) | undefined;
    async function start() {
      if (!media.matches || disposed) return;
      const attempt = ++generation;
      try {
        const THREE = await import("three");
        if (disposed || !media.matches || attempt !== generation) return;
        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: false,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        renderer.setClearColor(0x000000, 0);
        element!.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
        camera.position.z = 12;
        const positions = new Float32Array(72 * 3);
        for (let i = 0; i < 72; i++) {
          positions[i * 3] = Math.sin(i * 2.399) * ((i % 9) + 1);
          positions[i * 3 + 1] = Math.cos(i * 2.399) * ((i % 7) + 1);
          positions[i * 3 + 2] = Math.sin(i * 0.7) * 2;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3),
        );
        const material = new THREE.PointsMaterial({
          color: 0x087f8c,
          size: 0.035,
          transparent: true,
          opacity: 0.3,
        });
        const points = new THREE.Points(geometry, material);
        scene.add(points);
        let visible = true,
          frame = 0,
          last = 0;
        function render(time: number) {
          frame = 0;
          if (disposed || !visible || document.hidden) return;
          if (time - last >= 50) {
            points.rotation.y = time * 0.000015;
            renderer.render(scene, camera);
            last = time;
          }
          frame = requestAnimationFrame(render);
        }
        function schedule() {
          if (visible && !document.hidden && !frame)
            frame = requestAnimationFrame(render);
          else if (!visible || document.hidden) {
            cancelAnimationFrame(frame);
            frame = 0;
          }
        }
        const observer = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          schedule();
        });
        observer.observe(element!);
        function resize() {
          const { width, height } = element!.getBoundingClientRect();
          renderer.setSize(width, height);
          camera.aspect = width / Math.max(height, 1);
          camera.updateProjectionMatrix();
        }
        const size = new ResizeObserver(resize);
        size.observe(element!);
        resize();
        document.addEventListener("visibilitychange", schedule);
        schedule();
        release = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          size.disconnect();
          document.removeEventListener("visibilitychange", schedule);
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        };
      } catch {
        /* Blueprint SVG/CSS fallback remains visible on unavailable WebGL. */
      }
    }
    function change() {
      ++generation;
      release?.();
      release = undefined;
      if (media.matches) void start();
    }
    void start();
    media.addEventListener("change", change);
    return () => {
      disposed = true;
      media.removeEventListener("change", change);
      release?.();
    };
  }, []);
  return (
    <div
      ref={host}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    />
  );
}
