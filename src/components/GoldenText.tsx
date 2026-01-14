import { Text3D, Center } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";

const fontUrl = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/fonts/gentilis_bold.typeface.json';

const goldMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#FFD700"),
  emissive: new THREE.Color("#ffaa00"),
  emissiveIntensity: 0.4,
  metalness: 1.0,
  roughness: 0.1,
  envMapIntensity: 3.0,
});

const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

export function GoldenText({ isActive }: { isActive: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  // Position
  const posX = -40; 
  const posZ = 0;   
  const startY = -40; 
  const endY = 8; 

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // 1. Position Interpolation (Rise Up)
    const targetY = isActive ? endY : startY;
    groupRef.current.position.y = lerp(groupRef.current.position.y, targetY, delta * 0.8);

    // 2. Scale Interpolation (Grow Smoothly)
    // If active, scale to 1. If not, shrink to 0.
    const targetScale = isActive ? 1 : 0;
    const currentScale = groupRef.current.scale.x;
    const newScale = lerp(currentScale, targetScale, delta * 2.0); // Faster scale for pop-up feel
    
    groupRef.current.scale.set(newScale, newScale, newScale);
  });

  const textOptions = useMemo(() => ({
    font: fontUrl,
    size: 4, 
    height: 0.5,
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.05,
    bevelOffset: 0,
    bevelSegments: 5,
  }), []);

  return (
    <group 
      ref={groupRef} 
      position={[posX, startY, posZ]}
      rotation={[0, Math.PI / 2, 0]} 
      // Initialize scale at 0 so it grows from nothing
      scale={[0, 0, 0]}
      // Safety visibility toggle (prevents light calculation when deep underground)
      visible={isActive}
    >
      <Center top> 
        <Text3D 
          {...textOptions} 
          material={goldMaterial}
          castShadow
          receiveShadow
        >
          HAPPY BIRTHDAY ABIDA
        </Text3D>
      </Center>
      
      <pointLight 
        position={[0, 5, 10]}
        intensity={5.0} 
        color="#ffaa00" 
        distance={60}
        decay={1.5}
      />
      <pointLight 
        position={[0, -5, 10]}
        intensity={2.0} 
        color="#ffffff" 
        distance={60}
        decay={1.5}
      />
    </group>
  );
}