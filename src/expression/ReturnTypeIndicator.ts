import { parseSingleTokenAst } from "../parseAst";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../error";
import { TypeIndicatorToken } from "../token/TypeIndicator";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";
import { ProcDeclarationExpression } from "./ProcDeclaration";

export class ReturnTypeIndicatorExpression extends Expression {
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
        if (!(right instanceof KeywordExpression) && !(right instanceof ProcDeclarationExpression)) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedIdentifier)
                    .addError(right.position, "Invalid type")
                    .addInfo(typeIndicatorToken.position, "Types can only be simple references to classes or primitives")
            );
            return;
        }
        astCollector.appendExpression(new ReturnTypeIndicatorExpression(right));
    }

    constructor(public readonly type: KeywordExpression|ProcDeclarationExpression) {
        super(ExpressionKind.ReturnTypeIndicator, type.position);
    }
}