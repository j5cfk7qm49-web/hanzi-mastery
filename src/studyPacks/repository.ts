import { serializeByKey } from '../services/serial';
import { MasteryRepository, type SyncedStore } from '../services/persistence';
import { PACK_NAMESPACE, emptyProgress, type StudyPack, type StudyEvent, type ItemProgress, type StudySession } from './model';

import type { NativeStudySource } from './nativeRems';

export class StudyPackRepository {
  constructor(readonly storage: SyncedStore, readonly source?:NativeStudySource) {}
  key(packId: string, suffix: string) { return PACK_NAMESPACE + encodeURIComponent(packId) + ':' + suffix; }
  async pack(): Promise<StudyPack | undefined> {
    if(this.source)return this.source.load();
    const id = await this.storage.getSynced<string>(PACK_NAMESPACE + 'active');
    if (!id) return;
    const pack = await this.storage.getSynced<StudyPack>(this.key(id,'pack'));
    if (!pack || pack.schemaVersion !== 1 || pack.studyPackId !== id || !Array.isArray(pack.items)) throw new Error('Saved study pack is unavailable or incompatible. Reimport the ZIP; progress is retained.');
    return pack;
  }
  async install(pack: StudyPack) {
    if(this.source)return this.source.install(pack);
    // Write/read content before changing the active pointer. Reimport never clears results.
    await this.confirm(this.key(pack.studyPackId,'pack'), pack);
    await this.confirm(PACK_NAMESPACE + 'active', pack.studyPackId);
  }
  async hide() { if(this.source)return this.source.hide();await this.confirm(PACK_NAMESPACE + 'active',''); }
  async confirm<T>(key:string, value:T) {
    await this.storage.setSynced(key,value);
    if (JSON.stringify(await this.storage.getSynced(key)) !== JSON.stringify(value)) throw new Error('Save could not be confirmed. Keep this page open and retry.');
  }
  async progress(pack: StudyPack): Promise<Record<string,ItemProgress>> {
    const result:Record<string,ItemProgress> = {};
    // Bound host RPC pressure for a full course pack.
    for (let i=0; i<pack.items.length; i+=16) await Promise.all(pack.items.slice(i,i+16).map(async item => { result[item.id] = await this.item(pack.studyPackId,item.id); }));
    return result;
  }
  async item(packId:string, id:string):Promise<ItemProgress> {
    const value = await this.storage.getSynced<ItemProgress>(this.key(packId,'item:' + encodeURIComponent(id)));
    if (!value) return emptyProgress();
    if (!Array.isArray(value.events) || !Number.isInteger(value.attempts) || !Number.isInteger(value.misses)) throw new Error('Saved course progress needs recovery; it has not been overwritten.');
    return value;
  }
  record(packId:string, id:string, event:StudyEvent):Promise<ItemProgress> {
    const key = this.key(packId,'item:' + encodeURIComponent(id));
    return serializeByKey(this.storage,key,async () => {
      const old = await this.item(packId,id);
      if (old.events.some(e => e.id === event.id)) return old;
      const next = { attempts:old.attempts+1, misses:old.misses + (event.passed ? 0 : 1), lastPassed:event.passed, events:[...old.events,event].slice(-200) };
      await this.confirm(key,next); return next;
    });
  }
  async session(packId:string) { return this.storage.getSynced<StudySession>(this.key(packId,'session')); }
  async sessions(pack:StudyPack):Promise<Record<number,StudySession>> {
    const result:Record<number,StudySession>={},valid=(s:StudySession|undefined)=>s?.sourceVersion===pack.sourceVersion && s.ids.every(id=>pack.items.some(i=>i.id===id));
    for(const section of [0,...pack.sections.map(s=>s.id)]){
      const saved=await this.storage.getSynced<StudySession>(this.key(pack.studyPackId,`session:section:${section}`));
      if(valid(saved))result[section]={...saved!,section};
    }
    // Keep the pre-section save intact. Infer its original scope from the saved IDs,
    // never from the dashboard's newly selected filters.
    const legacy=await this.session(pack.studyPackId);
    if(valid(legacy)){
      const sections=[...new Set(legacy!.ids.map(id=>pack.items.find(i=>i.id===id)!.section))];
      const section=legacy!.section ?? (sections.length===1 ? sections[0] : 0);
      const current=result[section];
      const laterLegacy=current?.id===legacy!.id && current.sourceVersion===legacy!.sourceVersion && JSON.stringify(current.ids)===JSON.stringify(legacy!.ids) && legacy!.index>current.index;
      if(!current || laterLegacy){
        result[section]={...legacy!,section};
        // Complete migration before a new section can replace the legacy pointer.
        await this.confirm(this.key(pack.studyPackId,`session:section:${section}`),result[section]);
      }
    }
    return result;
  }
  saveSession(packId:string, session:StudySession, startNew=false):Promise<StudySession> {
    const key = this.key(packId,'session');
    return serializeByKey(this.storage,key,async () => {
      const slot=session.section===undefined ? key : this.key(packId,`session:section:${session.section}`);
      const current=await this.storage.getSynced<StudySession>(slot);
      if(current){
        const same=current.id===session.id && current.sourceVersion===session.sourceVersion && JSON.stringify(current.ids)===JSON.stringify(session.ids);
        // A delayed draft or closing window must not restore an older position,
        // replace a deliberately started list, or unfreeze a submitted answer.
        if(!same && !startNew)return current;
        if(same && (current.index>session.index || (current.index===session.index && current.draft?.submitted)))return current;
      }
      if(slot!==key)await this.confirm(slot,session);
      // Retain the latest-session pointer for older clients and recovery tooling.
      await this.confirm(key,session);
      return session;
    });
  }
  writing(packId:string):MasteryRepository {
    // Same stages/ledger and date rules; a removable prefix prevents any collision with normal cards.
    const prefix = this.key(packId,'writing:');
    return new MasteryRepository({ getSynced:<T,>(key:string) => this.storage.getSynced<T>(prefix + key), setSynced:(key,value) => this.storage.setSynced(prefix + key,value) });
  }
}

