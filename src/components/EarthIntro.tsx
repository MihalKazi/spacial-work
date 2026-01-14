import { useRef, useState, useEffect, useMemo, forwardRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture, Stars } from "@react-three/drei";
import * as THREE from "three";

// --- PROPS INTERFACE ---
interface EarthIntroProps {
  startLat: number;
  startLon: number;
  targetLat: number;
  targetLon: number;
  onComplete: () => void;
}

const EARTH_RADIUS = 2;
const FLIGHT_HEIGHT = 5.2;  

// --- MATH HELPERS ---
function getPositionFromGPS(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180); 
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = (radius * Math.sin(phi) * Math.sin(theta));
  const y = (radius * Math.cos(phi));
  return new THREE.Vector3(x, y, z);
}

function getTrajectoryCurve(p1: THREE.Vector3, p2: THREE.Vector3) {
  const mid = p1.clone().add(p2).multiplyScalar(0.5).normalize().multiplyScalar(EARTH_RADIUS + 1.8); 
  return new THREE.QuadraticBezierCurve3(p1, mid, p2);
}

// --- TERMINAL OVERLAY (The Hacker Text) ---
function TerminalOverlay({ onComplete }: { onComplete: () => void }) {
    const [lines, setLines] = useState<string[]>([]);
    
    useEffect(() => {
        const script = [
            { text: "> SYSTEM BOOT...", delay: 200 },
            { text: "> CONNECTING TO SATELLITE...", delay: 800 },
            { text: "> TRIANGULATING...", delay: 1500 },
            { text: "> LOCATION: KHULNA, BD", delay: 2500, color: "#ffff00" },
            { text: "Khulna?? No... Boring.", delay: 4000, color: "#ff0000" },
            { text: "Let's go somewhere COOL.", delay: 5500, color: "#00ff00", bold: true },
            { text: "> INITIATING WARP DRIVE...", delay: 7000 }
        ];

        let timeouts: NodeJS.Timeout[] = [];

        script.forEach(({ text, delay, color, bold }, index) => {
            const timeout = setTimeout(() => {
                setLines(prev => [...prev, `<span style="color:${color || '#0f0'}; font-weight:${bold ? 'bold' : 'normal'}">${text}</span>`]);
                if (index === script.length - 1) {
                    setTimeout(onComplete, 1000); 
                }
            }, delay);
            timeouts.push(timeout);
        });

        return () => timeouts.forEach(clearTimeout);
    }, [onComplete]);

    // This overlay is rendered via HTML in App.tsx usually, but here we return null
    // and let the parent handle the transition. 
    // Ideally, for 3D context, we use Html from drei, but to keep your App.tsx clean
    // we will rely on the 3D scene starting immediately after this.
    return null; 
}


// --- 3D SPACECRAFT ---
const Spacecraft = forwardRef<THREE.Group>((props, ref) => {
    return (
      <group ref={ref} scale={[0.12, 0.12, 0.12]} {...props}>
        <mesh position={[0, 0.2, 0.5]}>
           <boxGeometry args={[0.2, 0.2, 0.4]} />
           <meshBasicMaterial color="#00ffff" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.3, 1.5, 6]} />
          <meshStandardMaterial color="#333" roughness={0.2} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.8]}>
            <sphereGeometry args={[0.15]} />
            <meshBasicMaterial color="#ffaa00" />
        </mesh>
        <pointLight position={[0, 0, 1]} color="#ffaa00" intensity={3} distance={3} />
      </group>
    );
});

// --- MAIN 3D SCENE ---
export function EarthIntro({ startLat, startLon, targetLat, targetLon, onComplete }: EarthIntroProps) {
  const earthRef = useRef<THREE.Group>(null);
  const spacecraftRef = useRef<THREE.Group>(null);
  const camera = useThree((state) => state.camera);
  const [active, setActive] = useState(false);
  const startTime = useRef<number | null>(null);

  // Textures
  const [colorMap, normalMap, specularMap, cloudMap] = useTexture([
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png',
  ]);

  // Calculations
  const startPos = useMemo(() => getPositionFromGPS(startLat, startLon, EARTH_RADIUS), [startLat, startLon]);
  const endPos = useMemo(() => getPositionFromGPS(targetLat, targetLon, EARTH_RADIUS), [targetLat, targetLon]);
  const flightCurve = useMemo(() => getTrajectoryCurve(startPos, endPos), [startPos, endPos]);

  const startQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(startPos.clone().normalize(), new THREE.Vector3(0, 0, 1)), [startPos]);
  const endQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(endPos.clone().normalize(), new THREE.Vector3(0, 0, 1)), [endPos]);

  // Initial Camera Setup
  useEffect(() => {
     camera.position.set(0, 0, 2.5);
  }, [camera]);

  useFrame((state) => {
    if (!active) {
        // Wait for textures or external trigger if needed
        setActive(true);
        return;
    }

    if (startTime.current === null) startTime.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startTime.current;
    const DURATION = 6.0;

    if (elapsed < DURATION) {
        const progress = elapsed / DURATION;
        const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        // Rotate Earth
        if(earthRef.current) {
            earthRef.current.quaternion.slerpQuaternions(startQuat, endQuat, ease);
        }

        // Camera Zoom
        const alt = Math.sin(progress * Math.PI);
        camera.position.z = THREE.MathUtils.lerp(2.5, FLIGHT_HEIGHT, alt);

        // Move Ship
        if (spacecraftRef.current) {
            const point = flightCurve.getPointAt(ease);
            spacecraftRef.current.position.copy(point);
            const tangent = flightCurve.getTangentAt(ease).normalize();
            spacecraftRef.current.lookAt(point.clone().add(tangent));
            spacecraftRef.current.rotateZ(Math.PI / 2);
            spacecraftRef.current.rotateX(0.2);
        }
    } else {
        if (elapsed > DURATION + 0.5) onComplete();
    }
  });

  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 5]} intensity={2.5} />
      
      <group ref={earthRef}>
        <mesh>
            <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
            <meshStandardMaterial map={colorMap} normalMap={normalMap} roughnessMap={specularMap} metalness={0.1} />
        </mesh>
        <mesh scale={[1.01, 1.01, 1.01]}>
             <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
             <meshStandardMaterial map={cloudMap} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        
        <Spacecraft ref={spacecraftRef} />
        
        <mesh>
             <tubeGeometry args={[flightCurve, 64, 0.01, 8, false]} />
             <meshBasicMaterial color="lime" transparent opacity={0.3} />
        </mesh>
      </group>
      <Stars />
    </>
  );
}