import { SHA256 } from 'crypto-js';
export const genToken = (pin:string | null) => !!pin ? SHA256(pin).toString() : null;