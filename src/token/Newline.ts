import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export class NewlineToken extends Token {
    static read(stringReader: StringReaderContext) {
        const nl = stringReader.readWhileRegexMatch(/[\n]/);
        if (nl === null) return null;

        return new NewlineToken(stringReader.getPositionRange());
    }

    constructor(public readonly position: FilePositionRange) {
        super(TokenKind.Newline, position);
    }

    getPrecedence() {
        return null;
    }
}