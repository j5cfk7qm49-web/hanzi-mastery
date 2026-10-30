import React from 'react';
import { STUDY_NAMES, STUDY_SKILLS, type StudySkill } from '../core/study';
export function SkillSelection({ value, onChange, disabled }: { value: readonly StudySkill[]; onChange(value: StudySkill[]): void; disabled?: boolean }) {
  return <details className="hm-skill-selection"><summary>Study skills · {value.length} of {STUDY_SKILLS.length} selected</summary>
    <fieldset className="hm-form" disabled={disabled}><legend>Cards to create</legend>
      <div className="hm-actions"><button type="button" onClick={() => onChange([...STUDY_SKILLS])}>All skills</button>
        <button type="button" onClick={() => onChange([])}>Vocabulary only</button></div>
      {STUDY_SKILLS.map(skill => <label className="hm-check" key={skill}><input type="checkbox" checked={value.includes(skill)}
        onChange={event => onChange(event.target.checked ? [...value, skill] : value.filter(item => item !== skill))} />{STUDY_NAMES[skill]}</label>)}
    </fieldset></details>;
}
