import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";
import { slackApi } from "./api";
export function SlackAttachment({
  file,
  connection,
  onFile,
}: {
  file: {
    id: string;
    name?: string;
    mimetype?: string;
    permalink?: string;
    size?: number;
  };
  connection: string;
  onFile: (id: string, preview: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);
  const image = ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
    file.mimetype || "",
  );
  useEffect(() => {
    setSource("");
    setFailed(false);
    if (!image || !host.current) return;
    let cancelled = false,
      url = "";
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void slackApi("download", { connection, file: file.id })
          .then((r) => {
            if (cancelled) return;
            if (
              !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
                r.mime,
              )
            )
              throw Error("Unsupported image");
            const bytes = Uint8Array.from(atob(r.base64), (c: string) =>
              c.charCodeAt(0),
            );
            url = URL.createObjectURL(new Blob([bytes], { type: r.mime }));
            setSource(url);
          })
          .catch(() => {
            if (!cancelled) setFailed(true);
          });
      },
      { rootMargin: "200px" },
    );
    observer.observe(host.current);
    return () => {
      cancelled = true;
      observer.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, [connection, file.id, image]);
  return (
    <div
      ref={host}
      className="group/file my-2 w-fit max-w-full overflow-hidden rounded-lg border bg-background text-sm"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {!image && <FileText className="h-7 w-7 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate font-semibold">
          {file.name || "Attachment"}
        </span>
        <button
          type="button"
          aria-label={`Download ${file.name || "attachment"}`}
          title="Download"
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          onClick={() => onFile(file.id, false)}
        >
          <Download className="h-4 w-4" />
        </button>
        {file.permalink && (
          <a
            href={file.permalink}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${file.name || "attachment"} in Slack`}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      {image && (
        <button
          type="button"
          aria-label={`Preview ${file.name || "image"}`}
          className="block max-w-full border-t text-left"
          onClick={() => onFile(file.id, true)}
        >
          {source ? (
            <img
              src={source}
              alt={file.name || "Slack attachment"}
              className="max-h-[320px] max-w-full object-contain"
            />
          ) : (
            <span className="flex h-32 w-72 max-w-full items-center justify-center bg-muted/30 text-xs text-muted-foreground">
              {failed ? "Open image preview" : "Loading image…"}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
