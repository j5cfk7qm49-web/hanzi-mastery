import React from 'react';

/** Keep render/effect startup failures visible instead of leaving an empty review iframe. */
export class WidgetBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="hm" role="alert">
      <h1>Hanzi Mastery could not start</h1>
      <p>Close and reopen this view. If it stays unavailable, report diagnostic code HM-START.</p>
    </div>;
    return this.props.children;
  }
}
