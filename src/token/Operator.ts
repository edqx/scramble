import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export class OperatorToken extends Token {
    static read(stringReader: StringReaderContext) {
        const operator = stringReader.readWhileRegexMatch(/[+-/*!=<>]/);
        if (operator === null) return null;

        return new OperatorToken(operator, stringReader.getPositionRange());
    }

    constructor(public readonly operator: string, public readonly position: FilePositionRange) {
        super(TokenKind.Operator, position);
    }
}