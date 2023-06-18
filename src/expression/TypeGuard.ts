import { parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../error";
import { FilePositionRange } from "../stringReader";
import { TypeIndicatorToken } from "../token/TypeIndicator";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";

export class TypeGuardExpression extends Expression {
    static read(typeIndicatorToken: TypeIndicatorToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        while (true) {
            const nextToken = tokenReader.getNextToken();

            if (nextToken === undefined) break;

            const tokenPrecedence = nextToken.getPrecedence();
            if (tokenPrecedence === null) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
                continue;
            }

            if (tokenPrecedence > typeIndicatorToken.getPrecedence()) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
            } else {
                tokenReader.moveBack();
                break;
            }
        }
        const right = astCollector.popLastExpression()!;
        const left = astCollector.popLastExpression()!;
        if (!(left instanceof KeywordExpression)) {
            errorCollector.addError(
                new CompilerError(ErrorCode.InvalidLeftHandSideReference)
                    .addError(left.position, "Invalid left-hand side reference")
                    .addInfo(typeIndicatorToken.position, "The left-hand side of a type guard expression expects an identifier, not a reference or a value")
            );
            return;
        }
        astCollector.appendExpression(new TypeGuardExpression(left, right));
    }

    constructor(public readonly identifier: KeywordExpression, public readonly type: Expression) {
        super(ExpressionKind.TypeGuard, FilePositionRange.contain(identifier.position, type.position));
    }
}