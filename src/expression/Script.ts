import { FilePositionRange } from "../stringReader";
import { Expression, ExpressionKind } from "./Expression";

export class ScriptExpression extends Expression {
    constructor(public readonly expressions: Expression[]) {
        super(ExpressionKind.Parenthesis, expressions.length > 0
            ? FilePositionRange.contain(expressions[0].position, expressions[expressions.length - 1].position)
            : FilePositionRange.null());
    }
}