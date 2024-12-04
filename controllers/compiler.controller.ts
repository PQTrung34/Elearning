require('dotenv').config();
import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import CourseModel, { ICode } from "../models/course.model";
import progressModel, { ICodeProgress } from "../models/progress.model";
import { stderr } from "process";


// const option = {stats: true};
// compiler.init(option);

// interface CompilerEnvData {
//     OS: string;
//     cmd?: string;
//     options?: {
//         timeout: number;
//     };
// }

// let envData: CompilerEnvData;

// export const executeCode = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//         const code = req.body.code;
//         const lang: string = req.body.language;

//         switch (lang.toLowerCase()) {
//             case 'c':
//                 var cEnvData = {OS: 'windows', cmd: 'g++', options: {timeout: 10000}};
//                 compiler.compileCPP(cEnvData, code, (data) => {
//                     res.send(data);
//                 })
//                 break;

//             case 'cpp':
//                 var cEnvData = {OS: 'windows', cmd: 'g++', options: {timeout: 10000}};
//                 compiler.compileCPP(cEnvData, code, (data) => {
//                     res.send(data);
//                 })
//                 break;

//             case 'python':
//                 var pythonEnvData = {OS: 'windows'};
//                 compiler.compilePython(pythonEnvData, code, (data) => {
//                     res.send(data);
//                 })
//                 break;

//             case 'java':
//                 var javaEnvData = {OS: 'windows'};
//                 compiler.compileJava(javaEnvData, code, (data) => {
//                     res.send(data);
//                 })
//                 break;
            
//             case 'cs':
//                 var csEnvData = {OS: 'windows'};
//                 compiler.compileCS(csEnvData, code, (data) => {
//                     res.send(data);
//                 })
//                 break;
        
//             default:
//                 break;
//         }

//         // res.status(200).json({
//         //     success: true,
//         // });
//     } catch (error: any) {
//         return next(new ErrorHandler(error.message, 400));
//     }
// });

// compiler.flush(function(){
//     console.log('All temporary files flushed !'); 
// });

export const addTestCase = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {courseId, contentId, question, testCases} = req.body;

        const course = await CourseModel.findById(courseId);
        if (!course) {
            return next(new ErrorHandler('Course not found', 400));
        }

        const content = course.courseContent.find((item: any) => item._id.toString() === contentId);
        if (!content) {
            return next(new ErrorHandler('Content not found', 400));
        }

        const code: any = {
            question: question,
            testCases: testCases
        }

        // content.questionCode.push(code);
        content.questionCode = code;
        await course.save();

        res.status(200).json({
            success: true,
            content
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

const getLanguageId = (lang) => {
    const languages = {
      javascript: 63,
      python: 71,
      java: 62,
      cpp: 54,
    };
    return languages[lang];
};

export const executeCode = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const code = req.body.code;
        const lang: string = req.body.language;

        const response = await fetch('https://judge0-ce.p.rapidapi.com/submissions', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
              'X-RapidAPI-Key': process.env.RAPID_API_KEY,
            },
            body: JSON.stringify({
              source_code: code,
              language_id: getLanguageId(lang),
              stdin: ''
            }),
        });
        
        const data = await response.json();
        const token = data.token;

        // Thêm việc chờ và poll kết quả
        let result;
        const maxAttempts = 10;
        for (let i = 0; i < maxAttempts; i++) {
            const resultResponse = await fetch(`https://judge0-ce.p.rapidapi.com/submissions/${token}`, {
                headers: {
                  'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
                  'X-RapidAPI-Key': process.env.RAPID_API_KEY,
                },
            });
            
            result = await resultResponse.json();

            // Kiểm tra trạng thái của submission
            if (result.status.id <= 2) {
                // Chờ một chút trước khi poll tiếp
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            // Nếu đã có kết quả cuối cùng
            break;
        }

        // Xử lý và trả về kết quả
        if (!result) {
            return next(new ErrorHandler('Timeout khi chờ kết quả', 408));
        }

        res.status(200).json({  
            success: true,
            result: {
                stdout: result.stdout,
                stderr: result.stderr,
                compile_output: result.compile_output,
                status: result.status.description
            }
        });

    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
})


