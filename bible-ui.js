import { BOOKS, parseReference } from './bible.js';
import { getChapter, passageFromChapter, expandReference, chapterOptions, BIBLE_SOURCE } from './bible-reader.js';
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selections=new Map();
const localChapters=new Map();
const bookOpts = selected => BOOKS.map(([b])=>`<option value="${escapeHtml(b)}" ${b===selected?'selected':''}>${escapeHtml(b)}</option>`).join('');
const chapOpts = (book,selected) => chapterOptions(book).map(n=>`<option value="${n}" ${Number(selected)===n?'selected':''}>${n}</option>`).join('');
const current = id=>selections.get(id)||{book:'João',chapter:3,start:null,end:null};
export function selectorMarkup(id,{title='Encontrar na Bíblia',compact=false}={}){
 const sel=current(id);
 return `<section class="bible-picker ${compact?'bible-picker-small':''}" data-bible-picker="${id}">
 <h3>${title}</h3><div class="bible-controls">
 <label class="formfield">Livro<select class="select" data-bible-book="${id}">${bookOpts(sel.book)}</select></label>
 <label class="formfield">Capítulo<select class="select" data-bible-chapter="${id}">${chapOpts(sel.book,sel.chapter)}</select></label>
 <button type="button" class="secondary" data-bible-load="${id}">📖 Ler capítulo</button></div>
 <p class="muted subtitle" style="margin:0">Selecione o livro e capítulo; toque nos versículos para definir o trecho. A leitura fica salva no aparelho.</p>
 <div data-bible-content="${id}" aria-live="polite"></div>
 ${id==='culto'?'<button type="button" class="primary" data-bible-add="culto" disabled>＋ Salvar passagem no culto</button>':''}
 </section>`;
}
export function biblePageMarkup(meetings){
 return `<div class="section-head"><h2>📖 Bíblia Sagrada</h2></div>
 <div class="panel stack">${selectorMarkup('biblia',{title:'Leitura bíblica'})}
 <label class="formfield">Salvar trecho no culto<select class="select" id="bible-destination">${meetings.length?meetings.map(m=>`<option value="${escapeHtml(m.id)}">${escapeHtml(m.title||'Culto')} · ${escapeHtml(m.date||'')}</option>`).join(''):'<option value="">Cadastre um culto primeiro</option>'}</select></label>
 <button class="primary" data-bible-add="biblia" ${meetings.length?'disabled':''}>＋ Adicionar seleção ao culto</button>
 <small class="muted">Tradução: João Ferreira de Almeida (domínio público) · <a href="${BIBLE_SOURCE}" target="_blank" rel="noopener noreferrer">Fonte: bible-api.com</a>. A fonte requer internet para novos capítulos.</small></div>`;
}
export function savedPassageMarkup(r){
 return r.text?`<div class="scripture-text">${escapeHtml(r.text)}</div><small class="muted">${escapeHtml(r.translation||'Almeida (domínio público)')} · ${BIBLE_SOURCE}</small>`
 :`<button type="button" class="ghost small no-print" data-bible-expand="${escapeHtml(r.id)}">📖 Ver texto bíblico</button>`;
}
function preview(id, chapter){
 const state=current(id),target=document.querySelector(`[data-bible-content="${id}"]`);
 if(!target)return;
 const options=chapter.verses.map(v=>`<option value="${v.verse}" ${v.verse===state.start?'selected':''}>${v.verse}</option>`).join('');
 const optionsEnd=chapter.verses.map(v=>`<option value="${v.verse}" ${v.verse===state.end?'selected':''}>${v.verse}</option>`).join('');
 target.innerHTML=`<div class="bible-range"><label class="formfield">Versículo inicial<select class="select" data-bible-start="${id}"><option value="">Capítulo inteiro</option>${options}</select></label><label class="formfield">Versículo final<select class="select" data-bible-end="${id}" ${state.start===null?'disabled':''}>${optionsEnd}</select></label></div>
 <div class="chapter-list">${chapter.verses.map(v=>`<button type="button" class="verse-row ${state.start!==null&&v.verse>=state.start&&v.verse<=(state.end??state.start)?'selected':''}" data-verse-id="${id}" data-verse-number="${v.verse}"><span>${v.verse}</span><span>${escapeHtml(v.text)}</span></button>`).join('')}</div>
 <small class="muted">João Ferreira de Almeida (domínio público) · ${BIBLE_SOURCE}</small>`;
 const add=document.querySelector(`[data-bible-add="${id}"]`);if(add)add.disabled=false;
}
export function setupBibleUI({root,toast,getMeetings,savePassage,expandSaved}){
 async function load(id){
 const s=current(id),container=document.querySelector(`[data-bible-content="${id}"]`);
 if(container)container.innerHTML='<p class="muted">Carregando capítulo...</p>';
 try{const chapter=await getChapter(s.book,s.chapter);localChapters.set(id,chapter);preview(id,chapter)}
 catch(e){if(container)container.textContent=e.message;toast(e.message)}
 }
 root.addEventListener('change', e=>{
 const el=e.target, id=el.dataset.bibleBook||el.dataset.bibleChapter||el.dataset.bibleStart||el.dataset.bibleEnd;
 if(!id)return;
 const state={...current(id)};
 if(el.dataset.bibleBook){state.book=el.value;state.chapter=1;state.start=null;state.end=null;const chapterSelect=document.querySelector(`[data-bible-chapter="${id}"]`);if(chapterSelect)chapterSelect.innerHTML=chapOpts(state.book,1);}
 else if(el.dataset.bibleChapter){state.chapter=Number(el.value);state.start=null;state.end=null;}
 else if(el.dataset.bibleStart){state.start=el.value?Number(el.value):null;state.end=state.start;}
 else if(el.dataset.bibleEnd){state.end=Number(el.value);if(state.end<state.start){state.end=state.start;toast('O versículo final não pode ser menor que o inicial.');}}
 selections.set(id,state);
 if(el.dataset.bibleBook||el.dataset.bibleChapter){localChapters.delete(id);const content=document.querySelector(`[data-bible-content="${id}"]`);if(content)content.innerHTML='';const add=document.querySelector(`[data-bible-add="${id}"]`);if(add)add.disabled=true;}
 else {const ch=localChapters.get(id);if(ch)preview(id,ch);}
 });
 root.addEventListener('click',async event=>{
 const element=event.target.closest('button');if(!element)return;
 const loadId=element.dataset.bibleLoad,selectId=element.dataset.verseId,addId=element.dataset.bibleAdd,expandId=element.dataset.bibleExpand;
 if(loadId){await load(loadId);return;}
 if(selectId){const n=Number(element.dataset.verseNumber), state={...current(selectId)};
   if(state.start===null||n<state.start||state.end!==state.start){state.start=n;state.end=n;}else{state.end=n;}
   selections.set(selectId,state);const ch=localChapters.get(selectId);if(ch)preview(selectId,ch);return;}
 if(addId){const ch=localChapters.get(addId);if(!ch)return toast('Carregue o capítulo primeiro.');
   try{const s=current(addId), ref=passageFromChapter(ch,s.start,s.end);
     const dest=addId==='biblia'?document.querySelector('#bible-destination')?.value:null;
     if(addId==='biblia'&&!dest)return toast('Cadastre um culto para salvar a passagem.');
     const note=addId==='culto'?document.querySelector('#ref-form [name="note"]')?.value||'':'';
     await savePassage(ref,dest,note);toast(`${ref.label} salvo no culto!`);
   }catch(e){toast(e.message)}return;}
 if(expandId){
   const row=getMeetings().flatMap(m=>(m.refs||[]).map(r=>({m,r}))).find(x=>x.r.id===expandId);
   if(!row)return toast('Referência não encontrada.');
   element.disabled=true;element.textContent='Buscando texto...';
   try{const ref=await expandReference(row.r);await expandSaved(row.m, row.r, ref);toast('Texto bíblico salvo para leitura offline.');}
   catch(e){element.disabled=false;element.textContent='📖 Ver texto bíblico';toast(e.message)}
 }
 });
 return {load};
}