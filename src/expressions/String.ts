import { StringToken } from "../token";
import { Expression, ExpressionKind } from "./Expression";

export class StringExpression extends Expression {
    static from(stringToken: StringToken) {
        return new StringExpression(stringToken);
    }

    text: string;

    constructor(stringToken: StringToken) {
        super(ExpressionKind.String, stringToken.position);

        this.text = stringToken.text;
    }
}