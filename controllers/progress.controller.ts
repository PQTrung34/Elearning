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
        
        const contentInCourse = course.courseContent.find((item: any) => item._id.toString() === contentId);
        if (!contentInCourse) {
            return next(new ErrorHandler('Content not found', 404));
        }

        if (quizId) {
            const quizInCourse = contentInCourse.quiz.find((item: any) => item._id.toString() === quizId);
            if (!quizInCourse) {
                return next(new ErrorHandler('Quiz not found', 404));
            }
        }

        if (codeId) {
            const codeInCourse = contentInCourse.questionCode.find((item: any) => item._id.toString() === codeId);
            if (!codeInCourse) {
                return next(new ErrorHandler('Code not found', 404));
            }
        }

        const progress = await progressModel.findOne({userId, courseId});
        const content = progress.lesson.find(content => content.contentId == contentId);

        if (!content) {
            const quiz: IQuizProgress[] = quizId ? [{ quizId:quizId, status:quizStatus }] : [];
            const code: ICodeProgress[] = codeId ? [{ codeId:codeId, status:codeStatus }] : [];

            // Tìm giá trị order lớn nhất trong lesson để thêm bài học mới
            const maxOrder = progress.lesson.reduce((max, lesson) => Math.max(max, lesson.order), 0) || 0;
            
            const countQuiz = quizId ? quizStatus ? 1 : 0 : 0;
            const countCode = codeId ? codeStatus ? 1 : 0 : 0;

            const totalQuiz = contentInCourse?.quiz.length || 0;
            const totalCode = contentInCourse?.questionCode.length || 0;

            const isComplete = 
                (countQuiz === totalQuiz || totalQuiz === 0) &&
                (countCode === totalCode || totalCode === 0);

            const newLesson: IArrayProgress = {
                contentId: contentId,
                order: maxOrder + 1,
                isLessonCompleted: isComplete,
            };

            if (quizId) {
                newLesson.quiz = quiz;
            }

            if (codeId) {
                newLesson.code = code;
            }
            progress.lesson.push(newLesson);
        }
        else {
            if (quizId) {
                const quiz = content.quiz.find(quiz => quiz.quizId == quizId);
                if (!quiz) {
                    const newQuiz: IQuizProgress = {
                        quizId: quizId,
                        status: quizStatus
                    }
                    content.quiz.push(newQuiz);
                }
                else {
                    quiz.status = quizStatus;
                }
            }

            if (codeId) {
                const code = content.code.find(code => code.codeId == codeId);
                if (!code) {
                    const newCode: ICodeProgress = {
                        codeId: codeId,
                        status: codeStatus
                    }
                    content.code.push(newCode);
                } 
                else {
                    code.status = codeStatus;
                }
            }
            
            // const isComplete = content.quiz.every(quiz => quiz.status) && content.code.every(code => code.status);
            const isComplete = 
                (contentInCourse.quiz.length === 0 || (content.quiz.every(quiz => quiz.status) && contentInCourse?.quiz.length === content.quiz.length)) &&
                (contentInCourse.questionCode.length === 0 || (content.code.every(code => code.status) && contentInCourse?.questionCode.length === content.code.length));
            content.isLessonCompleted = isComplete;
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
        // const {courseId} = req.body;
        const {courseId} = req.params;
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
                contentId: course.courseContent[0]._id.toString() || '',
                quiz: [],
                code: [],
                order: 1,
                isLessonCompleted: false
            }
            lastLesson = newLesson//them dong nay
            progress.lesson.push(newLesson);
        } else {
            lastLesson = progress.lesson.reduce((maxLesson, currentLesson) => {
                return currentLesson.order > maxLesson.order ? currentLesson : maxLesson;
            }, progress.lesson[0]);
        }
        await progress.save()
        // console.log(progress)
        res.status(200).json({
            'success': true,
            lastLesson
        })
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
})

export const isLessonComplete = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
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

        const content = course.courseContent.find((item: any) => item._id.toString() === contentId);
        if (!content) {
            return next(new ErrorHandler('Content not found', 404));
        }

        const progress = await progressModel.findOne({userId, courseId});
        if (!progress) {
            return next(new ErrorHandler('Progress not found', 404));
        }

        const lessonProgress = progress.lesson.find(lesson => lesson.contentId == contentId);
        if (!lessonProgress) {
            return next(new ErrorHandler('Content not found', 404));
        }

        const isComplete = 
            (content.quiz.length === 0 || (lessonProgress.quiz.every(quiz => quiz.status) && content?.quiz.length === lessonProgress.quiz.length)) &&
            (content.questionCode.length === 0 || (lessonProgress.code.every(code => code.status) && content?.questionCode.length === lessonProgress.code.length));

        res.status(200).json({
            'success': true,
            "content": contentId,
            'isComplete': isComplete
        })
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
})
    
export const isCourseComplete = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const courseId = req.body;
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
        if (!progress) {
            return next(new ErrorHandler('Progress not found', 404));
        }

        const isComplete = progress.lesson.every(lesson => lesson.isLessonCompleted) && (progress.lesson.length === course.courseContent.length);
        res.status(200).json({
            'success': true,
            'is course complete': isComplete
        })
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
})