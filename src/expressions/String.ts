import { AstCollector } from "../astCollector";
import { StringToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class StringExpression extends Expression {
    static read(stringToken: StringToken, astCollector: AstCollector, tokenReader: TokenReader) {
        astCollector.appendExpression(new StringExpression(stringToken));
    }

    text: string;

    constructor(stringToken: StringToken) {
        super(ExpressionKind.String, stringToken.position);

        this.text = stringToken.text;
    }
}