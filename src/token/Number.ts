import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../errors";
import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export class NumberToken extends Token {
    static read(stringReader: StringReaderContext, errorCollector: ErrorCollector) {
        const integerPart = stringReader.readWhileRegexMatch(/\d/);
        const decimalSeparator = stringReader.readOnceRegexMatch(/\./);
        if (decimalSeparator === null) {
            if (integerPart === null)
                return null;

            return new NumberToken(integerPart.toString(), stringReader.getPositionRange());
        }

        const fractionalPart = stringReader.readWhileRegexMatch(/\d/);
        if (fractionalPart === null) {
            errorCollector.addError(
                new CompilerError(ErrorCode.MissingFractionalPart)
                    .addError(stringReader.getPositionRange().end, "Missing fractional part")
            );
            if (integerPart === null)
                return null;
            return new NumberToken(`${integerPart}`, stringReader.getPositionRange());
        }

        return new NumberToken(`${integerPart || ""}.${fractionalPart}`, stringReader.getPositionRange());
    }

    constructor(public readonly unprocessedNumber: string, public readonly position: FilePositionRange) {
        super(TokenKind.Number, position);
    }

    getPrecedence(): number|null {
        return null;
    }
}