import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../middleware/catchAsyncError';
import ErrorHandler from '../utils/ErrorHandler';
import LayoutModel from '../models/layout.model';
import cloudinary from 'cloudinary';

// create layout
export const createLayout = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.body;
      const isTypeExist = await LayoutModel.findOne({ type });
      if (isTypeExist) {
        return next(new ErrorHandler(`${type} already exist`, 400));
      }
      if (type === 'Banner') {
        const { image, title, subTitle } = req.body;
        const myCloud = await cloudinary.v2.uploader.upload(image, {
          folder: 'layout',
        });
        const banner = {
          image: {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          },
          title,
          subTitle,
        };
        await LayoutModel.create(banner);
      }

      if (type === 'FAQ') {
        const { faq } = req.body;
        const faqItems = await Promise.all(
          faq.map(async (item: any) => {
            return {
              question: item.question,
              answer: item.answer,
            };
          })
        );
        await LayoutModel.create({ type: 'FAQ', faq: faqItems });
      }

      if (type === 'Categories') {
        const { categories } = req.body;
        const categoriesItems = await Promise.all(
          categories.map(async (item: any) => {
            return {
              title: item.title,
            };
          })
        );
        await LayoutModel.create({
          type: 'Categories',
          categories: categoriesItems,
        });
      }

      res.status(200).json({
        success: true,
        message: 'Layout created successfully',
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// edit layout
export const editLayout = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.body;
      if (type === 'Banner') {
        const bannerData: any = await LayoutModel.findOne({ type: 'Banner' });
        const { image, title, subTitle } = req.body;
        if (bannerData && bannerData.image) {
          await cloudinary.v2.uploader.destroy(bannerData.image.public_id);
        }
        const myCloud = await cloudinary.v2.uploader
          .upload(image, {
            folder: 'layout',
          })
          .catch((err) => {
            console.error('Cloudinary Upload Error:', err);
            throw new Error('Cloudinary upload failed');
          });
        const banner = {
          image: {
            public_id: myCloud?.public_id,
            url: myCloud?.secure_url,
          },
          title,
          subTitle,
        };
        if (bannerData) {
          await LayoutModel.findByIdAndUpdate(bannerData._id, { banner });
        } else {
          await LayoutModel.create({ type: 'Banner', banner });
        }
      }

      if (type === 'FAQ') {
        const { faq } = req.body;
        const faqItem = await LayoutModel.findOne({ type: 'FAQ' });
        const duplicateFAQ = new Set(faq.map((item: any) => item.question.toLowerCase()));
        if (duplicateFAQ.size !== faq.length) {
          return next(new ErrorHandler('FAQ already exist', 400));
        }
        const faqItems = await Promise.all(
          faq.map(async (item: any) => {
            return {
              question: item.question,
              answer: item.answer,
            };
          })
        );
        await LayoutModel.findByIdAndUpdate(faqItem?._id, {
          type: 'FAQ',
          faq: faqItems,
        });
      }

      if (type === 'Categories') {
        const { categories } = req.body;
        const categoriesItem = await LayoutModel.findOne({
          type: 'Categories',
        });
        const duplicateCategories = new Set(categories.map((item: any) => item.title.toLowerCase()));
        if (duplicateCategories.size !== categories.length) {
          return next(new ErrorHandler('Category already exist', 400));
        }
        const categoriesItems = await Promise.all(
          categories.map(async (item: any) => {
            return {
              title: item.title,
            };
          })
        );
        await LayoutModel.findByIdAndUpdate(categoriesItem?._id, {
          type: 'Categories',
          categories: categoriesItems,
        });
      }

      res.status(200).json({
        success: true,
        message: 'Layout updated successfully',
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// get layout by type
export const getLayoutByType = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = req.params.type;
      console.log("type: " + type);
      const layout = await LayoutModel.findOne({ type });
      res.status(201).json({
        succces: true,
        layout,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
export const getAll = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.body;
      const layout = await LayoutModel.find();
      res.status(201).json({
        succces: true,
        layout,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