export const executeTestCases = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {courseId, contentId, code, language} = req.body;
        const userId = req.user?._id;

        const course = await CourseModel.findById(courseId);
        if (!course) {
            return next(new ErrorHandler('Course not found', 400));
        }

        const content = course.courseContent.find((item: any) => item._id.toString() === contentId);
        if (!content) {
            return next(new ErrorHandler('Content not found', 400));
        }

        const languageId = getLanguageId(language);

        const testCases = content.questionCode;
        if (!testCases) {
            return next(new ErrorHandler('Test case not found', 400));
        }
        
        const results = []

        for (const testCase of testCases.testCases) {
            const response = await fetch('https://judge0-ce.p.rapidapi.com/submissions', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
                    'X-RapidAPI-Key': process.env.RAPID_API_KEY,
                },
                body: JSON.stringify({
                    source_code: code,
                    language_id: languageId,
                    // base64_encoded: true,
                    // stdin: Buffer.from(testCase.testCase).toString('base64'),
                    stdin: testCase.testCase
                }),
            });

            if (response.status === 429) {
                console.error('API rate limit exceeded');
                const program = {
                    script : code,
                    stdin: testCase.testCase,
                    language: language,
                    versionIndex: "0",
                    clientId: process.env.JDOODLE_CLIENTID,
                    clientSecret: process.env.JDOODLE_SECRET,
                }
    
                const Jdoodle_response = await fetch('https://api.jdoodle.com/v1/execute', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(program),
                });
    
                if (Jdoodle_response.status !== 200) {
                    return next(new ErrorHandler('Compiler error', 400));
                }
                const output = await response.json();

                results.push({
                    testCaseId: testCase._id,
                    actualResult: output.output,
                    passed: output.output.trim() === testCase.expectedResult.trim(),
                });

            } else {
                const data = await response.json();
                const token = data.token;
                let result;
                const maxAttempts = 10;
                for (let i = 0; i < maxAttempts; i++) {
                    const resultResponse = await fetch(`https://judge0-ce.p.rapidapi.com/submissions/${token}`, {
                        headers: {
                            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
                            'X-RapidAPI-Key': process.env.RAPID_API_KEY,
                        },
                    });

                    result = await resultResponse.json();
                    if (result.status.id > 2) break;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                if (!result) {
                    results.push({ testCase: testCases.testCases, error: 'Timeout' });
                    continue;
                }

                results.push({
                    testCase: testCase.testCase,
                    // expectedResult: testCase.expectedResult,
                    testCaseId: testCase._id,
                    actualResult: result.stdout,
                    passed: result.stdout.trim() === testCase.expectedResult.trim(),
                });
            }
        }

        // thêm results vào codeprogress
        const codeProgress: ICodeProgress = {
            codeId: content.questionCode._id.toString(),
            status: results.every((result) => result.passed),
        };

        const progress = await progressModel.findOne({ userId, courseId });
        if (!progress) {
            return next(new ErrorHandler('Progress not found', 400));
        }

        const lessonProgress = progress.lesson.find((lesson) => lesson.contentId === contentId);
        if (!lessonProgress) {
            const maxOrder = progress.lesson.reduce((max, lesson) => Math.max(max, lesson.order), 0) || 0;
            const newLesson: any = {
                contentId: contentId,
                order: maxOrder + 1,
                code: codeProgress,
                isLessonCompleted: codeProgress.status && content.quiz.length,
            };

            progress.lesson.push(newLesson);
        } else if (lessonProgress.code) {
            lessonProgress.code.status = codeProgress.status;
        }
        else {
            lessonProgress.code = codeProgress;
        }
        
        await progress.save();

        res.status(200).json({
            success: true,
            results
        });

    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
})

export const execute = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {courseId,contentId, code, language} = req.body;
        const userId = req.user?._id;

        const course = await CourseModel.findById(courseId);
        if (!course) {
            return next(new ErrorHandler('Course not found', 400));
        }

        const content = course.courseContent.find((item: any) => item._id.toString() === contentId);
        if (!content) {
            return next(new ErrorHandler('Content not found', 400));
        }

        const testCases = content.questionCode;
        if (!testCases) {
            return next(new ErrorHandler('Test case not found', 400));
        }
        
        const results = []
        for (const testCase of testCases.testCases) {
            const program = {
                script : code,
                stdin: testCase.testCase,
                language: language,
                versionIndex: "0",
                clientId: process.env.JDOODLE_CLIENTID,
                clientSecret: process.env.JDOODLE_SECRET,
            }

            const response = await fetch('https://api.jdoodle.com/v1/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(program),
            });

            if (response.status !== 200) {
                return next(new ErrorHandler('Compiler error', 400));
            }

            const output = await response.json();

            results.push({
                testCaseId: testCase._id,
                actualResult: output.output,
                passed: output.output.trim() === testCase.expectedResult.trim(),
            });
        }

        res.status(200).json({
            success: true,
            results
        });
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
})