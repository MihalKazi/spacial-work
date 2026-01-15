import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls, Html, useProgress, useGLTF, useTexture } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing"; 
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

// --- COMPONENTS ---
import { Candle } from "./models/candle";
import { Cake } from "./models/cake";
import { Table } from "./models/table";
import { PictureFrame } from "./models/pictureFrame";
import { Fireworks } from "./components/Fireworks";
import { Glitter } from "./components/Glitter";
import { Moon } from "./components/Moon";
import { Aurora } from "./components/Aurora";
import { BirthdayCard } from "./components/BirthdayCard";
import { GoldenText } from "./components/GoldenText"; 
import { EarthIntro } from "./components/EarthIntro"; 

import "./App.css";

// --- 1. DRACO CONFIG & PRELOADING ---
// This URL provides the decoder needed to "unzip" your compressed .glb files
const DRACO_URL = "https://www.gstatic.com/draco/versioned/decoders/1.5.5/";

useGLTF.preload("/candle.glb", DRACO_URL);
useGLTF.preload("/cake.glb", DRACO_URL);
useGLTF.preload("/table.glb", DRACO_URL);
useGLTF.preload("/picture_frame.glb", DRACO_URL);
// Note: If you renamed your compressed frame images to .webp, update these strings
useTexture.preload("/frame1.jpg");
useTexture.preload("/frame2.jpg");
useTexture.preload("/frame3.jpg");
useTexture.preload("/frame4.jpg");
useTexture.preload("/card.png");

// --- CONFIG ---
const CURRENT_LAT = 23.8103;
const CURRENT_LON = 90.4125;
const TARGET_LAT = -29.6823;
const TARGET_LON = 17.9492; 

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// --- ANIMATION CONSTANTS ---
const CAKE_START_Y = 10;
const CAKE_END_Y = 0;
const CAKE_DESCENT_DURATION = 3;
const TABLE_START_Z = 30;
const TABLE_END_Z = 0;
const TABLE_SLIDE_DURATION = 0.7;
const TABLE_SLIDE_START = CAKE_DESCENT_DURATION - TABLE_SLIDE_DURATION - 0.1;
const CANDLE_START_Y = 5;
const CANDLE_END_Y = 0;
const CANDLE_DROP_DURATION = 1.2;
const CANDLE_DROP_START = Math.max(CAKE_DESCENT_DURATION, TABLE_SLIDE_START + TABLE_SLIDE_DURATION) + 1.0;
const totalAnimationTime = CANDLE_DROP_START + CANDLE_DROP_DURATION;
const BACKGROUND_FADE_DURATION = 1.5; 
const BACKGROUND_FADE_START = Math.max((Math.max(CANDLE_DROP_START, BACKGROUND_FADE_DURATION) - BACKGROUND_FADE_DURATION), 0);

// --- SCRIPTS ---
const TERMINAL_SCRIPT = [
  { text: "> SYSTEM BOOT...", delay: 500 },
  { text: "> CONNECTING TO SATELLITE...", delay: 800 },
  { text: "> TRIANGULATING SIGNAL...", delay: 1000 },
  { text: "> DETECTED: DHAKA, BANGLADESH", delay: 1500, color: "#ffff00" },
  { text: "Analysis: TOO FAR FROM TARGET 😒", delay: 2000, color: "#ff3333" },
  { text: "REROUTING TO: NORTHERN CAPE, SA", delay: 2000, color: "#00ff00", bold: true },
  { text: "> INITIATING WARP DRIVE ✈️...", delay: 2500 }
];

const TYPED_LINES = [
  "> ARRIVAL CONFIRMED.",
  "> Location: Northern Cape, SA",
  "> Hello, Abida.",
  "> Current Date: 28 FEB 2026",
  "> Status: SPECIAL DAY DETECTED",
  "> Happy Birthday! 🎂",      
  "> Initiating Surprise Protocol..."
];

const TYPED_CHAR_DELAY = 40;        
const POST_TYPING_SCENE_DELAY = 3000; 
const CURSOR_BLINK_INTERVAL = 500;

// --- LOADER ---
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="text-green-500 font-mono text-center" style={{ minWidth: '300px' }}>
        <div className="text-xl mb-2">{'>'} DOWNLOADING ASSETS...</div>
        <div className="text-4xl font-bold">{progress.toFixed(0)}%</div>
      </div>
    </Html>
  );
}

