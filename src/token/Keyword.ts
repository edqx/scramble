import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

const STATEMENT_KEYWORDS = new Set(["if", "then", "while", "do"])

export class KeywordToken extends Token {
    static read(stringReader: StringReaderContext) {
        const firstChar = stringReader.readOnceRegexMatch(/[a-zA-Z_$]/);
        if (firstChar === null) return null;

        const remainingChars = stringReader.readWhileRegexMatch(/[a-zA-Z0-9_$]/) || "";

        return new KeywordToken(`${firstChar}${remainingChars}`, stringReader.getPositionRange());
    }

    constructor(public readonly keyword: string, public readonly position: FilePositionRange) {
        super(TokenKind.Keyword, position);
    }

    getPrecedence(): number|null {
        if (STATEMENT_KEYWORDS.has(this.keyword))
            return -999;

        return null;
    }
}