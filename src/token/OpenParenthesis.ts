import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export type AnyOpenParenthesis = "("|"["|"{";

export class OpenParenthesisToken extends Token {
    static read(stringReader: StringReaderContext) {
        const parenthesis = stringReader.readOnceRegexMatch(/[(\[{]/);
        if (parenthesis === null) return null;

        return new OpenParenthesisToken(parenthesis as AnyOpenParenthesis, stringReader.getPositionRange());
    }

    constructor(public readonly parenthesis: AnyOpenParenthesis, public readonly position: FilePositionRange) {
        super(TokenKind.OpenParenthesis, position);
    }

    getMatchingEndParenthesis() {
        return {
            "(": ")",
            "[": "]",
            "{": "}"
        }[this.parenthesis];
    }
}