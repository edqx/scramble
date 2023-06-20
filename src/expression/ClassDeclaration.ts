import { AstCollector } from "../astCollector";
import { CompilerError, ErrorCode } from "../error";
import { ErrorCollector } from "../errorCollector";
import { FilePositionRange } from "../stringReader";
import { KeywordToken, NewlineToken, OpenParenthesisToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";
import { ParenthesisExpression } from "./Parenthesis";
import { ProcDeclarationExpression } from "./ProcDeclaration";
import { TypeGuardExpression } from "./TypeGuard";

export class ClassDeclarationExpression extends Expression {
    static read(classKeywordToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        const identifierToken = tokenReader.getNextToken();
        if (identifierToken === undefined || !(identifierToken instanceof KeywordToken)) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedIdentifier)
                    .addError(identifierToken?.position || classKeywordToken.position.end.offset(1), "Expected class name identifier")
            );
            return;
        };
        
        tokenReader.moveNextWhile(token => token instanceof NewlineToken);
        const blockToken = tokenReader.getNextToken();
        if (blockToken === undefined) {
            errorCollector.addError(
                new CompilerError(ErrorCode.MissingCodeBlock)
                    .addError(identifierToken.position.end.offset(1), "Expected class block")
                    .addInfo(classKeywordToken.position, "A class needs a block to define properties and methods")
            );
            return;
        }
        if (!(blockToken instanceof OpenParenthesisToken) || blockToken.parenthesis !== "{") {
            errorCollector.addError(
                new CompilerError(ErrorCode.MissingCodeBlock)
                    .addError(blockToken.position, "Expected class block")
                    .addInfo(classKeywordToken.position, "A class needs a block to define properties and methods")
            );
            return;
        }

        ParenthesisExpression.readExpectBlock(blockToken, astCollector, tokenReader, errorCollector);
        const expr = astCollector.popLastExpression();
        if (expr === undefined || !(expr instanceof ParenthesisExpression)) {
            errorCollector.addError(
                new CompilerError(ErrorCode.MissingCodeBlock)
                    .addError(expr?.position || blockToken.position, "Expected class block")
                    .addInfo(classKeywordToken.position, "A class needs a block to define properties and methods")
            );
            return;
        }

        const fields = [];
        const methods = [];
        for (const expression of expr.expressions) {
            if (expression instanceof KeywordExpression) {
                errorCollector.addError(
                    new CompilerError(ErrorCode.ExpectedFieldOrMethod)
                        .addError(expression.position, "Expected a class field or class method")
                        .addInfo(expression.position.end.offset(1), "A type needs to be attached to a field")
                )
                return;
            } else if (expression instanceof TypeGuardExpression) {
                fields.push(expression);
            } else if (expression instanceof ProcDeclarationExpression) {
                methods.push(expression);
            } else {
                errorCollector.addError(
                    new CompilerError(ErrorCode.ExpectedFieldOrMethod)
                        .addError(expression.position, "Expected a class field or class method")
                        .addInfo(classKeywordToken.position, "You can only declare fields and methods in a class block")
                )
                return;
            }
        }

        astCollector.appendExpression(new ClassDeclarationExpression(classKeywordToken, expr, identifierToken.keyword, fields, methods));
    }

    constructor(
        classKeywordToken: KeywordToken,
        parenthesisExpression: ParenthesisExpression,
        public readonly identifier: string,
        public readonly fields: TypeGuardExpression[],
        public readonly methods: ProcDeclarationExpression[]
    ) {
        super(ExpressionKind.ClassDeclaration, FilePositionRange.null());
    }
}