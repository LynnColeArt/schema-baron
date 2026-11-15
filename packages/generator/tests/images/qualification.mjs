import assert from 'node:assert/strict';
import sharp from 'sharp';
import Database from 'better-sqlite3';
import {readFileSync,readdirSync,symlinkSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {normalizeImage,executeImages,readRecordImage} from './server/record-images.ts';
import {execute} from './server/record-service.ts';
import {config} from './server/record-0.ts';
const root=process.env.SCHEMA_BARON_IMAGE_ROOT;
const db=new Database(join(dirname(root),'records.sqlite'));
const input={key:'first',title:'A photograph'};
const params={'form:mode':'new'};
const jpeg=await sharp({create:{width:80,height:40,channels:3,background:'#f00'}}).jpeg().withExif({IFD0:{Artist:'SECRET-ARTIST',ImageDescription:'PRIVATE-METADATA'}}).withMetadata({orientation:6}).toBuffer();
const png=await sharp({create:{width:3000,height:1500,channels:4,background:'#00f8'}}).png().withExif({IFD0:{Artist:'PNG-PRIVATE'}}).toBuffer();
for(const [source,name]of [[jpeg,'fixture.jpg'],[png,'fixture.png']]) {
 const bytes=await normalizeImage(new File([source],name));
 const m=await sharp(bytes).metadata();assert.equal(m.format,'webp');assert.equal(m.exif,undefined);assert.equal(m.icc,undefined);assert.equal(m.xmp,undefined);assert.equal(m.iptc,undefined);
 assert.equal(bytes.includes(Buffer.from('SECRET-ARTIST')),false);assert.equal(bytes.equals(source),false);
 if(name.endsWith('jpg')){assert.equal(m.width,40);assert.equal(m.height,80);}else{assert.equal(m.width,2048);assert.equal(m.height,1024);}
}
await assert.rejects(normalizeImage(new File(['<svg/>'],'image.png')));
const animationMarker=Buffer.alloc(20);animationMarker.writeUInt32BE(8,0);animationMarker.write('acTL',4,'ascii');
await assert.rejects(normalizeImage(new File([png.subarray(0,8),animationMarker,png.subarray(8)],'animated.png')));
await assert.rejects(normalizeImage(new File([jpeg.subarray(0,90)],'broken.jpg')));
await assert.rejects(normalizeImage(new File([Buffer.alloc(5*1024*1024+1)],'large.jpg')));
const bomb=await sharp({create:{width:4096,height:4096,channels:3,background:'#000'}}).png().toBuffer();await assert.rejects(normalizeImage(new File([bomb],'bomb.png')));
let result=await executeImages(config,'insert',params,input,new Map([['photo',new File([jpeg],'../../raw.jpg')]]));assert.equal(result.saved,true,JSON.stringify(result));
let row=db.prepare('SELECT * FROM items WHERE id=?').get('first');assert.match(row.photo,/^[a-f0-9]{48}\.webp$/);const old=row.photo;
const edit={[config.keyParameters[0]]:'first'};
const served=readRecordImage(config,edit,'photo');assert.equal((await sharp(served).metadata()).format,'webp');assert.equal(served.includes(Buffer.from('SECRET-ARTIST')),false);
result=execute(config,'update',edit,{key:'first',title:'Forged',photo:'a'.repeat(48)+'.webp'});assert.ok(result.summary);assert.equal(db.prepare('SELECT photo FROM items WHERE id=?').get('first').photo,old);
result=await executeImages(config,'update',edit,{key:'first',title:'No file'},new Map());assert.equal(result.saved,true);assert.equal(db.prepare('SELECT photo FROM items WHERE id=?').get('first').photo,old);
await assert.rejects(executeImages(config,'update',edit,{key:'first',title:'Rejected'},new Map([['photo',new File(['bad'],'bad.png')]])));assert.equal(db.prepare('SELECT photo FROM items WHERE id=?').get('first').photo,old);
result=await executeImages(config,'update',edit,{key:'first',title:''},new Map([['photo',new File([png],'valid.png')]]));assert.ok(result.summary);assert.equal(db.prepare('SELECT photo FROM items WHERE id=?').get('first').photo,old);
result=await executeImages(config,'update',edit,{key:'first',title:'Replaced'},new Map([['photo',new File([png],'new.png')]]));assert.equal(result.saved,true);row=db.prepare('SELECT * FROM items WHERE id=?').get('first');assert.notEqual(row.photo,old);
assert.equal((await sharp(readRecordImage(config,edit,'photo')).metadata()).width,2048);
assert.throws(()=>readRecordImage(config,{[config.keyParameters[0]]:'missing'},'photo'));
const files=readdirSync(root,{recursive:true}).filter(p=>String(p).endsWith('.webp'));assert.ok(files.length>=2);
for(const path of files){const b=readFileSync(join(root,String(path)));assert.equal(b.equals(jpeg),false);assert.equal(b.equals(png),false);assert.equal((await sharp(b).metadata()).format,'webp');}
const unsafe={...config,imageFields:[{fieldId:'photo',folder:'../public'}]};await assert.rejects(executeImages(unsafe,'update',edit,{key:'first',title:'bad folder'},new Map([['photo',new File([jpeg],'ok.jpg')]])));
const linkRoot=join(dirname(root),'linked-assets');symlinkSync(root,linkRoot);process.env.SCHEMA_BARON_IMAGE_ROOT=linkRoot;assert.throws(()=>readRecordImage(config,edit,'photo'));process.env.SCHEMA_BARON_IMAGE_ROOT=root;
db.close();console.log('Image pixel normalization, orientation, bounds, metadata stripping, real SQLite insert/read/replace/no-file/forgery/failed replacement and symlink rejection passed.');
