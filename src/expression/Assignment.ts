import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../error";
import { FilePositionRange } from "../stringReader";
import { OperatorToken } from "../token";
import { AccessorExpression } from "./Accessor";
import { Expression, ExpressionKind } from "./Expression";
import { FunctionCallExpression } from "./FunctionCall";
import { KeywordExpression } from "./Keyword";
import { MacroDeclarationExpression } from "./MacroDeclaration";
import { TypeGuardExpression } from "./TypeGuard";

export class AssignmentExpression extends Expression {
    static fromOperator(left: Expression, right: Expression, operatorToken: OperatorToken, astCollector: AstCollector, errorCollector: ErrorCollector) {
        if (left instanceof FunctionCallExpression && left.reference instanceof KeywordExpression) {
            MacroDeclarationExpression.fromOperator(left, right, operatorToken, astCollector, errorCollector);
            return;
        }
        if (!(left instanceof KeywordExpression || left instanceof AccessorExpression || left instanceof TypeGuardExpression)) {
            errorCollector.addError(
                new CompilerError(ErrorCode.InvalidLeftHandSideReference)
                    .addError(left.position, "Invalid left-hand side assignment")
                    .addInfo(operatorToken.position, "The left-hand side of an assignment operator needs to refer to a reference, like a variable, rather than a value")
            );
            return null;
        }
        if (left instanceof TypeGuardExpression) {
            astCollector.appendExpression(new AssignmentExpression(left.reference, left.type, right));
            return;
        }
        astCollector.appendExpression(new AssignmentExpression(left, undefined, right));
        return;
    }

    constructor(public readonly reference: KeywordExpression|AccessorExpression, public readonly type: string|undefined, public readonly value: Expression) {
        super(ExpressionKind.Assignment, FilePositionRange.contain(reference.position, value.position));
    }
}