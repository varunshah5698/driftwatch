"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* -------------------------------------------------------------- palette */
const LIME = new THREE.Color("#c9f76f");
const ORANGE = new THREE.Color("#f2a35a");
const RED = new THREE.Color("#ff6a58");
const WHITE = new THREE.Color("#f4f4ee");
const DIM = new THREE.Color("#5d6152");

/* ---------------------------------------------------------------- nodes */
type Node = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  scale: number;
  phase: number;
};

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNodes(count: number): Node[] {
  const rand = seededRandom(20261024);
  const nodes: Node[] = [];
  for (let i = 0; i < count; i++) {
    // Spherical-ish shell with jitter, so the cluster reads as a cloud.
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const radius = 2.1 + rand() * 3.4;
    const roll = rand();
    const color = roll > 0.86 ? ORANGE : roll > 0.78 ? RED : roll > 0.35 ? LIME : DIM;
    nodes.push({
      position: new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi) * 0.62,
        radius * Math.sin(phi) * Math.sin(theta),
      ),
      velocity: new THREE.Vector3(
        (rand() - 0.5) * 0.0016,
        (rand() - 0.5) * 0.0016,
        (rand() - 0.5) * 0.0016,
      ),
      color,
      scale: 0.028 + rand() * 0.05,
      phase: rand() * Math.PI * 2,
    });
  }
  return nodes;
}

/* ----------------------------------------------------------- nodes mesh */
function NodeCloud({ count = 220, reduced }: { count?: number; reduced: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const nodes = useMemo(() => makeNodes(count), [count]);

  const { positions, colors, scales } = useMemo(() => {
    const positions = new Float32Array(nodes.length * 3);
    const colors = new Float32Array(nodes.length * 3);
    const scales = new Float32Array(nodes.length);
    nodes.forEach((node, index) => {
      positions[index * 3] = node.position.x;
      positions[index * 3 + 1] = node.position.y;
      positions[index * 3 + 2] = node.position.z;
      colors[index * 3] = node.color.r;
      colors[index * 3 + 1] = node.color.g;
      colors[index * 3 + 2] = node.color.b;
      scales[index] = node.scale;
    });
    return { positions, colors, scales };
  }, [nodes]);

  useFrame(({ clock }) => {
    if (!ref.current || reduced) return;
    const t = clock.getElapsedTime();
    const attribute = ref.current.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      node.position.add(node.velocity);
      // Soft containment so the cloud never drifts apart.
      if (node.position.length() > 6.4) node.velocity.multiplyScalar(-1);
      const bob = Math.sin(t * 0.7 + node.phase) * 0.04;
      array[i * 3] = node.position.x;
      array[i * 3 + 1] = node.position.y + bob;
      array[i * 3 + 2] = node.position.z;
    }
    attribute.needsUpdate = true;
    ref.current.rotation.y = t * 0.035;
    ref.current.rotation.x = Math.sin(t * 0.11) * 0.05;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-scale" args={[scales, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.075}
        vertexColors
        transparent
        opacity={0.92}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ------------------------------------------------------------ edge web */
function EdgeWeb({ count = 34, reduced }: { count?: number; reduced: boolean }) {
  const ref = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const rand = seededRandom(77123);
    const nodes = makeNodes(60);
    const points: number[] = [];
    const palette: number[] = [];
    for (let i = 0; i < count; i++) {
      const a = nodes[Math.floor(rand() * nodes.length)];
      const b = nodes[Math.floor(rand() * nodes.length)];
      if (a === b) continue;
      points.push(a.position.x, a.position.y, a.position.z, b.position.x, b.position.y, b.position.z);
      const hot = a.color.equals(ORANGE) || b.color.equals(ORANGE) || b.color.equals(RED);
      const color = hot ? ORANGE : LIME;
      for (let k = 0; k < 2; k++) palette.push(color.r, color.g, color.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(palette, 3));
    return geo;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current || reduced) return;
    ref.current.rotation.y = clock.getElapsedTime() * 0.035;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.16}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  );
}

/* -------------------------------------------------------- ring + core */
function AlignmentRing({ reduced }: { reduced: boolean }) {
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.getElapsedTime();
    if (outer.current) {
      outer.current.rotation.z = t * 0.12;
      outer.current.rotation.x = Math.sin(t * 0.2) * 0.14;
    }
    if (inner.current) inner.current.rotation.z = -t * 0.19;
    if (core.current) {
      const pulse = 1 + Math.sin(t * 1.15) * 0.055;
      core.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      {/* Outer dashed arc */}
      <mesh ref={outer}>
        <torusGeometry args={[4.05, 0.014, 8, 220, Math.PI * 1.52]} />
        <meshBasicMaterial color={LIME} transparent opacity={0.55} />
      </mesh>
      {/* Counter-rotating orange arc */}
      <mesh ref={inner}>
        <torusGeometry args={[3.35, 0.011, 8, 200, Math.PI * 0.92]} />
        <meshBasicMaterial color={ORANGE} transparent opacity={0.5} />
      </mesh>
      {/* Breathing core */}
      <mesh ref={core}>
        <icosahedronGeometry args={[0.46, 2]} />
        <meshBasicMaterial color={LIME} wireframe transparent opacity={0.32} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshBasicMaterial color={WHITE} />
      </mesh>
      {/* Soft halo */}
      <mesh>
        <sphereGeometry args={[0.9, 24, 24]} />
        <meshBasicMaterial color={LIME} transparent opacity={0.06} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------- camera rig */
function CameraRig({ reduced }: { reduced: boolean }) {
  const { camera, pointer } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 9.4));

  useFrame(() => {
    const goalX = reduced ? 0 : pointer.x * 0.85;
    const goalY = reduced ? 0 : pointer.y * 0.5;
    camera.position.x += (goalX - camera.position.x) * 0.045;
    camera.position.y += (goalY - camera.position.y) * 0.045;
    camera.lookAt(target.current);
  });

  return null;
}

/* ---------------------------------------------------------------- demo */
export function HeroScene({ className = "" }: { className?: string }) {
  const [reduced, setReduced] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  if (!mounted) {
    // Reserve the layout before hydration so the hero never jumps.
    return <div className={className} aria-hidden />;
  }

  return (
    <div className={className} aria-hidden role="presentation">
      <Canvas
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 9.4], fov: 42 }}
      >
        <CameraRig reduced={reduced} />
        <NodeCloud count={220} reduced={reduced} />
        <EdgeWeb count={34} reduced={reduced} />
        <AlignmentRing reduced={reduced} />
      </Canvas>
    </div>
  );
}
