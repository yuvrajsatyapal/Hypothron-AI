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
        // Deterministic distribution keeps the reference network stable across visits.
        const group = new THREE.Group();
        scene.add(group);
        const positions: import("three").Vector3[] = [];
        const nodeGeometry = new THREE.SphereGeometry(0.065, 10, 8);
        const materials = [0x087f8c, 0x7565d9, 0x38bdf8].map(
          (color) =>
            new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity: 0.45,
            }),
        );
        for (let i = 0; i < 42; i++) {
          const theta = i * 2.399963;
          const radius = 2 + (i % 11) * 0.48;
          const position = new THREE.Vector3(
            Math.sin(theta) * radius,
            Math.cos(theta) * radius * 0.65,
            Math.sin(i * 0.7) * 1.5,
          );
          const node = new THREE.Mesh(nodeGeometry, materials[i % 3]);
          node.position.copy(position);
          node.scale.setScalar(0.8 + (i % 4) * 0.2);
          group.add(node);
          positions.push(position);
        }
        const centerGeometry = new THREE.SphereGeometry(0.14, 16, 12);
        const center = new THREE.Mesh(centerGeometry, materials[0]);
        group.add(center);
        const edges: number[] = [];
        positions.forEach((point, i) => {
          if (i % 4 === 0) edges.push(0, 0, 0, point.x, point.y, point.z);
          positions.slice(i + 1).forEach((other) => {
            if (point.distanceTo(other) < 1.9)
              edges.push(point.x, point.y, point.z, other.x, other.y, other.z);
          });
        });
        const edgeGeometry = new THREE.BufferGeometry();
        edgeGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(edges, 3),
        );
        const edgeMaterial = new THREE.LineBasicMaterial({
          color: 0x7565d9,
          transparent: true,
          opacity: 0.12,
        });
        group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
        let pointerX = 0,
          pointerY = 0;
        const hero = element!.parentElement;
        const move = (event: PointerEvent) => {
          if (event.pointerType !== "mouse") return;
          const bounds = element!.getBoundingClientRect();
          pointerX =
            ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.15;
          pointerY =
            ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.08;
        };
        const reset = () => {
          pointerX = 0;
          pointerY = 0;
        };
        hero?.addEventListener("pointermove", move);
        hero?.addEventListener("pointerleave", reset);
        let visible = true,
          frame = 0,
          last = 0;
        function render(time: number) {
          frame = 0;
          if (disposed || !visible || document.hidden) return;
          if (time - last >= 50) {
            group.rotation.y = time * 0.000015 + pointerX;
            group.rotation.x += (pointerY - group.rotation.x) * 0.08;
            center.scale.setScalar(1 + Math.sin(time * 0.001) * 0.06);
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
          hero?.removeEventListener("pointermove", move);
          hero?.removeEventListener("pointerleave", reset);
          nodeGeometry.dispose();
          centerGeometry.dispose();
          edgeGeometry.dispose();
          edgeMaterial.dispose();
          materials.forEach((material) => material.dispose());
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