// --- HACKER TERMINAL ---
function HackerTerminal({ onComplete }: { onComplete: () => void }) {
  const [lineIndex, setLineIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const { progress } = useProgress();

  useEffect(() => {
    if (lineIndex >= TERMINAL_SCRIPT.length) {
      const readTimeout = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onComplete, 1000);
      }, 1500);
      return () => clearTimeout(readTimeout);
    }
    const currentLine = TERMINAL_SCRIPT[lineIndex];
    const timeout = setTimeout(() => setLineIndex((prev) => prev + 1), currentLine.delay);
    return () => clearTimeout(timeout);
  }, [lineIndex, onComplete]);

  return (
    <div className="fullscreen-overlay" style={{ opacity: isExiting ? 0 : 1, transition: 'opacity 1s ease-in-out', pointerEvents: isExiting ? 'none' : 'auto' }}>
      <div className="terminal-box">
        {TERMINAL_SCRIPT.slice(0, lineIndex + 1).map((line, i) => (
          <div key={i} style={{ color: line.color || '#0f0', fontWeight: line.bold ? 'bold' : 'normal' }}>
            {line.text}
          </div>
        ))}
        {!isExiting && <div><span className="cursor"></span></div>}
        <div style={{ marginTop: '20px', fontSize: '10px', color: '#113311' }}>
          Background Sync: {progress.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

// --- ANIMATED SCENE COMPONENTS ---
type BirthdayCardConfig = { id: string; image: string; position: [number, number, number]; rotation: [number, number, number]; };
const BIRTHDAY_CARDS: ReadonlyArray<BirthdayCardConfig> = [
  { id: "confetti", image: "/card.png", position: [1, 0.081, -2], rotation: [-Math.PI / 2, 0, Math.PI / 3] }
];
const ORBIT_TARGET = new Vector3(0, 1, 0);
const FINAL_CAM_POS_BASE = new Vector3(3, 1, 0).add(ORBIT_TARGET); 
const START_CAM_TARGET = new Vector3(-40, 12, 0); 
const START_CAM_POS = new Vector3(-10, 15, 30);   
const CAMERA_SWOOP_DURATION = 6.0;

function AnimatedScene({ isPlaying, onBackgroundFadeChange, onEnvironmentProgressChange, candleLit, onAnimationComplete, cards, activeCardId, onToggleCard, fireworksActive }: any) {
    const cakeGroup = useRef<Group>(null);
    const tableGroup = useRef<Group>(null);
    const candleGroup = useRef<Group>(null);
    const animationStartRef = useRef<number | null>(null);
    const hasPrimedRef = useRef(false);
    const hasCompletedRef = useRef(false);
    const completionNotifiedRef = useRef(false);
    const backgroundOpacityRef = useRef(1);
    const environmentProgressRef = useRef(0);

    useEffect(() => {
        onBackgroundFadeChange?.(backgroundOpacityRef.current);
        onEnvironmentProgressChange?.(environmentProgressRef.current);
    }, [onBackgroundFadeChange, onEnvironmentProgressChange]);

    const emitBackgroundOpacity = (value: number) => {
        const clamped = clamp(value, 0, 1);
        if (Math.abs(clamped - backgroundOpacityRef.current) > 0.005) {
            backgroundOpacityRef.current = clamped;
            onBackgroundFadeChange?.(clamped);
        }
    };
    const emitEnvironmentProgress = (value: number) => {
        const clamped = clamp(value, 0, 1);
        if (Math.abs(clamped - environmentProgressRef.current) > 0.005) {
            environmentProgressRef.current = clamped;
            onEnvironmentProgressChange?.(clamped);
        }
    };

    useFrame(({ clock }) => {
        const cake = cakeGroup.current; const table = tableGroup.current; const candle = candleGroup.current;
        if (!cake || !table || !candle) return;

        if (!hasPrimedRef.current) {
            cake.position.set(0, CAKE_START_Y, 0); table.position.set(0, 0, TABLE_START_Z); candle.position.set(0, CANDLE_START_Y, 0);
            candle.visible = false; hasPrimedRef.current = true;
        }

        if (!isPlaying) {
            emitBackgroundOpacity(1); emitEnvironmentProgress(0); animationStartRef.current = null;
            hasCompletedRef.current = false; completionNotifiedRef.current = false; return;
        }

        if (hasCompletedRef.current) {
            emitBackgroundOpacity(0); emitEnvironmentProgress(1);
            if (!completionNotifiedRef.current) { completionNotifiedRef.current = true; onAnimationComplete?.(); }
            return;
        }

        if (animationStartRef.current === null) animationStartRef.current = clock.elapsedTime;
        const elapsed = clock.elapsedTime - animationStartRef.current;
        const clampedElapsed = clamp(elapsed, 0, totalAnimationTime);

        const cakeProgress = clamp(clampedElapsed / CAKE_DESCENT_DURATION, 0, 1);
        const cakeEase = easeOutCubic(cakeProgress);
        cake.position.y = lerp(CAKE_START_Y, CAKE_END_Y, cakeEase);
        cake.rotation.y = cakeEase * Math.PI * 2;

        let tableZ = TABLE_START_Z;
        if (clampedElapsed >= TABLE_SLIDE_START) {
            const tableProgress = clamp((clampedElapsed - TABLE_SLIDE_START) / TABLE_SLIDE_DURATION, 0, 1);
            tableZ = lerp(TABLE_START_Z, TABLE_END_Z, easeOutCubic(tableProgress));
        }
        table.position.z = tableZ;

        if (clampedElapsed >= CANDLE_DROP_START) {
            if (!candle.visible) candle.visible = true;
            const candleProgress = clamp((clampedElapsed - CANDLE_DROP_START) / CANDLE_DROP_DURATION, 0, 1);
            candle.position.y = lerp(CANDLE_START_Y, CANDLE_END_Y, easeOutCubic(candleProgress));
        } else {
            candle.visible = false; candle.position.y = CANDLE_START_Y;
        }

        if (clampedElapsed < BACKGROUND_FADE_START) { 
            emitBackgroundOpacity(1); 
            emitEnvironmentProgress(0); 
        } else {
            const fadeProgress = clamp((clampedElapsed - BACKGROUND_FADE_START) / BACKGROUND_FADE_DURATION, 0, 1);
            const bgOpacity = 1 - easeOutCubic(fadeProgress);
            emitBackgroundOpacity(bgOpacity); 
            emitEnvironmentProgress(1 - bgOpacity);
        }

        if (clampedElapsed >= totalAnimationTime) {
            cake.position.set(0, CAKE_END_Y, 0); table.position.set(0, 0, TABLE_END_Z); candle.position.set(0, CANDLE_END_Y, 0); candle.visible = true;
            hasCompletedRef.current = true;
        }
    });

    return (
        <>
            <group ref={tableGroup}>
                <Table />
                {/* Updated to use .jpg as per your imports, change to .webp if you renamed them */}
                <PictureFrame image="/frame2.jpg" position={[0, 0.735, 3]} rotation={[0, 5.6, 0]} scale={0.75} />
                <PictureFrame image="/frame3.jpg" position={[0, 0.735, -3]} rotation={[0, 4.0, 0]} scale={0.75} />
                <PictureFrame image="/frame4.jpg" position={[-1.5, 0.735, 2.5]} rotation={[0, 5.4, 0]} scale={0.75} />
                <PictureFrame image="/frame1.jpg" position={[-1.5, 0.735, -2.5]} rotation={[0, 4.2, 0]} scale={0.75} />
                {cards.map((card: any) => (
                    <BirthdayCard key={card.id} id={card.id} image={card.image} tablePosition={card.position} tableRotation={card.rotation} isActive={activeCardId === card.id} onToggle={onToggleCard} />
                ))}
            </group>
            <group ref={cakeGroup}><Cake /></group>
            <group ref={candleGroup}><Candle isLit={candleLit} scale={0.5} position={[0.5, 0.5, 0.5]} rotation={[0.2, 0, -0.2]} /></group>
            <Fireworks isActive={fireworksActive} origin={[0, 10, 0]} />
            <Glitter isActive={fireworksActive} />
            <Moon isActive={fireworksActive} />
            <Aurora isActive={fireworksActive} />
            <GoldenText isActive={fireworksActive} />
        </>
    );
}

function CinematiceCameraControls({ sceneStarted }: { sceneStarted: boolean }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size); 
  const [isSweeping, setIsSweeping] = useState(false);
  const sweepStartTime = useRef<number | null>(null);
  const hasSweptOnce = useRef(false);
  const isMobile = size.width < 768;
  const mobileOffset = isMobile ? new Vector3(0, 2, 8) : new Vector3(0, 0, 0);
  const finalPos = useMemo(() => FINAL_CAM_POS_BASE.clone().add(mobileOffset), [isMobile]);

  useEffect(() => {
    if (sceneStarted && !hasSweptOnce.current) {
      setIsSweeping(true); hasSweptOnce.current = true; sweepStartTime.current = null;
      camera.position.copy(START_CAM_POS); camera.lookAt(START_CAM_TARGET);
      if (controlsRef.current) controlsRef.current.enabled = false;
    }
  }, [sceneStarted, camera]);

  useFrame(({ clock }) => {
    if (!isSweeping) return;
    if (sweepStartTime.current === null) sweepStartTime.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - sweepStartTime.current;
    const progress = Math.min(elapsed / CAMERA_SWOOP_DURATION, 1);
    const ease = easeInOutCubic(progress);
    camera.position.copy(new Vector3().lerpVectors(START_CAM_POS, finalPos, ease));
    camera.lookAt(new Vector3().lerpVectors(START_CAM_TARGET, ORBIT_TARGET, ease));
    if (progress >= 1) {
      setIsSweeping(false);
      if (controlsRef.current) { 
        controlsRef.current.enabled = true; 
        controlsRef.current.target.copy(ORBIT_TARGET); 
        controlsRef.current.update(); 
      }
    }
  });

  return <OrbitControls ref={controlsRef} enableDamping={!isSweeping} dampingFactor={0.05} minDistance={2} maxDistance={12} minPolarAngle={0} maxPolarAngle={Math.PI / 2} enabled={false} />;
}

function EnvironmentBackgroundController({ intensity }: { intensity: number }) {
  const scene = useThree((state) => state.scene);
  useEffect(() => { if ("backgroundIntensity" in scene) (scene as any).backgroundIntensity = intensity; }, [scene, intensity]);
  return null;
}

// --- MAIN APP ---
export default function App() {
  const [appStage, setAppStage] = useState<'terminal' | 'flight' | 'typing' | 'party'>('terminal');
  const [typingFadingOut, setTypingFadingOut] = useState(false); 

  const [backgroundOpacity, setBackgroundOpacity] = useState(1);
  const [environmentProgress, setEnvironmentProgress] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [hasAnimationCompleted, setHasAnimationCompleted] = useState(false);
  const [isCandleLit, setIsCandleLit] = useState(true);
  const [fireworksActive, setFireworksActive] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const { progress } = useProgress();

  const handleTerminalComplete = useCallback(() => setAppStage('flight'), []);
  
  const handleFlightComplete = useCallback(() => {
    if (progress >= 100) {
      setAppStage('typing');
    } else {
      const check = setInterval(() => {
        if (progress >= 100) {
          setAppStage('typing');
          clearInterval(check);
        }
      }, 100);
    }
  }, [progress]);

  useEffect(() => {
    const audio = new Audio("/music.mp3");
    audio.loop = true; 
    audio.preload = "auto"; 
    backgroundAudioRef.current = audio;
    return () => {
      audio.pause();
      backgroundAudioRef.current = null;
    };
  }, []);

  const isTypingStage = appStage === 'typing';
  const typingComplete = currentLineIndex >= TYPED_LINES.length;

  const typedLines = useMemo(() => {
    if (!isTypingStage) return [];
    return TYPED_LINES.map((line, index) => {
      if (typingComplete || index < currentLineIndex) return line;
      if (index === currentLineIndex) return line.slice(0, Math.min(currentCharIndex, line.length));
      return "";
    });
  }, [currentCharIndex, currentLineIndex, typingComplete, isTypingStage]);

  const cursorLineIndex = typingComplete ? Math.max(typedLines.length - 1, 0) : currentLineIndex;
  const cursorTargetIndex = Math.max(Math.min(cursorLineIndex, typedLines.length - 1), 0);

  useEffect(() => {
    if (!isTypingStage) return;
    if (typingComplete) {
      const suspendHandle = window.setTimeout(() => {
          setTypingFadingOut(true);
          setTimeout(() => {
             setAppStage('party');
             setTypingFadingOut(false);
          }, 1000);
      }, POST_TYPING_SCENE_DELAY);
      return () => window.clearTimeout(suspendHandle);
    }
    const currentLine = TYPED_LINES[currentLineIndex] ?? "";
    const handle = window.setTimeout(() => {
      if (currentCharIndex < currentLine.length) { 
        setCurrentCharIndex((prev) => prev + 1); 
      } else {
        setCurrentLineIndex((prev) => prev + 1); 
        setCurrentCharIndex(0);
      }
    }, TYPED_CHAR_DELAY);
    return () => window.clearTimeout(handle);
  }, [currentCharIndex, currentLineIndex, typingComplete, isTypingStage]);

  useEffect(() => {
    const handle = window.setInterval(() => setCursorVisible((prev) => !prev), CURSOR_BLINK_INTERVAL);
    return () => window.clearInterval(handle);
  }, []);

  const blowCandle = useCallback(() => {
    if (hasAnimationCompleted && isCandleLit) {
      setIsCandleLit(false); 
      setFireworksActive(true);
      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.play().catch((err) => console.warn("Audio blocked:", err));
      }
    }
  }, [hasAnimationCompleted, isCandleLit]);

  const handleCardToggle = useCallback((id: string) => setActiveCardId((current) => (current === id ? null : id)), []);

  return (
    <div className="App">
      <div className="landscape-warning">
        <div className="phone-icon">📱🔄</div>
        <h2>PLEASE ROTATE DEVICE</h2>
        <p>For the best 3D experience, please use Landscape Mode</p>
      </div>

      {appStage === 'terminal' && <HackerTerminal onComplete={handleTerminalComplete} />}

      {appStage === 'flight' && (
         <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
            <EarthIntro 
                startLat={CURRENT_LAT}
                startLon={CURRENT_LON}
                targetLat={TARGET_LAT} 
                targetLon={TARGET_LON} 
                onComplete={handleFlightComplete} 
            />
         </div>
      )}

      {isTypingStage && (
        <div className="fullscreen-overlay" style={{ opacity: typingFadingOut ? 0 : backgroundOpacity, transition: 'opacity 1s ease-in-out' }}>
          <div className="terminal-box">
            {typedLines.map((line, index) => {
              const showCursor = cursorVisible && index === cursorTargetIndex && !typingComplete;
              return (
                <div key={`typed-line-${index}`}>
                  {line}
                  {showCursor && <span className="cursor"></span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="ui-layer" style={{ opacity: hasAnimationCompleted && isCandleLit && appStage === 'party' ? 1 : 0, transition: 'opacity 1s ease-in-out', pointerEvents: hasAnimationCompleted && isCandleLit && appStage === 'party' ? 'auto' : 'none' }}>
          <div className="hint-overlay">Make a Wish</div>
          <button className="wish-button" onClick={blowCandle}>Tap to Blow Candle</button>
      </div>
      
      {(appStage === 'typing' || appStage === 'party') && (
        <Canvas
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          style={{ background: 'transparent' }}
          onCreated={({ gl }) => { 
              gl.setClearColor("#000000", 0); 
              gl.shadowMap.enabled = true; 
              gl.shadowMap.type = THREE.PCFSoftShadowMap; 
          }}
          shadows
        >
          <Suspense fallback={<Loader />}>
            <AnimatedScene 
                isPlaying={appStage === 'party'} 
                candleLit={isCandleLit} 
                onBackgroundFadeChange={setBackgroundOpacity} 
                onEnvironmentProgressChange={setEnvironmentProgress} 
                onAnimationComplete={() => setHasAnimationCompleted(true)} 
                cards={BIRTHDAY_CARDS} 
                activeCardId={activeCardId} 
                onToggleCard={handleCardToggle} 
                fireworksActive={fireworksActive} 
            />
            <ambientLight intensity={(1 - environmentProgress) * 0.8} />
            <directionalLight intensity={0.5 * (1 - environmentProgress)} position={[2, 10, 0]} color={[1, 0.9, 0.95]} castShadow />
            
            <Environment 
                files={["/background.hdr"]} 
                backgroundRotation={[0, 3.3, 0]} 
                environmentRotation={[0, 3.3, 0]} 
                blur={0.05}
                background 
                environmentIntensity={0.2 * environmentProgress} 
                backgroundIntensity={0.1 * environmentProgress} 
            />
            
            <EnvironmentBackgroundController intensity={0.1 * environmentProgress} />
            <CinematiceCameraControls sceneStarted={appStage === 'party'} />
            
            <EffectComposer>
              <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.4} />
              <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}