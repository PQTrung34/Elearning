require('dotenv').config();
import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import CourseModel, { ICode } from "../models/course.model";
import progressModel, { ICodeProgress } from "../models/progress.model";
 
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
            const stdin = testCase.testCase
            .split('\n')
            .map((line, index) => index === 1 ? line.split(' ').join('\n') : line)
            .join('\n');
            const judge0Response = await fetch('https://judge0-ce.p.rapidapi.com/submissions', {
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
                    stdin: stdin
                }),
            });
            if (judge0Response.status === 429) {
                // Nếu Judge0 limit
                const program = {
                    script : code,
                    stdin: stdin,
                    language: language,
                    versionIndex: "0",
                    clientId: process.env.JDOODLE_CLIENTID,
                    clientSecret: process.env.JDOODLE_SECRET,
                }
                if (language === 'python') {
                    program.language = 'python3';
                }

                const Jdoodle_response = await fetch('https://api.jdoodle.com/v1/execute', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(program),
                });

                let output = await Jdoodle_response.json();
                if (output.statusCode === 429){
                    // Nếu Jdoodle limit
                    console.log('Chạy vào piston');
                    const pistonResponse = await fetch('https://emkc.org/api/v2/piston/execute', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            language: language,
                            version: '*', // hoặc phiên bản cụ thể
                            files: [{ content: code }],
                            stdin: stdin,
                            compile_timeout: 10000,
                            run_timeout: 3000,
                            compile_memory_limit: -1,
                            run_memory_limit: -1
                        })
                    });
        
                    let output = await pistonResponse.json();
                    if (output.run.stderr) {
                        return next(new ErrorHandler(output.run.stderr.split(',').slice(1).join(' ').trim(), 400));
                    }
                    results.push({
                        testCaseId: testCase._id,
                        actualResult: output.run.stdout,
                        passed: output.run.stdout.trim() === testCase.expectedResult.trim(),
                    });
                }
                else {
                    console.log('Chạy vào Jdoodle');
                    if (!output.isExecutionSuccess) {
                        return next(new ErrorHandler(output.output.trim(), 400));
                    }

                    results.push({
                        testCaseId: testCase._id,
                        actualResult: output.output,
                        passed: output.output.trim() === testCase.expectedResult.trim(),
                    });
                }

            } else {
                console.log('Chạy vào Judge0');
                const data = await judge0Response.json();
                const token = data.token;
                let output
                const maxAttempts = 10;
                for (let i = 0; i < maxAttempts; i++) {
                    const resultResponse = await fetch(`https://judge0-ce.p.rapidapi.com/submissions/${token}`, {
                        headers: {
                            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
                            'X-RapidAPI-Key': process.env.RAPID_API_KEY,
                        },
                    });
 
                    output = await resultResponse.json();
                    if (output.status.id > 2) break;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
 
                if (!output) {
                    results.push({ testCase: testCases.testCases, error: 'Timeout' });
                    continue;
                }
                if (output.stderr) {
                    return next(new ErrorHandler(output.stderr.trim(), 400));
                }

                results.push({
                    testCaseId: testCase._id,
                    actualResult: output.stdout,
                    passed: output.stdout.trim() === testCase.expectedResult.trim(),
                });
            }
        }
 
        // thêm results vào codeprogress
        const codeProgress: ICodeProgress = {
            codeId: content.questionCode._id as string,
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
                isLessonCompleted: codeProgress.status && content.quiz.length == 0 && content.quizSection.length == 0,
            };
            progress.lesson.push(newLesson);
        } else {
            if (lessonProgress.code) {
                lessonProgress.code.status = codeProgress.status;
            }
            else {
                lessonProgress.code = codeProgress;
            }
            const hasQuiz = content.quiz.length > 0 ? true : false;
            const isQuizCompleted = (!hasQuiz) || // không có quiz -> true
                (hasQuiz && lessonProgress.quiz.length != 0) || // có quiz và chưa làm
                (hasQuiz && lessonProgress.quiz.length == content.quiz.length && lessonProgress.quiz.every(quiz => quiz.status)); // có quiz và đã làm
            const isQuizSectionCompleted = content.quizSection.length > 0 ? (lessonProgress.isQuizSectionCompleted ? lessonProgress.isQuizSectionCompleted : false) : true;
            console.log('isQuizCompleted', isQuizCompleted);
            console.log('isQuizSectionCompleted', isQuizSectionCompleted);
            lessonProgress.isLessonCompleted = codeProgress.status && isQuizCompleted && isQuizSectionCompleted;
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
 
// test jdoodle
export const executeJdoodle = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
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
            const creditSpent = await fetch('https://api.jdoodle.com/v1/credit-spent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    clientId: process.env.JDOODLE_CLIENTID,
                    clientSecret: process.env.JDOODLE_SECRET,
                }),
            });
            const credit = await creditSpent.json();
            console.log(credit.used)
            const stdin = testCase.testCase
            .split('\n')
            .map((line, index) => index === 1 ? line.split(' ').join('\n') : line)
            .join('\n');
            const program = {
                script : code,
                stdin: stdin,
                language: language,
                versionIndex: "0",
                clientId: process.env.JDOODLE_CLIENTID,
                clientSecret: process.env.JDOODLE_SECRET,
            }
            if (language === 'python') {
                program.language = 'python3'
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
            if (!output.isExecutionSuccess) {
                return next(new ErrorHandler(output.output.trim(), 400));
            }
 
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

// test piston
export const executePiston = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
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
 
        const testCases = content.questionCode;
        if (!testCases) {
            return next(new ErrorHandler('Test case not found', 400));
        }
       
        const results = []
        for (const testCase of testCases.testCases) {
            const stdin = testCase.testCase
            .split('\n')
            .map((line, index) => index === 1 ? line.split(' ').join('\n') : line)
            .join('\n');
            const response = await fetch('https://emkc.org/api/v2/piston/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    language: language,
                    version: '*', // hoặc phiên bản cụ thể
                    files: [{ content: code }],
                    stdin: stdin,
                    compile_timeout: 10000,
                    run_timeout: 3000,
                    compile_memory_limit: -1,
                    run_memory_limit: -1
                })
            });

            const result = await response.json();
            console.log(result);
            console.log('--------------------------')
            if (result.run.stderr) {
                return next(new ErrorHandler(result.run.stderr.split(',').slice(1).join(' ').trim(), 400));
            }
            results.push({
                testCaseId: testCase._id,
                actualResult: result.run.stdout,
                passed: result.run.stdout.trim() === testCase.expectedResult.trim(),
            });
        }

        // thêm results vào codeprogress
        const codeProgress: ICodeProgress = {
            codeId: content.questionCode._id as string,
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
                isLessonCompleted: codeProgress.status && content.quiz.length == 0 && content.quizSection.length == 0,
            };
            progress.lesson.push(newLesson);
        } else {
            if (lessonProgress.code) {
                lessonProgress.code.status = codeProgress.status;
            }
            else {
                lessonProgress.code = codeProgress;
            }
            const hasQuiz = content.quiz.length > 0 ? true : false;
            const isQuizCompleted = (!hasQuiz) || // không có quiz -> true
                (hasQuiz && lessonProgress.quiz.length != 0) || // có quiz và chưa làm
                (hasQuiz && lessonProgress.quiz.length == content.quiz.length && lessonProgress.quiz.every(quiz => quiz.status)); // có quiz và đã làm
            const isQuizSectionCompleted = content.quizSection.length > 0 ? (lessonProgress.isQuizSectionCompleted ? lessonProgress.isQuizSectionCompleted : false) : true;
            console.log('isQuizCompleted', isQuizCompleted);
            console.log('isQuizSectionCompleted', isQuizSectionCompleted);
            lessonProgress.isLessonCompleted = codeProgress.status && isQuizCompleted && isQuizSectionCompleted;
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