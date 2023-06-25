const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%()*+,-./:;=?@[]^_\\`{|}~";
export class IdGenerator {
    protected idIndex: number;

    constructor() {
        this.idIndex = 0;
    }

    nextId() {
        let n = this.idIndex;
        let str = CHARS[n % CHARS.length];
        while (n >= CHARS.length) {
            n = Math.floor(n / CHARS.length) - 1;
            str += CHARS[n % CHARS.length];
        }
        this.idIndex++;
        return str;
    }
}