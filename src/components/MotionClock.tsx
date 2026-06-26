"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DURATION, FPS, clamp } from "@/lib/jumpMotion";
import type { PhaseMarker } from "@/types/exercise";

/**
 * Gemeinsame Animations-Uhr. JumpForceLab (Stage + Steuerung) und KneeFrontal
 * (Knie-Detail) liegen im Mockup in getrennten Karten, laufen aber synchron.
 * Diese Uhr hält die Zeit `t` zentral, damit beide Medien-Komponenten
 * deckungsgleich animieren.
 */
interface MotionClockApi {
  t: number;
  duration: number;
  fps: number;
  playing: boolean;
  rate: number;
  phases: PhaseMarker[];
  toggle: () => void;
  setPlaying: (p: boolean) => void;
  seek: (t: number) => void;
  stepFrame: (dir: number) => void;
  nudge: (sec: number) => void;
  setRate: (r: number) => void;
}

const Ctx = createContext<MotionClockApi | null>(null);

export function useMotionClock(): MotionClockApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMotionClock muss innerhalb von <MotionClockProvider> verwendet werden");
  return c;
}

export function MotionClockProvider({
  duration = DURATION,
  fps = FPS,
  phases = [],
  children,
}: {
  duration?: number;
  fps?: number;
  phases?: PhaseMarker[];
  children: React.ReactNode;
}) {
  const [t, setT] = useState(0);
  const [playing, setPlayingState] = useState(false);
  const [rate, setRate] = useState(1);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const setPlaying = useCallback((p: boolean) => setPlayingState(p), []);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
      return;
    }
    const loop = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setT((prev) => {
        const next = prev + dt * rateRef.current;
        if (next >= duration) {
          setPlayingState(false);
          return duration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, duration]);

  const toggle = useCallback(() => setPlayingState((p) => !p), []);
  const seek = useCallback((nt: number) => setT(clamp(nt, 0, duration)), [duration]);
  const stepFrame = useCallback(
    (dir: number) => {
      setPlayingState(false);
      setT((prev) => clamp(prev + (dir * 1) / fps, 0, duration));
    },
    [fps, duration],
  );
  const nudge = useCallback(
    (sec: number) => {
      setPlayingState(false);
      setT((prev) => clamp(prev + sec, 0, duration));
    },
    [duration],
  );

  const api: MotionClockApi = {
    t,
    duration,
    fps,
    playing,
    rate,
    phases,
    toggle,
    setPlaying,
    seek,
    stepFrame,
    nudge,
    setRate,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
