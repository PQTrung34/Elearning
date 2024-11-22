import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../middleware/catchAsyncError';
import ErrorHandler from '../utils/ErrorHandler';
import CourseModel, { IQuiz } from '../models/course.model';
import userModel from '../models/user.model';
import progressModel, { IArrayProgress } from '../models/progress.model';
import { IQuizProgress, ICodeProgress } from '../models/progress.model';

export const updateProgress = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const {courseId, contentId, quizId, quizStatus, codeId, codeStatus} = req.body;
        const userId = req.user?._id;
        const course = await CourseModel.findById(courseId);
        if (!course) {
            return next(new ErrorHandler('Course not found', 404));
        }
        const progress = await progressModel.findOne({userId, courseId});
        const content = progress.lesson.find(content => content.contentId == contentId);
        if (!progress.lesson.length || !content) {
            if (!progress.lesson.length) {
                const quiz: IQuizProgress[] = quizId ? [{ quizId:quizId, status:quizStatus }] : [];
                const code: ICodeProgress[] = codeId ? [{ codeId:codeId, status:codeStatus }] : [];
                const newLesson: IArrayProgress = {
                    contentId: contentId,
                    quiz: quiz,
                    code: code,
                    order: 1
                };
                progress.lesson.push(newLesson);
            }

            if (content) {
                const quiz = content.quiz.find(quiz => quiz.quizId == quizId);
                if (!quiz) {
                    return next(new ErrorHandler('Quiz not found', 404));
                }
                const code = content.code.find(code => code.codeId == codeId);
                if (!code) {
                    return next(new ErrorHandler('Code not found', 404));
                }
                quiz.status = quizStatus;
                code.status = codeStatus;
            }
            
        }
        await progress.save();
        res.status(200).json({
            'success': true,
            progress
        })
    
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
})

export const getProgress = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const {courseId} = req.body;
        const userId = req.user?._id;

        const user = await userModel.findById(userId);
        if (!user) {
            return next(new ErrorHandler('User not found', 404));
        }

        const course = await CourseModel.findById(courseId);
        if (!course) {
            return next(new ErrorHandler('Course not found', 404));
        }
        

        const progress = await progressModel.findOne({userId, courseId});
        let lastLesson;
        if (!progress.lesson.length){
            lastLesson = course.courseContent[0];
        } else {
            lastLesson = progress.lesson.find(content => {
                const quizCheck = content.quiz.every(quiz => quiz.status);
                const codeCheck = content.code.every(code => code.status);
                console.log(!quizCheck && !codeCheck)
                return !(quizCheck && codeCheck)
            })
        }
        
        res.status(200).json({
            'success': true,
            lastLesson
        })
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
})
    