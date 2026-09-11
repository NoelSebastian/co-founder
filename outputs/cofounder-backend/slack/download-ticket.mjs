import {randomBytes} from 'node:crypto';
const tickets=new Map();
export function createDownloadTicket(file, now=Date.now()) {
 for(const [id,item] of tickets) if(item.expires<=now) tickets.delete(id);
 if(tickets.size>=10) tickets.delete(tickets.keys().next().value);
 const id=randomBytes(32).toString('hex');
 tickets.set(id,{file,expires:now+60000});
 return '/slack/file/'+id;
}
export function consumeDownloadTicket(id,now=Date.now()) {
 const item=tickets.get(id); tickets.delete(id);
 return item && item.expires>now ? item.file : null;
}
