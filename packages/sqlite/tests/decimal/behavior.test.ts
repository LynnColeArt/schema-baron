import { expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { decimalCodec, decimalEncode, decimalCalculate, registerDecimalFunctions } from '../../src/decimal/index.js';
const type = { precision: 38, scale: 4, rounding: 'half-even' as const, encoding: 'text' as const };
test('exact codec, signed ties, scale, overflow and invalid inputs', () => {
 expect(decimalCodec('9007199254740993.1234', type)).toBe('9007199254740993.1234');
 expect(decimalCodec('-1.23445', type, true)).toBe('-1.2344');
 expect(decimalCodec('-1.23455', type, true)).toBe('-1.2346');
 expect(decimalCodec('1.23455', {...type,rounding:'down'}, true)).toBe('1.2345');
 expect(decimalCodec('-1.23445', {...type,rounding:'half-up'}, true)).toBe('-1.2345');
 expect(decimalCodec(12345n,{...type,precision:18,encoding:'scaled-integer'})).toBe('1.2345');
 for (const invalid of [0.1,'1e2',' 1.00','NaN','1.23456']) expect(()=>decimalCodec(invalid,type)).toThrow();
 expect(()=>decimalCodec('100.00',{...type,precision:4,scale:2})).toThrow();
 expect(decimalEncode('90071992547409.9312',{...type,precision:18,encoding:'scaled-integer'})).toBe(900719925474099312n);
 expect(decimalCalculate('*','0.1000','3.0000',type)).toBe('0.3000');
 expect(decimalCalculate('/','1.0000','6.0000',type)).toBe('0.1667');
 expect(()=>decimalCalculate('/','1.0000','0.0000',type)).toThrow();
});
test('portable deterministic SQLite helpers retain 38-digit comparisons, ordering and aggregates', () => {
 const db = new Database(':memory:'); registerDecimalFunctions(db);
 try {
 db.exec('CREATE TABLE values_exact(v TEXT);'); for(const v of ['10.0000','2.0000','-3.0000',null]) db.prepare('INSERT INTO values_exact VALUES(?)').run(v);
 expect(db.prepare("SELECT sb_sum(v,38,4,'half-even') AS s, sb_avg(v,38,4,'half-even') AS a FROM values_exact").get()).toEqual({s:'9.0000',a:'3.0000'});
 expect(db.prepare("SELECT v FROM values_exact WHERE v IS NOT NULL ORDER BY sb_sort(v,38,4,'half-even')").all()).toEqual([{v:'-3.0000'},{v:'2.0000'},{v:'10.0000'}]);
 expect(db.prepare("SELECT sb_compare(?, ?,38,4,'half-even') AS c").get('9007199254740993.0000','9007199254740992.9999')).toEqual({c:1});
 expect(db.prepare("SELECT sb_sum(v,38,4,'half-even') AS s FROM values_exact WHERE 0").get()).toEqual({s:null});
 } finally { db.close(); }
});
