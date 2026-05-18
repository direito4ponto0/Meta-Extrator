const GITHUB_REPO_URL = "https://github.com/direito4ponto0/Meta-Extrator";

export default function AboutSection() {
  return (
    <section id="sobre" data-testid="about-section" className="mt-24 border-t border-[var(--ma-border)] pt-16">
      <div className="mb-12 flex flex-col items-center gap-4 text-center">
        <img
          src="/about-illustration.png"
          alt="Ilustração de privacidade e processamento local"
          className="h-24 w-24 object-contain opacity-90"
        />
        <div className="space-y-3">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Meta Extrator
          </h2>
        </div>
      </div>

      {/* Texto sobre o MetaExtrator */}
      <div
        data-testid="about-authorial"
        className="border border-[var(--ma-border)] bg-white p-8 sm:p-12"
      >
        <div className="mx-auto max-w-3xl space-y-5 text-[15px] leading-relaxed text-[var(--ma-text)] text-justify">
          <p>
            O <span className="font-semibold">MetaExtrator</span> é um projeto de aplicação web,
            gratuita e de código aberto, pensada e focada na extração e manipulação de metadados,
            além da geração e comparação de assinaturas <span className="font-mono font-semibold">HASH</span> em diversos formatos de arquivos.
            A ferramenta não tem por objetivo substituir a análise forense, pois esta carece de
            inúmeras ferramentas e técnicas específicas. O ponto aqui é fazer uma análise inicial,
            rápida e fácil, sem a utilização de programas ou técnicas complexas, sendo que tudo é
            processado em seu navegador, sem nenhum acesso ao seu dispositivo.
          </p>
          <p>
            Embora seja uma ferramenta de extração rápida, as tecnologias utilizadas na aplicação
            web e as bibliotecas estão entre as mais eficientes atualmente.
          </p>
          <p>
            Ao final da extração, um relatório com assinatura <span className="font-mono font-semibold">HASH</span> será
            emitido. Você também pode usar os módulos independentes de{" "}
            <span className="font-semibold">Assinatura Hash</span> e{" "}
            <span className="font-semibold">Comparação Hash</span> para validar a integridade de
            qualquer arquivo.{" "}
            <span>
              Esta é uma aplicação de código-fonte aberto. Seu código e todas as ferramentas
              utilizadas estão disponibilizadas no GitHub.{" "}
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="about-github-link"
                className="font-semibold text-[var(--ma-text)] underline decoration-[var(--ma-text)]/40 underline-offset-2 transition-colors hover:decoration-[var(--ma-text)]"
              >
                Clique aqui para acessar
              </a>
              .
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
