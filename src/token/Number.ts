import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export class NumberToken extends Token {
    static read(stringReader: StringReaderContext) {
        const integerPart = stringReader.readWhileRegexMatch(/\d/);
        if (integerPart === null) return null;

        const decimalSeparator = stringReader.readOnceRegexMatch(/\./);
        if (decimalSeparator === null) {
            return new NumberToken(integerPart.toString(), stringReader.getPositionRange());
        }

        const fractionalPart = stringReader.readWhileRegexMatch(/\d/);
        if (fractionalPart === null) return null;

        return new NumberToken(`${integerPart}.${fractionalPart}`, stringReader.getPositionRange());
    }

    constructor(public readonly unprocessedNumber: string, public readonly position: FilePositionRange) {
        super(TokenKind.Number, position);
    }
}