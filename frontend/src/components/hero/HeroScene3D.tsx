"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useLab } from "@/context/LabContext";
import { ChevronUp, ChevronDown, Sparkles } from "lucide-react";

export function HeroScene3D() {
  const { isHero3DExpanded, setIsHero3DExpanded, currentModuleDef } = useLab();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasWebGlError, setHasWebGlError] = useState(false);

  useEffect(() => {
    if (!isHero3DExpanded || !canvasRef.current) return;

    let animId: number;
    let renderer: THREE.WebGLRenderer | null = null;

    try {
      const canvas = canvasRef.current;
      const width = canvas.parentElement?.clientWidth || window.innerWidth;
      const height = canvas.parentElement?.clientHeight || 176;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 4, 8);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Ambient and directional lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
      dirLight.position.set(10, 10, 5);
      scene.add(dirLight);

      const ptLight = new THREE.PointLight(0x8b5cf6, 1.5, 30);
      ptLight.position.set(-8, -4, -3);
      scene.add(ptLight);

      // Create parametric volatility surface
      const nx = 36;
      const ny = 36;
      const geom = new THREE.PlaneGeometry(16, 10, nx, ny);
      const pos = geom.attributes.position;

      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i);
        const v = pos.getY(i);
        const z =
          0.7 * Math.sin(u * 0.7) * Math.cos(v * 0.9) +
          0.3 * Math.sin(u * 1.5 + v * 0.5) +
          0.2 * Math.cos(u * 2.0);
        pos.setZ(i, z);
      }
      geom.computeVertexNormals();

      const meshMat = new THREE.MeshStandardMaterial({
        color: 0x0b132b,
        emissive: 0x064e3b,
        emissiveIntensity: 0.25,
        roughness: 0.3,
        metalness: 0.8,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, meshMat);
      mesh.rotation.x = -Math.PI / 3;
      scene.add(mesh);

      const wireGeom = new THREE.WireframeGeometry(geom);
      const wireMat = new THREE.LineBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.3,
      });
      const wireframe = new THREE.LineSegments(wireGeom, wireMat);
      wireframe.rotation.x = -Math.PI / 3;
      scene.add(wireframe);

      // Glowing Particles
      const particleCount = 120;
      const partGeom = new THREE.BufferGeometry();
      const partPos = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        partPos[i * 3] = (Math.random() - 0.5) * 20;
        partPos[i * 3 + 1] = (Math.random() - 0.5) * 10;
        partPos[i * 3 + 2] = (Math.random() - 0.5) * 8;
      }
      partGeom.setAttribute("position", new THREE.BufferAttribute(partPos, 3));
      const partMat = new THREE.PointsMaterial({
        size: 0.08,
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });
      const particles = new THREE.Points(partGeom, partMat);
      scene.add(particles);

      let clock = new THREE.Clock();

      const animate = () => {
        animId = requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime() * 0.35;

        mesh.rotation.z = Math.sin(elapsed * 0.2) * 0.05;
        mesh.rotation.x = -Math.PI / 3 + Math.cos(elapsed * 0.3) * 0.04;

        wireframe.rotation.z = mesh.rotation.z;
        wireframe.rotation.x = mesh.rotation.x;

        particles.rotation.y = elapsed * 0.04;

        if (renderer) renderer.render(scene, camera);
      };

      animate();

      const handleResize = () => {
        if (!canvasRef.current || !renderer) return;
        const w = canvasRef.current.parentElement?.clientWidth || window.innerWidth;
        const h = canvasRef.current.parentElement?.clientHeight || 176;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      window.addEventListener("resize", handleResize);

      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener("resize", handleResize);
        if (renderer) {
          renderer.dispose();
          renderer.forceContextLoss();
        }
      };
    } catch (e) {
      console.warn("Three.js WebGL initialization skipped:", e);
      setHasWebGlError(true);
    }
  }, [isHero3DExpanded]);

  if (!isHero3DExpanded) {
    return (
      <div className="flex items-center justify-between px-6 py-2 bg-[#090D16]/90 border-b border-[#1E293B] text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="font-mono text-slate-300">QUANT MATHEMATICAL MANIFOLD (3D SCENE MINIMIZED)</span>
        </div>
        <button
          onClick={() => setIsHero3DExpanded(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#111827] hover:bg-[#1E293B] text-cyan-400 border border-cyan-500/30 transition-all cursor-pointer"
        >
          <span>Expand Hero 3D</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-44 bg-gradient-to-b from-[#05070D] via-[#090D16] to-[#07090E] border-b border-cyan-500/20 overflow-hidden">
      {/* 3D WebGL Canvas */}
      {!hasWebGlError ? (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      ) : (
        /* Graceful SVG gradient grid wave fallback */
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
      )}

      {/* Hero Overlay Content */}
      <div className="relative z-10 flex items-center justify-between h-full px-8 pointer-events-auto">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono tracking-wider font-semibold uppercase bg-cyan-950/80 text-cyan-400 border border-cyan-500/40">
              {currentModuleDef.category}
            </span>
            <span className="text-xs font-mono text-slate-400">
              Module {currentModuleDef.id} of 10
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>{currentModuleDef.name}</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1 font-mono">
            {currentModuleDef.subtitle} • Paper: <span className="text-cyan-300 font-semibold">{currentModuleDef.paper}</span>
          </p>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex flex-col items-end text-right font-mono text-[11px] text-slate-400 border-r border-[#1E293B] pr-4">
            <div className="text-slate-300 font-semibold">ECONOMETRIC ENGINE</div>
            <div className="text-cyan-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              STOCHASTIC MANIFOLD ACTIVE
            </div>
          </div>
          <button
            onClick={() => setIsHero3DExpanded(false)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0D111D]/80 hover:bg-[#1E293B] text-slate-400 hover:text-white border border-[#1E293B] text-xs font-mono transition-all cursor-pointer"
            title="Minimize 3D scene"
          >
            <span>Hide</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Glowing Bottom Neon Accent Line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
    </div>
  );
}
