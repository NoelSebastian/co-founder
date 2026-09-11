import { useEffect, useRef, useState } from "react";
import { AppWindow } from "lucide-react";
export function LovableWorkspace() {
  const area = useRef<HTMLDivElement>(null);
  const [native] = useState(
    () => !!(window as any).webkit?.messageHandlers?.businessBrowser,
  );
  useEffect(() => {
    const handler = (window as any).webkit?.messageHandlers?.businessBrowser;
    if (!handler || !area.current) return;
    const update = () => {
      const r = area.current!.getBoundingClientRect();
      handler.postMessage({
        visible: true,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(area.current);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      handler.postMessage({ visible: false });
    };
  }, []);
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-5">
        <AppWindow className="size-4" />
        <h1 className="text-sm font-medium">Lovable</h1>
      </header>
      <div ref={area} className="min-h-0 flex-1">
        {!native && (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <h2 className="text-lg font-semibold">Lovable workspace</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The native desktop browser is being tested. This web version
                cannot display Lovable’s full editor and private preview
                together.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
