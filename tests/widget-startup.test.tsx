import React, { useEffect } from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WidgetBoundary } from '../src/ui/WidgetBoundary';
import { createId } from '../src/core/ids';

it('creates distinct UUIDs without the secure-context-only randomUUID API', () => {
  const original = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
  try {
    const ids = Array.from({ length: 1024 }, createId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/.test(id))).toBe(true);
  } finally {
    if (original) Object.defineProperty(crypto, 'randomUUID', original);
    else delete (crypto as Partial<Crypto>).randomUUID;
  }
});

it.each(['render', 'effect'])('shows a diagnostic instead of a blank widget after a %s startup crash', phase => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  function BrokenView() {
    useEffect(() => { if (phase === 'effect') throw new Error('fixture effect startup failure'); }, []);
    if (phase === 'render') throw new Error('fixture render startup failure');
    return <p>Starting</p>;
  }
  try {
    render(<WidgetBoundary><BrokenView /></WidgetBoundary>);
    expect(screen.getByRole('alert').textContent).toContain('HM-START');
    expect(screen.getByRole('heading', { name: 'Hanzi Mastery could not start' })).toBeTruthy();
  } finally { errors.mockRestore(); }
});
