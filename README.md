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

## Exemplo de backend para IA (Node.js ou função serverless)

Veja `api/summary.example.mjs`. Use a chave `OPENAI_API_KEY` em variável de ambiente **no servidor**, nunca no frontend. Este endpoint não tem autenticação, por isso a implantação pública exige controles antiexcesso (rate limiting, orçamento/cota e proteção de origem). Configure a URL HTTPS no menu Ajustes.

## Próxima etapa

Migrar o MVP para React + TypeScript em arquitetura modular se o projeto exigir crescimento de equipe, acrescentar validação exata de todos os versículos, testes end-to-end e uma integração bíblica licenciada. A versão atual prioriza funcionar imediatamente com zero dependências externas.