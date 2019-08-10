const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
//sendgrid setup
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(
  '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'
);

const User = require('../models/user');

exports.getLogin = (req, res, next) => {
  res.render('auth/login', {
    path: '/login',
    pageTitle: 'Login',
    oldInput: {
      email: ''
    },
    validationErrors: []
  });
};
exports.getSignup = (req, res, next) => {
  res.render('auth/signup', {
    path: '/signup',
    pageTitle: 'Signup',
    oldInput: {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    },
    validationErrors: []
  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render('auth/login', {
      path: '/login',
      pageTitle: 'Login',
      error: errors.array()[0].msg,
      oldInput: {
        email: email
      },
      validationErrors: errors.array()
    });
  }

  User.findOne({ email: email }).then(user => {
    if (!user) {
      return res.status(422).render('auth/login', {
        path: '/login',
        pageTitle: 'Login',
        error: 'User not found.',
        oldInput: {
          email: email
        },
        validationErrors: [{ param: 'email', param: 'password' }]
      });
    }
    bcrypt
      .compare(password, user.password)
      .then(doMatch => {
        if (doMatch) {
          req.session.isLoggedIn = true;
          req.session.user = user;
          return req.session.save(err => {
            console.log(err);
            req.flash('success', 'Welcome back ' + req.session.user.name + '!');
            return res.redirect('/');
          });
        }
        return res.status(422).render('auth/login', {
          path: '/login',
          pageTitle: 'Login',
          error: 'Invalid email or password.',
          oldInput: {
            email: email
          },
          validationErrors: [{ param: 'email', param: 'password' }]
        });
      })
      .catch(err => {
        console.log(err);
        res.redirect('/login');
      });
  });
};

exports.postSignup = (req, res, ext) => {
  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render('auth/signup', {
      path: '/signup',
      pageTitle: 'Signup',
      error: errors.array()[0].msg,
      oldInput: {
        name: name,
        email: email,
        password: password,
        confirmPassword: req.body.confirmPassword
      },
      validationErrors: errors.array()
    });
  }
  bcrypt
    .hash(password, 12) //bcrypt to encrypt passwords
    .then(hashedPassword => {
      const user = new User({
        name: name,
        email: email,
        password: hashedPassword,
        cart: { items: [] }
      });
      return user.save();
    })
    .then(result => {
      req.flash('success', 'Welcome! Please Log in now.');
      res.redirect('/login');
      //send Sendgrid confirmation email
      const msg = {
        to: email,
        from: 'nodejs-app@gmail.com',
        subject: 'Test Mail',
        template_id: 'd-2a1513703a364b0b8a8d37c8c3cb209f'
      };
      sgMail.send(msg, function(error, response) {
        if (error) {
          console.log(error);
        }
      });
    })
    .catch(err => {
      console.log(err);
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy(err => {
    console.log(err);
    res.redirect('/');
  });
};

exports.getReset = (req, res, next) => {
  res.render('auth/reset', {
    path: '/reset',
    pageTitle: 'Reset Password'
  });
};

exports.postReset = (req, res, next) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
      return res.redirect('/reset');
    }
    const token = buffer.toString('hex');
    User.findOne({ email: req.body.email })
      .then(user => {
        if (!user) {
          req.flash('error', 'No account with that email found.');
          return res.redirect('/reset');
        }
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        return user.save();
      })
      .then(result => {
        req.flash(
          'success',
          'Please check your email to reset your password!.'
        );
        res.redirect('/');
        const msg = {
          to: req.body.email,
          from: 'nodejs-app@gmail.com',
          subject: 'Password Reset Link',
          //template_id: 'd-2a1513703a364b0b8a8d37c8c3cb209f'
          html: `
                <p>You requested a password reset.</p>
                <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password.</p>
                <p>This link will expire in 1 hour</p>
                `
        };
        sgMail.send(msg, function(error, response) {
          if (error) {
            console.log(error);
          }
        });
      })
      .catch(err => {
        console.log(err);
      });
  });
};

exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;
  User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } })
    .then(user => {
      res.render('auth/new-password', {
        path: '/new-password',
        pageTitle: 'New Password',
        userId: user._id.toString(),
        passwordToken: token
      });
    })
    .catch(err => {
      console.log(err);
    });
};

exports.postNewPassword = (req, res, next) => {
  if (req.body.password.length >= 6) {
    const newPassword = req.body.password;
    const userId = req.body.userId;
    const passwordToken = req.body.passwordToken;
    let resetUser;

    User.findOne({
      resetToken: passwordToken,
      resetTokenExpiration: { $gt: Date.now() },
      _id: userId
    })
      .then(user => {
        resetUser = user;
        return bcrypt.hash(newPassword, 12);
      })
      .then(hashedPassword => {
        resetUser.password = hashedPassword;
        resetUser.resetToken = undefined;
        resetUser.resetTokenExpiration = undefined;
        console.log(resetUser);
        return resetUser.save();
      })
      .then(result => {
        req.flash('success', 'Your password has been updated.');
        res.redirect('/login');
        //send Sendgrid confirmation email
        const msg = {
          to: resetUser.email,
          from: 'nodejs-app@gmail.com',
          subject: 'Password Updated!',
          //template_id: 'd-2a1513703a364b0b8a8d37c8c3cb209f'
          html: `
            <p>Your new password has been registered.</p>
            <p>Click this <a href="http://localhost:3000/login/">link</a> to log in now.</p>
            `
        };
        sgMail.send(msg, function(error, response) {
          if (error) {
            console.log(error);
          }
        });
      })
      .catch(err => {
        console.log(err);
      });
  } else {
    req.flash('error', 'Password must be at least 6 characters.');
    res.redirect('back');
  }
};
