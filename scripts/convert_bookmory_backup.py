#!/usr/bin/env python3
"""Convert a *private* .bookmory ZIP backup into a locally stored diary import JSON.
Usage: python3 scripts/convert_bookmory_backup.py Database.bookmory private-import.json
No network, npm module, app upload or server access required. Do not commit output.
This supports new_bookmory.db entry-store exports. Fails closed for unknown formats.
"""
import json, sys, tempfile, zipfile, sqlite3, hashlib, re
from datetime import datetime, timezone
from pathlib import Path


def iso_ms(v):
    try:
        v = float(v)
        if not v: return None
        return datetime.fromtimestamp(v / 1000, tz=timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
    except (ValueError,TypeError,OverflowError,OSError): return None


def date_ms(v):
    iso = iso_ms(v)
    return iso[:10] if iso else None


def identifier(value):
    return hashlib.sha256(str(value).encode('utf-8')).hexdigest()[:20]


def norm_status(source):
    return {'DONE':'completed','NOT_STARTED':'want-to-read','GIVE_UP':'dropped','READING':'reading','PAUSED':'paused'}.get(source,'want-to-read')


def count(v):
    try:
        n = int(float(v))
        return max(0, n)
    except (ValueError,TypeError): return 0


def convert(source):
    with zipfile.ZipFile(source) as archive:
        if 'new_bookmory.db' not in archive.namelist():
            raise ValueError('Unsupported Bookmory backup: missing new_bookmory.db')
        raw = archive.read('new_bookmory.db')
        if not raw.startswith(b'SQLite format 3\x00'):
            raise ValueError('Bookmory internal database is not SQLite')
    with tempfile.TemporaryDirectory() as td:
        dbfile = Path(td)/'bookmory.db'
        dbfile.write_bytes(raw)
        c = sqlite3.connect(f'file:{dbfile}?mode=ro', uri=True)
        try:
            rows = c.execute("SELECT key,value FROM entry WHERE store='books' AND COALESCE(deleted,0)=0").fetchall()
            tags = c.execute("SELECT value FROM entry WHERE store='tags' AND COALESCE(deleted,0)=0").fetchall()
        finally: c.close()
    tag_map={}
    for (raw_tag,) in tags:
        value=json.loads(raw_tag)
        for bid in value.get('bids',[]): tag_map.setdefault(str(bid),[]).append(str(value.get('name','')).lstrip('#').strip())
    results=[]
    for book_id, raw_value in rows:
        book=json.loads(raw_value)
        title=str(book.get('title') or '').strip()
        if not title: continue
        sid='native_'+identifier(book_id)
        reads=book.get('reads') or []
        statuses=book.get('status_list') or []
        status=norm_status(str(statuses[0]) if statuses else (reads[-1].get('status') if reads else 'NOT_STARTED'))
        total=count(book.get('total_page')) or None
        current=count(book.get('cur_page'))
        if total is not None: current=min(current,total)
        authors=book.get('authors') or ([book.get('author')] if book.get('author') else [])
        creators=[str(x) for x in authors if isinstance(x,str) and x.strip()]
        rating=next((float(r['star']) for r in reversed(reads) if r.get('star') is not None and float(r['star'])>0),None)
        purchases=[]
        for i,p in enumerate(book.get('purchases') or []):
            purchases.append({'id':f'{sid}_purchase_{i+1}','date':date_ms(p.get('purchased_at')),
                              'amount':p.get('price'),'currency':p.get('currency_code') or None,'memo':p.get('memo') or None,'store':p.get('from') or None})
        item={'schemaVersion':2,'id':sid,'mediaType':'book','title':title,'creators':creators or ['Unknown Author'],
              'status':status,'rating':rating,'ratingScale':5,'isbn':book.get('isbn') or None,
              'publisher':book.get('publisher') or None,'publicationDate':book.get('publication_date') or None,
              'language':book.get('language') or None,'bookFormat':book.get('book_type') or None,
              'tags':sorted(set(tag_map.get(str(book_id),[]))), 'genres':sorted(set(tag_map.get(str(book_id),[]))),
              'wishlist':bool(book.get('wishlist')),'favorite':False,'visibility':'private',
              'cover':book.get('image') or '', 'purchases':purchases,'bookmoryLogCount':len(reads),
              'progress':{'unit':'page','current':current,'total':total},
              'startedOn':date_ms(book.get('first_read_start_date')),
              'finishedOn':date_ms(book.get('last_read_done_date')) if status=='completed' else None,
              'provenance':{'source':'bookmory_native','sourceKey':f'bookmory_native:{book_id}'}}
        attempts=[]; sessions=[]; journals=[]
        for i,r in enumerate(reads):
            attempt_id=f'{sid}_attempt_{i+1}'
            astatus={'DONE':'completed','GIVE_UP':'abandoned'}.get(r.get('status'),'in_progress')
            attempts.append({'schemaVersion':2,'id':attempt_id,'libraryItemId':sid,'ordinal':i+1,
                             'status':astatus,'startedOn':date_ms(r.get('start')),
                             'completedOn':date_ms(r.get('end')) if astatus=='completed' else None,
                             'rating':r.get('star') or None,'progress':{'unit':'page','current':count(r.get('page')),'total':total},
                             'provenance':{'source':'bookmory_native','sourceKey':f'{book_id}:read:{i+1}'}})
            if r.get('comment'):
                journals.append({'schemaVersion':2,'id':f'{sid}_review_{i+1}','linkedMediaId':sid,
                                 'mediaType':'book','type':'review','body':r['comment'],'visibility':'private',
                                 'date':date_ms(r.get('end') or r.get('start')),
                                 'provenance':{'source':'bookmory_native','sourceKey':f'{book_id}:read:{i+1}'}})
            for j,timer in enumerate(r.get('read_timer_list') or []):
                started=iso_ms(timer.get('read_started_at'))
                duration=count(timer.get('elapsed_sec'))
                if not started or not duration: continue
                sessions.append({'schemaVersion':2,'id':f'{sid}_timer_{i+1}_{j+1}_{identifier(timer.get("read_started_at"))}',
                                 'libraryItemId':sid,'attemptId':attempt_id,'mediaType':'book','source':'timer',
                                 'startedAt':started,'activeSeconds':duration,'pagesRead':0,'timezone':'Asia/Manila',
                                 'isDailySession':True,
                                 'provenance':{'source':'bookmory_native_timer','sourceKey':f'{book_id}:read:{i+1}:timer:{j+1}'}})
        results.append({'item':item,'attempts':attempts,'sessions':sessions,'historicalAggregates':[],'journalEntries':journals})
    return {'format':'bookmory-native-candidates-v1','source':'Bookmory native SQLite entry store',
            'entries':results,'summary':{'books':len(results),'attempts':sum(len(r['attempts']) for r in results),
            'timedSessions':sum(len(r['sessions']) for r in results)}}


def main():
    if len(sys.argv)!=3: raise SystemExit('Usage: python3 scripts/convert_bookmory_backup.py Database.bookmory private-import.json')
    inp,out=map(Path,sys.argv[1:])
    if inp.resolve()==out.resolve(): raise SystemExit('Source and destination must differ')
    result=convert(inp)
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f"Converted {result['summary']['books']} books and {result['summary']['timedSessions']} real timed sessions.")
    print('This file contains private diary data. Do not commit, serve or publish it.')

if __name__=='__main__':main()
