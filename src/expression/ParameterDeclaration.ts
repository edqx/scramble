import { FilePositionRange } from "../stringReader";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";

export class ParameterDeclarationExpression extends Expression {
    identifier: string;

    constructor(identifier: KeywordExpression, public readonly type: Expression|undefined, public readonly defaultValue: Expression|undefined) {
        super(ExpressionKind.ParameterDeclaration, FilePositionRange.contain(identifier.position, defaultValue?.position || type?.position || identifier.position));

        this.identifier = identifier.keyword;
    }
}