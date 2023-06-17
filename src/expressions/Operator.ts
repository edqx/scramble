import { parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../errors";
import { FilePositionRange } from "../stringReader";
import { OperatorToken } from "../token";
import { TokenReader } from "../tokenReader";
import { AccessorExpression } from "./Accessor";
import { AssignmentExpression } from "./Assignment";
import { Expression, ExpressionKind } from "./Expression";

export class OperatorExpression extends Expression {
    static read(operatorToken: OperatorToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        while (true) {
            const nextToken = tokenReader.getNextToken();

            if (nextToken === undefined) break;

            const tokenPrecedence = nextToken.getPrecedence();
            if (tokenPrecedence === null) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
                continue;
            }

            if (tokenPrecedence > operatorToken.getPrecedence()) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
            } else {
                tokenReader.moveBack();
                break;
            }
        }
        const right = astCollector.assertPop();
        const left = astCollector.assertPop();
        if (operatorToken.operator === "=") {
            return AssignmentExpression.fromOperator(left, right, operatorToken, astCollector, errorCollector);
        }
        astCollector.appendExpression(new OperatorExpression(left, right, operatorToken.operator));
    }

    constructor(public readonly left: Expression, public readonly right: Expression, public readonly operator: string) {
        super(ExpressionKind.Operator, FilePositionRange.contain(left.position, right.position));
    }
}