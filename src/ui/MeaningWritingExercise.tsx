import React, { useMemo, useRef } from 'react';
import { DEFAULT_SETTINGS } from '../core/config';
import { characters } from '../core/schema';
import { recallTargetKey } from '../core/recall';
import { MasteryRepository } from '../services/persistence';
import { ReviewExercise, type WritingSummary } from './ReviewExercise';
import type { RecallExerciseProps } from './RecallExercise';

/** Translation keeps its native scheduling and result identity, using the same writing engine. */
export function MeaningWritingExercise({ context, repository, settings = DEFAULT_SETTINGS, assetRoot, fitToCard, ...host }: RecallExerciseProps) {
  const schema = context.schema;
  const stable = useRef({ cardId: context.cardId,
    vocabularyId: `meaning:${schema.vocabularyId}:${recallTargetKey(schema)}`,
    chars: characters(schema.traditional), prompt: schema.meaning });
  const mastery = useMemo(() => new MasteryRepository(repository.storage), [repository]);
  const writingSettings = useMemo(() => ({ ...settings, script: 'traditional' as const }), [settings]);
  const save = async (summary: WritingSummary) => {
    await repository.save(schema, { id: summary.id, at: summary.at, cardId: context.cardId,
      result: { passed: summary.passed, accuracy: summary.accuracy, total: summary.total, spellingCorrect: 0, tonesCorrect: 0,
        assessment: 'checked', ...(summary.failure ? { failure: summary.failure === 'answer-revealed' ? 'answer-revealed' as const : 'forgotten' as const } : {}) } });
  };
  return <ReviewExercise context={stable.current} settings={writingSettings} repository={mastery} assetRoot={assetRoot} fitToCard={fitToCard}
    skillLabel="Meaning to characters" regionLabel="Hanzi Mastery study review" onSaveResult={save} {...host} />;
}
