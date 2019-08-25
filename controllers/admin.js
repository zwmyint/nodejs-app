const fileHelper = require('../util/file');
const { validationResult } = require('express-validator');
const Product = require('../models/product');
const User = require('../models/user');
const ejs_helpers = require('../util/helpers');
require('dotenv').config();

const cloudinary = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_USER,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY
});

exports.getAddProduct = (req, res, next) => {
  res.render('admin/edit-product', {
    pageTitle: 'Add Product',
    path: '/admin/add-product',
    editing: false,
    hasError: false,
    error: null,
    validationErrors: []
  });
};

exports.postAddProduct = (req, res, next) => {
  const title = req.body.title;
  const image = req.file;
  const price = req.body.price;
  const description = req.body.description;
  if (!image) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      hasError: true,
      product: {
        title: title,
        price: price,
        description: description
      },
      error: 'Attached file is not an image.',
      validationErrors: []
    });
  }
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      hasError: true,
      product: {
        title: title,
        price: price,
        description: description
      },
      error: errors.array()[0].msg,
      validationErrors: errors.array()
    });
  }

  const tempImage = image.path;

  cloudinary.v2.uploader.upload(tempImage, { folder: 'shop' }, function(
    error,
    result
  ) {
    // console.log(result, error);
    const cloudImage = result.secure_url;
    const cloudImageId = result.public_id;

    //Delete temp Image
    fileHelper.deleteFile(tempImage);

    const product = new Product({
      title: title,
      price: price,
      description: description,
      imageUrl: cloudImage,
      imageId: cloudImageId,
      userId: req.user
    });
    product
      .save()
      .then(result => {
        console.log('Created Product');
        res.redirect('/admin/products');
      })
      .catch(err => {
        return res.status(500).render('admin/edit-product', {
          pageTitle: 'Add Product',
          path: '/admin/add-product',
          editing: false,
          hasError: true,
          product: {
            title: title,
            imageUrl: imageUrl,
            price: price,
            description: description
          },
          error: 'Database operation failed, please try again.',
          validationErrors: []
        });
      });
  });
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit;
  if (!editMode) {
    return res.redirect('/');
  }
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      if (!product) {
        return res.redirect('/');
      }
      res.render('admin/edit-product', {
        pageTitle: 'Edit Product',
        path: '/admin/edit-product',
        editing: editMode,
        product: product,
        hasError: false,
        error: null,
        validationErrors: []
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postEditProduct = (req, res, next) => {
  const prodId = req.body.productId;
  const updatedTitle = req.body.title;
  const updatedPrice = req.body.price;
  const image = req.file;
  const updatedDesc = req.body.description;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Edit Product',
      path: '/admin/edit-product',
      editing: true,
      hasError: true,
      product: {
        title: updatedTitle,
        price: updatedPrice,
        description: updatedDesc,
        _id: prodId
      },
      error: errors.array()[0].msg,
      validationErrors: errors.array()
    });
  }

  Product.findById(prodId)
    .then(product => {
      if (product.userId.toString() !== req.user._id.toString()) {
        return res.redirect('/');
      }
      product.title = updatedTitle;
      product.price = updatedPrice;
      product.description = updatedDesc;
      if (image) {
        //Destroy old image.
        cloudinary.v2.uploader.destroy(product.imageId, function(
          error,
          result
        ) {
          console.log(result, error);
        });

        //upload image to temp folder
        const tempImage = image.path;

        //upload image to cloudinary
        cloudinary.v2.uploader.upload(tempImage, { folder: 'shop' }, function(
          error,
          result
        ) {
          // console.log(result, error);
          const cloudImage = result.secure_url;
          const cloudImageId = result.public_id;

          //delete the image from temp folder
          fileHelper.deleteFile(tempImage);

          //assign new image to cloudImage
          product.imageUrl = cloudImage;
          product.imageId = cloudImageId;

          return product.save().then(result => {
            console.log('UPDATED PRODUCT!');
            res.redirect('/admin/products');
          });
        });
      }
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProducts = (req, res, next) => {
  Product.find({ userId: req.user._id })

    .then(products => {
      res.render('admin/products', {
        prods: products,
        pageTitle: 'Admin Products',
        path: '/admin/products',
        helpers: ejs_helpers
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.deleteProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      if (!product) {
        return next(new Error('Product not found.'));
      }

      return Product.deleteOne({ _id: prodId, userId: req.user._id }).then(
        () => {
          // Delete the product image from the server

          cloudinary.v2.uploader.destroy(product.imageId, function(
            error,
            result
          ) {
            console.log(result, error);
          });

          // Delete the product from every users cart
          User.find({}, (err, users) => {
            users.forEach(user => {
              user.removeFromCart(prodId);
            });
          });
        }
      );
    })
    .then(() => {
      console.log('DESTROYED PRODUCT');
      res.status(200).json({ message: 'Success!' });
    })
    .catch(err => {
      res.status(500).json({ message: 'Deleting product failed.' });
    });
};
