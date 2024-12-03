require("dotenv").config();
import mongoose, { Document, Schema, Model } from "mongoose";
 
export interface IQuizProgress {
    quizId: string;
    status: boolean;
}
 
export interface ICodeProgress {
    codeId: string;
    status: boolean;
}

export interface IQuizSectionProgress {
    quizSectionId: string;
    status: boolean;
}
 
export interface ILessonProgress {
    contentId: string;
    quiz?: Array<IQuizProgress>;
    code?: ICodeProgress;
    quizSection?: Array<IQuizSectionProgress>;
    order: number;
    isLessonCompleted: boolean;
    isQuizSectionCompleted?: boolean;
}
 
interface IProgressLesson {
    courseId: string;
    userId: string;
    lesson: Array<ILessonProgress>;
    isCompleted: boolean;
}
 
const quizSchema = new Schema<IQuizProgress>({
    quizId: String,
    status: Boolean,
}, { _id: false });
 
const codeSchema = new Schema<ICodeProgress>({
    codeId: String,
    status: Boolean,
}, { _id: false });

const quizSectionSchema = new Schema<IQuizSectionProgress>({
    quizSectionId: String,
    status: Boolean,
}, { _id: false });
 
const lessonSchema = new Schema<ILessonProgress>({
    contentId: String,
    quiz: [quizSchema],
    code: codeSchema,
    quizSection: [quizSectionSchema],
    order: Number, // Không tự động tăng
    isLessonCompleted: Boolean,
    isQuizSectionCompleted: Boolean,
}, { _id: false });
 
const progressSchema = new Schema<IProgressLesson>({
    courseId: String,
    userId: String,
    lesson: [lessonSchema],
});
 
const progressModel: Model<IProgressLesson> = mongoose.model("Progress", progressSchema);
export default progressModel;