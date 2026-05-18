# Meta Extrator

Aplicação web 100% client-side para extração, edição e eliminação de metadados de arquivos.

- **Site**: https://metaextrator.com.br
- **Privacidade**: nenhum dado é coletado; todo o processamento ocorre no navegador.

## Stack
- React 19 + Tailwind CSS + Shadcn UI
- WebAssembly (hash-wasm) para hashing
- exifr, pdf-lib, piexifjs, music-metadata, JSZip, pdf.js

## Build local
```bash
cd frontend
yarn install
yarn build
```
Os arquivos prontos ficam em `frontend/build/`.

## Deploy
Hospedado no **Cloudflare Pages** (free tier).

## Autor
Mateus Ferreira dos Santos — Advogado e Especialista em Segurança da Informação
[Currículo Lattes](http://lattes.cnpq.br/6042598673740678)
