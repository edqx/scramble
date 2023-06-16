import { parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { FilePositionRange } from "../stringReader";
import { OperatorToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class OperatorExpression extends Expression {
    static read(operatorToken: OperatorToken, astCollector: AstCollector, tokenReader: TokenReader) {
        while (true) {
            const nextToken = tokenReader.getNextToken();

            if (nextToken === undefined) break;

            const tokenPrecedence = nextToken.getPrecedence();
            if (tokenPrecedence === null) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader);
                continue;
            }

            if (tokenPrecedence > operatorToken.getPrecedence()) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader);
            } else {
                tokenReader.moveBack();
                break;
            }
        }
        const right = astCollector.assertPop();
        const left = astCollector.assertPop();
        astCollector.appendExpression(new OperatorExpression(left, right, operatorToken.operator));
    }

    constructor(public readonly left: Expression, public readonly right: Expression, public readonly operator: string) {
        super(ExpressionKind.Operator, FilePositionRange.contain(left.position, right.position));
    }
}