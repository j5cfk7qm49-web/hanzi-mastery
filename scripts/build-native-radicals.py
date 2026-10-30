"""Build a private two-field Anki bridge for native radical cards (requires anki).

Usage: python scripts/build-native-radicals.py <radical-import.json> <output.apkg>
The source export has aggregate skill counts, not a complete review log. Only
the known latest Pinyin event is transferred; intervals/ease are estimates.
"""
import sys, json, html, hashlib, math, tempfile
from pathlib import Path
from datetime import datetime, date, time, timedelta, timezone
from zoneinfo import ZoneInfo
from collections import Counter

DAY=86400000
TZ=ZoneInfo('America/Los_Angeles')
def review_day(ms):
    dt=datetime.fromtimestamp(ms/1000,TZ)
    return dt.date()-timedelta(days=dt.hour<4)
def estimate(row):
    right,wrong=row['pinyin_right'],row['pinyin_wrong']
    last=max(row['last_pinyin'],row['last_pinyin_right'],row['last_pinyin_wrong'])
    assert right+wrong>0 and 0<row['added_date']<=last
    interval=max(1,min(3,math.floor((last-row['added_date'])/DAY/(right+wrong))))
    rate=wrong/(right+wrong)
    if row['pinyin_level']<=3 or rate>=.15 or (row['last_pinyin_wrong'] and 0<=(last-row['last_pinyin_wrong'])/DAY<=7):interval=1
    elif rate>=.05:interval=min(interval,2)
    outcome=1 if last==row['last_pinyin_wrong'] and last>row['last_pinyin_right'] else 3 if last==row['last_pinyin_right'] else None
    if outcome==1:interval=1
    return dict(interval_days=interval,ease_percent=180,last_ms=last,due_date=(review_day(last)+timedelta(days=interval)).isoformat(),reps_proxy=right+wrong,lapses_proxy=wrong,rating_proxy=outcome)
def main():
    from anki.collection import Collection,ExportAnkiPackageOptions
    from anki.import_export_pb2 import ImportAnkiPackageRequest,ImportAnkiPackageOptions
    rows=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'));out=Path(sys.argv[2]).resolve()
    assert len(rows)==72 and len({r['key'] for r in rows})==72
    with tempfile.TemporaryDirectory(dir=out.parent,prefix='native-build-') as folder:
        col=Collection(str(Path(folder)/'source.anki2'))
        start=datetime.combine(min(review_day(r['history']['added_date']) for r in rows)-timedelta(days=1),time(4),TZ)
        col.crt=int(start.timestamp());col.set_config('creationOffset',int(-start.utcoffset().total_seconds()/60));col.set_config('rollover',4);col.close()
        col=Collection(str(Path(folder)/'source.anki2'))
        try:
            model=col.models.new('Hanzi Mastery native radicals v1')
            for name in ('Front','Back'):col.models.add_field(model,col.models.new_field(name))
            template=col.models.new_template('Radical recall');template['qfmt']='{{Front}}';template['afmt']='{{FrontSide}}<hr id="answer">{{Back}}';col.models.add_template(model,template);col.models.add(model)
            did=col.decks.id('Classical Chinese I - Midterm Study::3. Radicals - Chinese Guru')
            config=col.decks.get_config(1);config['new']['initialFactor']=1800;col.decks.update_config(config)
            today=review_day(int(datetime.now(timezone.utc).timestamp()*1000));used=set()
            for row in rows:
                note=col.new_note(model);note.guid='hm_'+hashlib.sha256(('native-radical-v1:'+row['item']['id']).encode()).hexdigest()[:20]
                note['Front']=html.escape(row['front']);note['Back']=html.escape(row['back']);note.tags=['HanziMastery','ChineseGuruEstimatedSchedule'];col.add_note(note,did)
                state=estimate(row['history']);card=note.cards()[0];card.type=2;card.queue=2;card.ivl=state['interval_days'];card.factor=1800;card.reps=state['reps_proxy'];card.lapses=state['lapses_proxy'];card.due=col.sched.today+(date.fromisoformat(state['due_date'])-today).days;card.last_review_time=state['last_ms']//1000;col.update_card(card)
                if state['rating_proxy']:
                    review=state['last_ms']
                    while review in used:review+=1
                    used.add(review);col.db.execute('insert into revlog values (?,?,?,?,?,?,?,?,?)',review,card.id,-1,state['rating_proxy'],card.ivl,card.ivl,card.factor,0,1)
                row['estimate']=state
            expected=sorted(col.db.all('select n.guid,c.ivl,c.factor,c.reps,c.lapses,c.due-?,c.queue from notes n join cards c on n.id=c.nid',col.sched.today))
            anchors=sorted(col.db.all('select id,ease,ivl,factor from revlog'))
            col.export_anki_package(out_path=str(out),options=ExportAnkiPackageOptions(with_scheduling=True,with_deck_configs=True,with_media=False,legacy=True),limit=None)
        finally:col.close()
        destination=Collection(str(Path(folder)/'roundtrip.anki2'))
        try:
            destination.import_anki_package(ImportAnkiPackageRequest(package_path=str(out),options=ImportAnkiPackageOptions(with_scheduling=True,with_deck_configs=True)))
            assert sorted(destination.db.all('select n.guid,c.ivl,c.factor,c.reps,c.lapses,c.due-?,c.queue from notes n join cards c on n.id=c.nid',destination.sched.today))==expected
            assert sorted(destination.db.all('select id,ease,ivl,factor from revlog'))==anchors
            assert destination.db.scalar('pragma integrity_check')=='ok'
        finally:destination.close()
    Path(str(out)+'.audit.json').write_text(json.dumps({'cards':len(rows),'intervals':dict(Counter(r['estimate']['interval_days'] for r in rows)),'schedule_basis':'Pinyin history only; other skill counts archived separately, not combined','earlier_events_invented':0,'records':rows},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'cards':len(rows),'intervals':dict(Counter(r['estimate']['interval_days'] for r in rows)),'roundtrip':'passed','package':str(out)}))
if __name__=='__main__':main()
