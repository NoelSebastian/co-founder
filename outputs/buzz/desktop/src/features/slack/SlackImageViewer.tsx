import { useState } from "react";
import { Download, Minus, Plus, RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
export function SlackImageViewer({
  url,
  name,
  onClose,
}: {
  url: string;
  name: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1),
    [rotation, setRotation] = useState(0);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[85vh] w-[90vw] max-w-[1200px] flex-col gap-0 overflow-hidden rounded-lg p-0"
        overlayClassName="bg-black/75"
      >
        <DialogTitle className="shrink-0 truncate border-b px-5 py-4 pr-12 text-sm">
          {name}
        </DialogTitle>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/30 p-8">
          <img
            alt={name}
            src={url}
            className="max-h-full max-w-full object-contain"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          />
        </div>
        <div
          role="toolbar"
          aria-label="Media controls"
          className="flex shrink-0 items-center justify-center gap-3 border-t p-3"
        >
          <button
            aria-label="Rotate"
            title="Rotate"
            onClick={() => setRotation((r) => (r + 90) % 360)}
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            aria-label="Zoom out"
            disabled={zoom <= 0.25}
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            className="w-14 text-xs"
            aria-label="Reset zoom"
            onClick={() => setZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            aria-label="Zoom in"
            disabled={zoom >= 3}
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
          >
            <Plus className="h-4 w-4" />
          </button>
          <a
            href={url}
            download={name}
            aria-label="Download image"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
