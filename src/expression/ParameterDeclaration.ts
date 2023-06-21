import { FilePositionRange } from "../stringReader";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";
import { TypeGuardExpression } from "./TypeGuard";

export class ParameterDeclarationExpression extends Expression {
    identifier: string;

    constructor(
        identifier: KeywordExpression,
        public readonly typeGuard: string|undefined,
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