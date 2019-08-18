const fs = require('fs');
const path = require('path');

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const ejs_helpers = require('../util/helpers');
const PDFDocument = require('pdfkit');
const formatDate = require('date-fns/format');

const Product = require('../models/product');
const Order = require('../models/order');

const ITEMS_PER_PAGE = 3;

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;
  Product.find()
    .countDocuments()
    .then(numProducts => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then(products => {
      console.log(products);
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'All Products',
        path: '/products',
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
        helpers: ejs_helpers
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products',
        helpers: ejs_helpers
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then(numProducts => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
        helpers: ejs_helpers
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products,
        helpers: ejs_helpers
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      console.log(result);
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(result => {
      console.log('Cart Deleted!');
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckout = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      let total = 0;
      products.forEach(p => {
        total += p.quantity * p.productId.price;
      });
      res.render('shop/checkout', {
        path: '/checkout',
        pageTitle: 'Checkout',
        products: products,
        totalSum: total,
        helpers: ejs_helpers,
        STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postOrder = (req, res, next) => {
  const token = req.body.stripeToken;
  let totalSum = 0;

  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      user.cart.items.forEach(p => {
        totalSum += p.quantity * p.productId.price;
      });

      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          name: req.user.name,
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      const charge = stripe.charges.create({
        amount: Math.round(totalSum.toFixed(2) * 100),
        currency: 'usd',
        description: 'Order charge',
        source: token,
        metadata: { order_id: result._id.toString() }
      });
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders,
        helpers: ejs_helpers,
        formatDate: formatDate
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then(order => {
      if (!order) {
        return next(new Error('No order found.'));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('Unauthorized'));
      }
      const invoiceName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('data', 'invoices', invoiceName);

      const pdfDoc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + invoiceName + '"'
      );
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);

      pdfDoc
        .image('util/logo.png', 50, 45, { width: 50 })
        .fillColor('#444444')
        .fontSize(20)
        .text('ACME Inc.', 110, 57)
        .fontSize(10)
        .text('ACME Inc.', 200, 50, { align: 'right' })
        .text('123 Main Street', 200, 65, { align: 'right' })
        .text('New York, NY, 10025', 200, 80, { align: 'right' })
        .moveDown();

      pdfDoc
        .fillColor('#444444')
        .fontSize(20)
        .text('Invoice', 50, 160);

      pdfDoc
        .strokeColor('#aaaaaa')
        .lineWidth(1)
        .moveTo(50, 200)
        .lineTo(550, 200)
        .stroke();

      let totalPrice = 0;
      order.products.forEach(prod => {
        totalPrice += prod.quantity * prod.product.price;
      });

      pdfDoc
        .fontSize(12)
        .text(`Invoice Number: ${ejs_helpers.sliceStr(order._id)}`, 50, 220)
        .moveDown()
        .text(
          `Invoice Date: ${formatDate(
            new Date(order.createdAt),
            'MMM DD, YYYY'
          )}`,
          50,
          245
        )
        .moveDown()
        .font('Helvetica-Bold')
        .text(`Order Total: ${ejs_helpers.currencyFormat(totalPrice)}`, 50, 270)

        .text(`Customer: ${order.user.name}`, 300, 220)
        .moveDown()
        .moveDown()
        .moveDown()
        .moveDown();

      pdfDoc
        .strokeColor('#aaaaaa')
        .lineWidth(1)
        .moveTo(50, 300)
        .lineTo(550, 300)
        .stroke()
        .moveDown()
        .moveDown()
        .moveDown();

      let i;
      const invoiceTableTop = 330;

      function generateTableRow(
        pdfDoc,
        y,
        title,
        quantity,
        unitCost,
        lineTotal
      ) {
        pdfDoc
          .fontSize(10)
          .text(title, 50, y)
          .text(quantity, 280, y, { width: 90, align: 'right' })
          .text(unitCost, 370, y, { width: 90, align: 'right' })
          .text(lineTotal, 0, y, { align: 'right' });
      }

      pdfDoc.font('Helvetica-Bold');
      generateTableRow(
        pdfDoc,
        invoiceTableTop,
        'Title',
        'Quantity',
        'Unit Cost',
        'Line Total'
      );

      pdfDoc.font('Helvetica').moveDown();

      for (i = 0; i < order.products.length; i++) {
        const product = order.products[i];
        let subtotal = product.quantity * product.product.price;
        const position = invoiceTableTop + (i + 1) * 30;
        generateTableRow(
          pdfDoc,
          position,
          product.product.title,
          product.quantity,
          ejs_helpers.currencyFormat(product.product.price),
          ejs_helpers.currencyFormat(subtotal)
        );
      }
      pdfDoc
        .strokeColor('#aaaaaa')
        .lineWidth(1)
        .moveTo(50, 500)
        .lineTo(550, 500)
        .stroke();
      pdfDoc
        .fontSize(10)
        .text(
          'Payment is due within 15 days. Thank you for your business.',
          50,
          680,
          { align: 'center', width: 500 }
        );
      pdfDoc.end();
    })
    .catch(err => {
      console.log(err);
    });
};
