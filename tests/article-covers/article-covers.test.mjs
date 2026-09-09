import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root = fileURLToPath(new URL('../../', import.meta.url));
test('three article desks reject explicit, missing and attempted opt-in covers; Books retain theirs', () => {
 const dir=mkdtempSync(join(tmpdir(),'dadbot-no-covers-'));
 try {
  mkdirSync(join(dir,'layouts/partials'),{recursive:true});
  mkdirSync(join(dir,'layouts/_default'),{recursive:true});
  writeFileSync(join(dir,'hugo.toml'),'baseURL="https://example.org/"\n');
  writeFileSync(join(dir,'layouts/partials/cover.html'),readFileSync(join(root,'layouts/partials/cover.html')));
  writeFileSync(join(dir,'layouts/_default/single.html'),'{{ partial "cover.html" . }}');
  for(const desk of ['news','posts','conspiracy-corner','books']) {
   mkdirSync(join(dir,'content',desk),{recursive:true});
   for(const variant of ['explicit','missing','opt-in']) writeFileSync(join(dir,'content',desk,variant+'.md'),`---\ntitle: test\n${variant==='missing'?'':'cover: /test-cover.png\nhideCover: false\n'}---\nBody preserved.\n`);
  }
  const hugo=execFileSync('sh',['-c','command -v hugo'],{encoding:'utf8'}).trim();
  execFileSync(hugo,['--source',dir],{stdio:'pipe'});
  for(const desk of ['news','posts','conspiracy-corner']) for(const variant of ['explicit','missing','opt-in']) assert.doesNotMatch(readFileSync(join(dir,'public',desk,variant,'index.html'),'utf8'),/<img|post-cover/,`${desk}/${variant}`);
  assert.match(readFileSync(join(dir,'public/books/explicit/index.html'),'utf8'),/test-cover.png/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('generator refuses cover-free desks before rendering', () => {
 for(const args of [[], ['--autostereogram']]) {
  assert.throws(() => execFileSync('python3',['scripts/generate-article-image.py',...args,'--dry-run','content/posts/2026-07-12-is-var-helping-football.md'],{cwd:root,encoding:'utf8',stdio:'pipe'}), error => /cover-free/.test(String(error.stderr)));
 }
});

test('published articles and non-Book templates have no cover metadata', () => {
 const files=[];
 const walk=(dir)=>{for(const entry of readdirSync(dir,{withFileTypes:true})) {const path=join(dir,entry.name);if(entry.isDirectory()) walk(path);else if(entry.name.endsWith('.md')) files.push(path);}};
 for(const desk of ['news','posts','conspiracy-corner']) walk(join(root,'content',desk));
 for(const file of files) {
  const fm=readFileSync(file,'utf8').split('---')[1] || '';
  assert.doesNotMatch(fm,/^(?:cover\w*|hideCover):/mi,file);
 }
 for(const file of ['draft-template.md','design-template.md','approval-template.md','publish-ready-news-template.md','publish-ready-blog-template.md','publish-ready-conspiracy-template.md']) {
  if (!existsSync(join(root,'templates',file))) continue;
  assert.doesNotMatch(readFileSync(join(root,'templates',file),'utf8'),/^(?:cover\w*|recommended_cover\w*|image_notes):/mi,file);
 }
});
