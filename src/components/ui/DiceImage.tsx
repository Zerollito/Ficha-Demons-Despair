import React, { useMemo, useState } from "react";
import { diceBase64 } from "../../diceIcons";
import { cn } from "../../lib/utils";

interface DiceImageProps {
  sides: number;
  fileName?: string;
  className?: string;
}

// Geometric SVG fallbacks for polyhedral dice
const PolyhedralSvg = ({ sides }: { sides: number }) => {
  switch (sides) {
    case 4:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full text-amber-500/80 stroke-current fill-amber-500/10" strokeWidth="2">
          <polygon points="20,4 36,34 4,34" />
          <line x1="20" y1="4" x2="20" y2="24" strokeDasharray="1,1" />
          <line x1="4" y1="34" x2="20" y2="24" strokeDasharray="1,1" />
          <line x1="36" y1="34" x2="20" y2="24" strokeDasharray="1,1" />
        </svg>
      );
    case 6:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full text-amber-500/80 stroke-current fill-amber-500/10" strokeWidth="2">
          <rect x="6" y="6" width="28" height="28" rx="4" />
          <circle cx="13" cy="13" r="2.5" className="fill-amber-400" />
          <circle cx="27" cy="27" r="2.5" className="fill-amber-400" />
          <circle cx="20" cy="20" r="2.5" className="fill-amber-400" />
        </svg>
      );
    case 8:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full text-amber-500/80 stroke-current fill-amber-500/10" strokeWidth="2">
          <polygon points="20,2 38,20 20,38 2,20" />
          <line x1="2" y1="20" x2="38" y2="20" />
          <line x1="20" y1="2" x2="20" y2="38" />
        </svg>
      );
    case 10:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full text-amber-500/80 stroke-current fill-amber-500/10" strokeWidth="2">
          <polygon points="20,3 36,15 29,36 11,36 4,15" />
          <line x1="20" y1="3" x2="20" y2="24" />
          <line x1="4" y1="15" x2="20" y2="24" />
          <line x1="36" y1="15" x2="20" y2="24" />
        </svg>
      );
    case 12:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full text-amber-500/80 stroke-current fill-amber-500/10" strokeWidth="2">
          <polygon points="20,3 35,9 38,25 28,37 12,37 2,25 5,9" />
          <circle cx="20" cy="20" r="5" strokeDasharray="2,2" />
        </svg>
      );
    case 20:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full text-amber-500/80 stroke-current fill-amber-500/10" strokeWidth="2">
          <polygon points="20,3 37,13 37,27 20,37 3,27 3,13" />
          <polygon points="20,10 32,24 8,24" strokeWidth="1.5" />
          <line x1="20" y1="3" x2="20" y2="10" />
          <line x1="37" y1="13" x2="32" y2="24" />
          <line x1="3" y1="13" x2="8" y2="24" />
          <line x1="37" y1="27" x2="32" y2="24" />
          <line x1="3" y1="27" x2="8" y2="24" />
          <line x1="20" y1="37" x2="20" y2="24" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full text-amber-500/80 stroke-current fill-amber-500/10" strokeWidth="2">
          <circle cx="20" cy="20" r="16" />
          <text x="20" y="24" textAnchor="middle" fill="currentColor" stroke="none" fontSize="12" fontWeight="bold">
            %{sides}
          </text>
        </svg>
      );
  }
};

const DiceImage = React.memo(({
  sides,
  fileName,
  className,
}: DiceImageProps) => {
  const [error, setError] = useState(false);

  const src = useMemo(() => {
    if (!fileName) {
      return diceBase64[`d${sides}.png`] || null;
    }
    const cleanName = fileName.startsWith("/")
      ? fileName.substring(1)
      : fileName;
    return diceBase64[cleanName] || null;
  }, [fileName, sides]);

  if (src && !error) {
    return (
      <div
        className={cn("relative flex items-center justify-center select-none", className)}
      >
        <img
          src={src}
          alt={`d${sides}`}
          className="w-full h-full object-contain filter invert brightness-[2] contrast-125 transition-transform duration-200"
          style={{ filter: "invert(1) brightness(1.8) contrast(1.2)" }}
          referrerPolicy="no-referrer"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 shadow-inner select-none",
        className
      )}
    >
      <div className="w-full h-full flex items-center justify-center">
        <PolyhedralSvg sides={sides} />
      </div>
    </div>
  );
});

DiceImage.displayName = "DiceImage";

export { DiceImage };
