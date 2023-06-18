import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { NumberToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class NumberExpression extends Expression {
    static read(numberToken: NumberToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        astCollector.appendExpression(new NumberExpression(numberToken));
    }

    unprocessedNumber: string;

    constructor(numberToken: NumberToken) {
        super(ExpressionKind.Number, numberToken.position);

        this.unprocessedNumber = numberToken.unprocessedNumber;
    }
}