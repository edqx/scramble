import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../error";
import { EOF, FilePositionRange, StringReaderContext } from "../stringReader";
import { Token, TokenKind } from "./Token";

export class StringToken extends Token {
    static read(stringReader: StringReaderContext, errorCollector: ErrorCollector) {
        const stringBegin = stringReader.readOnceRegexMatch(/\"/);
        if (stringBegin === null) return null;
        
        let str = "";
        while (true) {
            const nextChar = stringReader.readNextChar();
            if (nextChar === EOF) {
                errorCollector.addError(
                    new CompilerError(ErrorCode.UnexpectedTermination)
                        .addError(stringReader.getPositionRange().end, "Unexpected EOF (end of file) while reading string")
                );
                return null;
            }
            if (nextChar === "\"") break;
            if (nextChar === "\\") {
                const escapedChar = stringReader.readNextChar();
                if (escapedChar === EOF) {
                    errorCollector.addError(
                        new CompilerError(ErrorCode.UnexpectedTermination)
                            .addError(stringReader.getPositionRange().end, "Unexpected EOF (end of file) while reading string")
                    );
                    return null;
                }

                str += escapedChar;
                continue;
            }
            if (nextChar === "\n") {
                errorCollector.addError(
                    new CompilerError(ErrorCode.UnexpectedTermination)
                        .addError(stringReader.getPositionRange().end, "Unexpected newline while reading string")
                );
                return null;
            }

            str += nextChar;
        }
        
        return new StringToken(str, stringReader.getPositionRange());
    }

    constructor(public readonly text: string, public readonly position: FilePositionRange) {
        super(TokenKind.String, position);
    }

    getPrecedence(): number|null {
        return null;
    }
}