import { ErrorCollector } from "../errorCollector";
import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export type AnyCloseParenthesis = ")"|"]"|"}";

export class CloseParenthesisToken extends Token {
    static read(stringReader: StringReaderContext, errorCollector: ErrorCollector) {
        const parenthesis = stringReader.readOnceRegexMatch(/[)}\]]/);
        if (parenthesis === null) return null;

        return new CloseParenthesisToken(parenthesis as AnyCloseParenthesis, stringReader.getPositionRange());
    }

    constructor(public readonly parenthesis: AnyCloseParenthesis, public readonly position: FilePositionRange) {
        super(TokenKind.CloseParenthesis, position);
    }

    getMatchingOpenParenthesis() {
        switch (this.parenthesis) {
        case ")": return "(";
        case "]": return "[";
        case "}": return "{";
        }
    }

    getPrecedence(): number|null {
        return null;
    }
}