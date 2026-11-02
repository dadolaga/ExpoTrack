import { Button } from "@/components/ui/Button";

export type SaveState = "idle" | "saving" | "saved" | "error";

const messages: Record<SaveState, string> = {
  idle: "Le modifiche si salvano automaticamente sul dispositivo.",
  saving: "Salvataggio sul dispositivo…",
  saved: "Salvato sul dispositivo.",
  error: "Modifiche non salvate. I dati restano aperti: riprova prima di uscire.",
};

export function SaveStatus({ status, onRetry }: {
  status: SaveState;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p
        role="status"
        aria-atomic="true"
        className={status === "error" ? "text-label text-danger" : "text-caption text-text-muted"}
      >
        {messages[status]}
      </p>
      {status === "error" && (
        <Button
          variant="secondary"
          onClick={onRetry}
        >Riprova salvataggio
        </Button>
      )}
    </div>
  );
}
