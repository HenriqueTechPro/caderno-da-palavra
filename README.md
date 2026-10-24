# Caderno da Palavra — MVP funcional

Aplicativo PWA de registro de cultos e estudos bíblicos sem login. **A interface não depende de npm nem de serviços externos.**

## Executar localmente

No diretório do projeto, execute `python3 -m http.server 8080` e abra `http://localhost:8080`. Também é possível publicar os arquivos estáticos em Netlify, Vercel ou GitHub Pages. Instalação PWA requer HTTPS (ou localhost). Após a primeira visita conectada, os recursos de interface são armazenados em cache para uso offline.

## Funcionalidades implementadas

- Cadastro e histórico de cultos, pesquisa, edição e exclusão
- Registro rápido de referências bíblicas (ex.: João 3:16-18, Sl 23, Rm 8:28), favoritos e observações
- Anotações com salvamento automático em IndexedDB
- Roteiro de revisão offline sem IA (claramente identificado)
- Integração com endpoint HTTPS próprio para resumo com IA
- PDF via opção **Imprimir > Salvar como PDF** do navegador; compartilhamento de texto pelo celular
- Exportação/importação de backup JSON; instalação como PWA
- Conexões entre referências repetidas

## Importante — limites do MVP

- O aplicativo não inclui textos integrais de traduções bíblicas, apenas as referências. A validação de versículos é básica; capítulos são validados pelo livro, mas a quantidade exata de versículos por capítulo **ainda precisa de uma tabela completa**.
- O botão PDF usa o sistema nativo de impressão do navegador. Para obter um arquivo PDF, escolha **Salvar como PDF**.
- Os dados estão vinculados ao navegador/dispositivo. Limpar os dados do site pode apagá-los. **Faça backups JSON regularmente.**
- **A IA não vem habilitada automaticamente:** requer implantação do backend abaixo e chave do provedor no ambiente do servidor.
- O PWA e o salvamento offline devem ser testados no endereço HTTPS publicado em Android/iOS antes de produção.

## Integração Gemini gratuita (Vercel)

A função `api/summary.mjs` usa exclusivamente `gemini-3.5-flash-lite`, cuja modalidade gratuita depende de disponibilidade/cotas do seu projeto no Google AI Studio.

1. Crie uma chave para um projeto **sem faturamento pago** em https://aistudio.google.com/apikey.
2. Na Vercel, abra o projeto → Settings → Environment Variables, e cadastre para **Production**:
   - `GEMINI_API_KEY`: chave criada no Google AI Studio.
   - `AI_ACCESS_TOKEN`: um código privado longo (pelo menos 16 caracteres, idealmente 24+ aleatórios), diferente da chave Google.
3. Faça **Redeploy** após definir as variáveis.
4. No PWA, abra Ajustes, informe **somente** o código `AI_ACCESS_TOKEN`, e clique em **Ativar IA nesta sessão**.
5. Abra um culto com anotações ou referências e clique em **Gerar resumo com IA**.

A chave Google permanece no servidor e **nunca** é inserida no navegador. O código do proprietário é mantido em `sessionStorage` (precisa ser informado novamente numa nova sessão). Os dados do culto são enviados ao Google apenas quando você aciona a geração.

**Segurança e custos:** o token privado protege o endpoint de acessos anônimos sem conhecê-lo, mas não é uma solução de login e não substitui proteção avançada de rate limiting. Não divulgue o token; restrinja cotas no Google AI Studio e monitore o uso. Para garantir gratuidade, não habilite faturamento pago. A modalidade gratuita pode usar conteúdo enviado para melhoria de produtos, conforme os termos do Google. O modo IA não funciona offline, mas os resumos salvos ficam disponíveis no dispositivo.

A função `api/summary.example.mjs` é um exemplo histórico para OpenAI e não é utilizada pelo aplicativo.

### Testes

`node --test tests/summary.test.mjs`

## Próxima etapa

Migrar o MVP para React + TypeScript em arquitetura modular se o projeto exigir crescimento de equipe, acrescentar validação exata de todos os versículos, testes end-to-end e uma integração bíblica licenciada. A versão atual prioriza funcionar imediatamente com zero dependências externas.

## Atualização v1.1.0 — autorização e atualizações do PWA

- Em **Ajustes > Inteligência artificial**, o código `AI_ACCESS_TOKEN` é validado por `POST /api/access`.
- A sessão permanece até 30 dias com cookie assinado `HttpOnly; Secure; SameSite=Lax`. O código não é guardado no `localStorage`; a chave `GEMINI_API_KEY` permanece na Vercel.
- A função `POST /api/summary` aceita o cookie seguro. Alterar `AI_ACCESS_TOKEN` invalida sessões existentes.
- Em **Ajustes > Atualizações do aplicativo**, verifique novas versões e clique em **Atualizar agora**. O novo service worker só é ativado por ação do usuário.
- Notas pendentes são salvas no IndexedDB antes de reinicializar. O service worker não armazena respostas de `/api/`.
- Testes: `node --test tests/*.test.mjs`. Faça backups periódicos em JSON; cookies, cache do PWA e IndexedDB são armazenamentos independentes.
