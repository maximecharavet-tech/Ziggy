"use client";

import { useEffect, useRef } from "react";

export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: import("three").WebGLRenderer;
    let animId: number;

    import("three").then((THREE) => {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
      );
      camera.position.z = 420;

      const count = 2800;
      const positions = new Float32Array(count * 3);
      const alphas = new Float32Array(count);
      const sizes = new Float32Array(count);
      const velocities = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 100 + Math.pow(Math.random(), 0.5) * 220;

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        alphas[i] = 0.15 + Math.random() * 0.65;
        sizes[i] = 0.8 + Math.random() * 2.8;

        velocities[i * 3] = (Math.random() - 0.5) * 0.02;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));
      geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

      const vertexShader = `
        attribute float alpha;
        attribute float size;
        varying float vAlpha;
        uniform float uTime;

        void main() {
          vAlpha = alpha;
          vec3 p = position;
          float freq = 0.008;
          float amp = 6.0;
          p.y += sin(uTime * 0.4 + p.x * freq) * amp;
          p.x += cos(uTime * 0.3 + p.z * freq) * (amp * 0.6);
          p.z += sin(uTime * 0.25 + p.y * freq) * (amp * 0.4);

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = size * (280.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `;

      const fragmentShader = `
        varying float vAlpha;

        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float dist = length(uv);
          if (dist > 0.5) discard;

          float core = 1.0 - smoothstep(0.0, 0.18, dist);
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          float alpha = (core * 0.9 + glow * 0.5) * vAlpha;

          // Gold: #c9a96b = 0.788, 0.663, 0.420
          // Slightly warm highlight
          vec3 col = mix(vec3(0.788, 0.663, 0.420), vec3(0.96, 0.88, 0.64), core * 0.4);
          gl_FragColor = vec4(col, alpha);
        }
      `;

      const mat = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geo, mat);
      scene.add(points);

      // Secondary sparse large particles (depth illusion)
      const largeCount = 120;
      const largePos = new Float32Array(largeCount * 3);
      const largeAlpha = new Float32Array(largeCount);
      const largeSz = new Float32Array(largeCount);

      for (let i = 0; i < largeCount; i++) {
        largePos[i * 3] = (Math.random() - 0.5) * 800;
        largePos[i * 3 + 1] = (Math.random() - 0.5) * 600;
        largePos[i * 3 + 2] = (Math.random() - 0.5) * 400 - 100;
        largeAlpha[i] = 0.06 + Math.random() * 0.12;
        largeSz[i] = 4 + Math.random() * 8;
      }

      const largeGeo = new THREE.BufferGeometry();
      largeGeo.setAttribute("position", new THREE.BufferAttribute(largePos, 3));
      largeGeo.setAttribute("alpha", new THREE.BufferAttribute(largeAlpha, 1));
      largeGeo.setAttribute("size", new THREE.BufferAttribute(largeSz, 1));

      const largeMat = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const largePoints = new THREE.Points(largeGeo, largeMat);
      scene.add(largePoints);

      const mouse = { x: 0, y: 0 };
      const onMouseMove = (e: MouseEvent) => {
        mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("mousemove", onMouseMove);

      let targetRotX = 0, targetRotY = 0;
      const clock = new THREE.Clock();

      const animate = () => {
        animId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        mat.uniforms.uTime.value = t;
        largeMat.uniforms.uTime.value = t;

        targetRotY += (mouse.x * 0.08 - targetRotY) * 0.025;
        targetRotX += (-mouse.y * 0.04 - targetRotX) * 0.025;

        points.rotation.y = t * 0.018 + targetRotY;
        points.rotation.x = t * 0.009 + targetRotX;
        largePoints.rotation.y = t * 0.006;

        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", onResize);

      // Store cleanup refs in outer scope
      (canvas as HTMLCanvasElement & { _cleanup?: () => void })._cleanup = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("resize", onResize);
        geo.dispose();
        mat.dispose();
        largeGeo.dispose();
        largeMat.dispose();
        renderer.dispose();
      };
    });

    return () => {
      const c = canvas as HTMLCanvasElement & { _cleanup?: () => void };
      c._cleanup?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
