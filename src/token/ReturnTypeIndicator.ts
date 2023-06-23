import { ErrorCollector } from "../errorCollector";
import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export class ReturnTypeIndicatorToken extends Token {
    static read(stringReader: StringReaderContext, errorCollector: ErrorCollector) {
        const dash = stringReader.peekNextChar();
        if (dash !== "-") return null;

        stringReader.readNextChar();
        const arrow = stringReader.peekNextChar();
        if (arrow !== ">") {
            stringReader.moveBack();
            return null;
        }
        stringReader.readNextChar();

        return new ReturnTypeIndicatorToken(stringReader.getPositionRange());
    }

    constructor(public readonly position: FilePositionRange) {
        super(TokenKind.ReturnTypeIndicator, position);
    }

    getPrecedence() {
        return 1;
    }
}