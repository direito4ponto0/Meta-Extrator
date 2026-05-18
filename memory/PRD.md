# META EXTRATOR — Product Requirements Document

**Última atualização:** 18/05/2026

## Visão Geral
Web app brasileira, gratuita e de código aberto, para **extração**, **manipulação**, **assinatura** e **comparação** de metadados e hashes criptográficos. **100% client-side** (LGPD-first).

## Original Problem Statement
> Quero construir uma aplicação web de extração de metadados. Consistirá da extração de metadados e emissão de um relatório completo, com hash. Todo o processamento se dará localmente, nenhum dado será coletado. Limitação de 10 GB. Nome: META EXTRATOR. Relatórios em PDF e JSON.

## Personas
- Profissionais de TI/segurança que precisam de uma análise inicial rápida.
- Jornalistas, pesquisadores e cidadãos avaliando origem/integridade de arquivos.
- Usuários gerais querendo limpar EXIF/GPS antes de compartilhar.

## Princípios não-negociáveis (P0)
- Zero upload, zero analytics, zero cookies de rastreamento.
- LGPD: banner próprio, política localizada, sem terceiros que coletem dados.
- Sem badges/watermarks de plataforma; código pronto para Cloudflare Pages.
- Relatórios **não contêm nenhum dado** sobre navegador, localização, IP ou equipamento — apenas informações sobre o(s) arquivo(s) analisado(s).

## Features implementadas
- Extração de metadados de 30+ formatos (imagens, PDF, Office, áudio, vídeo, ZIP, e-book, magic bytes).
- Manipulação: edição e eliminação de metadados (JPG, PNG, WebP, PDF, Office).
- 3 abas independentes: **Extração de Metadados** · **Assinatura Hash** · **Comparação Hash**.
- Assinatura Hash: MD5, SHA-1, SHA-256, SHA-384, SHA-512, SHA3-256, SHA3-512, BLAKE3 (streaming WebAssembly).
- Comparação Hash: Arquivo×Arquivo e Arquivo×Hash com detecção automática de algoritmo pelo tamanho.
- Drag-and-drop em todos os módulos (Dropzone principal + FileDropBox compacto reutilizável).
- Relatórios PDF + JSON com:
  - Logo vetorial (lupa+M) + cabeçalho "META EXTRATOR" + link **metaextrator.com.br** + subtítulo + data/hora UTC.
  - Marca d'água com lupa e letra M ambas em traço fino (`renderingMode: stroke`), opacidade GState 0.08, equilibradas visualmente.
  - Seção numerada "Tecnologias e bibliotecas utilizadas" **filtrada por tipo de relatório**: extrações listam apenas bibliotecas usadas para aquela categoria; relatórios de assinatura/comparação listam apenas File API + hash-wasm + jsPDF; manipulações listam apenas o que foi efetivamente usado para aquele formato.
  - **Privacidade reforçada**: timestamps em UTC, propriedades `/Author`, `/Creator`, `/Title`, `/Subject`, `/Keywords` neutras ("Meta Extrator"), `/Producer` sobrescrito após geração para remover o marcador `jsPDF X.Y.Z`, `/CreationDate` em formato `Z` (UTC sem offset local).
  - Rodapé padronizado: "Este relatório foi gerado integralmente no navegador..."
  - Nome do arquivo padronizado `Relatorio-Meta-Extrator_<op>_<timestamp>.pdf|json` (NÃO usa nome do arquivo original).
- UI futurista mas limpa: grid sutil de fundo, glow radial no topo, linha de destaque no tab ativo, cantos angulares nas drop zones.
- Página "Sobre" minimalista: imagem + título "Meta Extrator" + parágrafos descritivos com link de código aberto para o GitHub (`Clique aqui para acessar`).
- Rodapé compacto com fundo igual ao da página (sem fundo preto), copyright + política LGPD + crédito do desenvolvedor.
- Política LGPD com banner persistido em `localStorage`.

## Stack
- React 19, Tailwind, Shadcn UI, Phosphor Icons.
- hash-wasm, exifr, music-metadata, pdf.js, pdf-lib, piexifjs, jszip, jsPDF.
- 100% browser; deploy via GitHub → Cloudflare Pages.

## Changelog
- **18/05/2026** — Seção "Sobre" reduzida (apenas título + texto + link GitHub); rodapé claro e compacto; relatórios com URL `metaextrator.com.br` abaixo do header; marca d'água balanceada (lupa + M em outline fino); tabela de tecnologias filtrada por tipo de relatório; auditoria de privacidade do PDF (UTC, /Producer neutralizado, nenhum vazamento de navegador/IP/equipamento). Auditoria de segurança: sem XSS surface, sem `eval`, sem `fetch`, todos `target="_blank"` com `rel="noopener noreferrer"`.
- **18/05/2026 (anterior)** — Layout overhaul: hero em maiúsculas, ícone ArrowsLeftRight na Comparação, futurista/limpo, drag-drop nos módulos de hash, relatórios PDF reformulados (logo, watermark, datetime, seção tecnologias, novo rodapé, nome padronizado).
- **17/05/2026** — Edição de WebP via RIFF; relatórios sanitizados; UI modernizada; CSP+headers Cloudflare.
- **<= 16/05/2026** — Stack base, manipulação JPG/PNG/PDF/Office, banner LGPD, MIT license.

## Backlog
- P2: Resetar `expectedHash` em mais transições de estado da Comparação.
- P2: Refatorar `reportGenerator.js` em `/lib/reports/*` quando passar de 700 linhas.
- P2: Mover diretivas CSP de `<meta>` para HTTP header via `_headers` do Cloudflare.
- P3: Tooltips explicativos para termos técnicos (cidadão comum).
- P3: Interpretação textual ("Creator indica o software de origem").
