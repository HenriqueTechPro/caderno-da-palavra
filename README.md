# Caderno da Palavra

Aplicativo PWA para registrar cultos, referências bíblicas, anotações e estudos.

## Primeira versão

Sem login, com dados locais em IndexedDB, histórico pesquisável, backup JSON, exportação por impressão/PDF e roteiro de revisão offline. IA requer backend seguro configurado separadamente.

**Atenção:** os dados são locais ao navegador; exporte backups regularmente.

Após o envio dos arquivos, abra `index.html` por um servidor HTTP local (por exemplo, `python3 -m http.server 8080`) ou publique em hospedagem estática HTTPS.

Este projeto é um MVP em JavaScript modular sem dependências. Consulte o histórico de commits para as próximas evoluções.
