import { NumberToken } from "../token";
import { Expression, ExpressionKind } from "./Expression";

export class NumberExpression extends Expression {
    static from(numberToken: NumberToken) {
        return new NumberExpression(numberToken);
    }

    unprocessedNumber: string;

    constructor(numberToken: NumberToken) {
        super(ExpressionKind.Number, numberToken.position);

        this.unprocessedNumber = numberToken.unprocessedNumber;
    }
}