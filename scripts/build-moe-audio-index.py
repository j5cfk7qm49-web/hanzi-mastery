"""Build factual audio routing metadata from two unchanged official MOE workbooks.

Explicit maintenance command; normal builds do not fetch or regenerate source data.
Usage: python scripts/build-moe-audio-index.py <text-database.zip> <audio-index.xlsx>
"""
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

NS = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def workbook_rows(data):
    with zipfile.ZipFile(io.BytesIO(data)) as book:
        strings = [''.join(node.itertext()) for node in ET.fromstring(book.read('xl/sharedStrings.xml'))]
        for _, row in ET.iterparse(book.open('xl/worksheets/sheet1.xml'), events=('end',)):
            if row.tag != '{' + NS['x'] + '}row':
                continue
            result = {}
            for cell in row.findall('x:c', NS):
                value = cell.find('x:v', NS)
                if value is not None:
                    text = value.text or ''
                    result[re.sub(r'\d', '', cell.attrib['r'])] = strings[int(text)] if cell.attrib.get('t') == 's' else text
            yield result
            row.clear()


if len(sys.argv) != 3:
    raise SystemExit(__doc__)
text_bytes = Path(sys.argv[1]).read_bytes()
index_bytes = Path(sys.argv[2]).read_bytes()
with zipfile.ZipFile(io.BytesIO(text_bytes)) as source:
    names = [name for name in source.namelist() if name.endswith('.xlsx')]
    if len(names) != 1 or '2014_20260929' not in names[0]:
        raise ValueError('Unexpected MOE text snapshot; review its version and licence first.')
    rows = iter(workbook_rows(source.read(names[0])))
    header = next(rows)
    if header.get('A') != '字詞名' or header.get('B') != '字詞號' or header.get('J') != '漢語拼音':
        raise ValueError('Unexpected dictionary columns.')
    dictionary = {}
    for row in rows:
        item = (row.get('A', ''), row.get('J', '').strip())
        identifier = row.get('B', '')
        if identifier in dictionary and dictionary[identifier] != item:
            raise ValueError('Ambiguous source audio ID.')
        dictionary[identifier] = item

rows = iter(workbook_rows(index_bytes))
if next(rows) != {'A': '字詞號', 'B': '字詞名', 'C': '檔案名稱'}:
    raise ValueError('Unexpected audio-index columns.')
records = []
for row in rows:
    identifier, form = row.get('A', ''), row.get('B', '')
    if len(form) != 1 or not re.fullmatch(r'\d{4}[A-Z]?', identifier):
        continue
    if row.get('C') != identifier + '.wav':
        raise ValueError('Unexpected audio filename.')
    entry = dictionary.get(identifier)
    if not entry or entry[0] != form:
        continue
    reading = unicodedata.normalize('NFC', entry[1])
    # Keep only explicit, single-syllable Latin readings; never infer them from Hanzi.
    if not reading or any('LATIN' not in unicodedata.name(char, '') for char in reading):
        continue
    records.append([form, reading, identifier])
if not 6000 <= len(records) <= 6500:
    raise ValueError('Unexpected supported audio inventory.')
payload = {'version': 1, 'snapshot': 'MOE Concise 2014_20260929',
           'dictionarySha256': hashlib.sha256(text_bytes).hexdigest(),
           'audioIndexSha256': hashlib.sha256(index_bytes).hexdigest(), 'records': records}
compressed = gzip.compress(json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf8'), compresslevel=9, mtime=0)
destination = Path('public/audio/moe-index.json.gz')
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_bytes(compressed)
print(json.dumps({'records': len(records), 'bytes': len(compressed), 'sha256': hashlib.sha256(compressed).hexdigest(),
                  'dictionarySha256': payload['dictionarySha256'], 'audioIndexSha256': payload['audioIndexSha256']}))
