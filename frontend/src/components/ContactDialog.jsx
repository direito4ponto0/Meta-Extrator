import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EnvelopeSimple, PaperPlaneTilt } from "@phosphor-icons/react";
import { toast } from "sonner";

const CONTACT_EMAIL = "web@metaextrator.com.br";

export default function ContactDialog({ triggerClassName, triggerLabel = "Contato" }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!message.trim()) {
      toast.error("Por favor, escreva uma mensagem antes de enviar.");
      return;
    }
    // Defense-in-depth: strip CR/LF from subject to prevent any client quirks
    const cleanSubject = (subject.trim() || "Contato — Meta Extrator").replace(/[\r\n]+/g, " ").slice(0, 200);
    const cleanName = name.trim().replace(/[\r\n]+/g, " ").slice(0, 120);
    const cleanEmail = email.trim().replace(/[\r\n\s]+/g, "").slice(0, 200);
    const cleanMessage = message.slice(0, 5000);
    const body = [
      cleanName && `Nome: ${cleanName}`,
      cleanEmail && `E-mail: ${cleanEmail}`,
      "",
      cleanMessage,
    ].filter((l) => l !== undefined).join("\n");

    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(cleanSubject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    toast.success("Abrindo seu cliente de e-mail…");
    setTimeout(() => setOpen(false), 400);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid="contact-trigger"
          className={triggerClassName || "text-left underline decoration-white/30 underline-offset-2 hover:decoration-white"}
        >
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent
        data-testid="contact-dialog"
        className="max-h-[88vh] max-w-xl overflow-y-auto rounded-none border-[var(--ma-text)] bg-white"
      >
        <DialogHeader>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--ma-accent)]">
            Fale conosco
          </div>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
            Envie uma mensagem
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs text-[var(--ma-text-secondary)]">
            <EnvelopeSimple size={14} weight="bold" aria-hidden="true" />
            <span className="font-mono">{CONTACT_EMAIL}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="contact-name" className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ma-text-secondary)]">
                Nome (opcional)
              </label>
              <input
                id="contact-name"
                data-testid="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-none border border-[var(--ma-border)] bg-white px-3 py-2 text-sm focus:border-[var(--ma-text)] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="contact-email" className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ma-text-secondary)]">
                Seu e-mail (opcional)
              </label>
              <input
                id="contact-email"
                data-testid="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="w-full rounded-none border border-[var(--ma-border)] bg-white px-3 py-2 font-mono text-sm focus:border-[var(--ma-text)] focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="contact-subject" className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ma-text-secondary)]">
              Assunto
            </label>
            <input
              id="contact-subject"
              data-testid="contact-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sugestão, dúvida, parceria, bug…"
              className="w-full rounded-none border border-[var(--ma-border)] bg-white px-3 py-2 text-sm focus:border-[var(--ma-text)] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="contact-message" className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ma-text-secondary)]">
              Mensagem
            </label>
            <textarea
              id="contact-message"
              data-testid="contact-message"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Conte como podemos ajudar…"
              className="w-full resize-y rounded-none border border-[var(--ma-border)] bg-white px-3 py-2 text-sm leading-relaxed focus:border-[var(--ma-text)] focus:outline-none"
            />
          </div>

          <p className="border-l-2 border-[var(--ma-accent)] bg-[var(--ma-bg-secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--ma-text-secondary)]">
            Ao clicar em <span className="font-semibold text-[var(--ma-text)]">Enviar</span>, seu cliente de e-mail padrão será aberto
            com a mensagem pré-preenchida para <span className="font-mono">{CONTACT_EMAIL}</span>. Nada é transmitido por nossos
            servidores — coerente com a política de zero coleta da aplicação.
          </p>
        </div>

        <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="minimal"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            data-testid="contact-send-btn"
            variant="minimal"
            onClick={handleSend}
          >
            <PaperPlaneTilt size={16} weight="bold" className="mr-2" aria-hidden="true" />
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
