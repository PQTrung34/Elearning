import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../middleware/catchAsyncError';
import ErrorHandler from '../utils/ErrorHandler';
import cloudinary from 'cloudinary';
import { createCourse, getAllCoursesService } from '../services/course.service';
import CourseModel from '../models/course.model';
import { redis } from '../utils/redis';
import courseRouter from '../routes/course.route';
import mongoose from 'mongoose';
import path from 'path';
import ejs from 'ejs';
import sendMail from '../utils/sendMail';
import NotificationModel from '../models/notification.model';
import axios from 'axios';

// upload course
export const uploadCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      console.log("controller")
      console.log(data)
      const thumbnail = data.thumbnail;
      if (thumbnail) {
        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
          folder: 'courses',
        });
        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }
      createCourse(data, res, next);
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// edit course
export const editCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      console.log(data)
      const thumbnail = data.thumbnail;

      if (thumbnail) {
        await cloudinary.v2.uploader.destroy(thumbnail.public_id);
        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
          folder: 'courses',
        });
        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }

      const courseId = req.params.id;
      const course = await CourseModel.findByIdAndUpdate(
        courseId,
        {
          $set: data,
        },
        { new: true }
      );

      res.status(201).json({
        success: true,
        course,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// get single course - without purchasing
export const getSingleCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;
      const isCacheExist = await redis.get(courseId);
      if (isCacheExist) {
        const course = JSON.parse(isCacheExist);
        res.status(200).json({
          succces: true,
          course,
        });
      } else {
        const course = await CourseModel.findById(req.params.id).select(
          '-courseData.videoUrl -courseData-suggestion -courseData.questions -courseData.links'
        );
        await redis.set(courseId, JSON.stringify(course));
        res.status(200).json({
          success: true,
          course,
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// get all courses - without purchasing
export const getAllCourses = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // const isCacheExist = await redis.get("allCourses");
      // if (isCacheExist) {
      //     const courses = JSON.parse(isCacheExist);
      //     res.status(200).json({
      //         succcess: true,
      //         courses
      //     })
      // }
      // else {
      //     const courses = await CourseModel.find().select("-courseData.videoUrl -courseData-suggestion -courseData.questions -courseData.links");
      //     await redis.set("allCourses", JSON.stringify(courses));
      //     res.status(200).json({
      //         success: true,
      //         courses
      //     })
      // }
      const courses = await CourseModel.find().select(
        '-courseData.videoUrl -courseData-suggestion -courseData.questions -courseData.links'
      );
      await redis.set('allCourses', JSON.stringify(courses));
      res.status(200).json({
        success: true,
        courses,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// get course content - only for valid user
export const getCourseByUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList = req.user?.courses;
      const courseId = req.params.id;

      const courseExist = userCourseList?.find(
        (course: any) => course._id.toString() === courseId
      );
      if (!courseExist) {
        return next(
          new ErrorHandler('You are not eligible to access this course', 400)
        );
      }
      const course = await CourseModel.findById(courseId);
      const content = course?.courseData;
      res.status(200).json({
        success: true,
        content,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// add question in course
interface IAddQuestionData {
  question: string;
  courseId: string;
  contentId: string;
}
export const addQuestion = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, courseId, contentId }: IAddQuestionData = req.body;

      const course = await CourseModel.findById(courseId);
      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler('Invalid content id', 400));
      }

      const courseContent = course?.courseData.find((item: any) =>
        item._id.equals(contentId)
      );
      if (!courseContent) {
        return next(new ErrorHandler('Invalid content id', 400));
      }

      // create new question
      const newQuestion: any = {
        user: req.user,
        question,
        questionReplies: [],
      };

      // add question to course
      courseContent.questions.push(newQuestion);

      // notify
      await NotificationModel.create({
        user: req.user?._id,
        title: 'New Question Received',
        message: `You have a new question in ${courseContent.title}`,
      });

      // save update
      await course?.save();

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// add answer in course question
interface IAddAnswerData {
  answer: string;
  courseId: string;
  contentId: string;
  questionId: string;
}

export const addAnswer = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answer, courseId, contentId, questionId }: IAddAnswerData =
        req.body;

      const course = await CourseModel.findById(courseId);
      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler('Invalid content id', 400));
      }

      const courseContent = course?.courseData.find((item: any) =>
        item._id.equals(contentId)
      );
      if (!courseContent) {
        return next(new ErrorHandler('Invalid content id', 400));
      }

      const question = courseContent?.questions?.find((item: any) =>
        item._id.equals(questionId)
      );
      if (!question) {
        return next(new ErrorHandler('Invalid question id', 400));
      }

      // create new answer
      const newAnswer: any = {
        user: req.user,
        answer,
        createAt: new Date().toISOString(),
        updateAt: new Date().toISOString(),
      };
      // add answer to course content
      question.questionReplies.push(newAnswer);

      await course?.save();

      if (req.user?._id === question.user._id) {
        // notify
        await NotificationModel.create({
          user: req.user?._id,
          title: 'New Question Reply Received',
          message: `You have a new question reply in ${courseContent.title}`,
        });
      } else {
        const data = {
          name: question.user.name,
          title: courseContent.title,
        };
        const html = await ejs.renderFile(
          path.join(__dirname, '../mails/question-reply.ejs'),
          data
        );
        try {
          await sendMail({
            email: question.user.email,
            subject: 'Question Reply',
            template: 'question-reply.ejs',
            data,
          });
        } catch (error) {
          return next(new ErrorHandler(error.message, 400));
        }
      }

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// add review in course
interface IAddReviewData {
  review: string;
  rating: number;
  userId: string;
}
export const addReview = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList = req.user?.courses;
      const courseId = req.params.id;

      // check if courseId exist in userCourseList
      const courseExist = userCourseList?.some(
        (course: any) => course._id.toString() == courseId.toString()
      );
      if (!courseExist) {
        return next(
          new ErrorHandler('You are not eligible for this course', 400)
        );
      }

      const course = await CourseModel.findById(courseId);
      const { review, rating } = req.body as IAddReviewData;
      const reviewData: any = {
        user: req.user,
        comment: review,
        rating,
      };
      course?.reviews.push(reviewData);

      let avg = 0;
      course?.reviews.forEach((rev: any) => {
        avg += rev.rating;
      });

      if (course) {
        course.ratings = avg / course?.reviews.length;
      }

      await course?.save();

      await redis.set(courseId, JSON.stringify(course), 'EX', 604800); //7 days

      // create notification
      await NotificationModel.create({
        user: req.user?._id,
        title: 'New review received',
        message: `${req.user.name} has given a review in ${course?.name}`,
      });

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// add reply in review
interface IAddReviewReply {
  comment: string;
  courseId: string;
  reviewId: string;
}
export const addReplyToReview = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { comment, courseId, reviewId } = req.body as IAddReviewReply;

      const course = await CourseModel.findById(courseId);
      if (!courseId) {
        return next(new ErrorHandler('Course not found', 400));
      }

      const review = course?.reviews?.find(
        (rev: any) => rev._id.toString() === reviewId
      );
      if (!review) {
        return next(new ErrorHandler('Review not found', 400));
      }

      const replyData: any = {
        user: req.user,
        comment,
        createAt: new Date().toISOString(),
        updateAt: new Date().toISOString(),
      };

      if (!review.commentReplies) {
        review.commentReplies = [];
      }
      review.commentReplies?.push(replyData);
      await course?.save();
      await redis.set(courseId, JSON.stringify(course), 'EX', 604800); // 7days
      res.status(200).json({
        success: true,
        course,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// get all courses - only for admin
export const getAllCoursesAdmin = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllCoursesService(res);
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// delete course - only for admin
export const deleteCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const course = await CourseModel.findById(id);
      if (!course) {
        return next(new ErrorHandler('Course not found', 400));
      }
      await course.deleteOne({ id });
      await redis.del(id);
      res.status(200).json({
        success: true,
        message: 'Course deleted successfully',
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// generate viedo url
export const generateVideoUrl = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { videoId } = req.body;
      const response = await axios.post(
        `https://dev.vdocipher.com/api/videos/${videoId}/otp`,
        { ttl: 300 },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Apisecret ${process.env.VDOCIPHER_API_KEY}`,
          },
        }
      );
      res.json(response.data);
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
