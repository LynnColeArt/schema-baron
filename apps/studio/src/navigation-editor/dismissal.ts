export function navigationDismissal(input:{active:boolean;dirty:boolean;busy:boolean;confirming:boolean}):'blocked'|'keep-editing'|'confirm'|'close'{
 if(input.busy)return 'blocked';
 if(!input.active)return 'close';
 if(input.confirming)return 'keep-editing';
 return input.dirty?'confirm':'close';
}
