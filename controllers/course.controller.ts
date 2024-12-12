import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../middleware/catchAsyncError';
import ErrorHandler from '../utils/ErrorHandler';
import cloudinary from 'cloudinary';
import { createCourse, getAllCoursesService } from '../services/course.service';
import CourseModel from '../models/course.model';
import { redis } from '../utils/redis';
import mongoose from 'mongoose';
import path from 'path';
import ejs from 'ejs';
import sendMail from '../utils/sendMail';
import NotificationModel from '../models/notification.model';
import axios from 'axios';
import { IQuiz, IQuizSection } from '../models/course.model';
import fs from 'fs';
import mammoth from 'mammoth';
import progressModel from '../models/progress.model';

// upload course
export const uploadCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
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
      const sectionMap = new Map();
 
      data.courseContent.forEach((video) => {
        const section = video.videoSection;
        if (!sectionMap.has(section)) {
          sectionMap.set(section, []);
        }
        sectionMap.get(section).push(video);
      });

 
      sectionMap.forEach((videos) => {
        let timeQuizSection = 0;
        videos.forEach((video, index) => {
          if (video.timeQuizSection > 0) {
            timeQuizSection = video.timeQuizSection;
          }
          if (index !== videos.length - 1) {
            video.quizSection = [];
          } else {
            video.timeQuizSection = timeQuizSection;
          }
        });
      });
      data.courseContent = Array.from(sectionMap.values()).flat();
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
      const thumbnail = data.thumbnail;
 
      if (thumbnail) {
        if (thumbnail.public_id) {
          await cloudinary.v2.uploader.destroy(thumbnail.public_id);
          if (!thumbnail.url) {
            const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
              folder: 'courses',
            });
            data.thumbnail = {
              public_id: myCloud.public_id,
              url: myCloud.secure_url,
            };
          }
        } else {
          const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
            folder: 'courses',
          });
          data.thumbnail = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        }
      }
      const sectionMap = new Map();
 
      data.courseContent.forEach((video) => {
        const section = video.videoSection;
        if (!sectionMap.has(section)) {
          sectionMap.set(section, []);
        }
        sectionMap.get(section).push(video);
      });
 
      sectionMap.forEach((videos) => {
        let timeQuizSection = 0;
        videos.forEach((video, index) => {
          if (video.timeQuizSection > 0) {
            timeQuizSection = video.timeQuizSection;
          }
          if (index !== videos.length - 1) {
            video.quizSection = [];
          } else {
            video.timeQuizSection = timeQuizSection;
          }
        });
      });
      data.courseContent = Array.from(sectionMap.values()).flat();
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
      // const cachedCourse = await redis.get(courseId);
      // if (cachedCourse) {
      //   const course = JSON.parse(cachedCourse);
      //   return res.status(200).json({
      //     success: true,
      //     course,
      //   });
      // }

      const course = await CourseModel.findById(courseId)
        .select('-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links');

      if (!course) {
        return next(new ErrorHandler('Course not found', 404));
      }

      await redis.set(courseId, JSON.stringify(course), 'EX', 3600); // Thêm thời gian hết hạn (1 giờ)

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message || 'Internal Server Error', 500));
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
        (course: any) => course.courseId.toString() === courseId
      );
      if (!courseExist) {
        return next(
          new ErrorHandler('You are not eligible to access this course', 400)
        );
      }
      const course = await CourseModel.findById(courseId);
      const content = course?.courseContent;
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
      console.log(course);
      console.log(question, courseId, contentId);
      const courseContent = course?.courseContent.find((item: any) =>
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

      const courseContent = course?.courseContent.find((item: any) =>
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

      if (req.user?._id.toString() === question.user._id.toString()) {
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
      console.log(req.user?.courses);
      console.log(req.params.id);
      const userCourseList = req.user?.courses;
      const courseId = req.params.id;
      const userId = req.user?._id;
 
      // check if courseId exist in userCourseList
      const courseExist = userCourseList?.some(
        (course: any) => course.courseId == courseId
      );
      if (!courseExist) {
        return next(
          new ErrorHandler('You are not eligible for this course', 400)
        );
      }
 
      const course = await CourseModel.findById(courseId);
      const { review, rating } = req.body as IAddReviewData;

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

      if (!isCourseComplete) {
          return next(new ErrorHandler('You must complete course first before review', 400));
      }

      const isReviewExist = course?.reviews?.some(
        (rev: any) => rev.user._id.toString() === userId
      )
      if (isReviewExist) {
        return next(new ErrorHandler('You have already reviewed this course', 400));
      }

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
        reviews: course.reviews,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const getReviewInCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId } = req.params;
      const course = await CourseModel.findById(courseId);
      res.status(200).json({
        success: true,
        review: course.reviews,
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

// thêm quiz
interface IAddQuiz {
  courseId: string;
  contentId: string;
  time: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

export const addQuiz = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, contentId, time, question, options, correctAnswer } =
        req.body as IAddQuiz;

      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler('Course not found', 400));
      }

      const content = course?.courseContent?.find(
        (item: any) => item._id.toString() === contentId);

      if (!content) {
        return next(new ErrorHandler('Content not found', 400));
      }

      const newQuiz = {
        time,
        question,
        options,
        correctAnswer,
      } as IQuiz;

      content?.quiz?.push(newQuiz);
      await course?.save();
      await redis.set(courseId, JSON.stringify(course), 'EX', 604800); // 7days
      res.status(200).json({
        success: true,
        course,
      })
    }
    catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// lấy ngôn ngữ từ khoá học
export const getLanguage = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler('Course not found', 400));
      }
      res.status(200).json({
        success: true,
        "language": course?.language,
      })
    }
    catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
)

