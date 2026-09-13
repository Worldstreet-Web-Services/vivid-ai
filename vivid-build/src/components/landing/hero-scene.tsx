"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useTheme } from "@/hooks/use-theme";
import { prefersReducedMotion } from "@/lib/pointer-effects";
import type { Theme } from "@/lib/theme";

type SceneMaterials = {
  silver: THREE.MeshStandardMaterial;
  panel: THREE.MeshStandardMaterial;
  panelLight: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  canvas: HTMLCanvasElement;
};

type Part = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  home: THREE.Vector3;
  away: THREE.Vector3;
  spin: THREE.Vector3;
  delay: number;
};

function applySceneTheme(m: SceneMaterials, theme: Theme) {
  const light = theme === "light";
  m.silver.color.setHex(light ? 0x9aa3b0 : 0xd9dfe8);
  m.panel.color.setHex(light ? 0xe6eaf0 : 0x1a1f26);
  m.panelLight.color.setHex(light ? 0xf6f8fb : 0x252c35);
  m.accent.color.setHex(light ? 0x3b4350 : 0xf2f6fb);
  m.accent.emissiveIntensity = light ? 0 : 0.35;
  m.canvas.style.opacity = light ? "0.65" : "1";
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** A 3D app window that assembles itself from parts and follows the pointer. */
export function HeroScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const materialsRef = useRef<SceneMaterials | null>(null);
  const { theme } = useTheme();
  const themeRef = useRef(theme);

  useEffect(() => {
    themeRef.current = theme;
    if (materialsRef.current) applySceneTheme(materialsRef.current, theme);
  }, [theme]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || prefersReducedMotion()) return;

    const width = () => host.clientWidth;
    const height = () => host.clientHeight;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width(), height());
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width() / height(), 0.1, 100);
    const fitCamera = () => {
      camera.aspect = width() / height();
      // Pull back on portrait screens so the ~9 unit wide app window stays in frame.
      const fitDistance = 9 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      camera.position.set(0, 0, Math.max(15, fitDistance));
      camera.updateProjectionMatrix();
    };
    fitCamera();

    const silver = new THREE.MeshStandardMaterial({ color: 0xd9dfe8, metalness: 1, roughness: 0.24, transparent: true });
    const panel = new THREE.MeshStandardMaterial({ color: 0x1a1f26, metalness: 0.7, roughness: 0.42, transparent: true });
    const panelLight = new THREE.MeshStandardMaterial({ color: 0x252c35, metalness: 0.5, roughness: 0.55, transparent: true });
    const accent = new THREE.MeshStandardMaterial({
      color: 0xf2f6fb,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x6f7783,
      emissiveIntensity: 0.35,
      transparent: true,
    });
    const materials: SceneMaterials = { silver, panel, panelLight, accent, canvas: renderer.domElement };
    materialsRef.current = materials;

    const group = new THREE.Group();
    const geometries: THREE.BufferGeometry[] = [];
    const parts: Part[] = [];

    const add = (
      geometry: THREE.BufferGeometry,
      material: THREE.MeshStandardMaterial,
      x: number,
      y: number,
      z: number,
      delay: number,
    ) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      geometries.push(geometry);
      parts.push({
        mesh,
        material,
        home: new THREE.Vector3(x, y, z),
        away: new THREE.Vector3(
          x + (Math.random() - 0.5) * 9,
          y + (Math.random() - 0.5) * 7,
          z + (Math.random() - 0.2) * 7,
        ),
        spin: new THREE.Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.6),
        delay,
      });
      group.add(mesh);
    };
    const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

    add(box(6.4, 4.0, 0.16), panel, 0, 0, 0, 0); // window body
    add(box(6.4, 0.52, 0.2), panelLight, 0, 1.74, 0.04, 0.04); // title bar
    [-2.85, -2.6, -2.35].forEach((x, i) =>
      add(new THREE.SphereGeometry(0.07, 18, 18), silver, x, 1.74, 0.16, 0.08 + i * 0.02),
    );
    add(box(1.45, 3.1, 0.12), panelLight, -2.35, -0.22, 0.12, 0.16); // sidebar
    [0.85, 0.35, -0.15, -0.65].forEach((y, i) => add(box(1.0, 0.14, 0.06), silver, -2.35, y, 0.2, 0.22 + i * 0.03));
    add(box(4.2, 1.1, 0.12), panelLight, 0.95, 0.75, 0.12, 0.34); // content card
    add(box(2.6, 0.14, 0.06), silver, 0.15, 0.95, 0.2, 0.38);
    add(box(3.4, 0.12, 0.06), silver, 0.55, 0.62, 0.2, 0.42);
    [0.5, 0.95, 0.7, 1.3, 1.0].forEach((h, i) =>
      add(box(0.42, h, 0.14), i === 3 ? accent : silver, -0.55 + i * 0.72, -0.95 + h / 2, 0.16, 0.48 + i * 0.04),
    );
    add(box(4.2, 0.06, 0.06), panelLight, 0.95, -0.98, 0.16, 0.7); // baseline

    const assemble = (t: number) => {
      for (const part of parts) {
        const local = Math.min(1, Math.max(0, (t - part.delay) / 0.42));
        const e = easeInOutCubic(local);
        part.mesh.position.lerpVectors(part.away, part.home, e);
        part.mesh.rotation.set(part.spin.x * (1 - e), part.spin.y * (1 - e), part.spin.z * (1 - e));
        part.material.opacity = 0.15 + e * 0.85;
      }
    };
    assemble(0);

    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        Array.from({ length: 1400 * 3 }, () => (Math.random() - 0.5) * 26),
        3,
      ),
    );
    const dustMaterial = new THREE.PointsMaterial({ color: 0xc2cad5, size: 0.028, transparent: true, opacity: 0.6 });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dust, group);

    scene.add(new THREE.AmbientLight(0x9aa4b2, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(4, 6, 6);
    const rim = new THREE.DirectionalLight(0xbcc6d3, 2.2);
    rim.position.set(-6, -3, 2);
    const warm = new THREE.PointLight(0xf5f8fc, 26, 30);
    warm.position.set(-3, 3, 4);
    scene.add(key, rim, warm);

    applySceneTheme(materials, themeRef.current);

    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    let visible = true;
    let frame = 0;

    const onPointerMove = (event: PointerEvent) => {
      targetX = event.clientX / window.innerWidth - 0.5;
      targetY = event.clientY / window.innerHeight - 0.5;
    };
    const onResize = () => {
      renderer.setSize(width(), height());
      fitCamera();
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize);

    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    visibility.observe(host);

    const clock = new THREE.Clock();
    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (!visible) return;
      const t = clock.getElapsedTime();
      const scrollY = window.scrollY;
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;
      const scrolled = Math.min(1, scrollY / (window.innerHeight * 0.9));

      assemble(Math.min(1, t / 2.2));
      group.rotation.y = -0.38 + mouseX * 0.5 + scrolled * 0.5;
      group.rotation.x = 0.12 + Math.sin(t * 0.5) * 0.04 - mouseY * 0.35;
      group.position.y = 1.35 + Math.sin(t * 0.7) * 0.1 - scrollY * 0.0016;
      dust.rotation.y = t * 0.02;
      camera.position.x = mouseX * 1.2;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      visibility.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      geometries.forEach((geometry) => geometry.dispose());
      [silver, panel, panelLight, accent, dustMaterial].forEach((material) => material.dispose());
      dustGeometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      materialsRef.current = null;
    };
  }, []);

  return <div ref={hostRef} className="size-full" />;
}
