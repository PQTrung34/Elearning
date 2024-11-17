// simpleCompiler.controller.ts
import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncError";
const compiler = require('compilex');

const option = {stats: true};
compiler.init(option);

interface CompilerEnvData {
    OS: string;
    cmd?: string;
    options?: {
        timeout: number;
    };
}

let envData: CompilerEnvData;

export const executeCode = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const code = req.body.code;
        const lang: string = req.body.language;

        switch (lang.toLowerCase()) {
            case 'c':
                var cEnvData = {OS: 'windows', cmd: 'g++', options: {timeout: 10000}};
                compiler.compileCPP(cEnvData, code, (data) => {
                    res.send(data);
                })
                break;

            case 'cpp':
                var cEnvData = {OS: 'windows', cmd: 'g++', options: {timeout: 10000}};
                compiler.compileCPP(cEnvData, code, (data) => {
                    res.send(data);
                })
                break;

            case 'python':
                var pythonEnvData = {OS: 'windows'};
                compiler.compilePython(pythonEnvData, code, (data) => {
                    res.send(data);
                })
                break;

            case 'java':
                var javaEnvData = {OS: 'windows'};
                compiler.compileJava(javaEnvData, code, (data) => {
                    res.send(data);
                })
                break;
            
            case 'cs':
                var csEnvData = {OS: 'windows'};
                compiler.compileCS(csEnvData, code, (data) => {
                    res.send(data);
                })
                break;
        
            default:
                break;
        }

        // res.status(200).json({
        //     success: true,
        // });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

compiler.flush(function(){
    console.log('All temporary files flushed !'); 
});