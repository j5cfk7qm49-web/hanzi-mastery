import React from 'react';
import type { RecordingSource } from '../core/schema';

export function RecordingCredit({ source }: { source: RecordingSource }) {
  return <p className="hm-caption"><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.provider}</a>
    {' · '}{source.author}{' · '}<a href={source.licenseUrl} target="_blank" rel="noreferrer">{source.license}</a></p>;
}
