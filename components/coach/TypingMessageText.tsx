import { CoachMessageText } from "@/components/coach/CoachMessageText";
import { useEffect, useRef, useState } from "react";

interface TypingMessageTextProps {
  content: string;
  variant: "user" | "assistant";
  // True only on a freshly-arrived reply's first render; history/re-renders show full text immediately.
  animate: boolean;
  onProgress?: () => void;
}

const CHARS_PER_SECOND = 105;

// Reveals `content` a bit at a time. Uses real elapsed time via requestAnimationFrame, not a tick counter, so pace stays even if a frame drops.
export function TypingMessageText({
  content,
  variant,
  animate,
  onProgress,
}: TypingMessageTextProps) {
  const [revealedLength, setRevealedLength] = useState(
    animate ? 0 : content.length,
  );
  const startedAtRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) {
      setRevealedLength(content.length);
      return;
    }

    setRevealedLength(0);
    startedAtRef.current = null;

    const tick = (now: number) => {
      if (startedAtRef.current === null) startedAtRef.current = now;
      const elapsedSeconds = (now - startedAtRef.current) / 1000;
      const next = Math.min(
        content.length,
        Math.floor(elapsedSeconds * CHARS_PER_SECOND),
      );
      setRevealedLength(next);
      onProgress?.();
      if (next < content.length) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, animate]);

  return (
    <CoachMessageText
      content={content.slice(0, revealedLength)}
      variant={variant}
    />
  );
}
