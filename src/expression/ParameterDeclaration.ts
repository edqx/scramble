import { FilePositionRange } from "../stringReader";
import { ArrayReferenceExpression } from "./ArrayReference";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";
import { ProcDeclarationExpression } from "./ProcDeclaration";

export class ParameterDeclarationExpression extends Expression {
    identifier: string;

    constructor(
        identifier: KeywordExpression,
        public readonly type: KeywordExpression|ProcDeclarationExpression|ArrayReferenceExpression|undefined,
        public readonly defaultValue: Expression|undefined
    ) {
        super(
            ExpressionKind.ParameterDeclaration,
            FilePositionRange.contain(
                identifier.position,
                defaultValue?.position || identifier.position
            ));

        this.identifier = identifier.keyword;
    }
}