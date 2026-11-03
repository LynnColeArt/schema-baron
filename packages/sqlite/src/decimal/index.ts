import type Database from 'better-sqlite3';
/** Portable exact arithmetic: no dependency on Studio, native floating point, or ambient precision. */
export interface DecimalFormat { precision: number; scale: number; rounding: 'half-up' | 'half-even' | 'down'; encoding?: 'text' | 'scaled-integer' }
export class DecimalError extends Error { readonly code = 'TYPE_MISMATCH'; constructor() { super('Invalid exact decimal, division by zero, or precision overflow. Check encoding, scale and precision.'); } }
function format(f: DecimalFormat) {
 if (!Number.isInteger(f.precision) || !Number.isInteger(f.scale) || f.precision < 1 || f.precision > 38 || f.scale < 0 || f.scale > f.precision || f.encoding !== undefined && !['text','scaled-integer'].includes(f.encoding) || f.encoding === 'scaled-integer' && f.precision > 18 || !['half-up','half-even','down'].includes(f.rounding)) throw new DecimalError();
 return f;
}
const pow = (n: number) => 10n ** BigInt(n);
function checked(n: bigint, f: DecimalFormat): bigint { if ((n < 0n ? -n : n) >= pow(f.precision)) throw new DecimalError(); return n; }
function rounded(n: bigint, d: bigint, mode: DecimalFormat['rounding']): bigint {
 if (d === 0n) throw new DecimalError();
 const sign = (n < 0n) !== (d < 0n) ? -1n : 1n; n = n < 0n ? -n : n; d = d < 0n ? -d : d;
 const q = n / d, r = n % d;
 return sign * (q + (mode !== 'down' && (2n*r > d || 2n*r === d && (mode === 'half-up' || q % 2n !== 0n)) ? 1n : 0n));
}
function units(value: unknown, f: DecimalFormat, allowRounding = false, physical = false): bigint {
 format(f);
 if (physical && f.encoding === 'scaled-integer') {
  if (typeof value === 'bigint') return checked(value,f);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return checked(BigInt(value),f);
  throw new DecimalError();
 }
 if (typeof value !== 'string' || value.length > 80 || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new DecimalError();
 const negative = value.startsWith('-'); const [whole = '', fraction = ''] = value.replace(/^-/,'').split('.');
 if (fraction.length > f.scale && !allowRounding) throw new DecimalError();
 const n = BigInt(whole + fraction) * (negative ? -1n : 1n);
 return checked(fraction.length <= f.scale ? n * pow(f.scale-fraction.length) : rounded(n,pow(fraction.length-f.scale),f.rounding),f);
}
function string(n: bigint, f: DecimalFormat): string {
 checked(n,f); const s = (n < 0n ? -n : n).toString().padStart(f.scale+1,'0');
 return (n < 0n ? '-' : '') + (f.scale ? s.slice(0,-f.scale)+'.'+s.slice(-f.scale) : s);
}
/** Input rejects excess scale; explicit calculation boundaries may round. SQLite INTEGER decoding uses bigint. */
export function decimalCodec(value: unknown, f: DecimalFormat, allowRounding = false): string { return string(units(value,f,allowRounding,true),f); }
/** Encode a logical decimal into the declared SQLite storage representation. */
export function decimalEncode(value: string, f: DecimalFormat): string | bigint { format(f); const n=units(value,f); return f.encoding === 'scaled-integer' ? n : string(n,f); }
export function decimalCalculate(operator: '+' | '-' | '*' | '/', left: string, right: string, f: DecimalFormat): string {
 const a = units(left,f), b = units(right,f); const factor = pow(f.scale);
 return string(operator === '+' ? a+b : operator === '-' ? a-b : operator === '*' ? rounded(a*b,factor,f.rounding) : rounded(a*factor,b,f.rounding),f);
}
/** Register on preview and emitted-runtime connections alike. Caller owns connection isolation and query-only mode. */
export function registerDecimalFunctions(db: Database.Database): void {
 const config = (precision: unknown, scale: unknown, rounding: unknown): DecimalFormat => format({precision:Number(precision),scale:Number(scale),rounding:rounding as DecimalFormat['rounding']});
 const options = { deterministic: true, safeIntegers: true };
 db.function('sb_decimal', options, (v,p,s,r,e) => v === null ? null : decimalCodec(v,{...config(p,s,r),encoding:e as 'text' | 'scaled-integer'}));
 for (const [name,op] of [['add','+'],['subtract','-'],['multiply','*'],['divide','/']] as const) db.function('sb_'+name,options,(a,b,p,s,r) => a === null || b === null ? null : decimalCalculate(op,String(a),String(b),config(p,s,r)));
 db.function('sb_abs',options,(v,p,s,r) => v === null ? null : string((n => n < 0n ? -n : n)(units(v,config(p,s,r))),config(p,s,r)));
 db.function('sb_compare',options,(a,b,p,s,r) => { if(a === null || b === null) return null; const f=config(p,s,r), x=units(a,f),y=units(b,f); return x<y?-1:x>y?1:0; });
 db.function('sb_sort',options,(v,p,s,r) => { if(v === null) return null; const f=config(p,s,r); return (units(v,f)+pow(f.precision)).toString().padStart(f.precision+1,'0'); });
 type State = { value: bigint; count: bigint; format?: DecimalFormat };
 for(const kind of ['sum','avg','min','max'] as const) db.aggregate<State>('sb_'+kind,{
  deterministic:true, safeIntegers:true, start:()=>({value:0n,count:0n}),
  step:(state:State,v:unknown,p?:unknown,s?:unknown,r?:unknown) => { if(v === null) return state; const f=config(p,s,r), n=units(v,f); state.format=f; state.value=kind==='min' ? state.count===0n || n<state.value ? n:state.value : kind==='max' ? state.count===0n || n>state.value ? n:state.value : state.value+n; state.count++; return state; },
  result:state => state.count===0n ? null : string(kind==='avg' ? rounded(state.value,state.count,state.format!.rounding) : state.value,state.format!),
 });
}
