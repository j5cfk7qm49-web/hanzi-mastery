import React, { useEffect, useState } from 'react';
import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { DEFAULT_SETTINGS, parseSettings } from '../core/config';
import { SETTINGS_KEY } from '../core/schema';
import { StudyPacks } from '../studyPacks/StudyPacks';
import { WidgetBoundary } from '../ui/WidgetBoundary';
import '../ui/styles.css';
export function CourseStudy() {
  const plugin=usePlugin(), [settings,setSettings]=useState(DEFAULT_SETTINGS), [ready,setReady]=useState(false), [error,setError]=useState('');
  useEffect(() => { let live=true;void plugin.storage.getSynced(SETTINGS_KEY).then(value => {if(live){setSettings(parseSettings(value));setReady(true);}}).catch(() => {if(live)setError('Writing settings could not be loaded. Close and reopen to retry.');});return () => {live=false;}; },[plugin]);
  return <section className="hm hm-workbench hm-popup" aria-label="Hanzi Mastery study window" tabIndex={0}><header><h1>Hanzi Mastery</h1><button onClick={() => void plugin.widget.closePopup()}>Close</button></header>{error && <p role="alert">{error}</p>}{ready ? <StudyPacks plugin={plugin} storage={plugin.storage} assetRoot={plugin.rootURL} settings={settings}/> : !error && <p role="status">Loading writing settings…</p>}</section>;
}
renderWidget(() => <WidgetBoundary><CourseStudy/></WidgetBoundary>);
