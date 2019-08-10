router.post(
  '/signup',
  [
    check('email')
      .isEmail()
      .withMessage('Please enter a valid email.')
      .custom((value, { req }) => {
        User.findOne({ email: value }).then(userDoc => {
          if (userDoc) {
            return Promise.reject(
              'Email already exists, please pick a different one.'
            );
          }
        });
      }),

    body(
      'password',
      'Please enter a password only with numbers and text and at least 6 characters'
    )
      .isLength({ min: 6 })
      .isAlphanumeric(),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords have to match!');
      }
      return true;
    })
  ],
  authController.postSignup
);
