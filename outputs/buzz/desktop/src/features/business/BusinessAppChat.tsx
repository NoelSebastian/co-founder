import {useEffect,useRef,useState} from "react";
import {Send, LoaderCircle} from "lucide-react";
import {Markdown} from "@/shared/ui/markdown";
import {Button} from "@/shared/ui/button";
import {businessApi,type BusinessPage} from "./businessApi";

export function BusinessAppChat({page,onChange}:{page:BusinessPage;onChange:(page:BusinessPage)=>void}){
 const [draft,setDraft]=useState(""),[sending,setSending]=useState(false),[error,setError]=useState("");
 const bottom=useRef<HTMLDivElement>(null);
 const pending=sending||page.run?.status==="sending"||page.run?.status==="building";
 useEffect(()=>{bottom.current?.scrollIntoView({block:"nearest"});},[page.messages.length,pending]);
 useEffect(()=>{
  if(!pending)return;
  let active=true;
  const timer=setInterval(()=>{void businessApi("pages").then(result=>{const next=result.pages.find((p:BusinessPage)=>p.id===page.id);if(active&&next)onChange(next);}).catch(()=>{if(active)setError("Could not refresh progress. Your request is still saved.");});},4000);
  return()=>{active=false;clearInterval(timer);};
 },[pending,page.id,onChange]);
 async function send(){
  if(!draft.trim()||pending)return;
  const content=draft.trim();setSending(true);setError("");
  try{const result=await businessApi("chat",{id:page.id,message:content});onChange({...page,...result});setDraft("");}
  catch(e){setError(e instanceof Error?e.message:"Could not send your message.");}
  finally{setSending(false);}
 }
 return <aside id="business-cofounder-panel" aria-label="Edit app conversation" className="flex h-full min-h-0 w-[380px] max-w-[48%] shrink-0 flex-col border-l border-border bg-background">
  <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
   <span className="flex size-7 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">CF</span>
   <div><h2 className="text-sm font-semibold">Co-founder</h2><p className="text-xs text-muted-foreground">Edit {page.title.toLowerCase()}</p></div>
  </header>
  <div role="log" aria-label="App edit messages" className="min-h-0 flex-1 overflow-y-auto py-4">
   {page.messages.length===0&&<div className="px-4 py-3 text-sm leading-relaxed text-muted-foreground">What would you like to change in this app?</div>}
   {page.messages.map((message,index)=><div key={`${index}-${message.role}`} className="flex gap-2.5 px-4 py-2.5 hover:bg-muted/30">
    <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">{message.role==="user"?"N":"CF"}</span>
    <div className="min-w-0 flex-1"><p className="mb-1 text-sm font-semibold">{message.role==="user"?"You":"Co-founder"}</p><div className="break-words text-sm leading-relaxed"><Markdown content={message.content}/></div></div>
   </div>)}
   {pending&&<p role="status" className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground"><LoaderCircle className="size-3 animate-spin"/>{sending?"Sending to Lovable…":"Lovable is working on your request…"}</p>}
   {page.run?.status==="unknown"&&<p role="status" className="px-4 py-3 text-xs text-muted-foreground">Build status could not be confirmed. Check the project before retrying.</p>}
   <div ref={bottom}/>
  </div>
  <form className="shrink-0 p-3" onSubmit={e=>{e.preventDefault();void send();}}>
   {error&&<p role="alert" className="mb-2 text-xs text-destructive">{error}</p>}
   <div className="rounded-lg border border-input bg-background focus-within:border-ring">
    <textarea aria-label="Message Co-founder" placeholder="Message Co-founder…" className="block min-h-20 w-full resize-none bg-transparent px-3 pt-3 text-sm outline-none placeholder:text-muted-foreground" value={draft} maxLength={4000} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/>
    <div className="flex items-center justify-end px-2 pb-2"><Button type="submit" variant="ghost" size="icon" className="size-7" aria-label="Send app edit" disabled={pending||!draft.trim()}><Send className="size-4"/></Button></div>
   </div>
  </form>
 </aside>;
}
