import express from "express";
import { addAnswer, addQuestion, addQuiz, addReplyToReview, addReview, deleteCourse, editCourse, generateVideoUrl, getAllCourses, getAllCoursesAdmin, getCourseByUser, getLanguage, getReviewInCourse, getSingleCourse, reviewQuiz, shuffleQuestion, shuffleQuiz, uploadCourse } from "../controllers/course.controller";
import { authorizeRoles, isAutheticated } from "../middleware/auth";
import { updateAccessToken } from "../controllers/user.controller";
const courseRouter = express.Router();
import multer from "multer";

courseRouter.post('/create-course', updateAccessToken, isAutheticated, authorizeRoles("admin"), uploadCourse);

courseRouter.put('/edit-course/:id', updateAccessToken, isAutheticated, authorizeRoles("admin"), editCourse);

courseRouter.get('/get-course/:id', getSingleCourse);

courseRouter.get('/get-courses', getAllCourses);

courseRouter.get('/get-course-content/:id', updateAccessToken, isAutheticated, getCourseByUser);

courseRouter.put('/add-question', updateAccessToken, isAutheticated, addQuestion);

courseRouter.put('/add-answer', updateAccessToken, isAutheticated, addAnswer);

courseRouter.put('/add-review/:id', updateAccessToken, isAutheticated, addReview);

courseRouter.put('/add-reply/', updateAccessToken, isAutheticated, authorizeRoles("admin"), addReplyToReview);

courseRouter.get('/get-all-courses-admin', updateAccessToken, isAutheticated, authorizeRoles("admin"), getAllCoursesAdmin);

courseRouter.delete('/delete-course/:id',updateAccessToken, isAutheticated, authorizeRoles("admin"), deleteCourse);

courseRouter.post('/getVdoCipherOTP', generateVideoUrl);

courseRouter.post('/add-quiz', updateAccessToken, isAutheticated, authorizeRoles("admin"), addQuiz);

courseRouter.get('/get-language/:id', updateAccessToken, getLanguage);

const upload = multer({ dest: "uploads/" });
courseRouter.post("/review-quiz", upload.single("file"), reviewQuiz);

courseRouter.post('/shuffle-question', shuffleQuestion);

courseRouter.post('/shuffle-quiz', shuffleQuiz);

courseRouter.get('/get-review/:courseId', getReviewInCourse);

export default courseRouter;