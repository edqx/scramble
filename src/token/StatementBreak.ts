import { ErrorCollector } from "../errorCollector";
import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export class StatementBreakToken extends Token {
    static read(stringReader: StringReaderContext, errorCollector: ErrorCollector) {
        const br = stringReader.readWhileRegexMatch(/[;]/);
        if (br === null) return null;

        return new StatementBreakToken(stringReader.getPositionRange());
    }

    constructor(public readonly position: FilePositionRange) {
        super(TokenKind.StatementBreak, position);
    }

    getPrecedence() {
        return -999;
    }
}