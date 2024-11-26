import mongoose, {Document, Model, Schema} from "mongoose";
import { IUser } from "./user.model";

interface IComment extends Document {
    user: IUser;
    question: string;
    questionReplies?: IComment[];
}

interface IReview extends Document {
    user: IUser;
    rating: number;
    comment: string;
    commentReplies: IComment[];
}

interface ILink extends Document {
    title: string;
    url: string;
}

export interface IQuiz extends Document {
    time: number,
    question: string,
    options: Array<string>,
    correctAnswer: number,
}

interface ITestCase extends Document {
    
}

export interface ICode extends Document {
    question: string,
    testCase: Array<ITestCase>,
}

export interface IQuizSection {
    question: string,
    options: Array<string>,
    correctAnswer: number,
}

interface ICourseData extends Document {
    title: string;
    description: string;
    videoUrl: string;
    videoThumbnail: object;
    videoSection: string;
    videoLength: number;
    videoPlayer: string;
    links: ILink[];
    suggestion: string;
    questions: IComment[];
    quiz?: IQuiz[];
    questionCode?: ICode[];
    quizSection?: IQuizSection[];
}

interface ICourse extends Document {
    name: string;
    description: string;
    price: number;
    estimatedPrice?: number;
    thumbnail: object;
    tags: string;
    level: string;
    demoUrl: string;
    benefits: {title: string}[];
    prerequisites: {title: string}[];
    reviews: IReview[];
    courseContent: ICourseData[];
    ratings?: number;
    purchased: number;
    categories: string;
    language?: string;
}

const commentSchema = new Schema<IComment>({
    user: Object,
    question: String,
    questionReplies: [Object],
}, {timestamps: true});

const reviewSchema = new Schema<IReview>({
    user: Object,
    rating: {
        type: Number,
        default: 0,
    },
    comment: String,
    commentReplies: [Object],
}, {timestamps: true});

const linkSchema = new Schema<ILink>({
    title: String,
    url: String,
});

const quizSchema = new Schema<IQuiz>({
    time: Number,
    question: String,
    options: [String],
    correctAnswer: Number,
})

const testCaseSchema = new Schema<ITestCase>({

})

const codeSchema = new Schema<ICode>({
    question: String,
    testCase: [testCaseSchema],
})

const quizSectionSchema = new Schema<IQuizSection>({
    question: String,
    options: [String],
    correctAnswer: Number,
})

const courseDataSchema = new Schema<ICourseData>({
    videoUrl: String,
    videoThumbnail: Object,
    title: String,
    videoSection: String,
    description: String,
    videoLength: Number,
    videoPlayer: String,
    links: [linkSchema],
    suggestion: String,
    questions: [commentSchema],
    quiz: [quizSchema],
    questionCode: [codeSchema],
    quizSection: [quizSectionSchema],
});

const courseSchema = new Schema<ICourse>({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    categories: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
    },
    estimatedPrice: {
        type: Number,
    },
    thumbnail: {
        public_id: {
            type: String,
        },
        url: {
            type: String,
        },
    },
    tags: {
        type: String,
        required: true,
    },
    level: {
        type: String,
        required: true,
    },
    demoUrl: {
        type: String,
        required: true,
    },
    benefits: [{title: String}],
    prerequisites: [{title: String}],
    reviews: [reviewSchema],
    courseContent: [courseDataSchema],
    ratings: {
        type: Number,
        default: 0,
    },
    purchased: {
        type: Number,
        default: 0,
    },
    language: {
        type: String,
    }
}, {timestamps: true});

const CourseModel: Model<ICourse> = mongoose.model("Course", courseSchema);
export default CourseModel;