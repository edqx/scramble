import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export type AnyCloseParenthesis = ")"|"]"|"}";

export class CloseParenthesis extends Token {
    static read(stringReader: StringReaderContext) {
        const parenthesis = stringReader.readOnceRegexMatch(/[)}\]]/);
        if (parenthesis === null) return null;

        return new CloseParenthesis(parenthesis as AnyCloseParenthesis, stringReader.getPositionRange());
    }

    constructor(public readonly parenthesis: AnyCloseParenthesis, public readonly position: FilePositionRange) {
        super(TokenKind.CloseParenthesis, position);
    }

    getMatchingOpenParenthesis() {
        return {
            ")": "(",
            "]": "[",
            "}": "{"
        }[this.parenthesis];
    }
}