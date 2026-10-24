import test from 'node:test';import assert from 'node:assert/strict';import {normalizeMode,studyInstructions} from '../study-prompt.mjs';
test('modo inválido assume resumo',()=>assert.equal(normalizeMode('qualquer'), 'resumo'));
test('estudo pede distinguir reflexões e fatos',()=>{const p=studyInstructions('estudo');assert.match(p,/INTERPRET/i);assert.match(p,/pregador/i);assert.match(p,/não invente/i)});
test('revisão cria perguntas e calendário',()=>assert.match(studyInstructions('revisao'),/3 dias/));