const Product = require('../models/product');
const Order = require('../models/order');
const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit');

exports.getProducts = (req, res, next) => {
  Product.find()
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'All Products',
        path: '/products'
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
        path: '/products'
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  Product.find()
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/'
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
        products: products
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

exports.postOrder = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          name: req.user.name,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      req.user.clearCart();
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
        orders: orders
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
        .text(`Invoice Number: 555`, 50, 220)
        .moveDown()
        .text(`Invoice Date: ${formatDate(new Date())}`, 50, 245)
        .moveDown()
        .font('Helvetica-Bold')
        .text(`Order Total: ${formatCurrency(totalPrice)}`, 50, 270)

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
          product.product.price,
          subtotal
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

      function formatDate(date) {
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        return year + '/' + month + '/' + day;
      }

      function formatCurrency(cents) {
        return '$' + cents.toFixed(2);
      }
    })
    .catch(err => {
      console.log(err);
    });
};
