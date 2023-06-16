export const EOF = Symbol("EOF");

export class StringReaderContext {
    protected start: FilePosition|null;
    protected end: FilePosition|null;

    constructor(public readonly reader: StringReader) {
        this.start = null;
        this.end = null;
    }

    readNextChar() {
        if (this.reader.getCharsLeft() <= 0) return EOF;
        if (this.start === null) {
            this.start = this.reader.getPosition();
        }
        const char = this.reader.readNextChar();
        this.end = this.reader.getPosition();
        return char;
    }

    peekNextChar() {
        return this.reader.getCharsLeft() <= 0 ? EOF : this.reader.peekNextChar();
    }

    readWhileMatch(match: (char: string) => boolean) {
        let str = this.peekNextChar();
        if (str === EOF || !match(str)) return null;
        while (true) {
            this.readNextChar();
            const char = this.peekNextChar();
            if (char === EOF || !match(char))
                break;

            str += char;
        }
        return str;
    }
    
    readOnceMatch(match: (char: string) => boolean) {
        const str = this.peekNextChar();
        if (str === EOF || !match(str)) return null;

        this.readNextChar();
        return str;
    }

    readWhileRegexMatch(regex: RegExp) {
        return this.readWhileMatch(char => regex.test(char));
    }

    readOnceRegexMatch(regex: RegExp) {
        return this.readOnceMatch(char => regex.test(char));
    }

    getPositionRange() {
        if (this.start === null || this.end === null) {
            return FilePositionRange.null();
        }

        return new FilePositionRange(this.start, this.end);
    }
}

export class StringReader {
    protected pos: FilePosition;
        
    constructor(public readonly str: string) {
        this.pos = FilePosition.null();
    }

    getPosition() {
        return new FilePosition(this.pos.cursor, this.pos.line, this.pos.column);
    }

    getCharsLeft() {
        return this.str.length - this.pos.cursor;
    }

    readNextChar() {
        const char = this.str[this.pos.cursor];
        this.pos.cursor++;
        if (char === "\n") {
            this.pos.column = 0;
            this.pos.line++;
        } else {
            this.pos.column++;
        }
        return char;
    }

    peekNextChar() {
        return this.str[this.pos.cursor];
    }

    createContext() {
        return new StringReaderContext(this);
    }
}

export class FilePosition {
    static null() {
        return new FilePosition(0, 0, 0);
    }

    constructor(public cursor: number, public line: number, public column: number) {}
}

export class FilePositionRange {
    static null() {
        return new FilePositionRange(FilePosition.null(), FilePosition.null());
    }

    static contain(a: FilePositionRange, b: FilePositionRange) {
        if (a.start.cursor < b.start.cursor) {
            if (b.end.cursor > a.end.cursor) {
                return new FilePositionRange(a.start, b.end);
            } else {
                return new FilePositionRange(a.start, a.end);
            }
        } else {
            if (b.end.cursor > a.end.cursor) {
                return new FilePositionRange(b.start, b.end);
            } else {
                return new FilePositionRange(b.start, a.end);
            }
        }
    }

    constructor(public readonly start: FilePosition, public readonly end: FilePosition = start) {
        if (end.cursor < start.cursor) {
            [ start, end ] = [ end, start ];
        }
    }
}