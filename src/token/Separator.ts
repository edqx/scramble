import { ErrorCollector } from "../errorCollector";
import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export class SeparatorToken extends Token {
    static read(stringReader: StringReaderContext, errorCollector: ErrorCollector) {
        const br = stringReader.readWhileRegexMatch(/[,]/);
        if (br === null) return null;

        return new SeparatorToken(stringReader.getPositionRange());
    }

    constructor(public readonly position: FilePositionRange) {
        super(TokenKind.Separator, position);
    }

    getPrecedence() {
        return -998;
    }
}