// đọc file, trả về mảng các câu hỏi như IQuizSection
// viết thêm 1 hàm trộn, 1 route trộn
// Hàm xử lý nội dung file và chuyển đổi thành câu hỏi
const parseQuestions = (content) => {
  if (!content || typeof content !== "string") {
    throw new Error("Nội dung không hợp lệ.");
  }

  const lines = content.split("\n");
  const questions = [];
  let currentQuestion: any = null;

  lines.forEach((line) => {
    line = line.trim();
    if (line.startsWith("Câu ")) {
      if (currentQuestion) questions.push(currentQuestion); // Lưu câu hỏi trước
      currentQuestion = { question: line.split(": ")[1], options: [], correctAnswer: null };
    } else if (line.endsWith("(True)")) {
      const answer = line.replace("(True)", "").trim();
      currentQuestion.options.push(answer);
      currentQuestion.correctAnswer = currentQuestion.options.length - 1;
    } else if (line) {
      currentQuestion.options.push(line);
    }
  });

  if (currentQuestion) questions.push(currentQuestion); // Thêm câu hỏi cuối cùng
  return questions;
};

const shuffle = (quizSection: IQuizSection[]): IQuizSection[] => {
  return quizSection.map((question) => {
    const { options, correctAnswer } = question;

    // Tạo mảng các chỉ số [0, 1, 2, ...] tương ứng với các câu trả lời
    const indices = options.map((_, index) => index);

    // Tráo trộn chỉ số bằng cách sử dụng thuật toán Fisher-Yates
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Sắp xếp lại câu trả lời theo chỉ số đã tráo
    const shuffledOptions = indices.map((i) => options[i]);

    // Tìm chỉ số mới của đáp án đúng
    const newCorrectAnswer = indices.indexOf(correctAnswer);

    return {
      ...question,
      options: shuffledOptions,
      correctAnswer: newCorrectAnswer,
    };
  });
};

const shuffleArray = (array: any[]): any[] => {
  const shuffled = [...array]; // Tạo một bản sao để không làm thay đổi mảng gốc
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1)); // Chọn ngẫu nhiên một chỉ số từ 0 đến i
    // Hoán đổi phần tử hiện tại với phần tử tại randomIndex
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }
  return shuffled;
};

// Controller để xử lý tệp upload
export const reviewQuiz = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có tệp nào được tải lên." });
    }
    const filePath = req.file.path;
 
    // Đọc nội dung văn bản từ tệp bằng Mammoth
    const result = await mammoth.extractRawText({ path: filePath });
 
    if (!result || !result.value) {
      throw new Error("Không thể đọc nội dung từ tệp.");
    }
 
    const data = result.value; // Văn bản thuần từ tệp
    // console.log("Extracted Content:", data); // Debug nội dung trích xuất
 
    // Chuyển đổi nội dung thành danh sách câu hỏi
    const questions = parseQuestions(data);
 
    // Xóa file tạm sau khi xử lý
    fs.unlinkSync(filePath);
 
    // Trả về danh sách câu hỏi
    return res.status(200).json(questions);
  } catch (error) {
    console.error("Error processing file:", error.message);
 
    // Nếu file tồn tại, hãy xóa file để dọn dẹp
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
 
    return res.status(400).json({ message: "Error processing file", error: error.message });
  }
};

// shuffle in database
export const shuffleQuizInDatabase = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {courseId, contentId} = req.body;
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler('Course not found', 400));
      }

      const content = course.courseContent.find((item: any) => item._id.toString() === contentId);
      if (!content) {
        return next(new ErrorHandler('Content not found', 400));
      }

      if (content.quizSection) {
        content.quizSection = shuffle(content.quizSection)
        content.quizSection = shuffleArray(content.quizSection)
      }
      await course.save();

      res.status(200).json({
        'success': true,
        content
      })
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
})

export const shuffleQuestion = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const shuffleData = shuffle(data);

      res.status(200).json({
        'success': true,
        shuffleData
      })
      }
    catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
})

export const shuffleQuiz = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {data} = req.body;
    let shuffleData = shuffle(data);
    shuffleData = shuffleArray(shuffleData);

    res.status(200).json({
      'success': true,
      shuffleData
    })
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
})