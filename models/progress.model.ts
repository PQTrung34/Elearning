require("dotenv").config()
import mongoose, {Document, Schema, Model} from "mongoose";
const AutoIncrement = require('mongoose-sequence')(mongoose);


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
    quiz: Array<IQuizProgress>;
    code: Array<ICodeProgress>;
    order: number;
}

interface IProgressLesson {
    courseId: string;
    userId: string;
    lesson: Array<IArrayProgress>;
}

const quizSchema = new Schema<IQuizProgress>({
    quizId: String,
    status: Boolean,
});


const codeSchema = new Schema<ICodeProgress>({
    codeId: String,
    status: Boolean,
});

const arraySchema = new Schema<IArrayProgress>({
    contentId: String,
    quiz: [quizSchema],
    code: [codeSchema],
    order: Number,
});

const progressSchema = new Schema<IProgressLesson>({
    courseId: String,
    userId: String,
    lesson: [arraySchema],
});

arraySchema.plugin(AutoIncrement, {
    inc_field: 'order',
    start_seq: 1
});

const progressModel: Model<IProgressLesson> = mongoose.model("Progress", progressSchema);
export default progressModel;