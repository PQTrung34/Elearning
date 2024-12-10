import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../middleware/catchAsyncError';
import ErrorHandler from '../utils/ErrorHandler';
import CourseModel, { IQuiz } from '../models/course.model';
import userModel from '../models/user.model';
import progressModel, { ILessonProgress } from '../models/progress.model';
import { IQuizProgress, ICodeProgress } from '../models/progress.model';

export const updateProgress = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { courseId, contentId, quizId, quizStatus, codeId, codeStatus, quizSectionStatus } = req.body;
        const userId = req.user?._id;

        const course = await CourseModel.findById(courseId);
        if (!course) {
            return next(new ErrorHandler('Course not found', 404));
        }

        const user = await userModel.findById(userId);
        if (!user) {
            return next(new ErrorHandler('User not found', 404));
        }

        const courseExist = user.courses.some((course: any) => course.courseId.toString() === courseId);
        if (!courseExist) {
            return next(new ErrorHandler('You have not purchased this course', 400));
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

        if (codeId && (contentInCourse.questionCode.testCases.length === 0 || contentInCourse.questionCode._id.toString() !== codeId)) {
            return next(new ErrorHandler('Code not found', 404));
        }

        const progress = await progressModel.findOne({ userId, courseId });
        if (!progress) {
            return next(new ErrorHandler('Progress not found', 404));
        }

        const lessonProgress = progress.lesson.find((lesson) => lesson.contentId.toString() === contentId);
        if (!lessonProgress) {
            console.log('Vào phần chưa có lessonProgress');
            const quiz: IQuizProgress[] = quizId ? [{ quizId:quizId, status:quizStatus }] : [];
            const code: ICodeProgress = codeId ? { codeId:codeId, status:codeStatus } : undefined;
            // Tìm giá trị order lớn nhất trong lesson để thêm bài học mới
            const maxOrder = progress.lesson.reduce((max, lesson) => Math.max(max, lesson.order), 0) || 0;

            const countQuiz = quizId ? quizStatus ? 1 : 0 : 0;
            const countCode = codeId ? codeStatus ? 1 : 0 : 0;

            const totalQuiz = contentInCourse.quiz.length || 0;
            const totalCode = contentInCourse.questionCode.testCases.length > 0 ? 1 : 0;

            const hasQuizSection = contentInCourse.quizSection.length > 0 ? true : false;

            const isComplete = 
                (countQuiz === totalQuiz || totalQuiz === 0) &&
                (countCode === totalCode || totalCode === 0) &&
                (hasQuizSection ? quizSectionStatus : true);

            console.log('totalQuiz', totalQuiz);
            console.log('countQuiz', countQuiz);
            console.log('totalCode', totalCode);
            console.log('countCode', countCode);
            console.log('isQuizSectionCompleted', hasQuizSection ? quizSectionStatus : true);
            console.log('isLessonComplete', isComplete);

            const newLesson: ILessonProgress = {
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

            if (hasQuizSection && (quizSectionStatus === true || quizSectionStatus === false)) {
                newLesson.isQuizSectionCompleted = quizSectionStatus;
            };

            progress.lesson.push(newLesson);

        } else {
            console.log('Vào phần cập nhật lessonProgress');
            if (quizId) {
                const quiz = lessonProgress.quiz.find(quiz => quiz.quizId == quizId);
                if (!quiz) {
                    const newQuiz: any = {
                        quizId: quizId,
                        status: quizStatus
                    }
                    lessonProgress.quiz.push(newQuiz);
                }
                else {
                    quiz.status = quizStatus;
                }
            }

            if (codeId) {
                const code = lessonProgress.code;
                if (!code) {
                    const newCode: any = {
                        codeId: codeId,
                        status: codeStatus
                    }
                        lessonProgress.code = newCode;
                } 
                else {
                    code.status = codeStatus;
                }
            }

            if (contentInCourse.quizSection.length > 0 && (quizSectionStatus === true || quizSectionStatus === false)) {
                lessonProgress.isQuizSectionCompleted = quizSectionStatus //&&
                // ((contentInCourse.quiz.length === 0) || (lessonProgress.quiz.every(quiz => quiz.status) && contentInCourse?.quiz.length === lessonProgress.quiz.length)) &&
                // ((contentInCourse.questionCode.testCases.length === 0) || (lessonProgress.code?.status === true && contentInCourse?.questionCode._id.toString() === lessonProgress.code.codeId));
            }

            const isLessonComplete = 
                ((contentInCourse.quiz.length === 0) || (lessonProgress.quiz.every(quiz => quiz.status) && contentInCourse?.quiz.length === lessonProgress.quiz.length)) &&
                ((contentInCourse.questionCode.testCases.length === 0) || (lessonProgress.code?.status === true && contentInCourse?.questionCode._id.toString() === lessonProgress.code.codeId)) &&
                ((contentInCourse.quizSection.length === 0) || (lessonProgress.isQuizSectionCompleted === true));
            lessonProgress.isLessonCompleted = isLessonComplete;
            console.log('isLessonComplete', isLessonComplete);
        }

        // cập nhật complete tổng của course
        const isQuizSectionCompleted = course.courseContent.every(async (content: any) => {
            if (content.quizSection.length === 0) return true;
            const lessonProgress = await progress.lesson.find((lesson) => lesson.contentId.toString() === content._id.toString());
            if (lessonProgress && lessonProgress.isQuizSectionCompleted) return lessonProgress.isQuizSectionCompleted;
            return false;
        });
        const isLessonCompleted = progress.lesson.every(lesson => lesson.isLessonCompleted) && 
            (progress.lesson.length === course.courseContent.length);
        progress.isCompleted = isLessonCompleted && isQuizSectionCompleted;

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

        const courseExist = user?.courses.some((course: any) => course.courseId.toString() === courseId);
        if (!courseExist) {
            return next(new ErrorHandler('You have not purchased this course', 400));
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
                contentId: firstContent._id as string,
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

        const courseExist = user.courses.some((course: any) => course.courseId.toString() === courseId);
        if (!courseExist) {
            return next(new ErrorHandler('You have not purchased this course', 400));
        }
        
        const content = course.courseContent.find((item: any) => item._id.toString() === contentId);
        if (!content) {
            return next(new ErrorHandler('Content not found', 404));
        }

        const progress = await progressModel.findOne({ userId, courseId });
        if (!progress) {
            return next(new ErrorHandler('Progress not found', 404));
        }

        const lessonProgress = progress.lesson.find((lesson) => lesson.contentId.toString() === contentId);
        if (!lessonProgress) {
            return next(new ErrorHandler('Lesson progress not found', 404));
        }

        const quizCompleted = 
            content.quiz.length === 0 || 
            (lessonProgress.quiz?.length === content.quiz?.length && lessonProgress.quiz?.every((quiz) => quiz.status));

        const codeCompleted = 
            content.questionCode.testCases.length === 0  || (lessonProgress.code?.status === true);

        const isQuizSectionCompleted = 
            content.quizSection.length === 0 || (lessonProgress.isQuizSectionCompleted === true);

        const isComplete = quizCompleted && codeCompleted && isQuizSectionCompleted;
        const isActiveQuizSection = (content.quizSection.length > 0 && quizCompleted && codeCompleted) 
            // || (content.quizSection.length === 0);
        
        res.status(200).json({
            success: true,
            content: contentId,
            isComplete,
            isActiveQuizSection,
        });
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
});
    
export const isCourseComplete = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
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

        const courseExist = user.courses.some((course: any) => course.courseId.toString() === courseId);
        if (!courseExist) {
            return next(new ErrorHandler('You have not purchased this course', 400));
        }

        const progress = await progressModel.findOne({userId, courseId});
        if (!progress) {
            return next(new ErrorHandler('Progress not found', 404));
        }

        const isQuizSectionCompleted = course.courseContent.every(async (content: any) => {
            if (!content.quizSection) return true;
            const lessonProgress = await progress.lesson.find((lesson) => lesson.contentId.toString() === content._id.toString());
            if (lessonProgress && lessonProgress.isQuizSectionCompleted) return lessonProgress.isQuizSectionCompleted;
            return false;
        })

        const isLessonComplete = progress.lesson.every(lesson => lesson.isLessonCompleted) && 
        (progress.lesson.length === course.courseContent.length)

        const isCourseComplete = isLessonComplete && isQuizSectionCompleted;
        
        res.status(200).json({
            'success': true,
            'is course complete': isCourseComplete,
        })
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
})