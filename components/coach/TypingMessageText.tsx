import { CoachMessageText } from "@/components/coach/CoachMessageText";
import { useEffect, useRef, useState } from "react";

interface TypingMessageTextProps {
  content: string;
  variant: "user" | "assistant";
  // Only a message's very first render as a freshly-arrived reply should
  // type in — history loaded from the server, and this same message on any
  // later re-render, just shows the full text immediately.
  animate: boolean;
  onProgress?: () => void;
}

const CHARS_PER_SECOND = 105;

// Reveals `content` a bit at a time to read as typing rather than a chat
// bubble popping in fully-formed. Driven by requestAnimationFrame computing
// how many characters *should* be visible from real elapsed time (not a
// fixed-size step per tick), so the pace stays even even if a frame or two
// gets dropped — a naive setInterval counter would visibly stutter instead.
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
