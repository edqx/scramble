import { parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../error";
import { FilePositionRange } from "../stringReader";
import { OperatorToken } from "../token";
import { TokenReader } from "../tokenReader";
import { AssignmentExpression } from "./Assignment";
import { Expression, ExpressionKind } from "./Expression";
import { UnaryOperatorExpression } from "./UnaryOperator";

export class OperatorExpression extends Expression {
    static read(operatorToken: OperatorToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        const left = astCollector.popLastExpression();
        while (true) {
            const nextToken = tokenReader.getNextToken();

            if (nextToken === undefined) break;

            const tokenPrecedence = nextToken.getPrecedence();
            if (tokenPrecedence === null) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
                if (left === undefined) break;
                continue;
            }

            if (tokenPrecedence > operatorToken.getPrecedence()) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
                if (left === undefined) break;
            } else {
                tokenReader.moveBack();
                break;
            }
        }
        const right = astCollector.popLastExpression();
        if (right === undefined) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedRightHandExpression)
                    .addError(operatorToken.position.end.offset(1), "Expected right-hand expression")
                    .addInfo(operatorToken.position, "Unary operators can only be used as a prefix, meaning a right-hand expression is required")
            );
            return;
        }
        if (left === undefined) return astCollector.appendExpression(new UnaryOperatorExpression(operatorToken, right, operatorToken.operator));
        if (operatorToken.operator === "=") {
            return AssignmentExpression.fromOperator(left, right, operatorToken, astCollector, errorCollector);
        }
        astCollector.appendExpression(new OperatorExpression(left, right, operatorToken.operator));
    }

    constructor(public readonly left: Expression, public readonly right: Expression, public readonly operator: string) {
        super(ExpressionKind.Operator, FilePositionRange.contain(left.position, right.position));
    }
}