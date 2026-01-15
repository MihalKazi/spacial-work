import { useGLTF } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { useMemo } from "react";
import type { Group } from "three";

// Configuration for Draco
const DRACO_URL = "https://www.gstatic.com/draco/versioned/decoders/1.5.5/";

type TableProps = ThreeElements["group"];

export function Table({ children, ...groupProps }: TableProps) {
  // 1. Load the Draco compressed table model
  const { scene } = useGLTF("/table.glb", DRACO_URL);

  // 2. Clone the scene for performance and isolation
  const tableScene = useMemo<Group>(() => scene.clone(true), [scene]);

  return (
    <group {...groupProps} dispose={null}>
      <primitive 
        object={tableScene} 
        receiveShadow // This allows the cake/frames to cast shadows onto the table
        castShadow    // This allows the table to cast a shadow on the floor
      />
      {children}
    </group>
  );
}

// Preload for a seamless experience
useGLTF.preload("/table.glb", DRACO_URL);