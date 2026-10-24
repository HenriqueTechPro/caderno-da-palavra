/** Open/public-domain Almeida passages delivered by bible-api.com.
 * Browser-only module; no Google keys or other credentials are needed.
 */
import { BOOKS, parseReference } from './bible.js';

export const BIBLE_TRANSLATION = 'João Ferreira de Almeida (domínio público)';
export const BIBLE_SOURCE = 'https://bible-api.com/';
export const ENGLISH_BOOKS = [
 'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'
];
const STORAGE = 'caderno-bible-cache';
const memory = new Map();
let connection;
const safeKey=(book,chapter)=>`almeida:${book}:${chapter}`;
export function chapterOptions(book) {
 const b=BOOKS.find(([name])=>name===book);
 return b ? Array.from({length:b[1]},(_,i)=>i+1) : [];
}
export function bibleUrl(book,chapter) {
 const index=BOOKS.findIndex(([name])=>name===book);
 if(index<0||!chapterOptions(book).includes(Number(chapter))) throw Error('Livro ou capítulo inválido.');
 return `${BIBLE_SOURCE}${encodeURIComponent(ENGLISH_BOOKS[index]+' '+Number(chapter))}?translation=almeida&single_chapter_book_matching=indifferent`;
}
function openCache() {
 if(typeof indexedDB==='undefined') return Promise.resolve(null);
 if(!connection)connection=new Promise((resolve)=>{
   const request=indexedDB.open(STORAGE,1);
   request.onupgradeneeded=()=>request.result.createObjectStore('chapters',{keyPath:'key'});
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>resolve(null);
 });
 return connection;
}
async function fromCache(key){
 if(memory.has(key))return memory.get(key);
 const db=await openCache();if(!db)return null;
 return new Promise(resolve=>{
   const req=db.transaction('chapters','readonly').objectStore('chapters').get(key);
   req.onsuccess=()=>resolve(req.result?.data||null);req.onerror=()=>resolve(null);
 });
}
async function putCache(key,data){
 memory.set(key,data);
 const db=await openCache();if(!db)return;
 await new Promise(resolve=>{const tx=db.transaction('chapters','readwrite');tx.objectStore('chapters').put({key,data});tx.oncomplete=resolve;tx.onerror=resolve;});
}
export function normalizeChapter(response,book,chapter) {
 if(!response||response.translation_id!=='almeida'||!Array.isArray(response.verses))throw Error('A fonte bíblica retornou uma tradução inesperada.');
 const verses=response.verses.filter(v=>v&&Number(v.chapter)===Number(chapter)&&Number.isInteger(v.verse)&&v.verse>0&&typeof v.text==='string').map(v=>({verse:v.verse,text:v.text.replace(/\s+/g,' ').trim()}));
 if(!verses.length||verses.length>176||new Set(verses.map(v=>v.verse)).size!==verses.length)throw Error('Capítulo inválido ou vazio.');
 return {book,chapter:Number(chapter),verses,translation:BIBLE_TRANSLATION,source:BIBLE_SOURCE};
}
export async function getChapter(book,chapter,{fetcher=fetch,force=false}={}){
 chapter=Number(chapter);const url=bibleUrl(book,chapter),key=safeKey(book,chapter);
 if(!force){const saved=await fromCache(key);if(saved)return saved;}
 if(typeof navigator!=='undefined'&&navigator.onLine===false)throw Error('Capítulo ainda não disponível offline. Conecte-se uma vez para carregá-lo.');
 const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error(response.status===429?'Aguarde alguns instantes antes de consultar novamente a Bíblia.':'Não foi possível consultar o texto bíblico agora.');
 const value=normalizeChapter(await response.json(),book,chapter);
 await putCache(key,value);return value;
}
export function passageFromChapter(chapter, start=null, end=start){
 const a=start===null||start===''?null:Number(start), b=end===null||end===''?a:Number(end);
 if(a!==null&&(!Number.isInteger(a)||!Number.isInteger(b)||b<a||!chapter.verses.some(v=>v.verse===a)||!chapter.verses.some(v=>v.verse===b)))throw Error('Selecione um intervalo de versículos válido.');
 const verses=a===null?chapter.verses:chapter.verses.filter(v=>v.verse>=a&&v.verse<=b);
 const label=`${chapter.book} ${chapter.chapter}${a===null?'':':'+a+(b!==a?'-'+b:'')}`;
 return {...parseReference(label),text:verses.map(v=>`${v.verse}. ${v.text}`).join('\n'),translation:chapter.translation,source:chapter.source};
}
export async function expandReference(reference){
 const parsed = reference.book && reference.chapter ? reference : parseReference(reference.label);
 const chapter=await getChapter(parsed.book,parsed.chapter);
 return passageFromChapter(chapter,parsed.start,parsed.end);
}