/** Device-local blobs: nothing binary or microphone-related goes through RemNote sync. */
export class PackAudioStore {
  private async database():Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') throw new Error('Local audio storage is unavailable. Import data only or reopen in a host with IndexedDB.');
    return new Promise((resolve,reject) => {
      const request = indexedDB.open('hanzi-mastery-study-audio-v1',1);
      request.onupgradeneeded = () => request.result.createObjectStore('audio');
      request.onerror = () => reject(new Error('Could not open private audio storage.'));
      request.onsuccess = () => resolve(request.result);
    });
  }
  private key(pack:StudyPack,id:string) { return `${pack.studyPackId}:${pack.audioVersion || pack.sourceVersion}:${id}`; }
  async install(pack:StudyPack, clips:Map<string,Blob>) {
    if (!clips.size) return;
    // ArrayBuffers avoid WebKit's platform-specific IndexedDB Blob persistence failures.
    const records=await Promise.all([...clips].map(async([id,blob])=>({id,bytes:await blob.arrayBuffer(),type:blob.type})));
    const db = await this.database();
    try { await new Promise<void>((resolve,reject) => {
      const tx = db.transaction('audio','readwrite');
      records.forEach(({id,bytes,type})=>tx.objectStore('audio').put({bytes,type},this.key(pack,id)));
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(new Error(`Private audio was not saved (${tx.error?.name || 'storage quota or host restriction'}). Reimport, or use a data-only ZIP.`));
    }); } finally { db.close(); }
  }
  async get(pack:StudyPack,id:string):Promise<Blob | undefined> {
    const db = await this.database();
    try { return await new Promise((resolve,reject) => {
      const request = db.transaction('audio').objectStore('audio').get(this.key(pack,id));
      request.onsuccess = () => {const result=request.result;resolve(result instanceof Blob ? result : result?.bytes ? new Blob([result.bytes],{type:result.type}) : undefined);}; request.onerror = () => reject(new Error('Private audio could not be loaded.'));
    }); } finally { db.close(); }
  }
}
