import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createId } from '../core/ids';
import { DEFAULT_SETTINGS, type Settings } from '../core/config';
import { ReviewExercise, type WritingSummary } from '../ui/ReviewExercise';
import { PronunciationRecorder } from '../ui/PronunciationRecorder';
import { PinyinInput } from '../ui/PinyinInput';
import type { SyncedStore } from '../services/persistence';
import { assessAnswer, shuffled, type StudyPack, type StudyItem, type StudySession, type ItemProgress, type StudyEvent } from './model';
import { StudyPackRepository, PackAudioStore } from './repository';
import { importHandoff } from './import';
import { CircleExercise } from './CircleExercise';
import './styles.css';
import { RemStudySource } from './nativeRems';
import { sourceLabel } from './sourceLabel';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { bindNativeStudyReviews } from '../services/nativeStudyReviews';
import { DictionaryLinks } from '../ui/DictionaryLinks';
import { auditNativeStudyCleanup } from './cleanup';
import { syncStudyResult } from './queueSync';
import {wordOrderHelp} from './wordOrderHelp';
import {particleHelp} from './particleHelp';

export interface StudyPacksProps { storage:SyncedStore; plugin?:RNPlugin; assetRoot?:string; settings?:Settings }
const name = (mode:string) => mode==='sound-recognition' ? 'Pronunciation' : mode==='dictation' ? 'Listening / dictation' : mode.replaceAll('-',' ');
export function StudyPacks({ storage, plugin, assetRoot, settings = DEFAULT_SETTINGS }:StudyPacksProps) {
  const source=useMemo(()=>plugin ? new RemStudySource(plugin,message=>setStatus(message)) : undefined,[plugin]);
  const repository = useMemo(() => new StudyPackRepository(storage,source),[storage,source]);
  const [listLink,setListLink]=useState('');
  const audio = useMemo(() => new PackAudioStore(),[]);
  const [pack,setPack] = useState<StudyPack>(), [progress,setProgress] = useState<Record<string,ItemProgress>>({});
  const [session,setSession] = useState<StudySession>(), [screen,setScreen] = useState<'dashboard'|'exercise'>('dashboard');
  const [sessions,setSessions] = useState<Record<number,StudySession>>({});
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [error,setError] = useState(''), [status,setStatus] = useState('');
  const [section,setSection] = useState(0), [mode,setMode] = useState(''), [installAudio,setInstallAudio] = useState(true);
  const [draftStatus,setDraftStatus] = useState(''), pending = useRef<ReturnType<typeof setTimeout>>(), guard = useRef(false);
  const [queueSync,setQueueSync]=useState(!!plugin);
  const surface=useRef<HTMLElement>(null);
  const practiceControls=useRef<HTMLElement>(null);
  const resumeControls=useRef<HTMLDivElement>(null);
  const latest = useRef(session); latest.current=session;
  const activePack = useRef(pack); activePack.current=pack;
  const load = async () => {
    const saved = await repository.pack(); setPack(saved);
    if(saved && plugin){await auditNativeStudyCleanup(plugin);await bindNativeStudyReviews(plugin,saved);}
    if (saved) { setQueueSync(!!plugin && await storage.getSynced<boolean>(repository.key(saved.studyPackId,'queue-sync-enabled'))!==false);setProgress(await repository.progress(saved)); const stored = await repository.session(saved.studyPackId);
      const restored=await repository.sessions(saved);setSessions(restored);
      const recent=Object.entries(restored).find(([,s])=>s.id===stored?.id);
      const selected=recent ? Number(recent[0]) : 0;setSection(selected);setMode('');setSession(restored[selected]);
    }
  };
  useEffect(() => { let live=true; void load().catch(e => { if(live) setError(String(e.message || e)); }).finally(() => {if(live)setLoading(false);});
    return () => {live=false; const unsaved=!!pending.current;clearTimeout(pending.current);pending.current=undefined;
      // A workbench tab change may unmount us before the debounce. Flush the latest draft.
      const saved=latest.current; if(unsaved && saved && activePack.current)void repository.saveSession(activePack.current.studyPackId,saved).catch(() => {});
    }; },[repository]);
  const run = async (task:() => Promise<void>) => { if(guard.current)return; guard.current=true;setBusy(true);setError('');
    try { await task(); } catch(e) { setError(e instanceof Error ? e.message : 'Operation failed.'); } finally {guard.current=false;setBusy(false);} };
  const persist = async (next:StudySession,startNew=false) => {
    if (!pack) return;
    clearTimeout(pending.current);pending.current=undefined; latest.current=next;setSession(next);setDraftStatus('Saving progress…');
    const saved=await repository.saveSession(pack.studyPackId,next,startNew);latest.current=saved;setSession(saved);setSessions(s=>({...s,[saved.section ?? 0]:saved})); setDraftStatus('Progress saved.');
  };
  const draft = (patch:Partial<NonNullable<StudySession['draft']>>) => {
    const now=latest.current; if(!now || !pack)return;
    const next={...now,draft:{itemId:now.ids[now.index],answer:'',submitted:false,...now.draft,...patch}};
    latest.current=next;setSession(next);setDraftStatus('Saving draft…');clearTimeout(pending.current);
    pending.current=setTimeout(() => {pending.current=undefined; void repository.saveSession(pack.studyPackId,next).then(saved => {
      if(latest.current===next){latest.current=saved;setSession(saved);setSessions(s=>({...s,[saved.section ?? 0]:saved}));setDraftStatus('Progress saved.');}
    }).catch(e => setError(e.message)); },400);
  };
  const start = (items:StudyItem[], label:string,scope=section) => run(async () => {
    if(!pack || !items.length) {setStatus('No matching activities.');return;}
    await persist({id:createId(),section:scope,sourceVersion:pack.sourceVersion,ids:shuffled(items).map(i => i.id),index:0,label},true);setSection(scope);setScreen('exercise');
  });
  const selectSection = (selected:number,showControls=false) => {
    setSection(selected);setMode('');setSession(sessions[selected]);
    if(showControls)requestAnimationFrame(()=>{
      const saved=sessions[selected],target=saved && saved.index<saved.ids.length ? resumeControls.current : practiceControls.current;
      target?.scrollIntoView?.({block:'start'});target?.focus({preventScroll:true});
    });
  };
  const item = pack?.items.find(i => i.id === session?.ids[session.index]);
  useEffect(()=>{if(screen==='exercise'){const popup=surface.current?.closest('.hm-popup');if(popup)popup.scrollTop=0;}},[screen,item?.id]);
  const response = session?.draft?.itemId === item?.id ? session?.draft : undefined;
  const savedResult=item && session ? progress[item.id]?.events.find(e=>e.id===`${session.id}:${item.id}`) : undefined;
  const saveResult = async (passed:boolean, assessment:'checked'|'self', summaryId?:string) => {
    if(!pack || !item || !latest.current)throw new Error('No active study item.');
    const event = {id:summaryId || `${latest.current.id}:${item.id}`,at:Date.now(),passed,assessment};
    const saved=await repository.record(pack.studyPackId,item.id,event);setProgress(p => ({...p,[item.id]:saved}));
    // A retry must use the learner's saved assessment, even if another button
    // was pressed after a failed schedule update.
    const original=saved.events.find(e=>e.id===event.id)!;
    const syncStatus=plugin && queueSync ? await syncStudyResult(plugin,repository,pack.studyPackId,item,original,pack.items.flatMap(i=>i.remId?[i.remId]:[])) : 'Practice result saved and read back. RemNote schedule unchanged.';
    setStatus(syncStatus);
  };
  const next = (passed:boolean, assessment:'checked'|'self') => run(async () => {
    await saveResult(passed,assessment);
    await persist({...latest.current!,index:latest.current!.index+1,draft:undefined});
  });
  const candidates = pack?.items.filter(i => (!section || i.section === section) && (!mode || i.mode === mode)) || [];
  const unstudied = candidates.filter(i => !progress[i.id]?.attempts);
  const missed = candidates.filter(i => progress[i.id]?.lastPassed===false);
  const attempted = pack?.items.filter(i=>progress[i.id]?.attempts>0).length || 0;
  const needsPractice = pack?.items.filter(i=>progress[i.id]?.lastPassed===false).length || 0;
  const selectedTitle = section ? pack?.sections.find(s=>s.id===section)?.title : 'All sections';
  const savedItems = session && pack ? session.ids.map(id => pack.items.find(i => i.id===id)).filter((i):i is StudyItem => !!i) : [];
  const savedSections = [...new Set(savedItems.map(i => i.section))], savedModes = [...new Set(savedItems.map(i => i.mode))];
  const savedScope = [savedSections.length===1 ? pack?.sections.find(s => s.id===savedSections[0])?.title || `Section ${savedSections[0]}` : 'Multiple sections',savedModes.length===1 ? name(savedModes[0]) : 'Multiple activity types'].join(' · ');
  return <section ref={surface} className="hm-study-packs" aria-label="Optional study packs">
    {screen==='dashboard' && <header className="hm-pack-heading"><div><p className="hm-pack-eyebrow">COURSE PRACTICE</p><h2>Midterm review</h2><p className="hm-caption">Your course Rems, ready to practice. Work through a list once, then revisit missed items.</p></div>{pack?.scheduledCardsPaused && !loading && !error && <span className="hm-pack-badge">Scheduled cards paused</span>}</header>}
    {loading && <p role="status">Loading course study…</p>}
    {error && <p role="alert" className="hm-error">{error} {session && (savedResult && screen==='exercise' ? <button disabled={busy} onClick={()=>void next(savedResult.passed,savedResult.assessment)}>Retry card update and continue</button> : <button disabled={busy} onClick={() => void run(() => persist(latest.current!))}>Retry session save</button>)}</p>}
    {!error && screen==='exercise' && savedResult && item?.kind!=='writing' && <p role="status">Your result for this activity is saved. Finish updating its card and continue without answering again. <button disabled={busy} onClick={()=>void next(savedResult.passed,savedResult.assessment)}>Finish saved result</button></p>}
    {status && <p role="status" className="hm-pack-notice">{status}</p>}
    {screen==='dashboard' && !loading && <>
      {pack && <><h3 className="hm-pack-title">{pack.title}</h3>
        <div className="hm-pack-stats" aria-label="Course progress"><div><strong>{attempted}<small> / {pack.items.length}</small></strong><span>Attempted</span></div><div><strong>{needsPractice}</strong><span>Need practice</span></div><div><strong>{pack.items.length-attempted}</strong><span>Unstudied</span></div></div>
        {session && session.index<session.ids.length && <div ref={resumeControls} tabIndex={-1} className="hm-pack-resume" role="group" aria-label="Saved session"><p><strong>Saved session:</strong> {savedScope} · {session.label}</p><p className="hm-caption">Resume continues this saved list and position. The activity filter applies to new sessions.</p><button className="hm-primary" disabled={busy} onClick={() => {setScreen('exercise');setStatus('');}}>Resume ({session.index+1}/{session.ids.length})</button></div>}
        <div className="hm-pack-sections">{pack.sections.map(s => { const items=pack.items.filter(i => i.section===s.id),passed=items.filter(i=>progress[i.id]?.lastPassed).length; return <button key={s.id} disabled={busy} aria-pressed={section===s.id} onClick={() => selectSection(s.id,true)}><span className="hm-pack-section-number">{s.id}</span><span className="hm-pack-section-copy">{s.title}<small>{passed} / {items.length} passed{sessions[s.id] && sessions[s.id].index<sessions[s.id].ids.length ? ' · Saved session' : ''}</small><span className="hm-pack-meter" aria-hidden="true"><span style={{width:`${items.length ? passed/items.length*100 : 0}%`}}/></span></span></button>;})}</div>
        <section ref={practiceControls} tabIndex={-1} className="hm-pack-practice" aria-label="Practice selection"><h3>{selectedTitle}</h3><div className="hm-field-grid"><label>Section<select disabled={busy} aria-label="Section" value={section} onChange={e => selectSection(Number(e.target.value))}><option value={0}>All sections</option>{pack.sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
          <label>Activity<select disabled={busy} aria-label="Activity" value={mode} onChange={e => setMode(e.target.value)}><option value="">All activity types</option>{[...new Set(pack.items.filter(i => !section || i.section===section).map(i => i.mode))].map(m => <option key={m} value={m}>{name(m)}</option>)}</select></label></div>

        <div className="hm-actions hm-pack-start"><button className="hm-primary" disabled={busy || !candidates.length} onClick={() => void start(candidates,'Mixed practice')}>Practice selected ({candidates.length})</button>
          <button disabled={busy || !missed.length} onClick={() => void start(missed,'Missed items')}>Practice missed<span className="hm-pack-count" aria-hidden="true">{missed.length}</span></button>
          <button disabled={busy || !unstudied.length} onClick={() => void start(unstudied,'Unstudied items')}>Practice unstudied ({unstudied.length})</button>
          </div>
        <p className="hm-caption">Each section saves its own position. New sessions replace that section’s saved list; completed results stay saved. Skipped activities remain unstudied.</p>
        <button disabled={busy} onClick={() => void start(pack.items,'Practice entire list',0)}>Practice entire list</button>
        </section>
        <details className="hm-pack-options"><summary>Study settings and course notes</summary>
          <p className="hm-caption">Exercises use your editable RemNote cards and the existing handwriting grader. {plugin && queueSync ? 'Completed exercises rate the matching RemNote card Good or Again. Paused cards stay paused.' : 'Practice results are saved separately. RemNote schedules are unchanged.'}</p>
          {plugin && <label className="hm-check"><input type="checkbox" checked={queueSync} disabled={busy} onChange={e=>{const enabled=e.target.checked,previous=queueSync;setQueueSync(enabled);void run(async()=>{try{await repository.confirm(repository.key(pack.studyPackId,'queue-sync-enabled'),enabled);}catch(e){setQueueSync(previous);throw e;}});}}/>Update linked RemNote card schedules (Good / Again)</label>}
          {pack.scheduledCardsPaused && <p>Scheduled cards are kept paused when this list loads. Practice here remains available and retains your results.</p>}
          {pack.notes.map((note,i) => <p key={i}>{note}</p>)}<p>Oral, circle and translation results use self-assessment. Radical writing uses the handwriting grader. Practice recordings stay in memory.</p>
          <button disabled={busy} onClick={() => void run(async () => {await repository.hide();setPack(undefined);setSession(undefined);setStatus('List disconnected. Rems and saved progress are retained; reconnect the same list to restore it.');})}>Disconnect list (keep Rems and progress)</button></details>
      </>}

      <div className="hm-pack-setup">{source && <details open={!pack}><summary>Connect a RemNote study list</summary><label>Study list Rem ID or document link<input value={listLink} onChange={e=>setListLink(e.target.value)}/></label><button disabled={busy || !listLink.trim()} onClick={()=>void run(async()=>{await source.connect(listLink);setSession(undefined);await load();setStatus('Reading exercises from the connected RemNote list.');})}>Connect list</button><button disabled={busy || !pack} onClick={()=>void run(async()=>{setSession(undefined);await load();setStatus('Reloaded current Rem text and exercise settings.');})}>Reload Rems</button><p>Edit questions and answers in RemNote, then reload. The exercise settings child chooses the mode.</p></details>}
      <details open={!pack}><summary>Import private course pack</summary><p>Select the complete handoff ZIP or its data-only edition. This creates ordinary RemNote cards when no list is connected. A connected list keeps its edited cards. Attached RemNote recordings can load on your other devices; this ZIP import also offers a local audio fallback.</p>
        <label className="hm-check"><input type="checkbox" checked={installAudio} disabled={busy} onChange={e => setInstallAudio(e.target.checked)}/>Store supplied instructor audio privately on this device</label>
        <label>Handoff ZIP<input type="file" accept=".zip,application/zip" disabled={busy} onChange={e => {
          const file=e.target.files?.[0];e.target.value='';if(!file)return;
          void run(async () => { if(file.size>85*1024*1024)throw new Error('Choose a ZIP smaller than 85 MB.');
            const imported=await importHandoff(new Uint8Array(await file.arrayBuffer()));
            let stored=0,audioWarning='';
            if(installAudio)try {await audio.install(imported.pack,imported.audio);stored=imported.audio.size;}catch(e){audioWarning=e instanceof Error ? e.message : 'Private audio storage unavailable.';}
            await repository.install(imported.pack);setSession(undefined);await load();setSection(0);setMode('');
            setStatus(`Course pack imported. ${stored} audio files stored on this device. ${audioWarning} ${imported.warnings.join(' ')}`);
          });
        }}/></label><p className="hm-caption">Questions, answers and mode settings live in Rems. RemNote attachments are shared through your knowledge base. ZIP audio stays on this device. Your own recording stays in memory.</p>
      </details>
      </div>
    </>}
    {screen==='exercise' && pack && session && <>
      <div className="hm-pack-session-head"><button disabled={busy} onClick={() => void run(async () => {await persist(latest.current!);setScreen('dashboard');setStatus('');})}>Save and return to dashboard</button><div><span>{session.label} · {Math.min(session.index+1,session.ids.length)} / {session.ids.length}</span><progress aria-label="Session progress" max={session.ids.length} value={session.index}/></div></div>
      <p className="hm-caption hm-pack-save-status" role="status">{busy ? 'Saving…' : draftStatus}</p>
      {item ? <PackItem key={`${session.id}:${item.id}`} pack={pack} item={item} audio={audio} repository={repository} settings={settings} assetRoot={assetRoot} savedWriting={savedResult}
        answer={response?.answer || ''} submitted={response?.submitted || false} points={response?.points || []} onDraft={draft} disabled={busy || (item.kind!=='writing' && !!savedResult)}
        onSubmit={() => void run(async () => {await persist({...latest.current!,draft:{itemId:item.id,answer:response?.answer || '',points:response?.points,submitted:true}});})}
        onNext={next} onSkip={() => void run(async()=>{await persist({...latest.current!,index:latest.current!.index+1,draft:undefined});setStatus('Activity skipped. No result recorded.');})}
        onWriting={async summary => { await saveResult(summary.passed,'checked',`${session.id}:${item.id}`); }} /> : <div className="hm-pack-complete" role="status"><span className="hm-pack-complete-icon" aria-hidden="true">✓</span><h3>Session complete</h3><p>You finished this list. Results are saved, and missed items are ready to practice separately.</p><button onClick={() => setScreen('dashboard')}>Return to dashboard</button></div>}
    </>}
  </section>;
}

function PrivateAudio({pack,id,store,onAvailability,onPlayed}:{pack:StudyPack;id?:string;store:PackAudioStore;onAvailability?(available:boolean):void;onPlayed?():void}) {
  const [url,setUrl]=useState(''), [error,setError]=useState(''), callbacks=useRef({onAvailability,onPlayed});callbacks.current={onAvailability,onPlayed};
  const player=useRef<HTMLAudioElement>(null);
  useEffect(() => {let live=true,objectURL='';setUrl('');setError('');callbacks.current.onAvailability?.(false);
    const attachment=id && pack.audio.find(a=>a.id===id);
    if(attachment && attachment.url && /^https:\/\//i.test(attachment.url))setUrl(attachment.url);
    else if(id)void store.get(pack,id).then(blob => {if(!live)return;if(blob){objectURL=URL.createObjectURL(blob);setUrl(objectURL);}else setError('Audio not configured on this device. Attach the recording in RemNote, or import the complete ZIP here.');}).catch(() => {if(live)setError('Audio not configured: private device storage is unavailable.');});
    else setError('Audio not configured: no unique supplied recording is available for this activity.');
    return () => {live=false;if(objectURL)URL.revokeObjectURL(objectURL);};
  },[pack,id,store]);
  return <div>{url && <><button onClick={() => {setError('');void player.current?.play().then(()=>callbacks.current.onAvailability?.(true)).catch(() => setError('Playback was blocked or the codec is unsupported here. Try the native Play control or written practice.'));}}>Play course reference</button>
    <audio ref={player} controls preload="metadata" src={url} aria-label="Private course reference" onCanPlay={() => callbacks.current.onAvailability?.(true)} onEnded={() => callbacks.current.onPlayed?.()}
    onPlaying={() => callbacks.current.onAvailability?.(true)}
    onError={() => {setError('This recording cannot play in this host. Try reimporting on the device or use written practice.');callbacks.current.onAvailability?.(false);}}/></>}{error && <p role="status">{error}</p>}{url && <small>Listen to the full recording before choosing a result.</small>}</div>;
}

function PackItem({pack,item,audio,repository,settings,assetRoot,answer,submitted,points,onDraft,onSubmit,onNext,onSkip,onWriting,disabled,savedWriting}:{
  pack:StudyPack;item:StudyItem;audio:PackAudioStore;repository:StudyPackRepository;settings:Settings;assetRoot?:string;
  answer:string;submitted:boolean;points:number[][][];onDraft(patch:Partial<NonNullable<StudySession['draft']>>):void;onSubmit():void;
  onNext(passed:boolean,assessment:'checked'|'self'):void;onSkip():void;onWriting(summary:WritingSummary):Promise<void>;disabled:boolean;savedWriting?:StudyEvent;
}) {
  const [showPinyin,setShowPinyin]=useState(item.showPinyin ?? true), [available,setAvailable]=useState(false), [played,setPlayed]=useState(false), [writingSaved,setWritingSaved]=useState(false), [writingPassed,setWritingPassed]=useState(false);
  const comparison=useRef<HTMLDivElement>(null), question=useRef<HTMLHeadingElement>(null);
  const restoredWriting=useRef(savedWriting);
  useEffect(()=>{question.current?.focus({preventScroll:true});},[item.id]);
  useEffect(()=>{if(submitted){comparison.current?.scrollIntoView?.({block:'nearest'});comparison.current?.focus({preventScroll:true});}},[submitted]);
  const target=item.answers[0];
  const context=useMemo(() => ({cardId:`pack:${pack.studyPackId}:${item.id}`,vocabularyId:item.id,chars:[target],prompt:item.prompt}),[pack.studyPackId,item,target]);
  const writing=useMemo(() => repository.writing(pack.studyPackId),[repository,pack.studyPackId]);
  const choices=useMemo(() => shuffled(item.choices || []),[item]);
  const help=useMemo(()=>item.mode==='word-order' ? wordOrderHelp(item) : [],[item]);
  const particleHints=useMemo(()=>item.mode==='particles' ? particleHelp(item) : [],[item]);
  const unanswered=(item.kind==='text' || item.kind==='choice') && !answer.trim();
  const verdict=unanswered ? 'incorrect' : assessAnswer(item,answer), dictation=item.mode==='dictation';
  if(item.kind==='writing' && restoredWriting.current)return <div className="hm-pack-reveal"><h3>Writing result saved</h3><p>{restoredWriting.current.passed ? 'You passed this writing activity.' : 'This activity is saved for more practice.'} Continue without repeating the test.</p><button disabled={disabled} onClick={()=>onNext(restoredWriting.current!.passed,restoredWriting.current!.assessment)}>Next activity</button></div>;
  if(item.mode==='dictionary-lookup')return <article className="hm-pack-item" aria-label="Dictionary lookup exercise"><h3>{item.prompt}</h3>
    <div className="hm-pack-glyph" lang="zh-Hant">{item.glyph}</div><p>Find this character in your paper dictionary or open a dictionary entry below. Check that the entry matches the character.</p>
    <DictionaryLinks word={item.glyph!}/><div className="hm-actions"><button disabled={disabled} onClick={()=>onNext(true,'self')}>I found the entry</button><button disabled={disabled} onClick={()=>onNext(false,'self')}>Needs practice</button></div></article>;
  if(item.kind==='writing')return <div>{item.referenceGlyph && <div className="hm-pack-reference"><p>Write only the radical of this character:</p><div className="hm-pack-glyph" lang="zh-Hant" aria-label="Reference character">{item.referenceGlyph}</div></div>}<ReviewExercise standalone context={context} settings={{...settings,script:'traditional'}} repository={writing} assetRoot={assetRoot}
    revealed={false} isCurrent={async () => true} skillLabel={item.referenceGlyph ? 'Radical writing' : 'Course writing'} onSaveResult={async summary => {await onWriting(summary);setWritingPassed(summary.passed);setWritingSaved(true);}}/>
    <button className="hm-primary" disabled={disabled || !writingSaved} onClick={() => onNext(writingPassed,'checked')}>Next activity</button><p className="hm-caption">Wait for the saved result before leaving. An interrupted writing test restarts; completed writing history is retained.</p></div>;
  return <article className="hm-pack-item" aria-label="Course exercise">
    <p className="hm-pack-eyebrow">Section {item.section} · {name(item.mode)}</p><h3 ref={question} tabIndex={-1}>{item.prompt}</h3>
    {item.kind==='circle' ? <CircleExercise glyph={item.glyph!} points={points} onChange={p => onDraft({points:p})} disabled={submitted || disabled}/> : item.glyph && <div className="hm-pack-glyph" lang="zh-Hant">{item.kind==='oral' || help.length ? [...item.glyph].map((c,i) => <ruby key={i}>{c}{(showPinyin || help.length>0) && <rt>{item.syllables?.[i]}</rt>}</ruby>) : item.glyph}</div>}
    {!!help.length && <div className="hm-word-order-help" aria-label="Character meanings"><p className="hm-caption">Pinyin and meanings are provided. Choose how the words relate.</p><dl>{help.map((h,i)=><div key={i}><dt lang="zh-Hant">{h.character}</dt><dd>{h.meaning}</dd></div>)}</dl></div>}
    {!!particleHints.length && <div className="hm-word-order-help hm-particle-help" aria-label="Surrounding word hints"><p className="hm-caption">Surrounding words · the tested particle is omitted.</p><dl>{particleHints.map((h,i)=><div key={i}><dt lang="zh-Hant">{h.text}</dt><dd><span className="hm-particle-pinyin">{h.pinyin}</span><span>{h.meaning}</span></dd></div>)}</dl></div>}
    {item.kind==='oral' && <>{!!item.syllables?.length && <button onClick={() => setShowPinyin(v => !v)}>{showPinyin ? 'Hide Pinyin' : 'Show Pinyin'}</button>}
      {!submitted && <p>Read aloud first. Record yourself if available, or read without recording and confirm below. The instructor recording stays hidden until your attempt.</p>}
      <PronunciationRecorder disabled={disabled || submitted} onReady={onSubmit}/>
      {submitted && <div className="hm-pack-comparison" ref={comparison} tabIndex={-1}><h4>Compare with the instructor</h4><PrivateAudio pack={pack} id={item.audioId} store={audio} onAvailability={setAvailable} onPlayed={() => setPlayed(true)}/><p>Listen to the full reference, then judge your pronunciation and tones. This is your self-assessment; no automatic speech grade is given.</p></div>}
    </>}
    {dictation && <PrivateAudio pack={pack} id={item.audioId} store={audio} onAvailability={setAvailable} onPlayed={() => setPlayed(true)}/>}
    {item.kind==='choice' && <fieldset disabled={submitted || disabled}><legend>Your choice</legend><div className="hm-pack-choices">{choices.map(choice => <button key={choice} aria-pressed={answer===choice} onClick={() => onDraft({answer:choice})}>{choice}</button>)}</div></fieldset>}
    {item.kind!=='oral' && item.kind!=='choice' && (item.input==='pinyin' ? <PinyinInput value={answer} onChange={value => onDraft({answer:value})} disabled={submitted || disabled || (dictation && !available)}/> : <label>{item.kind==='circle' ? 'Location description (keyboard alternative)' : 'Your answer'}<textarea value={answer} readOnly={submitted} disabled={disabled} onChange={e => onDraft({answer:e.target.value})} rows={3}/></label>)}
    {!submitted && <button className="hm-primary" disabled={disabled || (dictation && (!available || !played)) || (item.kind==='choice' && !answer) || (item.kind==='text' && !answer.trim())} onClick={onSubmit}>{item.kind==='oral' ? "I've read aloud — compare" : item.kind==='circle' ? 'Reveal and compare' : 'Submit and reveal'}</button>}
    {!submitted && unanswered && <button disabled={disabled || (dictation && (!available || !played))} onClick={onSubmit}>Reveal without answering</button>}
    {dictation && !submitted && available && !played && <p className="hm-caption">Listen to the full clip before submitting.</p>}
    {dictation && !submitted && <button disabled={disabled} onClick={onSkip}>Skip audio activity (no result)</button>}
    {item.kind==='oral' && <button disabled={disabled} onClick={onSkip}>Skip reading (no result)</button>}
    {submitted && <div className="hm-pack-reveal" ref={item.kind==='oral' ? undefined : comparison} tabIndex={-1}><h4>{item.kind==='oral' ? 'Your assessment' : verdict==='correct' ? 'Answer matches' : 'Compare your answer'}</h4>
      {item.kind!=='circle' && <p lang="zh-Hant">{item.answers.join(' / ')}</p>}<p>{item.reveal}</p><small>Source: {sourceLabel(item.source)}</small>
      {item.kind==='oral' ? <><p>{played ? 'Compare your attempt with the instructor before choosing a result.' : 'Listen to the full reference to enable self-assessment. If it cannot play, skip without a result.'}</p><div className="hm-actions"><button className="hm-primary" disabled={disabled || !available || !played} onClick={() => onNext(true,'self')}>I got it</button><button disabled={disabled || !available || !played} onClick={() => onNext(false,'self')}>Needs practice</button></div></> : unanswered || item.kind==='choice' || (!item.selfGrade && verdict!=='review') ? <><p>{unanswered ? 'No answer given. Save this result to revisit it in Practice missed.' : verdict==='correct' ? 'Correct first answer.' : 'Compare your first answer with the model.'}</p><button className="hm-primary" disabled={disabled} onClick={() => onNext(verdict==='correct','checked')}>Save result and next</button></> : <><p>{verdict==='correct' ? 'Answer matches. Confirm your understanding.' : 'Compare the substance of your answer. Equivalent English or Pinyin is acceptable; check tone marks separately.'}</p><div className="hm-actions"><button className="hm-primary" disabled={disabled} onClick={() => onNext(true,'self')}>I got it</button><button disabled={disabled} onClick={() => onNext(false,'self')}>Needs practice</button></div></>}
    </div>}
  </article>;
}
