import React, { useRef, useState, useEffect } from 'react';
import { Prize } from '../types';
import { playTick, playWinChime, speakPrize } from './SoundEffects';
import { Volume2, VolumeX, RotateCw } from 'lucide-react';

interface LuckyWheelProps {
  prizes: Prize[];
  duration: number; // spin duration in seconds
  soundEnabled: boolean;
  onSoundToggle: () => void;
  onSpinStart: () => void;
  onSpinEnd: (winner: Prize) => void;
}

export const LuckyWheel: React.FC<LuckyWheelProps> = ({
  prizes,
  duration,
  soundEnabled,
  onSoundToggle,
  onSpinStart,
  onSpinEnd,
}) => {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [blinkPhase, setBlinkPhase] = useState(0);
  const [isSpinButtonHovered, setIsSpinButtonHovered] = useState(false);
  const [showWinWiggle, setShowWinWiggle] = useState(false);
  const [blur, setBlur] = useState(0);
  
  const animationRef = useRef<number | null>(null);
  const currentRotationRef = useRef(0);
  const lastActiveIndex = useRef<number>(-1);

  // Update current rotation ref
  useEffect(() => {
    currentRotationRef.current = rotation;
  }, [rotation]);

  // Clean animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Blinking effect for outer LEDs while spinning
  useEffect(() => {
    if (!isSpinning) {
      const interval = setInterval(() => {
        setBlinkPhase((prev) => (prev + 1) % 2);
      }, 700); // Slow breathing blink
      return () => clearInterval(interval);
    } else {
      const interval = setInterval(() => {
        setBlinkPhase((prev) => (prev + 1) % 3);
      }, 100); // Rapid spinning flash
      return () => clearInterval(interval);
    }
  }, [isSpinning]);

  // Sum of weights
  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);

  // Calculate cumulative angles for slices
  const cumulativeAngles: number[] = [];
  let currentSum = 0;
  prizes.forEach((p) => {
    currentSum += p.weight;
    cumulativeAngles.push((currentSum / totalWeight) * 360);
  });

  // Calculate coordinates helper (0 degrees is straight UP matching clock coordinates)
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  // Describe a single sector path
  const describeArcSector = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
  };

  // Find prize at rotation angle (Pointer is straight UP at 0 degrees)
  // When the wheel has rotated R degrees clockwise, the wheel space has shifted.
  // The absolute item at the top pointer (0 deg) corresponds to relative angle of the wheel:
  // (360 - (R % 360)) % 360.
  const getPrizeAtRotation = (rot: number): number => {
    let relativeAngle = (360 - (rot % 360)) % 360;
    if (relativeAngle < 0) relativeAngle += 360;

    for (let i = 0; i < cumulativeAngles.length; i++) {
      const start = i === 0 ? 0 : cumulativeAngles[i - 1];
      const end = cumulativeAngles[i];
      if (relativeAngle >= start && relativeAngle < end) {
        return i;
      }
    }
    return 0;
  };

  const spin = () => {
    if (isSpinning || prizes.length < 2) return;

    onSpinStart();
    setIsSpinning(true);
    setShowWinWiggle(false);
    setIsSpinButtonHovered(false);

    // 1. Roll winning prize using weighted probability
    const randomWeight = Math.random() * totalWeight;
    let accumulated = 0;
    let winnerIndex = 0;

    for (let i = 0; i < prizes.length; i++) {
      accumulated += prizes[i].weight;
      if (randomWeight <= accumulated) {
        winnerIndex = i;
        break;
      }
    }

    const winnerPrize = prizes[winnerIndex];

    // 2. Identify the target sector relative angles
    const sectorStart = winnerIndex === 0 ? 0 : cumulativeAngles[winnerIndex - 1];
    const sectorEnd = cumulativeAngles[winnerIndex];
    
    // Pick center/sweet spot inside sector (with 10% safety margin from slice boundary)
    const padding = (sectorEnd - sectorStart) * 0.12;
    const targetSectorAngle = sectorStart + padding + Math.random() * (sectorEnd - sectorStart - padding * 2);

    // 3. To stop at top pointer (0 deg), we want relativeAngle === targetSectorAngle.
    // relativeAngle = (360 - (rot % 360)) % 360 = targetSectorAngle.
    // Hence: rot % 360 = 360 - targetSectorAngle.
    const targetStopRotation = (360 - targetSectorAngle) % 360;

    // 4. Calculate total rotational degrees (add 5-7 complete laps for realistic velocity)
    const startRotation = currentRotationRef.current;
    const currentLapRotation = startRotation % 360;
    
    let additionalRotation = targetStopRotation - currentLapRotation;
    if (additionalRotation <= 0) {
      additionalRotation += 360;
    }

    const laps = 5 + Math.floor(Math.random() * 3);
    const finalRotation = startRotation + (360 * laps) + additionalRotation;

    // 5. Run smooth cubic ease-out loop
    let startTime: number | null = null;
    const durationMs = duration * 1000;
    lastActiveIndex.current = getPrizeAtRotation(startRotation);

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // Easing curve: easeOutQuartic
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const currentRot = startRotation + (finalRotation - startRotation) * easeProgress;
      
      setRotation(currentRot);

      // Dynamic motion-blur setting (highest at peak acceleration/speed, fades completely as it decelerates below 25% speed)
      const currentSpeed = 1 - progress; // desc curve from 1 to 0
      const currentBlur = currentSpeed > 0.25 ? Math.min((currentSpeed - 0.25) * 4, 3) : 0;
      setBlur(currentBlur);

      // Mechanical boundary-impact sound check
      const currentActiveIndex = getPrizeAtRotation(currentRot);
      if (currentActiveIndex !== lastActiveIndex.current) {
        playTick(soundEnabled);
        lastActiveIndex.current = currentActiveIndex;
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Safe final stop assignment
        setRotation(finalRotation);
        setIsSpinning(false);
        setBlur(0);
        playWinChime(soundEnabled);
        speakPrize(winnerPrize.name, soundEnabled);
        
        // Trigger celebratory pointer wiggle
        setShowWinWiggle(true);
        setTimeout(() => {
          setShowWinWiggle(false);
        }, 1200);

        setTimeout(() => {
          onSpinEnd(winnerPrize);
        }, 350);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // Generate high quality lights on outer rim (24 small bulb dots)
  const rimBulbs = Array.from({ length: 24 }).map((_, idx) => {
    const angle = (idx / 24) * 360;
    const pos = polarToCartesian(200, 200, 188, angle);
    // Alternate blinking frames
    const isLit = isSpinning 
      ? (idx % 3 === blinkPhase) 
      : (idx % 2 === blinkPhase);

    return (
      <circle
        key={idx}
        cx={pos.x}
        cy={pos.y}
        r={isLit ? 4 : 2.5}
        fill={isLit ? '#FCD34D' : '#D1D5DB'} // warm yellow amber vs plain soft grey
        className={`transition-all duration-100 ${isLit ? 'shadow-md filter drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]' : ''}`}
      />
    );
  });

  // Dynamic pointer deflection based on boundary collision
  const getPointerAngle = (): number => {
    if (prizes.length < 2 || !isSpinning) return 0;

    // Relative angle at 12 o'clock in local wheel space
    let relativeAngle = (360 - (rotation % 360)) % 360;
    if (relativeAngle < 0) relativeAngle += 360;

    const boundaries = [0, ...cumulativeAngles];
    let maxDeflection = 0;

    for (const b of boundaries) {
      // Find boundary position in world coordinates relative to 12 o'clock (0 deg)
      const worldBound = (b + rotation) % 360;
      
      // Compute signed distance to world 0 deg
      let offset = worldBound;
      if (offset > 180) offset -= 360; // range [-180, 180]

      // As wheel spins clockwise, pin approaches pointer from left (offset in [-7, 0])
      if (offset >= -7 && offset <= 0) {
        const t = (offset + 7) / 7; // 0 to 1
        const deflection = 15 * t;
        if (Math.abs(deflection) > Math.abs(maxDeflection)) {
          maxDeflection = deflection;
        }
      }
      // After passing, snap back to left (offset in [0, 3])
      else if (offset > 0 && offset <= 3) {
        const t = offset / 3; // 0 to 1
        const deflection = -6 * (1 - t);
        if (Math.abs(deflection) > Math.abs(maxDeflection)) {
          maxDeflection = deflection;
        }
      }
    }

    return maxDeflection;
  };

  const pointerAngle = getPointerAngle();

  return (
    <div className="flex flex-col items-center justify-center space-y-6 select-none bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      {/* Upper Wheel Utilities Header */}
      <div className="flex justify-between items-center w-full max-w-[400px]">
        <div className="text-sm font-medium text-slate-500">
          奖项数：<span className="text-slate-800 font-semibold">{prizes.length}</span> 个
        </div>
        
        {/* Sound FX Toggle Action Button */}
        <button
          onClick={onSoundToggle}
          id="sound-fx-toggle-btn"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold select-none border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100 active:scale-95 transition-all"
          title={soundEnabled ? '静音' : '开启声音'}
        >
          {soundEnabled ? (
            <>
              <Volume2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>有声</span>
            </>
          ) : (
            <>
              <VolumeX className="h-3.5 w-3.5 text-slate-400" />
              <span>静音</span>
            </>
          )}
        </button>
      </div>

      {/* Interactive Outer Container */}
      <div className="relative w-full max-w-[400px] aspect-square flex items-center justify-center p-4">
        
        {/* Absolute Pointer / Pointer Arrow at top center pointing strictly DOWN */}
        <div 
          className={`absolute top-0 z-30 flex flex-col items-center select-none pointer-events-none transform -translate-y-2 ${
            isSpinning 
              ? '' 
              : showWinWiggle 
              ? 'animate-pointer-win' 
              : isSpinButtonHovered 
              ? 'animate-pointer-hover' 
              : 'animate-pointer-idle'
          }`}
          style={{ transformOrigin: 'center 4px' }}
        >
          {/* Triangular Vector Arrow with rich gradients */}
          <svg 
            width="40" 
            height="40" 
            viewBox="0 0 40 40" 
            className="filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)]"
            style={{
              transform: `rotate(${pointerAngle}deg)`,
              transformOrigin: '20px 4px',
            }}
          >
            <path
              d="M12,4 L28,4 C34,4 34,10 30,16 L22,34 C21,36 19,36 18,34 L10,16 C6,10 6,4 12,4 Z"
              fill="url(#pointer-gradient)"
              stroke="#B91C1C"
              strokeWidth="2.5"
            />
            {/* Center light indicator node with rich dynamic charging/celebration glow */}
            <circle 
              cx="20" 
              cy="11" 
              r={isSpinning ? 4.5 + Math.sin(Date.now() / 40) * 1.5 : 4.5} 
              fill={showWinWiggle ? '#10B981' : isSpinning ? '#FBBF24' : '#FFFFFF'} 
              opacity="0.95" 
              className={`transition-colors duration-200 ${
                showWinWiggle 
                  ? 'filter drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]' 
                  : isSpinning 
                  ? 'filter drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]' 
                  : ''
              }`}
            />
            <defs>
              <linearGradient id="pointer-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="100%" stopColor="#991B1B" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Outer Shiny Circle Rim & Dynamic Segment Slices Wheel */}
        <div className={`relative w-full h-full rounded-full flex items-center justify-center transition-all duration-300 ${
          isSpinning 
            ? 'scale-[1.015] shadow-[0_20px_50px_rgba(244,63,94,0.2)]' 
            : showWinWiggle 
            ? 'animate-wheel-bounce shadow-[0_25px_60px_rgba(16,185,129,0.3)]' 
            : 'animate-wheel-breath hover:scale-[1.015]'
        }`}>
          
          <svg
            id="lucky-wheel-canvas"
            className="w-full h-full overflow-visible select-none"
            viewBox="0 0 400 400"
          >
            {/* SVG motion blur utility definition */}
            <defs>
              <filter id="spin-blur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation={blur} />
              </filter>
            </defs>

            {/* Shadows and Outer Rim Background Ring */}
            <circle cx="200" cy="200" r="195" fill="#1E293B" className="opacity-5" />
            <circle cx="200" cy="200" r="190" fill="#0F172A" /> {/* Dark core chassis */}
            <circle cx="200" cy="200" r="183" fill="#1E293B" stroke="#334155" strokeWidth="3" />

            {/* Slices Rotating Element Group with optional hardware-accelerated motion blur filter */}
            <g 
              style={{ 
                transform: `rotate(${rotation}deg)`, 
                transformOrigin: '200px 200px',
                filter: blur > 0.1 ? 'url(#spin-blur)' : 'none'
              }}
            >
              
              {/* Fallback for single prize containing entire circle */}
              {prizes.length === 1 ? (
                <>
                  <circle cx="200" cy="200" r="172" fill={prizes[0].color} />
                  <g style={{ transform: 'rotate(0deg)', transformOrigin: '200px 200px' }}>
                    <text
                      x="200"
                      y="110"
                      fill="#FFFFFF"
                      fontSize="14"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] font-sans"
                    >
                      {prizes[0].name.length > 12 ? prizes[0].name.slice(0, 10) + '...' : prizes[0].name}
                    </text>
                    <text
                      x="200"
                      y="132"
                      fill="rgba(255,255,255,0.8)"
                      fontSize="11"
                      fontFamily="monospace"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      100.0%
                    </text>
                  </g>
                </>
              ) : (
                prizes.map((prize, idx) => {
                  const startAngle = idx === 0 ? 0 : cumulativeAngles[idx - 1];
                  const endAngle = cumulativeAngles[idx];
                  const midAngle = startAngle + (endAngle - startAngle) / 2;
                  const sliceAngle = endAngle - startAngle;

                  // Text truncation if slice narrow
                  let label = prize.name;
                  if (sliceAngle < 15 && label.length > 2) {
                    label = label.slice(0, 1) + '..';
                  } else if (sliceAngle < 28 && label.length > 5) {
                    label = label.slice(0, 4) + '..';
                  } else if (label.length > 11) {
                    label = label.slice(0, 9) + '..';
                  }

                  const pctStr = `${((prize.weight / totalWeight) * 100).toFixed(1)}%`;
                  const fontSz = sliceAngle < 14 ? '8px' : sliceAngle < 25 ? '10px' : '12px';

                  return (
                    <g key={prize.id}>
                      {/* Weighted Sector Slice Arc */}
                      <path
                        d={describeArcSector(200, 200, 172, startAngle, endAngle)}
                        fill={prize.color}
                        stroke="#0F172A"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      
                      {/* Integrated radial rotated text inside Slice */}
                      {sliceAngle > 6 && (
                        <g style={{ transform: `rotate(${midAngle}deg)`, transformOrigin: '200px 200px' }}>
                          <text
                            x="200"
                            y="75"
                            fill="#FFFFFF"
                            fontSize={fontSz}
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] font-sans"
                            style={{ userSelect: 'none' }}
                          >
                            {label}
                          </text>
                          {sliceAngle > 18 && (
                            <text
                              x="200"
                              y="94"
                              fill="rgba(255,255,255,0.85)"
                              fontSize="9.5"
                              fontFamily="monospace"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
                            >
                              {pctStr}
                            </text>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })
              )}
            </g>

            {/* Glowing inner metallic border separator */}
            <circle cx="200" cy="200" r="172" fill="none" stroke="#2D3748" strokeWidth="2.5" opacity="0.3" pointerEvents="none" />

            {/* Rim Lights (LED neon dots) */}
            {rimBulbs}

            {/* High-speed visual speed arcs overlaying the spinning wheel */}
            {isSpinning && blur > 0.5 && (
              <g className="animate-speed-lines pointer-events-none" style={{ opacity: Math.min(blur / 2.5, 0.75) }}>
                {/* Visual speed arcs/streaks */}
                <circle cx="200" cy="200" r="150" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3.5" strokeDasharray="80 180" style={{ transformOrigin: '200px 200px', animation: 'spin-slow 0.4s linear infinite' }} />
                <circle cx="200" cy="200" r="120" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeDasharray="60 220" style={{ transformOrigin: '200px 200px', animation: 'spin-slow 0.25s linear infinite reverse' }} />
                <circle cx="200" cy="200" r="90" fill="none" stroke="rgba(244,63,94,0.45)" strokeWidth="2.5" strokeDasharray="100 120" style={{ transformOrigin: '200px 200px', animation: 'spin-slow 0.3s linear infinite' }} />
              </g>
            )}

            {/* Elegant Chrome Center Hub Cap Base (Stationary) */}
            <circle cx="200" cy="200" r="34" fill="#0F172A" stroke="#475569" strokeWidth="2" pointerEvents="none" />
            <circle cx="200" cy="200" r="28" fill="url(#center-reflection)" stroke="#1E293B" strokeWidth="1" pointerEvents="none" />
            
            <defs>
              <linearGradient id="center-reflection" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="45%" stopColor="#334155" />
                <stop offset="55%" stopColor="#1E293B" />
                <stop offset="100%" stopColor="#0F172A" />
              </linearGradient>
            </defs>
          </svg>

          {/* Core Central Clickable Action "SPIN" Circular Overlay Button */}
          <button
            onClick={spin}
            disabled={isSpinning || prizes.length < 2}
            onMouseEnter={() => !isSpinning && prizes.length >= 2 && setIsSpinButtonHovered(true)}
            onMouseLeave={() => setIsSpinButtonHovered(false)}
            id="center-spin-trigger-button"
            className={`absolute z-20 w-16 h-16 rounded-full flex flex-col items-center justify-center font-sans uppercase font-extrabold tracking-wide text-xs transition-all duration-150 select-none
              ${isSpinning 
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed scale-95 shadow-inner' 
                : prizes.length < 2
                ? 'bg-slate-300 text-slate-400 cursor-not-allowed'
                : 'bg-rose-500 hover:bg-rose-600 text-white cursor-pointer active:scale-90 hover:scale-105 shadow-[0_4px_12px_rgba(244,63,94,0.4)] hover:shadow-[0_6px_16px_rgba(244,63,94,0.6)]'
              }`}
          >
            {isSpinning ? (
              <span className="animate-pulse">SPINNING</span>
            ) : (
              <div className="flex flex-col items-center justify-center leading-none">
                <RotateCw className="h-4.5 w-4.5 mb-1.5 animate-spin-slow" />
                <span className="text-[12px] font-black">抽 奖</span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Basic Tip underneath */}
      {prizes.length < 2 && (
        <p className="text-xs font-semibold text-rose-500 mt-2 text-center animate-pulse">
          ⚠️ 提示：转盘需要至少 2 个奖项才可以开始抽奖哦！
        </p>
      )}
    </div>
  );
};
