import { ErrorCollector } from "../errorCollector";
import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export type AnyOpenParenthesis = "("|"["|"{";

export class OpenParenthesisToken extends Token {
    static read(stringReader: StringReaderContext, errorCollector: ErrorCollector) {
        const parenthesis = stringReader.readOnceRegexMatch(/[(\[{]/);
        if (parenthesis === null) return null;

        return new OpenParenthesisToken(parenthesis as AnyOpenParenthesis, stringReader.getPositionRange());
    }

    constructor(public readonly parenthesis: AnyOpenParenthesis, public readonly position: FilePositionRange) {
        super(TokenKind.OpenParenthesis, position);
    }

    getMatchingEndParenthesis() {
        switch (this.parenthesis) {
        case "(": return ")";
        case "[": return "]";
        case "{": return "}";
        }
    }

    getPrecedence(): number|null {
        switch (this.parenthesis) {
        case "(": return null;
        case "[": return -1;
        case "{": return null;
        }
    }
}