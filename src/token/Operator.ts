import { ErrorCollector } from "../errorCollector";
import { FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export class OperatorToken extends Token {
    static read(stringReader: StringReaderContext, errorCollector: ErrorCollector) {
        const operator = stringReader.readWhileRegexMatch(/[+\-/*!=<>]/);
        if (operator === null) return null;

        return new OperatorToken(operator, stringReader.getPositionRange());
    }

    constructor(public readonly operator: string, public readonly position: FilePositionRange) {
        super(TokenKind.Operator, position);
    }

    getPrecedence() {
        switch (this.operator) {
        case "=": return 0;
        case "==": case ">": case "<": case "!=": return 1;
        case "+": case "-": return 2;
        case "*": case "/": return 3;
        default: return 0;
        }
    }
}