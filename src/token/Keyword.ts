import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export class KeywordToken extends Token {
    static read(stringReader: StringReaderContext) {
        const firstChar = stringReader.readOnceRegexMatch(/[a-zA-Z_$]/);
        if (firstChar === null) return null;

        const remainingChars = stringReader.readWhileRegexMatch(/[a-zA-Z0-9_$]/) || "";

        return new KeywordToken(`${firstChar}${remainingChars}`, stringReader.getPositionRange());
    }

    constructor(public readonly unprocessedNumber: string, public readonly position: FilePositionRange) {
        super(TokenKind.Keyword, position);
    }
}