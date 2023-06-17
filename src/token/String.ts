import { ErrorCollector } from "../errorCollector";
import { EOF, FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export class StringToken extends Token {
    static read(stringReader: StringReaderContext, errorCollector: ErrorCollector) {
        const stringBegin = stringReader.readOnceRegexMatch(/\"/);
        if (stringBegin === null) return null;
        
        let str = "";
        while (true) {
            const nextChar = stringReader.readNextChar();
            if (nextChar === EOF) {
                throw new Error("Unexpected EOF"); // TODO: proper error
            }
            if (nextChar === "\"") break;
            if (nextChar === "\\") {
                const escapedChar = stringReader.readNextChar();
                if (escapedChar === EOF)
                    throw new Error("Unexpected EOF");

                str += escapedChar;
                continue;
            }
            if (nextChar === "\n")
                throw new Error("Unexpected newline");

            str += nextChar;
        }
        
        return new StringToken(str, stringReader.getPositionRange());
    }

    constructor(public readonly text: string, public readonly position: FilePositionRange) {
        super(TokenKind.String, position);
    }

    getPrecedence(): number|null {
        return null;
    }
}