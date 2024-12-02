import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../middleware/catchAsyncError';
import ErrorHandler from '../utils/ErrorHandler';
import CourseModel, { IQuiz } from '../models/course.model';
import userModel from '../models/user.model';
import progressModel, { ILessonProgress } from '../models/progress.model';
import { IQuizProgress, ICodeProgress } from '../models/progress.model';

export const updateProgress = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { courseId, contentId, quizId, quizStatus, codeId, codeStatus } = req.body;
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

        if (codeId && !contentInCourse.questionCode) {
            return next(new ErrorHandler('Code not found', 404));
        }

        const progress = await progressModel.findOne({ userId, courseId });
        if (!progress) {
            return next(new ErrorHandler('Progress not found', 404));
        }

        const content = progress.lesson.find((lesson) => lesson.contentId === contentId);
        if (!content) {
            const newLesson: ILessonProgress = {
                contentId,
                order: progress.lesson.length + 1,
                isLessonCompleted: false,
                quiz: quizId ? [{ quizId, status: quizStatus }] : [],
                code: codeId ? { codeId, status: codeStatus } : undefined,
            };

            progress.lesson.push(newLesson);
        } else {
            if (quizId) {
                const existingQuiz = content.quiz?.find((quiz) => quiz.quizId === quizId);
                if (existingQuiz) {
                    existingQuiz.status = quizStatus;
                } else {
                    content.quiz?.push({ quizId, status: quizStatus });
                }
            }
            if (codeId) {
                if (content.code) {
                    content.code.status = codeStatus;
                } else {
                    content.code = { codeId, status: codeStatus };
                }
            }
            const quizCompleted = content.quiz?.every((quiz) => quiz.status) && content.quiz?.length == contentInCourse.quiz.length;
            const codeCompleted = content.code?.status || !contentInCourse.questionCode;
            content.isLessonCompleted = quizCompleted && codeCompleted;
        }

        await progress.save();

        res.status(200).json({
            success: true,
            progress,
        });
    } catch (error) {
        next(new ErrorHandler(error.message, 500));
    }
});

export const getProgress = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { courseId } = req.params;
        const userId = req.user?._id;

        const user = await userModel.findById(userId);
        if (!user) {
            return next(new ErrorHandler('User not found', 404));
        }

        const course = await CourseModel.findById(courseId);
        if (!course) {
            return next(new ErrorHandler('Course not found', 404));
        }

        let progress = await progressModel.findOne({ userId, courseId });
        if (!progress) {
            progress = new progressModel({
                userId,
                courseId,
                lesson: [],
                isCompleted: false,
            });
        }

        let lastLesson;
        if (!progress.lesson.length) {
            if (!course.courseContent.length) {
                return next(new ErrorHandler('Course has no content', 400));
            }

            const firstContent = course.courseContent[0];
            const newLesson = {
                contentId: firstContent._id.toString(),
                quiz: [],
                code: undefined,
                order: 1,
                isLessonCompleted: false,
            };

            lastLesson = newLesson;
            progress.lesson.push(newLesson);
        } else {
            lastLesson = progress.lesson.reduce((maxLesson, currentLesson) => {
                return currentLesson.order > maxLesson.order ? currentLesson : maxLesson;
            }, progress.lesson[0]);
        }

        await progress.save();

        res.status(200).json({
            success: true,
            lastLesson,
        });
    } catch (error) {
        return next(new ErrorHandler(error.message, 500));
    }
});

export const isLessonComplete = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { courseId, contentId } = req.body;
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
            return next(new ErrorHandler('Content not found in course', 404));
        }

        const progress = await progressModel.findOne({ userId, courseId });
        if (!progress) {
            return next(new ErrorHandler('Progress not found', 404));
        }

        const lessonProgress = progress.lesson.find((lesson) => lesson.contentId === contentId);
        if (!lessonProgress) {
            return next(new ErrorHandler('Lesson progress not found', 404));
        }

        const quizCompleted = 
            !content.quiz?.length || 
            (lessonProgress.quiz?.length === content.quiz?.length && lessonProgress.quiz?.every((quiz) => quiz.status));

        const codeCompleted = 
            !content.questionCode || (lessonProgress.code?.status === true);

        const isComplete = quizCompleted && codeCompleted;

        res.status(200).json({
            success: true,
            content: contentId,
            isComplete,
        });
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
});
    
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