import chalk from "chalk";
import { FilePosition, FilePositionRange } from "../stringReader";
import { ErrorCode } from "./ErrorCode";

export interface Note {
    position?: FilePositionRange|FilePosition;
    note: string;
}

export enum NoteType {
    Error,
    Info
}

export class CompilerError {
    errors: Note[];
    info: Note[];

    constructor(public readonly code: ErrorCode) {
        this.errors = [];
        this.info = [];
    }

    addError(position: FilePositionRange|FilePosition|undefined, note: string) {
        this.errors.push({ position, note });
        return this;
    }
    
    addInfo(position: FilePositionRange|FilePosition|undefined, note: string) {
        this.info.push({ position, note });
        return this;
    }

    generateStringForNote(sourceCode: string, note: Note, type: NoteType, indentation: string, linesAround: number) {
        if (note.position === undefined)
            return "";

        const startPos = note.position instanceof FilePositionRange ? note.position.start : note.position;
        const endPos = note.position instanceof FilePositionRange ? note.position.end : note.position;

        const sourceLines = sourceCode.split("\n");
        const minLine = Math.max(startPos.line - Math.ceil(linesAround / 2), 0);
        const maxLine = Math.min(endPos.line + Math.floor(linesAround / 2), sourceLines.length - 1);

        const colorFunction = type === NoteType.Error ? chalk.red : chalk.cyan;

        let maxLineLength = 0;
        for (let i = minLine; i <= maxLine; i++) {
            if (i.toString().length > maxLineLength) {
                maxLineLength = i.toString().length;
            }
        }

        let out = "";
        for (let i = minLine; i <= maxLine; i++) {
            out += "\n";
            const lineStr = sourceLines[i];
            out += chalk.black.bgWhite(" " + (i + 1).toString().padStart(maxLineLength, " ") + " ");
            if (i === startPos.line) {
                const strToStart = lineStr.substring(0, startPos.column);
                const startToEnd = lineStr.substring(
                    startPos.column,
                    startPos.line === endPos.line
                        ? endPos.column
                        : undefined);
                const endToStr = startPos.line === endPos.line
                    ? lineStr.substring(endPos.column)
                    : "";

                out += "  " + strToStart + colorFunction(startToEnd) + endToStr;
            } else if (i === endPos.line) {
                const strToStart = lineStr.substring(0, endPos.column);
                const endToStr = lineStr.substring(endPos.column);

                out += "  " + colorFunction(strToStart) + endToStr;
            } else {
                if (i > startPos.line && i < endPos.line) {
                    out += "  " + colorFunction(lineStr);
                } else {
                    out += "  " + lineStr;
                }
            }
        }
        const indent = " ".repeat(maxLineLength + 3 + endPos.column);
        out += "\n" + indent + colorFunction("^ " + note.note.replace(/\n/g, "\n  " + indent));
        return out.split("\n").map(line => indentation + line).join("\n");
    }

    generateString(sourceCode: string, errIdx: number) {
        const errorText = this.errors.map(err => this.generateStringForNote(sourceCode, err, NoteType.Error, "", 4)).join("\n\n");
        const noteText = this.info.map(info => this.generateStringForNote(sourceCode, info, NoteType.Info, "     ", 2)).join("\n\n");

        return chalk.bgRed((errIdx + 1) + ". E" + this.code.toString().padStart(3, "0") + " ") + errorText + "\n" + noteText;
    }
}