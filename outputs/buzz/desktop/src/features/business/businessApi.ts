export type BusinessPage = {
  id: string;
  mode: "lovable" | "connector" | "build";
  title: string;
  url: string | null;
  project_id: string | null;
  run?: {id:string;status:string;started_at:string} | null;
  messages: { role: string; content: string }[];
};
export async function businessApi(path: string, body?: unknown) {
  const r = await fetch(`http://127.0.0.1:5180/business/${path}`, {
    signal: AbortSignal.timeout(90000),
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Could not load business pages");
  return data;
}
export function pagesChanged() {
  window.dispatchEvent(new Event("business:changed"));
}
