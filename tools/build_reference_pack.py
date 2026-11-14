#!/usr/bin/env python3
"""Build a private, source-linked reading pack from the supplied Studio manual."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def build(pdf: Path, output: Path) -> None:
    manifest = json.loads((ROOT / 'docs/references/manual-index.json').read_text())
    expected = manifest['source']
    if hashlib.sha256(pdf.read_bytes()).hexdigest() != expected['sha256']:
        raise SystemExit('PDF does not match the indexed reference. Review the index before replacing its source.')
    output.mkdir(parents=True, exist_ok=True)
    assets = output / 'assets'
    assets.mkdir(exist_ok=True)
    shutil.copyfile(pdf, output / 'source.pdf')
    subprocess.run(['pdftotext', '-layout', str(pdf), str(output / 'manual.txt')], check=True)
    pages = (output / 'manual.txt').read_text().split('\f')
    if not pages[-1].strip():
        pages.pop()
    if len(pages) != expected['pages']:
        raise SystemExit(f'Unexpected page count: {len(pages)}')
    visual_pages = sorted({p for section in manifest['sections'] for p in section['visualPages']})
    for page in visual_pages:
        subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-scale-to', '1400',
                        '-singlefile', '-png', str(pdf), str(assets / f'page-{page}')], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    # The source's full workspace screenshot is sideways. Extract its original
    # image and orient it in CSS, preserving both source bytes and page rendering.
    subprocess.run(['pdfimages', '-f', '21', '-l', '21', '-png', str(pdf),
                    str(assets / 'workspace')], check=True, stdout=subprocess.DEVNULL)
    escape = html.escape
    sections = []
    for section in manifest['sections']:
        refs = ' '.join(f'<a href="source.pdf#page={page}">p. {page}</a>' for page in section['pages'])
        figures = []
        for page in section['visualPages']:
            if page == 21:
                image = '<div class="workspace"><img src="assets/workspace-000.png" alt="Original Studio workspace screenshot, oriented for reading"></div>'
            else:
                image = f'<img loading="lazy" src="assets/page-{page}.png" alt="Manual page {page}">'
            figures.append(f'<figure>{image}<figcaption><a href="source.pdf#page={page}">Original visual · page {page}</a></figcaption></figure>')
        excerpts = ''.join(f'<details><summary>Source text · page {page}</summary><pre>{escape(pages[page - 1])}</pre></details>' for page in section['pages'])
        sections.append(f'<section id="{section["id"]}"><h2>{escape(section["title"])}</h2>'
                        f'<p class="interpretation"><strong>Reading note:</strong> {escape(section["interpretation"])}</p>'
                        f'<p class="refs">{refs}</p><div class="visuals">{"".join(figures)}</div>{excerpts}</section>')
    additions = ''.join(f'<li><strong>{escape(item["title"])}</strong> — {escape(item["source"])}</li>' for item in manifest['userAdditions'])
    nav = ''.join(f'<a href="#{section["id"]}">{escape(section["title"])}</a>' for section in manifest['sections'])
    document = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Studio 1.0 reference pack</title><style>
*{box-sizing:border-box}body{margin:0;color:#243238;background:#eef1f2;font:16px/1.55 system-ui,sans-serif}
header{padding:28px 36px;background:#183c45;color:white}header h1{margin:0}header a{color:#d9edf0}
.layout{display:grid;grid-template-columns:270px minmax(0,1fr);max-width:1500px;margin:auto}
aside{padding:24px;position:sticky;top:0;height:100vh;overflow:auto}aside a{display:block;padding:7px 0;color:#205969}
main{padding:24px;min-width:0}section,.additions{background:white;border:1px solid #ccd5d9;border-radius:7px;padding:24px;margin-bottom:24px;scroll-margin-top:16px}
h2{margin-top:0}input{width:100%;padding:10px;font:inherit;margin-bottom:10px}a{color:#205969}.refs{font-size:14px}
.refs a{display:inline-block;padding:3px 7px}.interpretation{border-left:3px solid #6b929b;padding-left:12px}
.visuals{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:18px}figure{margin:10px 0}img{display:block;width:100%;height:auto;border:1px solid #d6dcdf}figcaption{font-size:13px;padding:5px}
.workspace{position:relative;aspect-ratio:743/546;overflow:hidden;background:white}.workspace img{position:absolute;left:50%;top:50%;width:73.49%;transform:translate(-50%,-50%) rotate(-90deg)}
details{border-top:1px solid #dce2e5;padding:9px 0}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.5 ui-monospace,monospace}.note{font-size:14px}#result{font-size:13px}section[hidden]{display:none}
@media(max-width:800px){.layout{display:block}aside{position:static;height:auto}header,main,aside{padding:18px}.visuals{display:block}}
</style><header><h1>CodeCharge Studio 1.0</h1><p>A private reading pack for the new Schema Baron baseline.</p><p class="note">The original PDF remains authoritative. Reading notes are interpretations; the new product additions below come from the user.</p><a href="source.pdf">Open original manual</a></header>
<div class="layout"><aside><label for="search">Search reference sections</label><input id="search" type="search" placeholder="forms, parameters, wizard…"><p id="result" role="status"></p>NAV</aside><main>
<div class="additions"><h2>Deliberate additions to the early baseline</h2><ul>ADDITIONS</ul><p class="note">Creating an ODBC data source or seeing an Access driver Create button is not evidence of a complete Studio schema designer. Keep that distinction explicit.</p></div>
SECTIONS</main></div><script>
const sections=[...document.querySelectorAll('main section')],search=document.querySelector('#search'),result=document.querySelector('#result');
function filter(){const query=search.value.trim().toLowerCase();let count=0;for(const section of sections){section.hidden=!!query&&!section.textContent.toLowerCase().includes(query);if(!section.hidden)count++;}result.textContent=count+' of '+sections.length+' sections';}
search.addEventListener('input',filter);filter();
</script></html>'''
    document = document.replace('NAV', nav).replace('ADDITIONS', additions).replace('SECTIONS', ''.join(sections))
    (output / 'index.html').write_text(document)
    (output / 'reference-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'index': str(output / 'index.html'), 'sections': len(sections), 'visualPages': visual_pages, 'sourceSha256': expected['sha256']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf', required=True, type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / '.local/references/codecharge-studio-1.0')
    args = parser.parse_args()
    build(args.pdf.resolve(), args.output.resolve())
