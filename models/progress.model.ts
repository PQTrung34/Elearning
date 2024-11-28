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
 
export interface IArrayProgress {
    contentId: string;
    quiz?: Array<IQuizProgress>;
    code?: Array<ICodeProgress>;
    order: number;
    isLessonCompleted: boolean;
}
 
interface IProgressLesson {
    courseId: string;
    userId: string;
    lesson: Array<IArrayProgress>;
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
 
const arraySchema = new Schema<IArrayProgress>({
    contentId: String,
    quiz: [quizSchema],
    code: [codeSchema],
    order: Number, // Không tự động tăng
    isLessonCompleted: Boolean,
});
 
const progressSchema = new Schema<IProgressLesson>({
    courseId: String,
    userId: String,
    lesson: [arraySchema],
});
 
const progressModel: Model<IProgressLesson> = mongoose.model("Progress", progressSchema);
export default progressModel;