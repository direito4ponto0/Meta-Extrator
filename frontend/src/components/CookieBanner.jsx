import { useEffect, useState } from "react";
import { ShieldCheck, X } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

const STORAGE_KEY = "me_lgpd_consent_v1";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ acceptedAt: new Date().toISOString(), version: 1 })
      );
    } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      data-testid="cookie-banner"
      role="dialog"
      aria-label="Aviso de privacidade conforme LGPD"
      className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-6 sm:bottom-6"
    >
      <div className="mx-auto max-w-3xl border border-[var(--ma-border)] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-5 sm:p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--ma-border)]">
            <ShieldCheck size={20} weight="bold" className="text-[var(--ma-text)]" aria-hidden="true" />
          </div>

          <div className="flex-1 space-y-2 text-sm leading-relaxed text-[var(--ma-text)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--ma-accent)]">
              Aviso de Privacidade · LGPD
            </div>
            <p>
              O <span className="font-semibold">Meta Extrator</span> não coleta, armazena ou
              compartilha nenhum dado pessoal. Todo o processamento dos seus arquivos acontece
              localmente no seu navegador. Utilizamos apenas o armazenamento local
              (<span className="font-mono text-xs">localStorage</span>) para lembrar que você já
              viu este aviso — nenhum cookie de rastreamento, analytics ou publicidade é
              utilizado.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <PolicyDialog />
            <button
              type="button"
              onClick={dismiss}
              data-testid="cookie-accept-btn"
              className="inline-flex items-center justify-center gap-2 border border-[var(--ma-border)] bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-[var(--ma-text)] transition-colors hover:border-[var(--ma-text)]"
            >
              Entendido
            </button>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar aviso"
            className="absolute right-3 top-3 text-[var(--ma-text-secondary)] hover:text-[var(--ma-text)] sm:hidden"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PolicyDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid="cookie-policy-link-btn"
          className="inline-flex items-center justify-center border border-[var(--ma-border)] px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-[var(--ma-text)] transition-colors hover:bg-[var(--ma-bg-secondary)]"
        >
          Ler política
        </button>
      </DialogTrigger>
      <DialogContent
        data-testid="privacy-policy-dialog"
        className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-none border-[var(--ma-text)] p-0"
      >
        <PolicyContent />
      </DialogContent>
    </Dialog>
  );
}

export function PolicyContent() {
  return (
    <div className="bg-white">
      <DialogHeader className="border-b border-[var(--ma-border)] p-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--ma-accent)]">
          LGPD · Lei nº 13.709/2018
        </div>
        <DialogTitle className="mt-2 font-display text-2xl font-semibold tracking-tight">
          Política de Privacidade
        </DialogTitle>
        <DialogDescription className="mt-1 text-xs text-[var(--ma-text-secondary)]">
          Última atualização: 2026
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 p-6 text-sm leading-relaxed text-[var(--ma-text)]">
        <section data-testid="policy-section-1">
          <h3 className="font-display text-base font-semibold tracking-tight">1. Resumo (TL;DR)</h3>
          <p className="mt-2">
            O Meta Extrator <span className="font-semibold">não coleta absolutamente nenhum dado pessoal</span>.
            Todo o processamento dos arquivos analisados acontece exclusivamente dentro do seu navegador.
            Nenhum byte do seu arquivo é enviado para servidores nossos ou de terceiros.
          </p>
        </section>

        <section data-testid="policy-section-2">
          <h3 className="font-display text-base font-semibold tracking-tight">2. Quais dados nós tratamos?</h3>
          <p className="mt-2">Nenhum dado pessoal é tratado nos termos do art. 5º, II, da LGPD. Especificamente:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--ma-text-secondary)]">
            <li>Não coletamos seu nome, e-mail, IP, geolocalização ou identificador de dispositivo.</li>
            <li>Não armazenamos os arquivos que você analisa (eles nunca saem do seu navegador).</li>
            <li>Não armazenamos os hashes, metadados extraídos ou relatórios gerados.</li>
            <li>Não utilizamos cookies de sessão, de rastreamento, publicitários ou de analytics.</li>
          </ul>
        </section>

        <section data-testid="policy-section-3">
          <h3 className="font-display text-base font-semibold tracking-tight">3. Armazenamento local (localStorage)</h3>
          <p className="mt-2">
            Utilizamos apenas <span className="font-mono text-xs">localStorage</span> do seu navegador para
            registrar que você visualizou o aviso de privacidade, evitando que ele seja exibido novamente.
            Essa informação permanece exclusivamente no seu dispositivo e pode ser removida a qualquer momento
            limpando os dados do site nas configurações do navegador.
          </p>
        </section>

        <section data-testid="policy-section-4">
          <h3 className="font-display text-base font-semibold tracking-tight">4. Compartilhamento com terceiros</h3>
          <p className="mt-2">
            Nenhum dado é compartilhado com terceiros, pois nenhum dado é coletado. O mapa que exibe coordenadas
            GPS extraídas de imagens utiliza tiles do <span className="font-semibold">OpenStreetMap</span>;
            ao visualizar um mapa, seu navegador requisita as imagens das tiles diretamente ao OSM, sem nossa
            intermediação. Nenhuma coordenada ou dado seu é transmitido por nós.
          </p>
        </section>

        <section data-testid="policy-section-5">
          <h3 className="font-display text-base font-semibold tracking-tight">5. Direitos do titular (arts. 17 a 22 da LGPD)</h3>
          <p className="mt-2">
            Como não realizamos tratamento de dados pessoais, não há dados para confirmar, acessar, corrigir,
            anonimizar, portar ou eliminar. Caso você tenha dúvidas, pode entrar em contato com o controlador
            indicado abaixo.
          </p>
        </section>

        <section data-testid="policy-section-6">
          <h3 className="font-display text-base font-semibold tracking-tight">6. Segurança</h3>
          <p className="mt-2">
            A aplicação é servida via HTTPS e todo o processamento é client-side, o que reduz drasticamente
            a superfície de risco. Recomendamos manter seu navegador atualizado.
          </p>
        </section>

        <section data-testid="policy-section-7">
          <h3 className="font-display text-base font-semibold tracking-tight">7. Controlador</h3>
          <p className="mt-2">
            <span className="font-semibold">Mateus Ferreira dos Santos</span><br />
            Advogado e Especialista em Segurança da Informação
          </p>
        </section>

        <section data-testid="policy-section-8">
          <h3 className="font-display text-base font-semibold tracking-tight">8. Alterações</h3>
          <p className="mt-2">
            Esta política poderá ser atualizada para refletir mudanças na aplicação ou na legislação.
            A versão mais recente estará sempre disponível nesta página.
          </p>
        </section>
      </div>
    </div>
  );
}
