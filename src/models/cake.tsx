import { useLoader } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import { useMemo } from "react";
import type { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type CakeProps = ThreeElements["group"];

export function Cake({ children, ...groupProps }: CakeProps) {
  // Make sure your chicken file is named "cake.glb" inside the public folder
  const gltf = useLoader(GLTFLoader, "/cake.glb");
  
  const cakeScene = useMemo<Group | null>(() => gltf.scene?.clone(true) ?? null, [gltf.scene]);

  if (!cakeScene) {
    return null;
  }

  return (
    <group {...groupProps}>
      {/* CHANGE THESE NUMBERS TO FIX THE CHICKEN:
         1. scale: Controls size (try 2, 5, or 10 if it's small)
         2. position: [x, y, z] -> Middle number moves it Up/Down
         3. rotation: [x, y, z] -> Middle number spins it around
      */}
      <primitive 
        object={cakeScene} 
        scale={2.5} 
        position={[0, .8, 0]} 
        rotation={[0, 0, 0]} 
      />
      {children}
    </group>
  );
}