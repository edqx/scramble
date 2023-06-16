import { AstCollector } from "../astCollector";
import { NumberToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class NumberExpression extends Expression {
    static read(numberToken: NumberToken, astCollector: AstCollector, tokenReader: TokenReader) {
        astCollector.appendExpression(new NumberExpression(numberToken));
    }

    unprocessedNumber: string;

    constructor(numberToken: NumberToken) {
        super(ExpressionKind.Number, numberToken.position);

        this.unprocessedNumber = numberToken.unprocessedNumber;
    }
}