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
        console.log(quizStatus);
        if (!content) {
            const quiz: IQuizProgress[] = quizId ? [{ quizId:quizId, status:quizStatus }] : [];
            const code: ICodeProgress[] = codeId ? [{ codeId:codeId, status:codeStatus }] : [];

            // Tìm giá trị order lớn nhất trong lesson để thêm bài học mới
            const maxOrder = progress.lesson.reduce((max, lesson) => Math.max(max, lesson.order), 0) || 0;

            const newLesson: IArrayProgress = {
                contentId: contentId,
                quiz: quiz,
                code: code,
                order: maxOrder + 1
            };
            progress.lesson.push(newLesson);
        }
        else {
            const quiz = content.quiz.find(quiz => quiz.quizId == quizId);
            if (!quiz) {
                const newQuiz: IQuizProgress = {
                    quizId: quizId,
                    status: quizStatus
                }
                content.quiz.push(newQuiz);
                // return next(new ErrorHandler('Quiz not found', 404));
            }
            else {
                quiz.status = quizStatus;
            }
            const code = content.code.find(code => code.codeId == codeId);
            if (!code) {
                const newCode: ICodeProgress = {
                    codeId: codeId,
                    status: codeStatus
                }
                content.code.push(newCode);
                // return next(new ErrorHandler('Code not found', 404));
            } 
            else {
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
        const {courseId, contentId} = req.body;
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
            const newLesson = {
                contentId,
                quiz: [],
                code: [],
                order: 1
            }
            progress.lesson.push(newLesson);
        } else {
            lastLesson = progress.lesson.reduce((maxLesson, currentLesson) => {
                return currentLesson.order > maxLesson.order ? currentLesson : maxLesson;
            }, progress.lesson[0]);
        }
        res.status(200).json({
            'success': true,
            lastLesson
        })
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
})
    