import React, { useEffect, useRef, useState } from 'react';
import HanziWriter, { type CharacterJson, type StrokeData } from 'hanzi-writer';
import type { Settings } from '../core/config';
import { CHARACTER_OVERRIDES } from '../data/overrides';
export interface WriterCanvasProps {
  character: string; data: CharacterJson; mode: 'test' | 'learn'; active: boolean;
  settings: Settings; generation: number;
  resumeStrokeNum?: number;
  onCorrect(data: StrokeData): void; onMistake(data: StrokeData): void;
  onComplete(): void; onError(): void;
  onInputCancelled?(): void;
}
export function WriterCanvas(props: WriterCanvasProps) {
  const canvas = useRef<HTMLDivElement>(null), shell = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriter | null>(null);
  const latest = useRef(props); latest.current = props;
  const characterData = useRef(new Map<string, CharacterJson>());
  characterData.current.set(props.character, props.data);
  const [ready, setReady] = useState(false);
  const [practiceVersion, setPracticeVersion] = useState(0);
  const operation = useRef(0);
  const canvasWidth = useRef(0);
  const recoverInput = useRef<() => void>(() => {});
  useEffect(() => {
    const node = canvas.current!;
    let live = true;
    const token = ++operation.current;
    setReady(false);
    // Reuse one engine for a mounted canvas. Hanzi Writer has no public destroy API.
    if (!writer.current) writer.current = new HanziWriter(node, {
      width: 280, height: 280, padding: 16, showCharacter: false, showOutline: false,
      charDataLoader: (character, resolve, reject) => {
        const data = characterData.current.get(character);
        if (data) resolve(data); else reject();
      },
      showHintAfterMisses: false, markStrokeCorrectAfterMisses: false, acceptBackwardsStrokes: false,
      highlightOnComplete: false, strokeColor: '#147d72', drawingColor: '#147d72', outlineColor: '#b8c9cc',
      strokeAnimationSpeed: props.settings.animationSpeed,
    });
    const engine = writer.current;
    engine.cancelQuiz();
    let accepted = props.resumeStrokeNum || 0, quizToken = 0;
    const valid = () => live && token === operation.current;
    void (async () => {
      try {
        await engine.setCharacter(props.character);
        if (!valid()) return;
        const learning = props.mode === 'learn';
        await engine.hideCharacter({ duration: 0 });
        if (learning) await engine.showOutline({ duration: 0 });
        else await engine.hideOutline({ duration: 0 });
        if (!valid()) return;
        setReady(true);
        const beginQuiz = () => {
          const currentQuiz = ++quizToken;
          return engine.quiz({
          leniency: learning ? 1.4 : (CHARACTER_OVERRIDES[props.character]?.leniency ?? props.settings.leniency),
          showHintAfterMisses: learning ? 2 : false, markStrokeCorrectAfterMisses: false,
          acceptBackwardsStrokes: false, highlightOnComplete: learning,
          quizStartStrokeNum: accepted,
          onMistake: data => { if (valid() && currentQuiz === quizToken && !learning) latest.current.onMistake(data); },
          onCorrectStroke: data => { if (valid() && currentQuiz === quizToken) { accepted = data.strokeNum+1; if (!learning) latest.current.onCorrect(data); } },
          onComplete: () => { if (valid() && currentQuiz === quizToken && !learning) latest.current.onComplete(); },
        }); };
        recoverInput.current = () => {
          if (!valid() || accepted >= props.data.strokes.length) return;
          engine.cancelQuiz();
          // Restore only the strokes already completed, using the public quiz start option.
          void beginQuiz().catch(() => { if (valid()) latest.current.onError(); });
          latest.current.onInputCancelled?.();
        };
        if (props.active) await beginQuiz();
      } catch { if (valid()) latest.current.onError(); }
    })();
    return () => { live = false; operation.current++; recoverInput.current = () => {}; engine.cancelQuiz(); };
  }, [props.character, props.data, props.mode, props.active, props.generation, practiceVersion, props.settings.leniency]);
  useEffect(() => {
    const resize = () => {
      const node = shell.current;
      const style = node && window.getComputedStyle(node);
      const gutters = style ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) : 0;
      // Reserve the canvas border and scroll margins instead of squeezing its SVG with CSS.
      const available = (node?.clientWidth || 280) - gutters - 2;
      const width = Math.max(1, Math.min(props.settings.canvasSize, available));
      if (width === canvasWidth.current) return;
      canvasWidth.current = width;
      writer.current?.updateDimensions({ width, height: width, padding: 16 });
    };
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (shell.current) observer?.observe(shell.current);
    return () => observer?.disconnect();
  }, [props.settings.canvasSize]);
  useEffect(() => {
    const node = canvas.current!;
    const cancel = () => recoverInput.current();
    node.addEventListener('touchcancel', cancel);
    return () => node.removeEventListener('touchcancel', cancel);
  }, []);
  useEffect(() => {
    // Scroll through the browser's normal ancestors, including the host queue pane.
    // This keeps the whole drawing surface reachable after starting or resuming.
    if (!ready || !props.active) return;
    const revealCanvas = () => (canvas.current?.closest('.hm-writing-stage') || shell.current)?.scrollIntoView?.({ block: 'nearest' });
    revealCanvas();
    // The SDK sends a ResizeObserver message to the host asynchronously.
    const settled = window.setTimeout(revealCanvas, 300);
    // Never move the surface under a finger/Pencil or override a user's scroll gesture.
    const stopAutoScroll = () => window.clearTimeout(settled);
    document.addEventListener('touchstart', stopAutoScroll, { capture: true, passive: true });
    document.addEventListener('mousedown', stopAutoScroll, true);
    document.addEventListener('pointerdown', stopAutoScroll, true);
    document.addEventListener('wheel', stopAutoScroll, { capture: true, passive: true });
    return () => {
      window.clearTimeout(settled);
      document.removeEventListener('touchstart', stopAutoScroll, true);
      document.removeEventListener('mousedown', stopAutoScroll, true);
      document.removeEventListener('pointerdown', stopAutoScroll, true);
      document.removeEventListener('wheel', stopAutoScroll, true);
    };
  }, [ready, props.active, props.generation]);
  return <div ref={shell} className="hm-canvas-shell">
    <div ref={canvas} className="hm-canvas" role="application" aria-label="Chinese handwriting canvas" aria-busy={!ready} />
    {!ready && <p role="status">Preparing writing canvas…</p>}
    <p className="hm-scroll-hint">Draw in the square. Swipe beside it to scroll.</p>
    {props.mode === 'learn' && <div className="hm-actions">
      <button disabled={!ready || !props.active} onClick={() => { recoverInput.current = () => {}; writer.current?.cancelQuiz(); void writer.current?.animateCharacter().catch(() => latest.current.onError()); }}>Animate strokes</button>
      <button disabled={!ready} onClick={() => setPracticeVersion(v => v+1)}>Practice again</button>
      <button disabled={!ready || !props.active} onClick={() => { recoverInput.current = () => {}; writer.current?.cancelQuiz(); void writer.current?.showCharacter().catch(() => latest.current.onError()); }}>Show character</button>
    </div>}
  </div>;
}
