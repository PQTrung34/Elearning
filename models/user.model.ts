require("dotenv").config()
import mongoose, {Document, Schema, Model} from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const emailRegexPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface IQuizProgress {
    quizId: string;
    isCorrect: boolean;
    attempts: number;
    lastAttemptAt?: Date;
}

interface ICodeExerciseProgress {
    exerciseId: string;
    isCompleted: boolean;
    attempts: number;
    lastSubmittedCode?: string;
    lastAttemptAt?: Date;
    passedTestCases: number[];
}

interface IContentProgress {
    contentId: string;
    completed: boolean;
    lastAccessed: Date;
    watchTime: number; // in seconds
    quizProgress?: IQuizProgress[];
    codeExerciseProgress?: ICodeExerciseProgress[];
}

interface ICourseProgress {
    courseId: string;
    completedContents: IContentProgress[];
    lastAccessed: Date;
    overallProgress: number; // percentage
}

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    avatar: {
        public_id: string;
        url: string;
    },
    role: string;
    isVerified: boolean;
    courses: Array<{courseId: string}>;
    courseProgress: ICourseProgress[];
    comparePassword: (password: string) => Promise<boolean>;
    SignAccessToken: () => string;
    SignRefreshToken: () => string;
}

const userSchema: Schema<IUser> = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter your name'],
    },
    email: {
        type: String,
        required: [true, 'Please enter your email'],
        validate: {
            validator: function (value: string) {
                return emailRegexPattern.test(value);
            },
            message: 'Please enter valid email',
        },
        unique: true,
    },
    password: {
        type: String,
        // required: [true, 'Please enter your password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false,
    },
    avatar: {
        public_id: String,
        url: String,
    },
    role: {
        type: String,
        default: 'user',
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    courses: [
        {
            courseId: String
        }
    ],

    courseProgress: [{
        courseId: String,
        completedContents: [{
            contentId: String,
            completed: {
                type: Boolean,
                default: false
            },
            lastAccessed: {
                type: Date,
                default: Date.now
            },
            watchTime: {
                type: Number,
                default: 0
            },
            quizProgress: [{
                questionId: String,
                isCorrect: {
                    type: Boolean,
                    default: false
                },
                attempts: {
                    type: Number,
                    default: 0
                },
                lastAttemptAt: Date
            }],
            codeExerciseProgress: [{
                exerciseId: String,
                isCompleted: {
                    type: Boolean,
                    default: false
                },
                attempts: {
                    type: Number,
                    default: 0
                },
                lastSubmittedCode: String,
                lastAttemptAt: Date,
                passedTestCases: [Number]
            }]
        }],
        lastAccessed: {
            type: Date,
            default: Date.now
        },
        overallProgress: {
            type: Number,
            default: 0
        }
    }]
}, {timestamps:true});

// hash password before saving
userSchema.pre<IUser>('save', async function(next) {
    if (!this.isModified('password')) {
        next();
    }
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// sign access token
userSchema.methods.SignAccessToken = function() {
    return jwt.sign({id: this._id}, process.env.ACCESS_TOKEN || '', {
        expiresIn: "5m"
    });
}

// sign refresh token
userSchema.methods.SignRefreshToken = function() {
    return jwt.sign({id: this._id}, process.env.REFRESH_TOKEN || '', {
        expiresIn: "3d"
    });
}

// compare password
userSchema.methods.comparePassword = async function (enteredPassword:string): Promise<boolean> {
    return await bcrypt.compare(enteredPassword, this.password);
};

const userModel: Model<IUser> = mongoose.model("User", userSchema);
export default userModel;