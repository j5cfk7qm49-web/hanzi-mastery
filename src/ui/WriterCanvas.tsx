import React, { useEffect, useRef, useState } from 'react';
import HanziWriter, { type CharacterJson, type StrokeData } from 'hanzi-writer';
import type { Settings } from '../core/config';
import { CHARACTER_OVERRIDES } from '../data/overrides';
export interface WriterCanvasProps {
  character: string; data: CharacterJson; mode: 'test' | 'learn'; active: boolean;
  settings: Settings; generation: number;
  onCorrect(data: StrokeData): void; onMistake(data: StrokeData): void;
  onComplete(): void; onError(): void;
}
export function WriterCanvas(props: WriterCanvasProps) {
  const canvas = useRef<HTMLDivElement>(null), shell = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriter | null>(null);
  const latest = useRef(props); latest.current = props;
  const [ready, setReady] = useState(false);
  const [practiceVersion, setPracticeVersion] = useState(0);
  const operation = useRef(0);
  useEffect(() => {
    const node = canvas.current!;
    let live = true;
    const token = ++operation.current;
    setReady(false);
    // Reuse one engine for a mounted canvas. Hanzi Writer has no public destroy API.
    if (!writer.current) writer.current = new HanziWriter(node, {
      width: 280, height: 280, padding: 16, showCharacter: false, showOutline: false,
      charDataLoader: (_char, resolve) => { resolve(latest.current.data); },
      showHintAfterMisses: false, markStrokeCorrectAfterMisses: false, acceptBackwardsStrokes: false,
      highlightOnComplete: false, strokeColor: '#147d72', drawingColor: '#147d72', outlineColor: '#b8c9cc',
      strokeAnimationSpeed: props.settings.animationSpeed,
    });
    const engine = writer.current;
    engine.cancelQuiz();
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
        if (props.active) await engine.quiz({
          leniency: learning ? 1.4 : (CHARACTER_OVERRIDES[props.character]?.leniency ?? props.settings.leniency),
          showHintAfterMisses: learning ? 2 : false, markStrokeCorrectAfterMisses: false,
          acceptBackwardsStrokes: false, highlightOnComplete: learning,
          onMistake: data => { if (valid() && !learning) latest.current.onMistake(data); },
          onCorrectStroke: data => { if (valid() && !learning) latest.current.onCorrect(data); },
          onComplete: () => { if (valid() && !learning) latest.current.onComplete(); },
        });
      } catch { if (valid()) latest.current.onError(); }
    })();
    return () => { live = false; operation.current++; engine.cancelQuiz(); };
  }, [props.character, props.data, props.mode, props.active, props.generation, practiceVersion]);
  useEffect(() => {
    const resize = () => {
      const width = Math.max(180, Math.min(props.settings.canvasSize, shell.current?.clientWidth || 280));
      writer.current?.updateDimensions({ width, height: width, padding: 16 });
    };
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (shell.current) observer?.observe(shell.current);
    return () => observer?.disconnect();
  }, [props.settings.canvasSize]);
  return <div ref={shell} className="hm-canvas-shell">
    <div ref={canvas} className="hm-canvas" role="application" aria-label="Chinese handwriting canvas" aria-busy={!ready} />
    {!ready && <p role="status">Preparing writing canvas…</p>}
    {props.mode === 'learn' && <div className="hm-actions">
      <button disabled={!ready} onClick={() => { writer.current?.cancelQuiz(); void writer.current?.animateCharacter(); }}>Animate strokes</button>
      <button disabled={!ready} onClick={() => setPracticeVersion(v => v+1)}>Practice again</button>
      <button disabled={!ready} onClick={() => { writer.current?.cancelQuiz(); void writer.current?.showCharacter(); }}>Show character</button>
    </div>}
  </div>;
}
