import React, { useMemo, useState } from "react";
import { diceBase64 } from "../../diceIcons";
import { cn } from "../../lib/utils";

interface DiceImageProps {
  sides: number;
  fileName?: string;
  className?: string;
}

const DiceImage = React.memo(({
  sides,
  fileName,
  className,
}: DiceImageProps) => {
  const [error, setError] = useState(false);

  const src = useMemo(() => {
    if (!fileName) {
      // Auto-generate filename if not provided
      return diceBase64[`d${sides}.png`] || null;
    }
    // Remove leading slash if present
    const cleanName = fileName.startsWith("/")
      ? fileName.substring(1)
      : fileName;
    return diceBase64[cleanName] || null;
  }, [fileName, sides]);

  if (src && !error) {
    return (
      <div
        className={cn("relative flex items-center justify-center", className)}
      >
        <img
          src={src}
          alt={`d${sides}`}
          className="w-full h-full object-contain filter invert brightness-[2] contrast-125"
          referrerPolicy="no-referrer"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-amber-500/10 rounded-lg border border-amber-500/20",
        className
      )}
    >
      <span className="text-[10px] font-bold text-amber-500/40">d{sides}</span>
    </div>
  );
});

DiceImage.displayName = "DiceImage";

export { DiceImage };
