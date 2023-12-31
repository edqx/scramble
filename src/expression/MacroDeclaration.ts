import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { FilePositionRange } from "../stringReader";
import { OperatorToken } from "../token";
import { Expression, ExpressionKind } from "./Expression";
import { FunctionCallExpression } from "./FunctionCall";
import { KeywordExpression } from "./Keyword";
import { ParameterDeclarationExpression } from "./ParameterDeclaration";
import { ProcDeclarationExpression } from "./ProcDeclaration";

export class MacroDeclarationExpression extends Expression {
    static fromOperator(left: FunctionCallExpression, right: Expression, operatorToken: OperatorToken, astCollector: AstCollector, errorCollector: ErrorCollector) {
        astCollector.appendExpression(
            new MacroDeclarationExpression(
                left,
                (left.reference as KeywordExpression).keyword,
                ProcDeclarationExpression.parseParameters(left, left.args, errorCollector),
                right
            )
        );
        return;
    }

    constructor(
        functionCallExpression: FunctionCallExpression,
        public readonly identifier: string,
        public readonly parameters: ParameterDeclarationExpression[],
        public readonly block: Expression
    ) {
        super(ExpressionKind.MacroDeclaration, FilePositionRange.contain(functionCallExpression.position, block.position));
    }
}