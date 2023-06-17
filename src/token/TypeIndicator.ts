import { ErrorCollector } from "../errorCollector";
import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export class TypeIndicatorToken extends Token {
    static read(stringReader: StringReaderContext, errorCollector: ErrorCollector) {
        const access = stringReader.readWhileRegexMatch(/[:]/);
        if (access === null) return null;

        return new TypeIndicatorToken(stringReader.getPositionRange());
    }

    constructor(public readonly position: FilePositionRange) {
        super(TokenKind.TypeIndicator, position);
    }

    getPrecedence() {
        return 1;
    }
}