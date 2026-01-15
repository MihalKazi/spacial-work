import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// --- HELPER: Create a star shape texture on the fly ---
function createStarTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  // Draw a 5-pointed star path
  const cx = 16;
  const cy = 16;
  const outerRadius = 15;
  const innerRadius = 6;
  const spikes = 5;

  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();

  // Fill with solid white (vertex colors will tint this later)
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
// --------------------------------------------------

export function Glitter({ isActive }: { isActive: boolean }) {
  const meshRef = useRef<THREE.Points>(null);

  // 1. Create the star texture once
  const starTexture = useMemo(() => createStarTexture(), []);

  const count = 600;
  const area = 25;

  // 2. Create Particles
  const particles = useMemo(() => {
    const temp = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color1 = new THREE.Color("#ffdd00"); // Gold
    const color2 = new THREE.Color("#ffffff"); // White

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * area;
      const y = (Math.random() - 0.5) * area + 5;
      const z = (Math.random() - 0.5) * area;
      temp[i * 3] = x;
      temp[i * 3 + 1] = y;
      temp[i * 3 + 2] = z;

      const mixedColor = Math.random() > 0.5 ? color1 : color2;
      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }
    return { positions: temp, colors: colors };
  }, [count, area]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * 0.05;
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.5;
  });

  if (!isActive) return null;

  return (
    <group>
        <points ref={meshRef}>
        <bufferGeometry>
            {/* FIXED: Added args={[particles.positions, 3]} to satisfy TypeScript */}
            <bufferAttribute
                attach="attributes-position"
                count={count}
                array={particles.positions}
                itemSize={3}
                args={[particles.positions, 3]} 
            />
            {/* FIXED: Added args={[particles.colors, 3]} to satisfy TypeScript */}
            <bufferAttribute
                attach="attributes-color"
                count={count}
                array={particles.colors}
                itemSize={3}
                args={[particles.colors, 3]} 
            />
        </bufferGeometry>
        <pointsMaterial
            map={starTexture}
            size={0.15}
            vertexColors
            transparent
            opacity={0.9}
            sizeAttenuation={true}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            alphaTest={0.5}
        />
        </points>
    </group>
  );
}