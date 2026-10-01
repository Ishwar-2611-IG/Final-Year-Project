import { useEffect, useState } from "react";

interface LoadingBarProps {
  active: boolean;
  progress?: number;
  color?: string;
  height?: number;
}

export function LoadingBar({
  active,
  progress,
  color = '#6366f1',
  height = 3,
}: LoadingBarProps) {
  const [internalProgress, setInternalProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (active) {
      setVisible(true);

      interval = setInterval(() => {
        setInternalProgress((prev) => {
          if (prev >= 90) return prev;
          return Math.min(90, prev + Math.random() * 12);
        });
      }, 300);
    } else {
      setInternalProgress(100);

      const timeout = setTimeout(() => {
        setVisible(false);
        setInternalProgress(0);
      }, 500);

      return () => clearTimeout(timeout);
    }

    return () => interval && clearInterval(interval);
  }, [active]);

  const currentProgress = typeof progress === 'number' ? progress : internalProgress;

  if (!visible) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height,
          zIndex: 99999,
          background: 'rgba(255,255,255,0.03)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${currentProgress}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${color}, #818cf8, #22d3ee)`,
            transition: 'width 0.35s ease',
            boxShadow: `0 0 10px ${color}, 0 0 20px ${color}, 0 0 30px ${color}`,
            borderRadius: '0 4px 4px 0',
          }}
        />
      </div>

      {/* Animated shine */}
      {active && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: '-30%',
            width: '30%',
            height,
            zIndex: 100000,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
            animation: 'loading-shine 1.2s linear infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      <style>
        {`
          @keyframes loading-shine {
            from { left: -30%; }
            to { left: 100%; }
          }
        `}
      </style>
    </>
  );
}

export default LoadingBar;
