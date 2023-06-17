import { ErrorCollector } from "../errorCollector";
import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export class AccessorToken extends Token {
    static read(stringReader: StringReaderContext, errorCollector: ErrorCollector) {
        const access = stringReader.readWhileRegexMatch(/[.]/);
        if (access === null) return null;

        return new AccessorToken(stringReader.getPositionRange());
    }

    constructor(public readonly position: FilePositionRange) {
        super(TokenKind.Accessor, position);
    }

    getPrecedence() {
        return 4;
    }
}