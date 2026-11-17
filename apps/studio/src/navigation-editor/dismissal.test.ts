import {expect,test} from 'vitest';
import {navigationDismissal} from './dismissal.js';
test('dirty Close or Escape requests confirmation, second Escape keeps editing',()=>{expect(navigationDismissal({active:true,dirty:true,busy:false,confirming:false})).toBe('confirm');expect(navigationDismissal({active:true,dirty:true,busy:false,confirming:true})).toBe('keep-editing');});
test('saved navigation closes normally; busy cannot dismiss',()=>{expect(navigationDismissal({active:true,dirty:false,busy:false,confirming:false})).toBe('close');expect(navigationDismissal({active:true,dirty:true,busy:true,confirming:true})).toBe('blocked');});
